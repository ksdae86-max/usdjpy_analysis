/**
 * Trend4h.js (テスト版：必ず通知を送る設定)
 */
function execute4hLogic(params) {
  const { c, o, h, l, cArr, webhookUrl, dateStr } = params;

  // テスト用に必ずメッセージを作成
  const msg = `🕒 **4H足 疎通テスト** [${dateStr}]\n──────────────────\n✅ システムは正常に動作しています。\n\n現在の価格: ${c.toFixed(3)}\n始値: ${o.toFixed(3)}\n高値: ${h.toFixed(3)}\n安値: ${l.toFixed(3)}\n──────────────────`;

  // Discordへ送信
  const response = UrlFetchApp.fetch(webhookUrl, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ content: msg })
  });
  
  console.log("Discord送信ステータス: " + response.getResponseCode());
}
