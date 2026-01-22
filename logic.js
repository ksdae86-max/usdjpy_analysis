/**
 * logic.js - [1h] 決済監視 ＆ 朝9時データ蓄積
 */
function executeMainLogic(params) {
  const { c, cArr, posSheet, logSheet, webhookUrl, now } = params;
  const currentPrice = parseFloat(c);

  // --- [1] 決済監視 (毎時実行) ---
  const posData = posSheet.getDataRange().getValues();
  let activePos = null;
  for (let i = 1; i < posData.length; i++) {
    if (!posData[i][3]) { // D列が未入力＝保有中
      activePos = { row: i + 1, entry: parseFloat(posData[i][0]), side: posData[i][1] };
      break;
    }
  }

  if (activePos) {
    const pips = (activePos.side === "L" ? (currentPrice - activePos.entry) : (activePos.entry - activePos.currentPrice)) * 100;
    let alertMsg = "";

    // A. 利益・損失の絶対値監視 (25pips / -15pips)
    if (pips > 25 || pips < -15) alertMsg = `【指値付近】損益: ${pips.toFixed(1)} pips (${currentPrice.toFixed(3)})`;

    // B. MA20タッチ監視 (出口シグナル)
    if (cArr && cArr.length >= 20) {
      const ma20 = cArr.slice(-20).reduce((a, b) => a + b, 0) / 20;
      if ((activePos.side === "L" && currentPrice < ma20) || (activePos.side === "S" && currentPrice > ma20)) {
        alertMsg = `【MA20タッチ】決済検討: 価格(${currentPrice.toFixed(3)})が平均をクロス。`;
      }
    }
    if (alertMsg) sendDiscord(webhookUrl, alertMsg);
  }

  // --- [2] 朝9時限定：詳細データ記録 (日次ログ) ---
  if (now.getHours() === 9 && logSheet) {
    if (!cArr || cArr.length < 24) return;

    // RSI(14) 精密計算
    const rsiPeriod = 14;
    let ups = 0, downs = 0;
    for (let i = 0; i < rsiPeriod; i++) {
      const diff = cArr[cArr.length - 1 - i] - cArr[cArr.length - 2 - i];
      if (diff > 0) ups += diff; else downs -= diff;
    }
    const rsi = (ups / (ups + downs)) * 100;

    // BB / MA / 乖離
    const ma20 = cArr.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const stdDev = Math.sqrt(cArr.slice(-20).map(v => Math.pow(v - ma20, 2)).reduce((a, b) => a + b, 0) / 20);
    const sigmaPos = (currentPrice - ma20) / stdDev;
    const kairi = currentPrice - ma20;
    const prevDayPrice = cArr[cArr.length - 24]; // 24時間前
    const diffDay = currentPrice - prevDayPrice;

    // 判定シグナル
    let signal = "様子見";
    if (sigmaPos > 2.0 || rsi > 70) signal = "売り検討";
    else if (sigmaPos < -2.0 || rsi < 30) signal = "買い検討";

    // 記録項目：日付、価格、前日比、トレンド、RSI、MA乖離、BB位置、シグナル
    logSheet.appendRow([
      Utilities.formatDate(now, "JST", "yyyy/MM/dd"),
      currentPrice.toFixed(3),
      (diffDay > 0 ? "+" : "") + diffDay.toFixed(3),
      sigmaPos > 0 ? "上昇" : "下落",
      rsi.toFixed(1),
      kairi.toFixed(3),
      sigmaPos.toFixed(2) + "σ",
      signal
    ]);
  }
}

function sendDiscord(url, msg) {
  if (!url) return;
  UrlFetchApp.fetch(url, { "method": "post", "contentType": "application/json", "payload": JSON.stringify({ "content": msg }), "muteHttpExceptions": true });
}
