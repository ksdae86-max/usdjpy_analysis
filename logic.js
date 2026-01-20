(function(scope) {
  scope.executeMainLogic = function(params) {
    const { c, hArr, lArr, cArr, posSheet, logSheet, webhookUrl, now } = params;
    
    // 1. ポジション管理（出口ナビ）
    if (posSheet && posSheet.getLastRow() >= 2) {
      const values = posSheet.getRange(2, 1, posSheet.getLastRow() - 1, 4).getValues();
      const ma20 = cArr.slice(-20).reduce((a, b) => a + b) / 20;

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
            if (isLong && c >= ma20 && entry < ma20) alerts.push("⚠️ **中心線(MA20)到達：一旦の利確ポイント**");
            if (!isLong && c <= ma20 && entry > ma20) alerts.push("⚠️ **中心線(MA20)到達：一旦の利確ポイント**");
          }

          if (alerts.length > 0) {
            const finalMsg = `💎 **出口ナビ：${side} (${entry.toFixed(3)})**\n${alerts.join("\n")}\n損益: **+${pips.toFixed(1)} pips**`;
            UrlFetchApp.fetch(webhookUrl, {method: "post", contentType: "application/json", payload: JSON.stringify({content: finalMsg})});
            posSheet.getRange(i + 2, 3).setValue(Math.floor(pips / 10) * 10);
          }
        }
      });
    }

    // 2. 9時台の自動記録（8列の指定範囲に直接書き込む方式に変更）
    if (now.getHours() === 9) {
      const dateStr = Utilities.formatDate(now, "JST", "yyyy/MM/dd(E)");
      const lastRow = logSheet.getLastRow();
      
      // A列（1列目）の最後の値を取得
      const lastDate = lastRow > 0 ? logSheet.getRange(lastRow, 1).getDisplayValue() : "";
      
      // 同じ日付がなければ新しく書き込む
      if (lastDate !== dateStr) {
        // [日付, 価格, 種類, 判定, 損益, 方向, 入口, 備考]
        const rowData = [
          dateStr,        // A列
          c.toFixed(3),   // B列
          "Auto",         // C列
          "判定中",       // D列
          "-",            // E列
          "-",            // F列
          "-",            // G列
          "なし"          // H列
        ];
        
        // appendRowではなく、範囲を指定してセットすることでズレを防止
        logSheet.getRange(lastRow + 1, 1, 1, 8).setValues([rowData]);
      }
    }
  };
})(this);
