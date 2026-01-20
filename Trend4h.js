function execute4hLogic(params) {
  const { c, cArr, webhookUrl, dateStr } = params;

  const last4 = cArr.slice(-4);
  const h4h = Math.max(...last4), l4h = Math.min(...last4), o4h = last4[0], c4h = c;

  const ma20 = cArr.slice(-20).reduce((a, b) => a + b) / 20;
  const sd = Math.sqrt(cArr.slice(-20).reduce((s, v) => s + Math.pow(v - ma20, 2), 0) / 20);
  const bbPos = (c - ma20) / sd;

  const body = Math.abs(o4h - c4h), safeBody = Math.max(body, 0.01);
  const upWick = h4h - Math.max(o4h, c4h), loWick = Math.min(o4h, c4h) - l4h;

  let signal = "様子見（レンジ内）", chance = "★☆☆", emoji = "📑";

  // 下ヒゲ：上昇の兆し
  if (loWick > safeBody * 0.7) {
    signal = "🏹 **下ヒゲ出現（上昇反発の兆し）**";
    emoji = "💡";
    if (bbPos < -1.2) { chance = "★★☆"; emoji = "🔥"; }
    if (bbPos < -1.8) { chance = "★★★"; emoji = "🚨"; }
  } 
  // 上ヒゲ：下落の兆し
  else if (upWick > safeBody * 0.7) {
    signal = "🏹 **上ヒゲ出現（下落反転の兆し）**";
    emoji = "💡";
    if (bbPos > 1.2) { chance = "★★☆"; emoji = "🔥"; }
    if (bbPos > 1.8) { chance = "★★★"; emoji = "🚨"; }
  }
  // 大陽線・大陰線
  else if (body > 0.08) {
    signal = `🚀 **勢い増加（${c4h > o4h ? "上昇" : "下落"}）**`;
    emoji = "🌊";
    if (Math.abs(bbPos) > 1.5) { chance = "★★☆"; emoji = "🔥"; }
  }

  const msg = `${emoji} **4H足 トレード診断** [${dateStr}]\n──────────────────\n判定：${signal}\n期待度：${chance}\n\n価格：${c.toFixed(3)}\nBB位置：${bbPos.toFixed(2)}σ\n──────────────────`;
  UrlFetchApp.fetch(webhookUrl, {method: "post", contentType: "application/json", payload: JSON.stringify({content: msg})});
}
