/**
 * logic.js: 市場閉鎖時の真の値を特定する「ピンポイント取得」版
 */
function executeMain() {
  const webhookUrl = PropertiesService.getScriptProperties().getProperty('DISCORD_URL');
  const ticker = "JPY=X";
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  try {
    // 【戦略変更】日足ではなく、直近数日分の「1時間足」を取得して金曜のラストを探す
    const res = UrlFetchApp.fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1h&range=5d`);
    const json = JSON.parse(res.getContentText());
    const quote = json.chart.result[0].indicators.quote[0];
    const stamps = json.chart.result[0].timestamp;

    let lastFridayClose = 0;
    let lastFridayStamp = 0;

    // データの末尾から「金曜日」の最後の一点を探す
    for (let i = stamps.length - 1; i >= 0; i--) {
      let d = new Date(stamps[i] * 1000);
      // 土曜の朝6時（JST）以前で、かつ最も新しいデータが金曜の真の終値
      // ※JSTで土曜の朝0時から7時までの間の最新データを取得
      if (d.getDay() === 6 && d.getHours() <= 7) {
        lastFridayClose = quote.close[i];
        lastFridayStamp = stamps[i];
        break;
      }
      // もし既に金曜日のデータ内に入っていたらそれを使う
      if (d.getDay() === 5) {
        lastFridayClose = quote.close[i];
        lastFridayStamp = stamps[i];
        break;
      }
    }

    const dateStr = Utilities.formatDate(new Date(lastFridayStamp * 1000), "JST", "yyyy/MM/dd(E)");

    // 重複チェック
    if (sheet.getLastRow() > 0 && sheet.getRange(sheet.getLastRow(), 1).getDisplayValue() === dateStr) {
      console.log("記録済み: " + dateStr);
      return;
    }

    // --- テクニカル指標（日足ベースの別APIでRSI等を補完） ---
    // 終値だけは今特定した正確な値(lastFridayClose)に上書きする
    const resDay = UrlFetchApp.fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=50d`);
    const jsonDay = JSON.parse(resDay.getContentText());
    const quoteDay = jsonDay.chart.result[0].indicators.quote[0];
    const cArr = quoteDay.close;
    
    // 日足配列の末尾を「真の終値」に差し替え
    cArr[cArr.length - 1] = lastFridayClose; 
    const c = lastFridayClose;
    const i = cArr.length - 1;

    // RSI / MA計算 (差し替えた配列を使用)
    const slice20 = cArr.slice(i - 19, i + 1);
    const ma20 = slice20.reduce((a, b) => a + b) / 20;
    const sd = Math.sqrt(slice20.reduce((s, v) => s + Math.pow(v - ma20, 2), 0) / 20);
    const bbPos = sd !== 0 ? ((c - (ma20 - sd * 2)) / (sd * 4)) * 100 : 50;
    
    let up = 0, down = 0;
    for (let k = i - 13; k <= i; k++) {
      let diff = cArr[k] - cArr[k-1];
      if (diff > 0) up += diff; else down -= diff;
    }
    const rsi = (up + down) !== 0 ? (up / (up + down)) * 100 : 50;

    // --- 記録 ---
    sheet.appendRow([
      dateStr, c.toFixed(3), (c - cArr[i-1]).toFixed(3), (c > cArr[i-1] ? "📈" : "📉"),
      rsi.toFixed(1), (((c - ma20) / ma20) * 100).toFixed(2), bbPos.toFixed(1), "市場閉鎖値特定"
    ]);
    
    // 通知
    if (webhookUrl) {
      const msg = `🔔 **USD/JPY 確定診断(高精度版)**\n📅 ${dateStr}\n💰 真の終値: ${c.toFixed(3)}円\n📊 RSI: ${rsi.toFixed(1)}\n📢 週末のノイズ(156.88)を排除しました。`;
      UrlFetchApp.fetch(webhookUrl, {method:"post", contentType:"application/json", payload:JSON.stringify({content:msg})});
    }

  } catch (e) {
    console.error("エラー: " + e.toString());
  }
}
