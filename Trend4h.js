/**
 * Trend4h.js - GitHub最新版 (v32)
 */
(function(scope) {
  scope.execute4hLogic = function(params) {
    const { c, o, h, l, cArr, webhookUrl, dateStr } = params;
    const ma20 = cArr.slice(-20).reduce((a, b) => a + b) / 20;
    const sd = Math.sqrt(cArr.slice(-20).reduce((s, v) => s + Math.pow(v - ma20, 2), 0) / 20);
    const bbPos = (c - ma20) / sd;

    const maSlope = (ma20 - (cArr.slice(-21, -1).reduce((a, b) => a + b) / 20));
    const body = Math.abs(o - c), upWick = h - Math.max(o, c), loWick = Math.min(o, c) - l;
    let signal = "", sub = "";

    if (maSlope > 0.035 && loWick >= body * 0.7 && Math.abs(c - ma20) < sd * 0.5) {
      signal = "📈 **押し目買いチャンス**";
      sub = "中心線反発。目標：BB上限まで約" + ((ma20 + sd*2 - c) * 100).toFixed(0) + " pips";
    } else if (maSlope < -0.035 && upWick >= body * 0.7 && Math.abs(c - ma20) < sd * 0.5) {
      signal = "📉 **戻り売りチャンス**";
      sub = "中心線反発。目標：BB下限まで約" + ((c - (ma20 - sd*2)) * 100).toFixed(0) + " pips";
    } else if (upWick >= body * 0.9 && bbPos > 1.8) {
      signal = "🔔 **天井反転アラート**";
      sub = "目標：中心線まで約" + ((c - ma20) * 100).toFixed(0) + " pips";
    } else if (loWick >= body * 0.9 && bbPos < -1.8) {
      signal = "🔔 **底値反発アラート**";
      sub = "目標：中心線まで約" + ((ma20 - c) * 100).toFixed(0) + " pips";
    }

    if (signal) {
      const msg = `🕒 **4H足 診断** [${dateStr}]\n──────────────────\n${signal}\n${sub}\n価格: ${c.toFixed(3)}\n──────────────────`;
      UrlFetchApp.fetch(webhookUrl, {method: "post", contentType: "application/json", payload: JSON.stringify({content: msg})});
    }
  };
})(this);
