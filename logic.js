/**
 * Trend4h.js - [デザイン最適化・リッチ通知版]
 */
function execute4hLogic(params) {
  const { c, cArr, webhookUrl, dateStr, logSheet } = params;
  const currentPrice = parseFloat(c);

  if (!cArr || cArr.length < 2) return;

  // [1] セッション判別
  const now = new Date();
  const hour = now.getHours();
  let session = "深夜";
  if (hour >= 9 && hour < 15) session = "東京";
  else if (hour >= 15 && hour < 21) session = "欧州";
  else if (hour >= 21 || hour < 3) session = "ＮＹ";
  
  // [2] テクニカル指標計算
  const ma20 = cArr.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const variance = cArr.slice(-20).map(v => Math.pow(v - ma20, 2)).reduce((a, b) => a + b, 0) / 20;
  const stdDev = Math.sqrt(variance);
  const sigmaPos = (stdDev === 0) ? 0 : (currentPrice - ma20) / stdDev;
  const kairi = currentPrice - ma20;

  // RSI(14)
  let ups = 0, downs = 0;
  const rsiPeriod = Math.min(cArr.length - 1, 14);
  for (let i = 0; i < rsiPeriod; i++) {
    const diff = cArr[cArr.length - 1 - i] - cArr[cArr.length - 2 - i];
    if (diff > 0) ups += diff; else downs -= diff;
  }
  const rsi = (ups + downs === 0) ? 50 : (ups / (ups + downs)) * 100;

  // [3] 形状判定（ひげ・勢い）
  const prevPrice = cArr[cArr.length - 2];
  let trendIcon = "💎";
  let statusText = "様子見";
  let star = "☆☆☆";

  if (sigmaPos > 1.8 || rsi > 70) {
    if (currentPrice < prevPrice) {
      trendIcon = "🏹";
      statusText = "上ヒゲ出現（下落反転の兆し）";
    } else {
      trendIcon = "🚀";
      statusText = "勢い増加（上昇）";
    }
    star = (sigmaPos > 2.2 && rsi > 75) ? "★★★ (🚨激アツ)" : "★★☆";
  } else if (sigmaPos < -1.8 || rsi < 30) {
    if (currentPrice > prevPrice) {
      trendIcon = "🏹";
      statusText = "下ヒゲ出現（上昇反転の兆し）";
    } else {
      trendIcon = "📉";
      statusText = "勢い増加（下落）";
    }
    star = (sigmaPos < -2.2 && rsi < 25) ? "★★★ (🚨激アツ)" : "★★☆";
  }

  // [4] リッチフォーマット通知の組み立て
  const headerIcon = star.includes("★") ? "🔥" : "📋";
  const alertWarning = Math.abs(kairi) > 0.5 ? "\n⚠️ **大幅なMA乖離を伴う**" : "";

  const msg = `${headerIcon} **4H足 トレード診断** [${dateStr} (${session})]
──────────────────
判定：${trendIcon} **${statusText}**${alertWarning}
期待度：${star}

価格：${currentPrice.toFixed(3)}
MA乖離：${(kairi > 0 ? "+" : "") + kairi.toFixed(3)}
BB位置：${sigmaPos.toFixed(2)}σ
──────────────────`;

  sendDiscord(webhookUrl, msg);

  // [5] ログ記録
  if (logSheet) {
    logSheet.appendRow([dateStr, session, currentPrice.toFixed(3), sigmaPos.toFixed(2), rsi.toFixed(1), statusText, star]);
  }
}

function sendDiscord(url, msg) {
  if (!url) return;
  try {
    UrlFetchApp.fetch(url, {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify({ "content": msg }),
      "muteHttpExceptions": true
    });
  } catch (e) { console.warn("Discord Send Error: " + e); }
}
