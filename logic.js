(function(scope) {
  scope.executeMainLogic = function(params) {
    const { c, cArr, posSheet, logSheet, webhookUrl, now } = params;
    
    // --- 1. ポジション管理（出口ナビ） ---
    if (posSheet && posSheet.getLastRow() >= 2) {
      try {
        const values = posSheet.getRange(2, 1, posSheet.getLastRow() - 1, 4).getValues();
        const slice20 = cArr.slice(-20);
        const ma20 = slice20.reduce((a, b) => a + b) / 20;

        values.forEach((row, i) => {
          const [entry, side, lastNotified, status] = row;
          if (entry && side && !status) {
            const isLong = (side === "L" || side === "買い");
            const pips = isLong ? (c - entry) * 100 : (entry - c) * 100;
            let alerts = [];

            if (pips >= 20 && lastNotified < 20) alerts.push("🛡️ **20pips：同値撤退(SL)推奨**");
            if (pips >= 50 && lastNotified < 50) alerts.push("📢 **50pips：半分利確検討**");
            if (pips >= 100 && lastNotified < 100) alerts.push("💰 **100pips：利確推奨**");

            if (pips > 10) {
              if (isLong && c >= ma20 && entry < ma20) alerts.push("⚠️ **中心線(MA20)到達：利確ポイント**");
              if (!isLong && c <= ma20 && entry > ma20) alerts.push("⚠️ **中心線(MA20)到達：利確ポイント**");
            }

            if (alerts.length > 0) {
              const finalMsg = `💎 **出口ナビ：${side} (${entry.toFixed(3)})**\n${alerts.join("\n")}\n損益: **+${pips.toFixed(1)} pips**`;
              UrlFetchApp.fetch(webhookUrl, {method: "post", contentType: "application/json", payload: JSON.stringify({content: finalMsg})});
              posSheet.getRange(i + 2, 3).setValue(Math.floor(pips / 10) * 10);
            }
          }
        });
      } catch(e) { console.error("Pos Error: " + e.toString()); }
    }

    // --- 2. データ更新（シート1の最終行に履歴を追記） ---
    try {
      const slice20 = cArr.slice(-20);
      const ma20 = slice20.reduce((a, b) => a + b) / 20;
      const sd = Math.sqrt(slice20.reduce((s, v) => s + Math.pow(v - ma20, 2), 0) / 20);
      const bbPos = ((c - ma20) / sd).toFixed(2);
      const maDiff = (c - ma20).toFixed(3);
      const prevDayC = cArr[cArr.length - 25] || cArr[0];
      const dayChange = (c - prevDayC).toFixed(3);
      const dateStr = Utilities.formatDate(now, "JST", "yyyy/MM/dd(E) HH:mm");
      
      const prevMa20 = cArr.slice(-21, -1).reduce((a, b) => a + b) / 20;
      const trend = (ma20 > prevMa20 + 0.005) ? "上昇" : (ma20 < prevMa20 - 0.005) ? "下落" : "横ばい";

      // RSI (14)
      let upAvg = 0, downAvg = 0;
      for (let i = cArr.length - 14; i < cArr.length; i++) {
        let diff = cArr[i] - cArr[i-1];
        if (diff > 0) upAvg += diff; else downAvg -= diff;
      }
      const rsiValue = (upAvg + downAvg === 0) ? "50.0" : (upAvg / (upAvg + downAvg) * 100).toFixed(1);

      // 最終行の次に追記
      const lastRow = logSheet.getLastRow();
      const targetRow = lastRow + 1;
      
      // シート項目: 日付, 価格, 前日比, トレンド, RSI, MA乖離, BB位置, シグナル
      const logData = [dateStr, c.toFixed(3), dayChange, trend, rsiValue, maDiff, bbPos, "記録完了"];
      
      logSheet.getRange(targetRow, 1, 1, 8).clearFormat().setValues([logData]);
      
    } catch(e) { console.error("Log Error: " + e.toString()); }
  };
})(this);
