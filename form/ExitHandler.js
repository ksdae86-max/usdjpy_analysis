/**
 * form/ExitHandler.js
 * 既存ポジションの決済（ステータス更新）処理
 * [現物の行番号抽出ロジックを完全継承]
 */

function executeExit(responses) {
  const ss = SpreadsheetApp.openById(CONFIG.SSID);
  const posSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.POSITION);
  
  // 1. フォームからの対象ポジション文字列取得
  // 例: "5行目: L (150.25)"
  const targetValue = responses[CONFIG.IDX.TARGET_POS];

  if (!targetValue || targetValue.includes("保持ポジションなし")) {
    console.log("決済対象が選択されていないか、保持ポジションがありません。");
    return;
  }

  try {
    // 2. 行番号の抽出 [現物継承: "行目"の前の数値を解析]
    const rowNum = parseInt(targetValue.split("行目")[0]);

    if (!isNaN(rowNum) && rowNum <= posSheet.getLastRow()) {
      // 3. ステータス更新 [現物継承: D列(4列目)を「済」にする]
      posSheet.getRange(rowNum, 4).setValue("済");
      
      SpreadsheetApp.flush();
      console.log(`決済完了: ${rowNum}行目を「済」に更新しました。`);
    } else {
      console.error("無効な行番号です:", rowNum);
    }

  } catch (err) {
    console.error("ExitHandlerでエラーが発生しました:", err.message);
  }
}
