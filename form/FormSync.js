/**
 * form/FormSync.js
 * フォームの「対象ポジション」プルダウンを動的に更新
 * [現物の未決済抽出ロジックを完全継承]
 */

function updateFormOptions() {
  const ss = SpreadsheetApp.openById(CONFIG.SSID);
  const posSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.POSITION);
  
  try {
    // 1. フォームの取得
    const form = FormApp.openByUrl(CONFIG.FORM_URL); 
    const items = form.getItems();
    
    // 2. 「対象ポジション」というタイトルの設問を探す
    const posItem = items.find(item => item.getTitle().includes("対象ポジション"));
    if (!posItem) {
      console.warn("フォーム内に「対象ポジション」という設問が見つかりません。");
      return;
    }

    // 3. ポジションシートのスキャン
    const data = posSheet.getDataRange().getValues();
    const choices = [];
    
    // 2行目以降（見出しを除く）をチェック
    for (let i = 1; i < data.length; i++) {
      const price  = data[i][0]; // A列:価格
      const side   = data[i][1]; // B列:L/S
      const status = data[i][3]; // D列:ステータス

      // 現物継承：ステータスが「済」ではなく、価格が入っている行をリストに追加
      if (status !== "済" && price !== "") {
        choices.push((i + 1) + "行目: " + side + " (" + price + ")");
      }
    }
    
    // 4. プルダウンの更新
    const listItem = posItem.asListItem();
    if (choices.length > 0) {
      listItem.setChoiceValues(choices);
    } else {
      listItem.setChoiceValues(["保持ポジションなし"]);
    }
    
    console.log("フォーム同期完了。未決済数: " + choices.length);

  } catch (err) {
    console.error("FormSyncでエラーが発生しました:", err.message);
  }
}
