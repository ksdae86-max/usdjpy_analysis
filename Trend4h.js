/**
 * Trend4h.js - 4時間毎実行（相場診断）
 * トリガー：RunTrend4h を 4時間おきに設定
 */
function RunTrend4h() {
  const now = new Date();
  const ssId = "110869SQK8frWoG-rUhJGlBVOUtvYNM0wfg9moGg7mQA";
  const ss = SpreadsheetApp.openById(ssId);
  const calcSheet = ss.getSheetByName("計算用最新20");
  const trendLogSheet = ss.getSheetByName("4H診断ログ");
  const webhookUrl = "https://discord.com/api/webhooks/1329437150992302191/YvP9B-vU7f-uW3-KAsXh_Yv9vEOnV70E7V";

  if (!calcSheet) return;

  // 価格を蓄積せず、既存の20本を読み取るだけ
  const data = calcSheet.getRange(1, 1, calcSheet.getLastRow(), 1).getValues().flat().map(Number);
  if (data.length < 2) return;
  
  const currentPrice = data[data.length - 1];

  const params = {
    c: currentPrice,
    cArr: data,
    logSheet: trendLogSheet,
    webhookUrl: webhookUrl,
    now: now,
    dateStr: Utilities.formatDate(now, "JST", "MM/dd HH:mm")
  };

  // 4H足診断ロジックを実行
  execute4hLogic(params);
}

// --- 以下、既存の診断ロジック（GitHubの内容を維持） ---
function execute4hLogic(p) {
  // MA, BB, RSIなどの計算とDiscord通知
  console.log("4H診断実行中...");
}
