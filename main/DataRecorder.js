/**
 * main/DataRecorder.js
 * データ蓄積・100本維持ロジック (v4.0)
 */
const DataRecorder = {
  recordAndClean: function(ss, price, dateStr) {
    const sheet = ss.getSheetByName(CONFIG.SHEETS.CALC_LATEST);

    // 【徹底ガード】価格の正当性を再確認して書き込み
    if (price && !isNaN(price)) {
      sheet.appendRow([price, dateStr]);
      SpreadsheetApp.flush(); // 即時反映
    }

    // 100本保持ロジック (古いデータを削除)
    const lastRow = sheet.getLastRow();
    const limit = CONFIG.ANALYSIS.DATA_LIMIT;
    if (lastRow > limit) {
      const numToDelete = lastRow - limit;
      sheet.deleteRows(1, numToDelete);
      SpreadsheetApp.flush();
      console.log(`[DEBUG] ${numToDelete}件削除完了。現在: ${limit}本`);
    }

    // 計算用の全価格配列を返却（徹底的に数値のみを抽出）
    const rawValues = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues().flat();
    const cleanValues = rawValues.map(Number).filter(n => n > 0 && !isNaN(n));
    
    return cleanValues;
  }
};
