(function(scope) {
  scope.executeMainLogic = function(params) {
    const { c, logSheet, webhookUrl, now } = params;
    
    if (now.getHours() === 9) {
      const dateStr = Utilities.formatDate(now, "JST", "yyyy/MM/dd(E)");
      const lastRow = logSheet.getLastRow();
      const sheetName = logSheet.getName();
      
      const rowData = [dateStr, c.toFixed(3), "Auto", "判定中", "-", "-", "-", "なし"];
      
      // 診断メッセージを送信
      const debugMsg = `🧪 **書き込み診断レポート**\n・対象シート: ${sheetName}\n・最終行: ${lastRow}\n・書き込み予定行: ${lastRow + 1}\n・データ列数: ${rowData.length}列\n・現在価格: ${c.toFixed(3)}`;
      UrlFetchApp.fetch(webhookUrl, {method: "post", contentType: "application/json", payload: JSON.stringify({content: debugMsg})});

      try {
        // 強制的にA列〜H列に書き込み
        logSheet.getRange(lastRow + 1, 1, 1, 8).setValues([rowData]);
      } catch(e) {
        UrlFetchApp.fetch(webhookUrl, {method: "post", contentType: "application/json", payload: JSON.stringify({content: "❌ 書き込みエラー: " + e.toString()})});
      }
    }
  };
})(this);
