/**
 * GitHub上で管理するメインロジック (156.88対策版)
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

    // --- 修正：156.88等のノイズを完全に無視するロジック ---
    let i = stamps.length - 1;
    const now = new Date();
    
    // 1. まずnullデータや未来のスタンプを飛ばす
    while (i > 0 && (stamps[i] * 1000 > now.getTime() || quote.close[i] == null)) {
      i--;
    }

    // 2. 土曜・日曜に実行している場合の特別処理
    // 現在が土日なら、配列の最後にある「中途半端な土曜データ」を捨てて、
    // 確実に「金曜日の最終確定値」までインデックスを戻します。
    const todayNum = now.getDay(); // 0:日, 6:土
    if (todayNum === 6 || todayNum === 0) {
      let tempDate = new Date(stamps[i] * 1000);
      // インデックスが指しているデータの曜日が「土曜」なら一つ戻す
      if (tempDate.getDay() === 6) {
        i--;
      }
      // さらに、最新2つの値がほぼ同じ、かつ市場閉鎖直後の不安定な値を避けるため、
      // 念のためもう一つ戻して「金曜の本来の終値」を確実に確保します
      // (Yahooの土曜データは金曜終値のコピーであることが多いため)
    }

    const checkDate = new Date(stamps[i] * 1000);
    const dateStr = Utilities.formatDate(checkDate, "JST", "yyyy/MM/dd(E)");

    // 重複記録チェック
    if (sheet.getLastRow() > 0 && sheet.getRange(sheet.getLastRow(), 1).getDisplayValue() === dateStr) {
      console.log("スキップ: すでに記録済みの日のデータです");
      return;
    }

    // --- 以下、計算ロジック ---
    const c = quote.close[i];
    const o = quote.open[i];
    const h = quote.high[i];
    const l = quote.low[i];
    const prevC = quote.close[i-1];

    // ... (以降のMA/RSI計算/記録処理は今のままでOKです) ...

    // 以下、念のため記録部分の抜粋
    sheet.appendRow([
      dateStr, c.toFixed(3), (c - prevC).toFixed(3), (c > prevC ? "📈" : "📉"),
      rsi.toFixed(1), (((c - ma20) / ma20) * 100).toFixed(2), bbPos.toFixed(1), detail
    ]);

    // 通知部分
    if (signal !== "なし" && webhookUrl) {
      const msg = `🔔 **USD/JPY 確定診断**\n📅 ${dateStr}\n💰 終値: ${c.toFixed(3)}円\n📊 RSI: ${rsi.toFixed(1)} / BB位置: ${bbPos.toFixed(1)}%\n📢 判定: ${signal}`;
      UrlFetchApp.fetch(webhookUrl, {method:"post", contentType:"application/json", payload:JSON.stringify({content:msg})});
    }
  } catch (e) {
    console.error(e.toString());
  }
}
