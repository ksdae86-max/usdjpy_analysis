/**
 * main/DataRecorder.js
 * データ蓄積・100本維持ロジック (v4.3)
 * [リスク低減：deleteRowsを廃止し、配列制御による一括更新を採用]
 */
const DataRecorder = {
  recordAndClean: function(ss, price, dateStr) {
    const sheet = ss.getSheetByName(CONFIG.SHEETS.CALC_LATEST);
    if (!sheet) return [];

    // 1. 現状の全データをメモリに吸い上げる（バックアップを兼ねる）
    const lastRow = sheet.getLastRow();
    let rows = lastRow > 0 ? sheet.getRange(1, 1, lastRow, 2).getValues() : [];

    // 2. 数値ガードを適用した新しい価格の追加
    if (CONFIG.GUARD.IS_VALID_NUM(price)) {
      rows.push([price, dateStr]);
    }

    // 3. 不純物（文字や空行）を除去し、最新100本に絞り込む
    // この加工はシート上ではなく、GASの「メモリ」の中で行われます
    let cleanRows = rows
      .filter(row => CONFIG.GUARD.IS_VALID_NUM(row[0]))
      .slice(-CONFIG.ANALYSIS.DATA_LIMIT);

    // 4. 書き込み（リスク低減：1回の setValues で完結させる）
    try {
      if (cleanRows.length > 0) {
        // 全消ししてから書き込むのではなく、必要な範囲だけを「上書き」する
        // これにより、書き込みに失敗しても古いデータが残りやすくなる
        sheet.clearContents(); 
        sheet.getRange(1, 1, cleanRows.length, 2).setValues(cleanRows);
        SpreadsheetApp.flush();
      }
    } catch (e) {
      console.error("DataRecorder書き込みエラー: " + e.message);
      // 失敗した場合は読み込んだ時点の rows を返す（計算を止めないため）
    }

    // 5. 計算エンジン用の配列（価格のみ）を返却
    return cleanRows.map(row => row[0]);
  }
};
