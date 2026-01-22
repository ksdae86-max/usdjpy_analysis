/**
 * logic.js - [統合版]
 * 1. 24H決済監視 (MAタッチ・利確損切)
 * 2. 計算用最新20シートの自動メンテナンス (Queue形式)
 * 3. 朝9時限定の日次詳細ログ記録
 */
function executeMainLogic(params) {
  const { c, cArr, posSheet, logSheet, calcSheet, webhookUrl, now } = params;
  const currentPrice = parseFloat(c);

  // --- [1] 「計算用最新20」シートのメンテナンス ---
  // 常に最新20件の価格データを保持し、4H診断の精度を担保する
  if (calcSheet) {
    calcSheet.appendRow([currentPrice, Utilities.formatDate(now, "JST", "yyyy/MM/dd HH:mm")]);
    const lastRow = calcSheet.getLastRow();
    if (lastRow > 20) {
      calcSheet.deleteRow(1); // 21行目が入ったら最古の1行目を削除
    }
  }

  // --- [2] 決済監視ロジック (保有ポジションがある場合のみ実行) ---
  const posData = posSheet.getDataRange().getValues();
  let activePos = null;
  for (let i = 1; i < posData.length; i++) {
    if (!posData[i][3]) { // D列(決済)が空＝保有中
      activePos = { row: i + 1, entry: parseFloat(posData[i][0]), side: posData[i][1] };
      break;
    }
  }

  if (activePos) {
    const pips = (activePos.side === "L" ? (currentPrice - activePos.entry) : (activePos.entry - currentPrice)) * 100;
    let alertMsg = "";

    // 利確 +25pips / 損切 -15pips の目安通知
    if (pips > 25 || pips < -15) {
      alertMsg = `【損益通知】現在: ${pips.toFixed(1)} pips (${currentPrice.toFixed(3)})`;
    }

    // MA20タッチ監視 (cArrが20本以上ある場合)
    if (cArr && cArr.length >= 20) {
      const ma20 = cArr.slice(-20).reduce((a, b) => a + b, 0) / 20;
      if ((activePos.side === "L" && currentPrice < ma20) || (activePos.side === "S" && currentPrice > ma20)) {
        alertMsg = `【決済検討】MA20を価格がクロスしました。価格:${currentPrice.toFixed(3)} / MA:${ma20.toFixed(3)}`;
      }
    }
    if (alertMsg) sendDiscord(webhookUrl, alertMsg);
  }

  // --- [3] 朝9時限定：詳細データ記録 (日次分析用) ---
  if (now.getHours() === 9 && logSheet) {
    // cArrが不足している場合は計算をスキップ
    if (!cArr || cArr.length < 15) return;

    // RSI(14) 計算
    let ups = 0, downs = 0;
    const rsiPeriod = 14;
    for (let i = 0; i < rsiPeriod; i++) {
      const diff = cArr[cArr.length - 1 - i] - cArr[cArr.length - 2 - i];
      if (diff > 0) ups += diff; else downs -= diff;
    }
    const rsi = (ups / (ups + downs)) * 100;

    // BB / MA / 乖離計算 (20期間)
    const ma20 = cArr.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const stdDev = Math.sqrt(cArr.slice(-20).map(v => Math.pow(v - ma20, 2)).reduce((a, b) => a + b, 0) / 20);
    const sigmaPos = (currentPrice - ma20) / (stdDev || 0.001);
    const kairi = currentPrice - ma20;
    
    // 前日比 (cArrの最古データとの比較、または簡易的に最新-1個前)
    const diffDay = cArr.length >= 24 ? (currentPrice - cArr[cArr.length - 24]) : (currentPrice - cArr[0]);

    let signal = "様子見";
    if (sigmaPos > 1.8 || rsi > 75) signal = "売り検討";
    else if (sigmaPos < -1.8 || rsi < 25) signal = "買い検討";

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

/**
 * Discord通知用共通関数
 */
function sendDiscord(url, msg) {
  if (!url) return;
  try {
    UrlFetchApp.fetch(url, {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify({ "content": msg }),
      "muteHttpExceptions": true
    });
  } catch (e) { console.warn("Discord Send Error: " + e); }
}
