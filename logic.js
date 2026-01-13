/**
 * logic.js - Anyday Update v15
 * 実行した当日の日付で必ず記録し、APIの遅延を回避します。
 */
function executeMain() {
  const webhookUrl = PropertiesService.getScriptProperties().getProperty('DISCORD_URL');
  const ticker = "JPY=X";
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheets()[0]; 
  const posSheet = ss.getSheetByName("ポジション");

  const fetchYahoo = (url) => {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) {
      Utilities.sleep(1000);
      return JSON.parse(UrlFetchApp.fetch(url).getContentText());
    }
    return JSON.parse(res.getContentText());
  };

  try {
    // 1h足で「今」のレートを確実に取得
    const jsonH = fetchYahoo(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1h&range=2d`);
    const qH = jsonH.chart.result[0].indicators.quote[0];
    const pricesH = qH.close.filter(v => v != null);
    const c = pricesH[pricesH.length - 1]; // リアルタイムに最も近い価格

    // 日付は「実行した今日」にする
    const dateStr = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd(E)");

    // 指標計算用の日足取得
    const jsonD = fetchYahoo(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=90d`);
    const qD = jsonD.chart.result[0].indicators.quote[0];
    let cArr = qD.close.filter(v => v != null);
    cArr[cArr.length - 1] = c; 

    const i = cArr.length - 1;
    const o = qD.open[i], h = qD.high[i], l = qD.low[i];
    const slice20 = cArr.slice(-20);
    const ma20 = slice20.reduce((a, b) => a + b) / 20;
    const sd = Math.sqrt(slice20.reduce((s, v) => s + Math.pow(v - ma20, 2), 0) / 20);
    const rsi = (function() {
      let up = 0, down = 0;
      for (let k = i - 13; k <= i; k++) {
        let diff = cArr[k] - cArr[k-1];
        if (diff > 0) up += diff; else down -= diff;
      }
      return (up + down) !== 0 ? (up / (up + down)) * 100 : 50;
    })();
    const maSlope = (ma20 - (cArr.slice(i - 24, i - 4).reduce((a, b) => a + b) / 20)) / 5;
    const trendType = maSlope > 0.02 ? "📈上昇" : maSlope < -0.02 ? "📉下落" : "➡️横ばい";

    // --- ポジション利益監視 ---
    if (posSheet) {
      const posLastRow = posSheet.getLastRow();
      if (posLastRow >= 2) {
        const posData = posSheet.getRange(posLastRow, 1, 1, 3).getValues()[0];
        const entryPrice = posData[0], side = posData[1], lastNotified = posData[2] || 0;
        if (entryPrice && side) {
          const currentPips = (side === "L" || side === "買い") ? (c - entryPrice) * 100 : (entryPrice - c) * 100;
          let shouldNotifyPos = false, nextStep = lastNotified;
          if (currentPips >= 20) {
            if (lastNotified === 0 || currentPips >= lastNotified + 10) {
              shouldNotifyPos = true;
              nextStep = Math.floor(currentPips / 10) * 10;
            }
          }
          if (shouldNotifyPos) {
            const posMsg = `💰 **利益更新**\n含み益: **+${currentPips.toFixed(1)} pips**\n(レート: ${c.toFixed(3)})`;
            UrlFetchApp.fetch(webhookUrl, {method: "post", contentType: "application/json", payload: JSON.stringify({content: posMsg})});
            posSheet.getRange(posLastRow, 3).setValue(nextStep);
          }
        }
      }
    }

    // --- ヒゲ判定 ---
    const body = Math.abs(o - c), safeBody = Math.max(body, 0.015);
    const upperWick = h - Math.max(o, c), lowerWick = Math.min(o, c) - l;
    let signals = [];
    const checkWick = (wickLen, label, isLower) => {
      const ratio = wickLen / safeBody;
      if (ratio >= 0.7) signals.push(`${label} (${isLower ? "下" : "上"}ヒゲ${ratio.toFixed(1)}倍)`);
    };
    if (upperWick >= safeBody * 0.7 && (rsi >= 60 || h >= (ma20 + sd * 2))) checkWick(upperWick, "天井反転", false);
    if (lowerWick >= safeBody * 0.7 && (rsi <= 40 || l <= (ma20 - sd * 2))) checkWick(lowerWick, "底値反発", true);

    // --- 記録 ---
    const lastRow = logSheet.getLastRow();
    const isDup = lastRow > 0 && logSheet.getRange(lastRow, 1).getDisplayValue() === dateStr;

    if (!isDup) {
      logSheet.appendRow([dateStr, c.toFixed(3), (c - cArr[i-1]).toFixed(3), trendType, rsi.toFixed(1), ((c - ma20)/ma20*100).toFixed(2), "v15運用", signals.length > 0 ? signals.join(", ") : "なし"]);
      if (signals.length > 0) {
        const msg = `🔍 **診断** [${dateStr}]\n💰 ${c.toFixed(3)}円 / ${trendType}\n` + signals.join("\n");
        UrlFetchApp.fetch(webhookUrl, {method: "post", contentType: "application/json", payload: JSON.stringify({content: msg})});
      }
    }
  } catch (e) { console.error("実行エラー: " + e.toString()); }
}
