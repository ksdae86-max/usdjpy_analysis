/**
 * Trend4h.js - 4時間足診断 & ログ記録版
 */
function execute4hLogic(params) {
  const { c, cArr, webhookUrl, dateStr, logSheet } = params;

  if (!cArr || cArr.length < 20) return;

  // --- 1. インジケーター計算 ---
  const last20 = cArr.slice(-20);
  const ma20 = last20.reduce((a, b) => a + b, 0) / 20;
  
  // ボリンジャーバンド (2σ)
  const squareDiffs = last20.map(v => Math.pow(v - ma20, 2));
  const stdDev = Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / 20);
  const sigma2 = ma20 + (stdDev * 2);
  const sigmaPos = (c - ma20) / stdDev; // 現在のシグマ位置

  // 乖離
  const kairi = c - ma20;

  // --- 2. 判定ロジック ---
  let judgment = "レンジ";
  let emoji = "⚖️";
  let star = "★☆☆";
  let details = "";

  if (sigmaPos > 2) {
    judgment = "勢い増加（上昇）";
    emoji = "🚀";
    star = "★★★ (🚨激アツ)";
    details = "大幅なMA乖離を伴う";
  } else if (sigmaPos < -2) {
    judgment = "勢い増加（下落）";
    emoji = "📉";
    star = "★★★ (🚨激アツ)";
    details = "大幅なMA乖離を伴う";
  } else if (Math.abs(sigmaPos) > 1.5 && Math.abs(kairi) < 0.1) {
    judgment = "反転の兆し";
    emoji = "🔄";
    star = "★★☆";
    details = "過熱感からの収束";
  }

  const message = `🚨 **4H足 トレード診断** [${dateStr}]\n` +
                  `──────────────────\n` +
                  `判定：${emoji} **${judgment}**\n` +
                  `⚠️ **${details}**\n` +
                  `期待度：${star}\n\n` +
                  `価格：${c.toFixed(3)}\n` +
                  `MA乖離：${kairi > 0 ? "+" : ""}${kairi.toFixed(3)}\n` +
                  `BB位置：${sigmaPos.toFixed(2)}σ\n` +
                  `──────────────────`;

  // --- 3. Discord通知 ---
  if (webhookUrl) {
    UrlFetchApp.fetch(webhookUrl, {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify({ "content": message }),
      "muteHttpExceptions": true
    });
  }

  // --- 4. スプレッドシート記録 (重要：ここがバックテストデータになる) ---
  if (logSheet) {
    logSheet.appendRow([
      dateStr,      // 日時
      c.toFixed(3), // 価格
      judgment,      // 判定
      `${details} (BB:${sigmaPos.toFixed(2)}σ)`, // 詳細
      star          // 期待度
    ]);
  }
}
