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

  // 2. シートへの蓄積（毎時間必ず実行されるように修正）
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

  // 5. 朝9時サマリー（これだけは時間指定）
  if (now.getHours() === 9) {
    recordDailySummary(params);
  }
}

function executeMainLogic(p) {
  const { c, posSheet, logSheet, webhookUrl, now } = p;
  const posData = posSheet.getDataRange().getValues();
  if (posData.length < 2) return;

  for (let i = 1; i < posData.length; i++) {
    const [id, type, entryPrice, qty, status] = posData[i];
    if (status !== "OPEN") continue;

    const pips = (type === "BUY") ? (c - entryPrice) * 100 : (entryPrice - c) * 100;

    // 利確・損切監視
    if (pips >= 20.0 || pips <= -15.0) {
      const msg = `【決済通知】\nID: ${id}\n損益: ${pips.toFixed(1)} pips`;
      sendDiscord(webhookUrl, msg);
      posSheet.getRange(i + 1, 5).setValue("CLOSED");
    }
  }
}

function getDmmPrice() {
  const url = "https://fx.dmm.com/market/charts/usdjpy/";
  try {
    const response = UrlFetchApp.fetch(url);
    const content = response.getContentText();
    const match = content.match(/<span id="rate_bid_top">([\d.]+)<\/span>/);
    return match ? parseFloat(match[1]) : null;
  } catch (e) {
    return null;
  }
}

function recordDailySummary(p) {
  // 9時時点の統計をログシートに記録
  p.logSheet.appendRow([p.now, "Daily Statistics", p.c]);
}

function sendDiscord(url, msg) {
  const payload = JSON.stringify({ content: msg });
  UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: payload
  });
}
