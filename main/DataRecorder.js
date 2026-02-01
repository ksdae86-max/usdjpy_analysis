/**
 * main/DataRecorder.js
 * データ蓄積・100本維持ロジック
 * [仕様書 v3.0: 蓄積・削除・即時反映を完全実装]
 */

const DataRecorder = {
  /**
   * 現在価格をシートに記録し、古いデータを削除して100本に維持する
   * @param {Object} ss - Spreadsheetオブジェクト
   * @param {number} price - 取得した現在価格
   * @param {string} dateStr - タイムスタンプ文字列
   */
  recordAndClean: function(ss, price, dateStr) {
    const sheet = ss.getSheetByName(CONFIG.SHEETS.CALC_LATEST);
    
    // 1. データの追加 (末尾に追記)
    sheet.appendRow([price, dateStr]);

    // 2. 即時反映を強制 (お昼時などのサーバー遅延対策)
    SpreadsheetApp.flush();

    // 3. 100本保持ロジック [仕様書準拠]
    // 1行目がヘッダー（または1本目）の場合、101行を超えたら古い行を消す
    const lastRow = sheet.getLastRow();
    const limit = CONFIG.ANALYSIS.DATA_LIMIT; // 100

    if (lastRow > limit) {
      // 100本を超える分（古いデータ）を削除
      // 2行目からデータが始まっている場合は deleteRow(2) になりますが、
      // 現物コードの「deleteRow(1)」を尊重しつつ、データ構造に合わせて調整
      const numToDelete = lastRow - limit;
      sheet.deleteRows(1, numToDelete);
      
      SpreadsheetApp.flush();
      console.log(`${numToDelete}件の古いデータを削除しました。現在: ${limit}本`);
    }
    
    // 4. 計算用の全価格配列を返却
    return sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues().flat().map(Number);
  }
};
