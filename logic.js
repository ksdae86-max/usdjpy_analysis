/**
 * logic.js - Ultimate Evolution v10.5
 * Python版の「倍率判定・トレンド分析・安全策」を完全継承
 */
function executeMain() {
  const webhookUrl = PropertiesService.getScriptProperties().getProperty('DISCORD_URL');
  const ticker = "JPY=X";
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  try {
    // 1. 高精度データ取得（1時間足から週末の偽値を排除）
    const resH = UrlFetchApp.fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1h&range=5d`);
    const jsonH = JSON.parse(resH.getContentText());
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
    if (!c) throw new Error("データ特定失敗");
    const dateStr = Utilities.formatDate(new Date(trueStamp), "JST", "yyyy/MM/dd(E)");

    // 重複記録防止
    if (sheet.getLastRow() > 0 && sheet.getRange(sheet.getLastRow(), 1).getDisplayValue() === dateStr) return;

    // 2. 指標計算（Python Pandasロジックの移植）
    const resD = UrlFetchApp.fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=60d`);
    const jsonD = JSON.parse(resD.getContentText());
    const qD = jsonD.chart.result[0].indicators.quote[0];
    let cArr = qD.close.filter(v => v != null);
    cArr[cArr.length - 1] = c; // 最終値を高精度版に置換

    const i = cArr.length - 1;
    const o = qD.open[i], h = qD.high[i], l = qD.low[i];

    // --- インジケーター計算 ---
    const slice20 = cArr.slice(-20);
    const ma20 = slice20.reduce((a, b) => a + b) / 20;
    const sd = Math.sqrt(slice20.reduce((s, v) => s + Math.pow(v - ma20, 2), 0) / 20);
    const bbPos = sd !== 0 ? ((c - (ma20 - sd * 2)) / (sd * 4)) * 100 : 50;

    // RSI (Pythonの14期間指数移動平均的な計算を近似)
    let up = 0, down = 0;
    for (let k = i - 13; k <= i; k++) {
      let diff = cArr[k] - cArr[k-1];
      if (diff > 0) up += diff; else down -= diff;
    }
    const rsi = (up + down) !== 0 ? (up / (up + down)) * 100 : 50;

    // トレンド分析 (Python版 ma_slope の継承)
    const maPrev5 = cArr.slice(i - 24, i - 4).reduce((a, b) => a + b) / 20;
    const maSlope = (ma20 - maPrev5) / 5;
    const trendType = maSlope > 0.02 ? "📈上昇" : maSlope < -0.02 ? "📉下落" : "➡️横ばい";
    const maDiff = ((c - ma20) / ma20) * 100;

    // --- 優先度付きシグナル判定 (Python版 add_signal 継承) ---
    const body = Math.abs(o - c);
    const upperWick = h - Math.max(o, c);
    const lowerWick = Math.min(o, c) - l;
    const safeBody = Math.max(body, 0.015); // 実体極小時の安全策

    let signals = [], logSignals = [], maxPriority = 0;

    const checkWick = (wickLen, label, isLower) => {
      const ratio = wickLen / safeBody;
      if (ratio < 0.7) return;

      let priority = 0, prefix = "🔍";
      if (ratio >= 1.8) { priority = 2; prefix = "🚨 **【強烈】**"; }
      else if (ratio >= 0.9) { priority = 1; prefix = "⚠️ **【注目】**"; }
      
      const dir = isLower ? "下ヒゲ" : "上ヒゲ";
      logSignals.push(`${label}(${dir}${ratio.toFixed(1)}倍)`);
      signals.push(`${prefix}${label}\n　　└ ${dir} ${ratio.toFixed(1)}倍`);
      maxPriority = Math.max(maxPriority, priority);
    };

    // 条件判定 (RSIの閾値をPython版に準拠)
    if (upperWick >= safeBody * 0.7) {
      if (rsi >= 65 || h >= (ma20 + sd * 2)) checkWick(upperWick, "天井反転/戻り売り", false);
      else if (rsi >= 60) checkWick(upperWick, "反転予兆(RSI60超)", false);
    }
    if (lowerWick >= safeBody * 0.7) {
      if (rsi <= 35 || l <= (ma20 - sd * 2)) checkWick(lowerWick, "底値反発/押し目買い", true);
      else if (rsi <= 40) checkWick(lowerWick, "反発予兆(RSI40以下)", true);
    }

    // 3. スプレッドシート記録
    sheet.appendRow([
      dateStr, c.toFixed(3), (c - cArr[i-1]).toFixed(3), trendType,
      rsi.toFixed(1), maDiff.toFixed(2), bbPos.toFixed(1), logSignals.join(", ") || "なし"
    ]);

    // 4. Discord通知
    if (signals.length > 0 && webhookUrl) {
      const emoji = maxPriority === 2 ? "🚨" : maxPriority === 1 ? "⚠️" : "🔍";
      const msg = `${emoji} **USD/JPY 総合診断**\n📅 ${dateStr}\n💰 終値: ${c.toFixed(3)}円\n📈 トレンド: ${trendType}\n📊 RSI: ${rsi.toFixed(1)} / 乖離: ${maDiff.toFixed(2)}%\n` + "\n" + signals.join("\n");
      UrlFetchApp.fetch(webhookUrl, {method: "post", contentType: "application/json", payload: JSON.stringify({content: msg})});
    }

  } catch (e) {
    console.error("Critical Error: " + e.toString());
  }
}
