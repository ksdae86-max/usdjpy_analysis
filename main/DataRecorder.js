/**
 * main/DataRecorder.js
 * データ蓄積・100本維持ロジック
 * [仕様書 v3.0: 蓄積・削除・即時反映を完全実装]
 * [数値ガード: 計算用配列の純度を徹底維持]
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

    // 【徹底ガード】書き込み前に価格の正当性を再確認
    if (price === null || price === undefined || isNaN(price) || price === "") {
      console.error("DataRecorder: 不正な価格のため記録をスキップしました。");
      // 既存のデータを配列として返して計算を継続させる
      return sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues().flat().filter(n => !isNaN(n) && n > 0);
    }

    // 1. データの追加 (末尾に追記)
    sheet.appendRow([price, dateStr]);

    // 2. 即時反映を強制 (お昼時などのサーバー遅延対策)
    SpreadsheetApp.flush();

    // 3. 100本保持ロジック [仕様書準拠]
    const lastRow = sheet.getLastRow();
    const limit = CONFIG.ANALYSIS.DATA_LIMIT; // 100

    if (lastRow > limit) {
      const numToDelete = lastRow - limit;
      // 現物「deleteRows(1, numToDelete)」を維持
      sheet.deleteRows(1, numToDelete);

      SpreadsheetApp.flush();
      console.log(`${numToDelete}件の古いデータを削除しました。現在: ${limit}本`);
    }

    // 4. 計算用の全価格配列を返却
    // 【徹底分析】map(Number) の後に filter を追加し、確実に「有効な数値だけ」の配列を作る
    const rawValues = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues().flat();
    return rawValues.map(Number).filter(n => n > 0 && !isNaN(n));
  }
};
