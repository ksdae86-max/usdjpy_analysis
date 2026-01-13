/**
 * logic.js - Ultimate Evolution v12 (Stability Max)
 * ・Yahoo Finance 400エラー対策済 (range拡張 & エラーハンドリング)
 * ・Mathオブジェクト修正済 / ポジション最新行監視搭載
 */
function executeMain() {
  const webhookUrl = PropertiesService.getScriptProperties().getProperty('DISCORD_URL');
  const ticker = "JPY=X";
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheets()[0]; 
  const posSheet = ss.getSheetByName("ポジション");

  // API取得用ヘルパー関数（400エラー対策）
  const fetchYahoo = (url) => {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) {
      console.warn("API警告: " + res.getResponseCode() + " - リトライ中...");
      Utilities.sleep(1000); // 1秒待機してリトライ
      return JSON.parse(UrlFetchApp.fetch(url).getContentText());
    }
    return JSON.parse(res.getContentText());
  };

  try {
    // --- 1. 市場データの取得 (rangeを広げて安定化) ---
    const jsonH = fetchYahoo(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1h&range=7d`);
    if (!jsonH.chart || !jsonH.chart.result) throw new Error("1hデータ構造エラー");
    
    const qH = jsonH.chart.result[0].indicators.quote[0];
    const stampsH = jsonH.chart.result[0].timestamp;

    let c = null, trueStamp = 0;
    for (let i = stampsH.length - 1; i >= 0; i--) {
      let d = new Date(stampsH[i] * 1000);
      if (((d.getDay() === 6 && d.getHours() <= 7) || d.getDay() === 5) && qH.close[i] != null) {
        c = qH.close[i];
        let normalizedDate = new Date(stampsH[i] * 1000);
        if (normalizedDate.getDay() === 6) normalizedDate.setDate(normalizedDate.getDate() - 1);
        trueStamp = normalizedDate.getTime();
        break;
      }
    }
    if (!c) throw new Error("終値特定失敗");
    const dateStr = Utilities.formatDate(new Date(trueStamp), "JST", "yyyy/MM/dd(E)");

    // --- 2. 指標計算 ---
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

    // --- 3. ポジション利益監視 (最新行のみ) ---
    if (posSheet) {
      const posLastRow = posSheet.getLastRow();
      if (posLastRow >= 2) {
        const posData = posSheet.getRange(posLastRow, 1, 1, 3).getValues()[0];
        const entryPrice = posData[0];
        const side = posData[1]; 
        const lastNotified = posData[2] || 0;

        if (entryPrice && side) {
          const currentPips = (side === "L" || side === "買い") ? (c - entryPrice) * 100 : (entryPrice - c) * 100;
          let shouldNotifyPos = false;
          let nextStep = lastNotified;

          if (currentPips >= 20) {
            if (lastNotified === 0) {
              shouldNotifyPos = true;
              nextStep = 20;
            } else if (currentPips >= lastNotified + 10) {
              shouldNotifyPos = true;
              nextStep = Math.floor(currentPips / 10) * 10;
            }
          }

          if (shouldNotifyPos) {
            const posMsg = `💰 **ポジション利益更新**\n現在の含み益: **+${currentPips.toFixed(1)} pips**\n(エントリー: ${entryPrice} / 現在: ${c.toFixed(3)})`;
            UrlFetchApp.fetch(webhookUrl, {method: "post", contentType: "application/json", payload: JSON.stringify({content: posMsg})});
            posSheet.getRange(posLastRow, 3).setValue(nextStep);
          }
        }
      }
    }

    // --- 4. ヒゲ判定 ---
    const body = Math.abs(o - c);
    const safeBody = Math.max(body, 0.015);
    const upperWick = h - Math.max(o, c);
    const lowerWick = Math.min(o, c) - l;
    
    let signals = [], maxPriority = 0;
    const checkWick = (wickLen, label, isLower) => {
      const ratio = wickLen / safeBody;
      if (ratio < 0.7) return;
      let p = ratio >= 1.8 ? 2 : ratio >= 0.9 ? 1 : 0;
      let pref = p === 2 ? "🚨 **【強烈】** " : p === 1 ? "⚠️ **【注目】** " : "🔍 ";
      signals.push(`${pref}${label}\n　　└ ${isLower ? "下ヒゲ" : "上ヒゲ"} ${ratio.toFixed(1)}倍`);
      maxPriority = Math.max(maxPriority, p);
    };

    if (upperWick >= safeBody * 0.7 && (rsi >= 60 || h >= (ma20 + sd * 2))) checkWick(upperWick, "天井反転", false);
    if (lowerWick >= safeBody * 0.7 && (rsi <= 40 || l <= (ma20 - sd * 2))) checkWick(lowerWick, "底値反発", true);

    // --- 5. 記録と通知 ---
    const isDup = logSheet.getLastRow() > 0 && logSheet.getRange(logSheet.getLastRow(), 1).getDisplayValue() === dateStr;
    if (!isDup) {
      logSheet.appendRow([dateStr, c.toFixed(3), (c - cArr[i-1]).toFixed(3), trendType, rsi.toFixed(1), ((c - ma20)/ma20*100).toFixed(2), "v12安定版", signals.length > 0 ? signals.join(", ") : "なし"]);
    }

    if (signals.length > 0 && !isDup) {
      const msg = `🔍 **USD/JPY 総合診断**\n📅 ${dateStr}\n💰 終値: ${c.toFixed(3)}円\n📈 トレンド: ${trendType}\n\n` + signals.join("\n");
      UrlFetchApp.fetch(webhookUrl, {method: "post", contentType: "application/json", payload: JSON.stringify({content: msg})});
    }

  } catch (e) {
    console.error("ロジック実行エラー: " + e.toString());
  }
}
