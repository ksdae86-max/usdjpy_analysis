/**
 * logic.js - GitHub管理用ロジック（安定版）
 */
function executeMainLogic(params) {
  const { c, cArr, posSheet, logSheet, webhookUrl, now } = params;

  // --- 【重要】データ不足時のガード ---
  // Yahoo API制限などで過去データ(cArr)が取得できなかった場合、
  // slice()を実行するとエラーになるため、ここで安全に終了させます。
  if (!cArr || cArr.length < 20) {
    console.warn("過去データ(cArr)が不足しているため、今回の分析をスキップします。");
    return;
  }

  try {
    // 1. 移動平均線（MA20）の計算
    const last20 = cArr.slice(-20);
    const ma20 = last20.reduce((a, b) => a + b, 0) / 20;

    // 2. ポジション状況の確認
    const data = posSheet.getDataRange().getValues();
    let hasPosition = false;
    let positionRow = -1;
    let positionSide = "";

    for (let i = 1; i < data.length; i++) {
      if (!data[i][3]) { // D列（ステータス）が空 = 保有中
        hasPosition = true;
        positionRow = i + 1;
        positionSide = data[i][1]; // B列（L/S）
        break;
      }
    }

    // 3. 判定ロジック：MA20へのタッチ監視
    // 例：ロングポジション保有中かつ、価格がMA20を下回った場合に通知
    if (hasPosition) {
      const diff = c - ma20;
      const isNotifyNeeded = (positionSide === "L" && diff < 0) || (positionSide === "S" && diff > 0);

      if (isNotifyNeeded) {
        sendDiscordNotification(webhookUrl, `【決済アラート】\n現在の価格(${c})がMA20(${ma20.toFixed(3)})に到達しました。フォームから決済を検討してください。\n対象: ${positionRow}行目 [${positionSide}]`);
      }
    }

    // 4. 実行ログの記録（スプレッドシート）
    if (logSheet) {
      logSheet.appendRow([now, c, ma20.toFixed(3), hasPosition ? "保有中" : "なし"]);
    }

  } catch (e) {
    console.error("logic.js内部エラー: " + e.toString());
  }
}

/**
 * Discord通知用サブ関数
 */
function sendDiscordNotification(url, message) {
  if (!url) return;
  const payload = { "content": message };
  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };
  UrlFetchApp.fetch(url, options);
}
