/**
 * logic.js
 * 役割：毎時の含み益監視（出口ナビ） ＋ 朝9時台のシート記録
 */
function executeMainLogic(params) {
  const { c, cArr, posSheet, logSheet, webhookUrl, now } = params;
  
  // --- 1. 出口ナビ（含み益の監視・通知）：毎時実行 ---
  if (posSheet && posSheet.getLastRow() >= 2) {
    try {
      // 2行目から最終行までデータを取得
      const lastRowPos = posSheet.getLastRow();
      const values = posSheet.getRange(2, 1, lastRowPos - 1, 4).getValues();
      const ma20 = cArr.slice(-20).reduce((a, b) => a + b) / 20;

      values.forEach((row, i) => {
        let [entry, side, lastNotified, status] = row;
        
        // entryが数値でない場合やstatus（決済済）がある場合はスキップ
        if (!entry || isNaN(entry) || status) return;

        const isLong = (side === "L" || side === "買い");
        // 損益（pips）の計算：1円 = 100pips
        const pips = isLong ? (c - entry) * 100 : (entry - c) * 100;
        let alerts = [];

        // 【通知ロジック1】段階的な利益確定通知（判定を緩和：現在のpipsが前回の通知pipsより5pips以上増えたら通知）
        const currentLevel = Math.floor(pips / 20) * 20; // 20, 40, 60...
        const lastLevel = Number(lastNotified) || 0;

        if (pips >= 10 && currentLevel > lastLevel) {
          if (currentLevel === 20) alerts.push("🛡️ **20pips到達：建値にSL移動を推奨**");
          if (currentLevel === 40 || currentLevel === 60) alerts.push(`📢 **${currentLevel}pips到達：分割利確の検討**`);
          if (currentLevel >= 100 && lastLevel < 100) alerts.push("💰 **100pips超え：全利確を強く推奨**");
        }

        // 【通知ロジック2】MA（中心線）タッチ判定
        // 含み益が5pips以上ある状態で、価格が中心線をまたいだら通知
        const maDiff = c - ma20;
        if (pips > 5) {
          if ((isLong && maDiff <= 0) || (!isLong && maDiff >= 0)) {
            alerts.push("⚠️ **中心線(MA20)に到達：戻り売りの警戒・利確目安**");
          }
        }

        // 通知実行
        if (alerts.length > 0) {
          const finalMsg = `💎 **出口ナビ：${side}エントリー (${entry.toFixed(3)})**\n` +
                           `──────────────────\n` +
                           `${alerts.join("\n")}\n` +
                           `現在の損益: **+${pips.toFixed(1)} pips**\n` +
                           `現在価格: ${c.toFixed(3)} / MA20: ${ma20.toFixed(3)}\n` +
                           `──────────────────`;
                           
          UrlFetchApp.fetch(webhookUrl, {
            method: "post",
            contentType: "application/json",
            payload: JSON.stringify({content: finalMsg})
          });
          
          // 通知済みレベルをシートのC列に記録（無限通知防止）
          posSheet.getRange(i + 2, 3).setValue(currentLevel);
        }
      });
    } catch(e) { console.error("ExitNavi Error: " + e.toString()); }
  }

  // --- 2. スプレッドシート記録（午前9時台のみ） ---
  if (now.getHours() === 9) {
    try {
      const slice20 = cArr.slice(-20);
      const ma20 = slice20.reduce((a, b) => a + b) / 20;
      const sd = Math.sqrt(slice20.reduce((s, v) => s + Math.pow(v - ma20, 2), 0) / 20);
      const bbPos = ((c - ma20) / sd).toFixed(2);
      const maDiffRecord = (c - ma20).toFixed(3);
      const dayChange = (c - (cArr[cArr.length - 25] || cArr[0])).toFixed(3);
      
      const prevMa20 = cArr.slice(-21, -1).reduce((a, b) => a + b) / 20;
      const trend = (ma20 > prevMa20 + 0.005) ? "上昇" : (ma20 < prevMa20 - 0.005) ? "下落" : "横ばい";

      let upSum = 0, downSum = 0;
      for (let i = cArr.length - 14; i < cArr.length; i++) {
        let diff = cArr[i] - cArr[i-1];
        if (diff > 0) upSum += diff; else downSum -= diff;
      }
      const rsi = (upSum + downSum !== 0) ? (upSum / (upSum + downSum) * 100).toFixed(1) : "50.0";

      let signal = "様子見";
      if (parseFloat(rsi) > 70 || bbPos > 2.0) signal = "買われすぎ";
      else if (parseFloat(rsi) < 30 || bbPos < -2.0) signal = "売られすぎ";

      const logData = [
        Utilities.formatDate(now, "JST", "yyyy/MM/dd(E) HH:mm"), 
        c.toFixed(3), 
        dayChange, 
        trend, 
        rsi, 
        maDiffRecord, 
        bbPos, 
        signal
      ];
      logSheet.getRange(logSheet.getLastRow() + 1, 1, 1, 8).clearFormat().setValues([logData]);
      
    } catch(e) { console.error("Log Error: " + e.toString()); }
  }
}
