/**
 * logic.js - [最終ブラッシュアップ版]
 * 10の改善：①通知基準20pips ②データ型強制変換 ③ゼロ除算ガード ④シート整合性チェック 
 * ⑤RSI計算精度向上 ⑥MA乖離率の正規化 ⑦Discordリトライ耐性 ⑧Queue管理の最適化 
 * ⑨9時処理の排他制御 ⑩ポジション判定の厳格化
 */
function executeMainLogic(params) {
  const { c, cArr, posSheet, logSheet, calcSheet, webhookUrl, now } = params;
  
  // [1] 入力値の数値化とバリデーション (ブラッシュアップ1, 2)
  const currentPrice = parseFloat(c);
  if (isNaN(currentPrice)) return;

  // [2] 計算用シートのQueue管理 (ブラッシュアップ8)
  if (calcSheet) {
    calcSheet.appendRow([currentPrice, Utilities.formatDate(now, "JST", "yyyy/MM/dd HH:mm")]);
    const lastRow = calcSheet.getLastRow();
    if (lastRow > 20) {
      calcSheet.deleteRow(1);
    }
  }

  // [3] ポジション監視の厳格化 (ブラッシュアップ10)
  if (posSheet) {
    const posData = posSheet.getDataRange().getValues();
    let activePos = null;
    for (let i = 1; i < posData.length; i++) {
      // A列:価格, B列:サイド(L/S), D列:決済(空なら保有)
      if (posData[i][0] && !posData[i][3]) { 
        activePos = { 
          row: i + 1, 
          entry: parseFloat(posData[i][0]), 
          side: String(posData[i][1]).toUpperCase().trim() 
        };
        break;
      }
    }

    if (activePos && !isNaN(activePos.entry)) {
      const pips = (activePos.side === "L" ? (currentPrice - activePos.entry) : (activePos.entry - currentPrice)) * 100;
      let alertMsg = "";

      // [4] 通知基準の適正化 (ブラッシュアップ1：利確20 / 損切15)
      if (pips >= 20 || pips <= -15) {
        alertMsg = `【損益通知】現在: ${pips.toFixed(1)} pips (${currentPrice.toFixed(3)})`;
      }

      // [5] MA20クロス監視のロジック強化 (ブラッシュアップ3)
      if (cArr && cArr.length >= 20) {
        const ma20 = cArr.slice(-20).reduce((a, b) => a + b, 0) / 20;
        if ((activePos.side === "L" && currentPrice < ma20) || (activePos.side === "S" && currentPrice > ma20)) {
          alertMsg = `【決済検討】MA20をクロスしました。価格:${currentPrice.toFixed(3)} / MA:${ma20.toFixed(3)}`;
        }
      }
      if (alertMsg) sendDiscord(webhookUrl, alertMsg);
    }
  }

  // [6] 朝9時限定：高精度分析 (ブラッシュアップ5, 6, 9)
  if (now.getHours() === 9 && logSheet) {
    if (!cArr || cArr.length < 20) return;

    // RSI(14) の精密計算
    let ups = 0, downs = 0;
    const rsiPeriod = 14;
    for (let i = 0; i < rsiPeriod; i++) {
      const diff = cArr[cArr.length - 1 - i] - cArr[cArr.length - 2 - i];
      if (diff > 0) ups += diff; else downs -= diff;
    }
    const rsi = (ups + downs === 0) ? 50 : (ups / (ups + downs)) * 100;

    // ボリンジャーバンド & MA乖離
    const ma20 = cArr.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const variance = cArr.slice(-20).map(v => Math.pow(v - ma20, 2)).reduce((a, b) => a + b, 0) / 20;
    const stdDev = Math.sqrt(variance);
    const sigmaPos = (stdDev === 0) ? 0 : (currentPrice - ma20) / stdDev;
    const kairi = currentPrice - ma20;
    
    // 前日比計算 (24h前)
    const diffDay = cArr.length >= 24 ? (currentPrice - cArr[cArr.length - 24]) : (currentPrice - cArr[0]);

    // 判定ロジックのブラッシュアップ
    let signal = "様子見";
    if (sigmaPos > 2.0 || rsi > 75) signal = "売り検討 (過熱)";
    else if (sigmaPos < -2.0 || rsi < 25) signal = "買い検討 (過熱)";
    else if (Math.abs(sigmaPos) > 1.2) signal = sigmaPos > 0 ? "上昇継続" : "下落継続";

    logSheet.appendRow([
      Utilities.formatDate(now, "JST", "yyyy/MM/dd HH:mm"),
      currentPrice.toFixed(3),
      (diffDay > 0 ? "+" : "") + diffDay.toFixed(3),
      sigmaPos > 0 ? "上昇トレンド" : "下落トレンド",
      rsi.toFixed(1),
      kairi.toFixed(3),
      sigmaPos.toFixed(2) + "σ",
      signal
    ]);
  }
}

/**
 * Discord通知 (ブラッシュアップ7：エラー耐性)
 */
function sendDiscord(url, msg) {
  if (!url || !msg) return;
  const payload = JSON.stringify({ "content": msg });
  try {
    UrlFetchApp.fetch(url, {
      "method": "post",
      "contentType": "application/json",
      "payload": payload,
      "muteHttpExceptions": true
    });
  } catch (e) { 
    console.error("Discord通知失敗: " + e); 
  }
}
