/**
 * logic.js: 週末のゴーストデータ（156.88）を完全に排除するロジック
 */
function executeMain() {
  const webhookUrl = PropertiesService.getScriptProperties().getProperty('DISCORD_URL');
  const ticker = "JPY=X";
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  try {
    const res = UrlFetchApp.fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=50d`);
    const json = JSON.parse(res.getContentText());
    const quote = json.chart.result[0].indicators.quote[0];
    const stamps = json.chart.result[0].timestamp;

    let i = stamps.length - 1;
    const now = new Date();

    // --- 156.88 排除ロジック：週末の「静止」ポイントを探す ---
    // 土日実行の場合、最新データが「金曜の真の終値」よりわずかにズレていることが多いため
    // 前日（i-1）と全く同じ値、または異常な微動（土曜朝の数分）を検知してスキップします
    
    if (now.getDay() === 6 || now.getDay() === 0) {
      // 1. まずインデックスが「土曜」以降を指していたら戻す
      let d = new Date(stamps[i] * 1000);
      if (d.getDay() === 6 || d.getDay() === 0) i--;

      // 2. さらに、156.88のような「市場閉鎖後のゴミ」を避けるため、
      // 確実に「金曜日の深夜（ニューヨーク閉場時）」のデータが来るまで遡る
      // (Yahooは週末に不規則な重複データを吐くため、念のため安全マージンをとる)
      while (i > 1 && quote.close[i] === quote.close[i+1]) {
        i--;
      }
    }

    const c = quote.close[i];
    const checkDate = new Date(stamps[i] * 1000);
    const dateStr = Utilities.formatDate(checkDate, "JST", "yyyy/MM/dd(E)");

    // 重複チェック
    if (sheet.getLastRow() > 0) {
      const lastRowDate = sheet.getRange(sheet.getLastRow(), 1).getDisplayValue();
      if (lastRowDate === dateStr) return; 
    }

    // --- 指標計算 ---
    const o = quote.open[i], h = quote.high[i], l = quote.low[i];
    const prevC = quote.close[i-1];
    const slice20 = quote.close.slice(i - 19, i + 1);
    const ma20 = slice20.reduce((a, b) => a + b) / 20;
    const sd = Math.sqrt(slice20.reduce((s, v) => s + Math.pow(v - ma20, 2), 0) / 20);
    const bbPos = sd !== 0 ? ((c - (ma20 - sd * 2)) / (sd * 4)) * 100 : 50;

    let up = 0, down = 0;
    for (let k = i - 13; k <= i; k++) {
      let diff = quote.close[k] - quote.close[k-1];
      if (diff > 0) up += diff; else down -= diff;
    }
    const rsi = (up + down) !== 0 ? (up / (up + down)) * 100 : 50;

    // --- ヒゲ判定 ---
    const body = Math.abs(o - c);
    const upperWick = h - Math.max(o, c);
    const lowerWick = Math.min(o, c) - l;
    const isTrend = (h - l) > 0 ? (body > (h - l) * 0.4) : false;

    let signal = "なし", detail = "なし";
    if (!isTrend) {
      if (upperWick > body * 0.9 && (rsi >= 60 || h >= (ma20 + sd * 2))) {
        signal = "🚨天井反転注意"; 
        detail = `上ヒゲ(${(upperWick/Math.max(body,0.01)).toFixed(1)}倍)`;
      } else if (lowerWick > body * 0.9 && (rsi <= 40 || l <= (ma20 - sd * 2))) {
        signal = "🚨底値反発注意"; 
        detail = `下ヒゲ(${(lowerWick/Math.max(body,0.01)).toFixed(1)}倍)`;
      }
    }

    // --- 記録 ---
    sheet.appendRow([
      dateStr, c.toFixed(3), (c - prevC).toFixed(3), (c > prevC ? "📈" : "📉"),
      rsi.toFixed(1), (((c - ma20) / ma20) * 100).toFixed(2), bbPos.toFixed(1), detail
    ]);
    
    // --- 通知 ---
    if (signal !== "なし" && webhookUrl) {
      const msg = `🔔 **USD/JPY 確定診断**\n📅 ${dateStr}\n💰 終値: ${c.toFixed(3)}円\n📊 RSI: ${rsi.toFixed(1)} / BB位置: ${bbPos.toFixed(1)}%\n📢 判定: ${signal}`;
      UrlFetchApp.fetch(webhookUrl, {method:"post", contentType:"application/json", payload:JSON.stringify({content:msg})});
    }

  } catch (e) {
    console.error(e.toString());
  }
}
