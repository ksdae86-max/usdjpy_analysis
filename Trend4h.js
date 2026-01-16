/**
 * Trend4h.js - Grand Master v24
 * 4時間足による中長期トレンド診断用
 */
const Trend4h = (function() {
  const TICKER = "JPY=X";

  return {
    execute: function() {
      const webhookUrl = PropertiesService.getScriptProperties().getProperty('DISCORD_URL');
      try {
        const now = new Date();
        const dateStr = Utilities.formatDate(now, "JST", "MM/dd HH:mm");

        const res = UrlFetchApp.fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${TICKER}?interval=4h&range=30d`);
        const json = JSON.parse(res.getContentText());
        const result = json.chart.result[0];
        const q = result.indicators.quote[0];
        const cArr = q.close.filter(v => v != null);
        
        const i = cArr.length - 1;
        const [c, o, h, l] = [cArr[i], q.open[i], q.high[i], q.low[i]];

        const slice20 = cArr.slice(-20);
        const ma20 = slice20.reduce((a, b) => a + b) / 20;
        const sd = Math.sqrt(slice20.reduce((s, v) => s + Math.pow(v - ma20, 2), 0) / 20);
        const bbPos = sd !== 0 ? ((c - ma20) / sd).toFixed(2) : "0.00";

        // RSI計算
        let up = 0, down = 0;
        for (let k = i - 13; k <= i; k++) {
          let diff = cArr[k] - cArr[k-1];
          if (diff > 0) up += diff; else down -= diff;
        }
        const rsi = (up + down) !== 0 ? (up / (up + down)) * 100 : 50;

        // ヒゲ判定シグナル
        const body = Math.abs(o - c), safeBody = Math.max(body, 0.015);
        let signals = [];
        if ((h - Math.max(o, c)) >= safeBody * 0.8 && rsi >= 65) signals.push("天井反転");
        if ((Math.min(o, c) - l) >= safeBody * 0.8 && rsi <= 35) signals.push("底値反発");

        const msg = `🕒 **4H足 定期診断** [${dateStr}]\n──────────────────\n💰 価格: ${c.toFixed(3)}\n📏 BB位置: ${bbPos}σ\n📈 RSI: ${rsi.toFixed(1)}\n判定: ${signals.length > 0 ? "🔔 " + signals.join(", ") : "ℹ️ サインなし"}\n──────────────────`;
        UrlFetchApp.fetch(webhookUrl, {method: "post", contentType: "application/json", payload: JSON.stringify({content: msg})});

      } catch (e) { console.error("4H Error: " + e.toString()); }
    }
  };
})();

function execute4hAnalysis() { Trend4h.execute(); }
