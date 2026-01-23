function runAnalysis() {
  const now = new Date();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const calcSheet = ss.getSheetByName("計算用最新20");
  const posSheet = ss.getSheetByName("ポジション");
  const logSheet = ss.getSheetByName("ログ");
  const webhookUrl = "https://discord.com/api/webhooks/1329437150992302191/YvP9B-vU7f-uW3-KAsXh_Yv9vEOnV70E7V";

  // 価格取得
  const currentPrice = getDmmPrice();
  if (!currentPrice || isNaN(currentPrice)) return;

  // 【修正】4時間おきの条件を削除し、毎時間必ず蓄積する
  if (calcSheet) {
    calcSheet.appendRow([currentPrice, Utilities.formatDate(now, "JST", "MM/dd HH:mm")]);
    if (calcSheet.getLastRow() > 20) {
      calcSheet.deleteRow(1);
    }
  }

  // パラメータ準備（最新20本を取得）
  const cArr = calcSheet.getRange(1, 1, calcSheet.getLastRow(), 1).getValues().flat().map(Number);
  
  const params = {
    c: currentPrice,
    cArr: cArr,
    posSheet: posSheet,
    logSheet: logSheet,
    webhookUrl: webhookUrl,
    now: now
  };

  // ポジション監視・通知実行
  executeMainLogic(params);

  // 朝9時のサマリーのみ時間指定
  if (now.getHours() === 9) {
    recordDailySummary(params);
  }
}
