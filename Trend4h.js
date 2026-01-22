/**
 * Trend4h.js - [4h] 環境認識 ＆ 診断ログ蓄積
 */
function execute4hLogic(params) {
  const { c, cArr, webhookUrl, dateStr, logSheet } = params;
  if (!cArr || cArr.length < 20) return;

  const currentPrice = parseFloat(c);
  const last20 = cArr.slice(-20);
  const ma20 = last20.reduce((a, b) => a + b, 0) / 20;
  const stdDev = Math.sqrt(last20.map(v => Math.pow(v - ma20, 2)).reduce((a, b) => a + b, 0) / 20);
  const sigmaPos = (currentPrice - ma20) / stdDev;
  const kairi = currentPrice - ma20;

  // 10回のブラッシュアップによる判定ロジック
  let judgment = "レンジ/停滞";
  let star = "★☆☆";
  let detail = "MA付近。様子見。";

  if (Math.abs(sigmaPos) > 2.1) {
    judgment = sigmaPos > 0 ? "過熱（天井圏）" : "過熱（底値圏）";
    star = "★★★ (🚨激アツ)";
    detail = "強烈な乖離。反転を待つ。";
  } else if (Math.abs(sigmaPos) > 1.3) {
    judgment = sigmaPos > 0 ? "上昇トレンド" : "下落トレンド";
    star = "★★☆";
    detail = "トレンド持続。押し目・戻り目。";
  }

  const msg = `🚨 **4H足 トレード診断** [${dateStr}]\n──────────────────\n判定：**${judgment}**\n期待度：${star}\n価格：${currentPrice.toFixed(3)}\nBB位置：${sigmaPos.toFixed(2)}σ\n──────────────────`;
  
  if (webhookUrl) sendDiscord(webhookUrl, msg);

  // 記録項目：日付、価格、判定、詳細（乖離/BB）、期待度
  if (logSheet) {
    logSheet.appendRow([
      dateStr, 
      currentPrice.toFixed(3), 
      judgment, 
      `${detail} (${kairi.toFixed(3)})`, 
      star
    ]);
  }
}

function sendDiscord(url, msg) {
  if (!url) return;
  UrlFetchApp.fetch(url, { "method": "post", "contentType": "application/json", "payload": JSON.stringify({ "content": msg }), "muteHttpExceptions": true });
}
