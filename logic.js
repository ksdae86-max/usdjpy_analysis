(function(scope) {
  scope.executeMainLogic = function(params) {
    const { c, hArr, lArr, cArr, posSheet, logSheet, webhookUrl, now } = params;
    
    // --- 1. ポジション管理（省略せずそのまま残してください） ---
    // (中略：昨日のコードと同じ)

    // --- 2. 9時台の自動記録（ここを強力に書き換えました） ---
    if (now.getHours() === 9) {
      const dateStr = Utilities.formatDate(now, "JST", "yyyy/MM/dd(E)");
      const lastRow = logSheet.getLastRow();
      const lastDate = lastRow > 0 ? logSheet.getRange(lastRow, 1).getDisplayValue() : "";
      
      if (lastDate !== dateStr) {
        // 8つの要素を確実に持つ配列を作成
        const finalRow = [
          dateStr,        // A列: 日付
          c.toFixed(3),   // B列: 価格
          "Auto",         // C列: 種類
          "判定中",       // D列: 判定
          "-",            // E列: 損益
          "-",            // F列: 方向
          "-",            // G列: 入口
          "なし"          // H列: 備考
        ];
        
        // シートの最後に新しい行として、8列分を強制的に流し込む
        logSheet.getRange(lastRow + 1, 1, 1, 8).setValues([finalRow]);
      }
    }
  };
})(this);
