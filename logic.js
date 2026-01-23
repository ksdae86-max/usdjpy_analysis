/**
 * logic.js - 毎時実行（価格蓄積 ＆ ポジション監視）
 * トリガー：runAnalysis を 1時間おきに設定
 */
function runAnalysis() {
  const now = new Date();
  const ssId = "110869SQK8frWoG-rUhJGlBVOUtvYNM0wfg9moGg7mQA";
  const ss = SpreadsheetApp.openById(ssId);
  const calcSheet = ss.getSheetByName("計算用最新20");
  const posSheet = ss.getSheetByName("ポジション");
  const logSheet = ss.getSheetByName("ログ");
  const webhookUrl = "https://discord.com/api/webhooks/1329437150992302191/YvP9B-vU7f-uW3-KAsXh_Yv9vEOnV70E7V";

  // 1. 価格取得
  const currentPrice = getDmmPrice();
  console.log("取得価格: " + currentPrice);

  if (!currentPrice || isNaN(currentPrice)) {
    console.error("価格取得失敗");
    return;
  }

  // 2. シートへの蓄積（毎時間必ず実行）
  if (calcSheet) {
    calcSheet.appendRow([currentPrice, Utilities.formatDate(now, "JST", "MM/dd HH:mm")]);
    if (calcSheet.getLastRow() > 20) {
      calcSheet.deleteRow(1);
    }
    console.log("計算用最新20に記録完了");
  }

  // 3. パラメータ準備
  const data = calcSheet.getRange(1, 1, calcSheet.getLastRow(), 1).getValues().flat().map(Number);
  const params = {
    c: currentPrice,
    cArr: data,
    posSheet: posSheet,
    logSheet: logSheet,
    webhookUrl: webhookUrl,
    now: now
  };

  // 4. ポジション監視実行
  executeMainLogic(params);

  // 5. 朝9時サマリー
  if (now.getHours() === 9) {
    recordDailySummary(params);
  }
}

// --- 以下、既存のロジック関数（GitHubの内容を維持） ---
function executeMainLogic(p) {
  // ポジション監視・Discord通知のロジック
  console.log("監視ロジック実行中...");
}

function getDmmPrice() {
  // DMMから価格を取得するスクレイピングロジック
  // テスト用：実際はスクレイピングコードをここに
  return 150.123; 
}

function recordDailySummary(p) {
  // 9時の統計記録ロジック
}
