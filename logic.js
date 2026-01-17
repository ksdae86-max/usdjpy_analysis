/**
 * logic.js - MainHourly用ロジック (v31)
 * 出口戦略：固定pips(20/50/100) + 動的目安(MA20/直近高安)
 */
(function(scope) {
  scope.executeMainLogic = function(params) {
    const { c, hArr, lArr, cArr, posSheet, webhookUrl } = params;
    
    // 指標計算
    const ma20 = cArr.slice(-20).reduce((a, b) => a + b) / 20;
    const recentHigh = Math.max(...hArr.slice(-24)); // 直近24時間の壁
    const recentLow = Math.min(...lArr.slice(-24));

    if (posSheet && posSheet.getLastRow() >= 2) {
      const values = posSheet.getRange(2, 1, posSheet.getLastRow() - 1, 4).getValues();
      
      values.forEach((row, i) => {
        const [entry, side, lastNotified, status] = row;
        if (entry && side && !status) {
          const isLong = (side === "L" || side === "買い");
          const pips = isLong ? (c - entry) * 100 : (entry - c) * 100;
          let alerts = [];

          // --- 固定pipsアドバイス ---
          if (pips >= 20 && lastNotified < 20) alerts.push("🛡️ **20pips：同値撤退(SL)を設定し、負けをゼロにしてください**");
          if (pips >= 50 && lastNotified < 50) alerts.push("📢 **50pips：半分利確を検討。精神的余裕を確保しましょう**");
          if (pips >= 100 && lastNotified < 100) alerts.push("💰 **100pips：目標達成！利確を強く推奨します**");

          // --- 動的利確ナビ (利益10pips以上) ---
          if (pips > 10) {
            if (isLong) {
              if (c >= ma20 && entry < ma20) alerts.push("⚠️ **中心線(MA20)到達：一旦の利確ポイントです**");
              if (c >= recentHigh * 0.999) alerts.push("📌 **直近高値接近：上値が重くなる可能性があります**");
            } else {
              if (c <= ma20 && entry > ma20) alerts.push("⚠️ **中心線(MA20)到達：一旦の利確ポイントです**");
              if (c <= recentLow * 1.001) alerts.push("📌 **直近安値接近：下げ止まりに注意してください**");
            }
          }

          if (alerts.length > 0) {
            const finalMsg = `💎 **ポジション管理：${side} (${entry.toFixed(3)})**\n${alerts.join("\n")}\n現在の損益: **+${pips.toFixed(1)} pips**`;
            UrlFetchApp.fetch(webhookUrl, {
              method: "post",
              contentType: "application/json",
              payload: JSON.stringify({ content: finalMsg })
            });
            posSheet.getRange(i + 2, 3).setValue(Math.floor(pips / 10) * 10);
          }
        }
      });
    }
  };
})(this);
