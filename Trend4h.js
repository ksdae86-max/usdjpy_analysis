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

  // すでに logic.js が貯めてくれたデータを読み取る
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

  execute4hLogic(params);
}

function execute4hLogic(p) {
  const { c, cArr, webhookUrl, dateStr } = p;
  
  // 移動平均、ボリンジャーバンド等の計算
  const ma = cArr.reduce((a, b) => a + b) / cArr.length;
  const sigma = Math.sqrt(cArr.map(x => Math.pow(x - ma, 2)).reduce((a, b) => a + b) / cArr.length);
  const upper = ma + (sigma * 2);
  const lower = ma - (sigma * 2);

  let signal = "様子見";
  let star = "☆☆☆";

  if (c > upper) {
    signal = "売り検討";
    star = (c > ma + (sigma * 2.2)) ? "★★★" : "★★☆";
  } else if (c < lower) {
    signal = "買い検討";
    star = (c < ma - (sigma * 2.2)) ? "★★★" : "★★☆";
  }

  const message = `【4H足診断: ${dateStr}】\n価格: ${c}\n判定: ${signal} ${star}\nMA乖離: ${(c - ma).toFixed(3)}`;
  
  // Discordへ通知
  const payload = JSON.stringify({ content: message });
  UrlFetchApp.fetch(webhookUrl, {
    method: "post",
    contentType: "application/json",
    payload: payload
  });
}
