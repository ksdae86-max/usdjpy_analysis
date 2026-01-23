function RunTrend4h() {
  const now = new Date();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const calcSheet = ss.getSheetByName("計算用最新20");
  const trendLogSheet = ss.getSheetByName("4H診断ログ");
  const webhookUrl = "https://discord.com/api/webhooks/1329437150992302191/YvP9B-vU7f-uW3-KAsXh_Yv9vEOnV70E7V";

  // 最新価格と過去20本のデータを取得（蓄積はしない）
  const data = calcSheet.getRange(1, 1, calcSheet.getLastRow(), 1).getValues().flat().map(Number);
  if (data.length < 2) return;
  
  const currentPrice = data[data.length - 1];
  const cArr = data;

  const params = {
    c: currentPrice,
    cArr: cArr,
    logSheet: trendLogSheet,
    webhookUrl: webhookUrl,
    now: now,
    dateStr: Utilities.formatDate(now, "JST", "MM/dd HH:mm")
  };

  // 4時間足の環境認識ロジックを実行
  execute4hLogic(params);
}
