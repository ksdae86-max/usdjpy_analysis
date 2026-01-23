function runAnalysis() {
  const now = new Date();
  if (now.getDay() === 0 || now.getDay() === 6) return; // 土日は停止

  const ssId = "110869SQK8frWoG-rUhJGlBVOUtvYNM0wfg9moGg7mQA";
  const ss = SpreadsheetApp.openById(ssId);
  const calcSheet = ss.getSheetByName("計算用最新20");

  // --- 【変更点】GoogleFinance関数を使って確実に価格を取得する ---
  let currentPrice = null;
  try {
    // 一時的に計算用シートの空きセルを使ってGoogleFinanceを呼び出す
    const tempSheet = ss.getSheetByName("ログ") || ss.getSheets()[0]; 
    const range = tempSheet.getRange("Z1"); // 邪魔にならない遠いセルを使用
    range.setFormula('=GOOGLEFINANCE("CURRENCY:USDJPY")');
    
    // 計算が完了するまで少し待機（重要）
    SpreadsheetApp.flush();
    Utilities.sleep(1000); 
    
    currentPrice = range.getValue();
    range.clearContent(); // セルを掃除
  } catch (e) {
    console.error("GoogleFinance取得エラー: " + e);
  }

  console.log("最終取得価格: " + currentPrice);

  // --- 書き込み処理 ---
  if (calcSheet && currentPrice && !isNaN(currentPrice) && currentPrice > 0) {
    calcSheet.appendRow([currentPrice, Utilities.formatDate(now, "JST", "yyyy/MM/dd HH:mm")]);
    if (calcSheet.getLastRow() > 20) {
      calcSheet.deleteRow(1);
    }
    console.log("書き込み成功: " + currentPrice);
  } else {
    console.error("価格が取得できませんでした。GoogleFinanceが一時的にダウンしているか、数値が不正です。");
  }
}
