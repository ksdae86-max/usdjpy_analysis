/**
 * logic.js - 決済監視 & 朝9時限定記録版
 */
function executeMainLogic(params) {
  const { c, cArr, posSheet, logSheet, webhookUrl, now } = params;

  // --- 1. 決済監視 & 含み益通知 (毎時実行) ---
  const data = posSheet.getDataRange().getValues();
  let activePosition = null;
  for (let i = 1; i < data.length; i++) {
    if (!data[i][3]) {
      activePosition = { row: i + 1, entryPrice: parseFloat(data[i][0]), side: data[i][1] };
      break;
    }
  }

  if (activePosition) {
    const currentPrice = parseFloat(c);
    const entryPrice = activePosition.entryPrice;
    const side = activePosition.side;
    let profitPips = (side === "L") ? (currentPrice - entryPrice) : (entryPrice - currentPrice);
    profitPips = profitPips * 100;

    // 含み益アラート (20pips以上)
    if (profitPips > 20 || profitPips < -15) {
      sendDiscordNotification(webhookUrl, `【監視】損益: ${profitPips.toFixed(1)} pips (${currentPrice.toFixed(3)})`);
    }

    // MA20タッチ判定
    if (cArr && cArr.length >= 20) {
      const ma20 = cArr.slice(-20).reduce((a, b) => a + b, 0) / 20;
      const diff = currentPrice - ma20;
      if ((side === "L" && diff < 0) || (side === "S" && diff > 0)) {
        sendDiscordNotification(webhookUrl, `【MAタッチ】決済検討: 価格 ${currentPrice.toFixed(3)} / MA ${ma20.toFixed(3)}`);
      }
    }
  }

  // --- 2. 朝9時台限定の記録処理 ---
  // now.getHours() が 9 の時だけ実行
  if (now.getHours() === 9 && logSheet) {
    try {
      if (!cArr || cArr.length < 20) return;

      const last20 = cArr.slice(-20);
      const ma20 = last20.reduce((a, b) => a + b, 0) / 20;
      
      // RSI (簡易計算)
      let ups = 0, downs = 0;
      for (let i = 1; i < 14; i++) {
        const diff = cArr[cArr.length - i] - cArr[cArr.length - i - 1];
        if (diff > 0) ups += diff; else downs -= diff;
      }
      const rsi = (ups / (ups + downs)) * 100;

      // BB位置 / MA乖離
      const squareDiffs = last20.map(v => Math.pow(v - ma20, 2));
      const stdDev = Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / 20);
      const sigmaPos = (c - ma20) / stdDev;
      const kairi = c - ma20;

      // 前日比 (24時間前との差)
      const diffYesterday = cArr.length >= 24 ? (c - cArr[cArr.length - 24]) : 0;

      // シグナル判定
      let signal = "様子見";
      if (sigmaPos > 1.5) signal = "売り検討";
      if (sigmaPos < -1.5) signal = "買い検討";

      // シートへ記録
      logSheet.appendRow([
        Utilities.formatDate(now, "JST", "yyyy/MM/dd"), // 日付
        c.toFixed(3),        // 価格
        diffYesterday.toFixed(3), // 前日比
        sigmaPos > 0 ? "上昇" : "下落", // トレンド (簡易)
        rsi.toFixed(1),      // RSI
        kairi.toFixed(3),    // MA乖離
        sigmaPos.toFixed(2) + "σ", // BB位置
        signal               // シグナル
      ]);
    } catch (e) {
      console.error("9時記録エラー: " + e.toString());
    }
  }
}

function sendDiscordNotification(url, message) {
  if (!url) return;
  UrlFetchApp.fetch(url, {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify({ "content": message }),
    "muteHttpExceptions": true
  });
}
