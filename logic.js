/**
 * logic.js: nullエラー対策済み・高精度版
 */
function executeMain() {
  const webhookUrl = PropertiesService.getScriptProperties().getProperty('DISCORD_URL');
  const ticker = "JPY=X";
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  try {
    const res = UrlFetchApp.fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1h&range=5d`);
    const json = JSON.parse(res.getContentText());
    const quote = json.chart.result[0].indicators.quote[0];
    const stamps = json.chart.result[0].timestamp;

    let lastFridayClose = null;
    let lastFridayStamp = 0;

    // --- nullを避けて有効な最新値を特定 ---
    for (let i = stamps.length - 1; i >= 0; i--) {
      let d = new Date(stamps[i] * 1000);
      
      // 土曜朝7時以前、または金曜日のデータを探す
      if ((d.getDay() === 6 && d.getHours() <= 7) || d.getDay() === 5) {
        if (quote.close[i] !== null && quote.close[i] !== undefined) {
          lastFridayClose = quote.close[i];
          lastFridayStamp = stamps[i];
          break; 
        }
      }
    }

    // 万が一見つからなかった場合のガード
    if (lastFridayClose === null) throw new Error("有効な価格データが見つかりませんでした。");

    const dateStr = Utilities.formatDate(new Date(lastFridayStamp * 1000), "JST", "yyyy/MM/dd(E)");

    // 重複チェック
    if (sheet.getLastRow() > 0 && sheet.getRange(sheet.getLastRow(), 1).getDisplayValue() === dateStr) {
      return;
    }

    // --- 日足データで指標を補完 ---
    const resDay = UrlFetchApp.fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=50d`);
    const jsonDay = JSON.parse(resDay.getContentText());
    const quoteDay = jsonDay.chart.result[0].indicators.quote[0];
    let cArr = quoteDay.close.filter(v => v !== null); // nullを除去
    
    // 最新の終値を真の値に差し替え
    cArr[cArr.length - 1] = lastFridayClose; 
    const c = lastFridayClose;
    const i = cArr.length - 1;

    // MA / SD / BB位置
    const slice20 = cArr.slice(i - 19, i + 1);
    const ma20 = slice20.reduce((a, b) => a + b) / 20;
    const sd = Math.sqrt(slice20.reduce((s, v) => s + Math.pow(v - ma20, 2), 0) / 20);
    const bbPos = sd !== 0 ? ((c - (ma20 - sd * 2)) / (sd * 4)) * 100 : 50;
    
    // RSI
    let up = 0, down = 0;
    for (let k = i - 13; k <= i; k++) {
      let diff = cArr[k] - cArr[k-1];
      if (diff > 0) up += diff; else down -= diff;
    }
    const rsi = (up + down) !== 0 ? (up / (up + down)) * 100 : 50;

    // --- 記録 (toFixedの前に数値であることを再確認) ---
    sheet.appendRow([
      dateStr, 
      Number(c).toFixed(3), 
      Number(c - cArr[i-1]).toFixed(3), 
      (c > cArr[i-1] ? "📈" : "📉"),
      Number(rsi).toFixed(1), 
      Number(((c - ma20) / ma20) * 100).toFixed(2), 
      Number(bbPos).toFixed(1), 
      "金曜確定値特定版"
    ]);
    
    // 通知
    if (webhookUrl) {
      const msg = `🔔 **USD/JPY 確定診断**\n📅 ${dateStr}\n💰 真の終値: ${Number(c).toFixed(3)}円\n📊 RSI: ${Number(rsi).toFixed(1)}\n📢 週末ノイズ排除済み`;
      UrlFetchApp.fetch(webhookUrl, {method:"post", contentType:"application/json", payload:JSON.stringify({content:msg})});
    }

  } catch (e) {
    console.error("詳細エラー: " + e.toString());
  }
}
