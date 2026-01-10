/**
 * logic.js - Final Evolution v10.1
 * 週末の156.88等のノイズを完全に封じ込め、日付とシグナルを正常化
 */
function executeMain() {
  const webhookUrl = PropertiesService.getScriptProperties().getProperty('DISCORD_URL');
  const ticker = "JPY=X";
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();

  try {
    // 1. 1時間足から「真の市場閉鎖値」を特定
    const resH = UrlFetchApp.fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1h&range=5d`);
    const jsonH = JSON.parse(resH.getContentText());
    const quoteH = jsonH.chart.result[0].indicators.quote[0];
    const stampsH = jsonH.chart.result[0].timestamp;

    let trueClose = null;
    let trueStamp = 0;

    // 最新から遡って「土曜朝7時以前の有効な値」を探す
    for (let i = stampsH.length - 1; i >= 0; i--) {
      let d = new Date(stampsH[i] * 1000);
      if ((d.getDay() === 6 && d.getHours() <= 7) || d.getDay() === 5) {
        if (quoteH.close[i] != null) {
          trueClose = quoteH.close[i];
          // 日付の正規化：土曜朝のデータなら金曜日に戻す
          let normalizedDate = new Date(stampsH[i] * 1000);
          if (normalizedDate.getDay() === 6) normalizedDate.setDate(normalizedDate.getDate() - 1);
          trueStamp = normalizedDate.getTime();
          break;
        }
      }
    }

    if (!trueClose) throw new Error("有効な価格が見つかりません");

    const dateStr = Utilities.formatDate(new Date(trueStamp), "JST", "yyyy/MM/dd(E)");

    // 重複チェック
    if (sheet.getLastRow() > 0 && sheet.getRange(sheet.getLastRow(), 1).getDisplayValue() === dateStr) {
      console.log("記録済みのためスキップ: " + dateStr);
      return;
    }

    // 2. 指標計算（日足ベースで補完）
    const resD = UrlFetchApp.fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=50d`);
    const jsonD = JSON.parse(resD.getContentText());
    const qD = jsonD.chart.result[0].indicators.quote[0];
    let cArr = qD.close.filter(v => v != null);
    
    // 最終値を特定した「真の終値」に差し替えて精度を100%に
    const c = trueClose;
    const o = qD.open[qD.open.length - 1];
    const h = qD.high[qD.high.length - 1];
    const l = qD.low[qD.low.length - 1];
    const prevC = cArr[cArr.length - 2];
    cArr[cArr.length - 1] = c;

    // MA(20) & BB(2σ)
    const slice20 = cArr.slice(-20);
    const ma20 = slice20.reduce((a, b) => a + b) / 20;
    const sd = Math.sqrt(slice20.reduce((s, v) => s + Math.pow(v - ma20, 2), 0) / 20);
    const bbPos = sd !== 0 ? ((c - (ma20 - sd * 2)) / (sd * 4)) * 100 : 50;

    // RSI(14)
    let up = 0, down = 0;
    for (let k = cArr.length - 14; k < cArr.length; k++) {
      let diff = cArr[k] - cArr[k-1];
      if (diff > 0) up += diff; else down -= diff;
    }
    const rsi = (up + down) !== 0 ? (up / (up + down)) * 100 : 50;

    // 3. ヒゲ・実体分析（シグナル正常化）
    const body = Math.abs(o - c);
    const upperWick = h - Math.max(o, c);
    const lowerWick = Math.min(o, c) - l;
    let signal = "なし", detail = "なし";

    if (body < (h - l) * 0.4) { // コマ足気味の場合のみヒゲ判定
      if (upperWick > body * 0.9 && rsi >= 60) {
        signal = "🚨天井反転注意";
        detail = `上ヒゲ(${(upperWick/Math.max(body,0.01)).toFixed(1)}倍)`;
      } else if (lowerWick > body * 0.9 && rsi <= 40) {
        signal = "🚨底値反発注意";
        detail = `下ヒゲ(${(lowerWick/Math.max(body,0.01)).toFixed(1)}倍)`;
      }
    }

    // 4. スプレッドシート記録
    const rowData = [
      dateStr, 
      c.toFixed(3), 
      (c - prevC).toFixed(3), 
      (c > prevC ? "📈" : "📉"),
      rsi.toFixed(1), 
      (((c - ma20) / ma20) * 100).toFixed(2), 
      bbPos.toFixed(1), 
      detail
    ];
    sheet.appendRow(rowData);

    // 5. 通知
    if (signal !== "なし" && webhookUrl) {
      const msg = `🔔 **USD/JPY 確定診断**\n📅 ${dateStr}\n💰 終値: ${c.toFixed(3)}円\n📊 RSI: ${rsi.toFixed(1)} / BB位置: ${bbPos.toFixed(1)}%\n📢 判定: ${signal}\n🔍 詳細: ${detail}`;
      UrlFetchApp.fetch(webhookUrl, {method: "post", contentType: "application/json", payload: JSON.stringify({content: msg})});
    }

  } catch (e) {
    console.error(e.toString());
  }
}
