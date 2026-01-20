/**
 * Trend4h.js
 * 役割：ローソク足形状 ＋ BB位置 ＋ MA乖離 で期待度を判定
 */
function execute4hLogic(params) {
  const { c, cArr, webhookUrl, dateStr } = params;

  // 1時間足から4時間足データを生成
  const last4 = cArr.slice(-4);
  const h4h = Math.max(...last4), l4h = Math.min(...last4), o4h = last4[0], c4h = c;

  // 指標計算
  const ma20 = cArr.slice(-20).reduce((a, b) => a + b) / 20;
  const sd = Math.sqrt(cArr.slice(-20).reduce((s, v) => s + Math.pow(v - ma20, 2), 0) / 20);
  const bbPos = (c - ma20) / sd;
  const maDiff = c - ma20; // MAとの乖離

  // ローソク足形状
  const body = Math.abs(o4h - c4h), safeBody = Math.max(body, 0.01);
  const upWick = h4h - Math.max(o4h, c4h), loWick = Math.min(o4h, c4h) - l4h;

  let signal = "様子見（レンジ内）", starCount = 1, emoji = "📑";

  // --- 1. ローソク足によるトリガー判定 ---
  let isReversalTrigger = false;
  if (loWick > safeBody * 0.7) {
    signal = "🏹 **下ヒゲ出現（上昇反発の兆し）**";
    isReversalTrigger = true;
    emoji = "💡";
  } else if (upWick > safeBody * 0.7) {
    signal = "🏹 **上ヒゲ出現（下落反転の兆し）**";
    isReversalTrigger = true;
    emoji = "💡";
  } else if (body > 0.08) {
    signal = `🚀 **勢い増加（${c4h > o4h ? "上昇" : "下落"}）**`;
    emoji = "🌊";
  }

  // --- 2. 期待度（★）の加算ロジック ---
  if (isReversalTrigger || body > 0.08) {
    // BB位置による加算
    if (Math.abs(bbPos) > 1.2) starCount++;
    if (Math.abs(bbPos) > 1.8) starCount++;

    // MA乖離による加算（0.5円以上離れていればさらにチャンス）
    if (Math.abs(maDiff) > 0.5) {
      starCount++;
      signal += "\n⚠️ **大幅なMA乖離を伴う**";
    }
  }

  // 星の表示を作成
  let chance = "";
  for(let i=0; i<3; i++) chance += (i < starCount) ? "★" : "☆";
  if (starCount >= 3) {
    chance = "★★★ (🚨激アツ)";
    emoji = "🚨";
  } else if (starCount === 2) {
    emoji = "🔥";
  }

  const msg = `${emoji} **4H足 トレード診断** [${dateStr}]\n` +
              `──────────────────\n` +
              `判定：${signal}\n` +
              `期待度：${chance}\n\n` +
              `価格：${c.toFixed(3)}\n` +
              `MA乖離：${maDiff > 0 ? "+" : ""}${maDiff.toFixed(3)}\n` +
              `BB位置：${bbPos.toFixed(2)}σ\n` +
              `──────────────────`;

  UrlFetchApp.fetch(webhookUrl, {method: "post", contentType: "application/json", payload: JSON.stringify({content: msg})});
}
