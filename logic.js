function runAnalysis() {
  const now = new Date();
  if (now.getDay() === 0 || now.getDay() === 6) return; // 土日停止

  const ssId = "110869SQK8frWoG-rUhJGlBVOUtvYNM0wfg9moGg7mQA";
  const ss = SpreadsheetApp.openById(ssId);
  const calcSheet = ss.getSheetByName("計算用最新20");

  // --- Yahoo!ファイナンスから価格取得 ---
  let currentPrice = null;
  try {
    const url = "https://finance.yahoo.co.jp/quote/USDJPY=X";
    const response = UrlFetchApp.fetch(url, { "muteHttpExceptions": true });
    const content = response.getContentText();
    
    // Yahooの価格表示部分を抽出する正規表現
    const match = content.match(/<span class="_3S33t_mX">([\d.]+)<\/span>/) || 
                  content.match(/<span class="StyledNumber__value__2as0o">([\d.]+)<\/span>/);
    
    if (match) {
      currentPrice = parseFloat(match[1]);
    } else {
      // バックアップ：Google Finance的な手法（スプレッドシート関数を利用）
      const tempSheet = ss.insertSheet("temp");
      tempSheet.getRange("A1").setFormula('=IMPORTXML("https://www.google.com/search?q=USDJPY","//*[@class=\'pclqee\']")');
      Utilities.sleep(2000); // 読み込み待ち
      currentPrice = tempSheet.getRange("A1").getValue();
      ss.deleteSheet(tempSheet);
    }
  } catch (e) {
    console.error("価格取得エラー: " + e);
  }

  console.log("最終取得価格: " + currentPrice);

  // --- 書き込み処理 ---
  if (calcSheet && currentPrice && !isNaN(currentPrice)) {
    calcSheet.appendRow([currentPrice, Utilities.formatDate(now, "JST", "yyyy/MM/dd HH:mm")]);
    if (calcSheet.getLastRow() > 20) {
      calcSheet.deleteRow(1);
    }
    console.log("書き込み成功: " + currentPrice);
  } else {
    console.error("価格が取得できませんでした。");
  }
}
