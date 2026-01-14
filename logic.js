/**
 * logic.js - Master Multi-Monitor v20
 * ・D列が空欄のポジションを全行並行監視
 * ・利益+20pips、以降+10pipsごとに通知
 * ・午前9時台に日足記録を実施
 */
function executeMain() {
  const webhookUrl = PropertiesService.getScriptProperties().getProperty('DISCORD_URL');
  const ticker = "JPY=X";
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheets()[0]; 
  const posSheet = ss.getSheetByName("ポジション");

  const TARGET_HOUR = 9; 

  const fetchYahoo = (url) => {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) {
      Utilities.sleep(1000);
      return JSON.parse(UrlFetchApp.fetch(url).getContentText());
    }
    return JSON.parse(res.getContentText());
  };

  try {
    const now = new Date();
    const currentHour = now.getHours();
    const dateStr = Utilities.formatDate(now, "JST", "yyyy/MM/dd(E)");

    // 1h足から最新価格を取得（監視精度向上のため）
    const jsonH = fetchYahoo(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1h&range=2d`);
    const qH = jsonH.chart.result[0].indicators.quote[0];
    const pricesH = qH.close.filter(v => v != null);
    const c = pricesH[pricesH.length - 1];

    // --- 1. 複数ポジションの動的監視ロジック ---
    if (posSheet) {
      const lastRowPos = posSheet.getLastRow();
      if (lastRowPos >= 2) {
        // A列(価格), B列(方向), C列(通知済), D列(ステータス)を取得
        const posRange = posSheet.getRange(2, 1, lastRowPos - 1, 4);
        const posValues = posRange.getValues();

        posValues.forEach((row, index) => {
          const entryPrice = row[0];
          const side = row[1]; // "L" or "S"
          const lastNotified = row[2] || 0;
          const status = row[3]; // D列

          // D列が未入力（監視中）の行のみ処理
          if (entryPrice && side && !status) {
            const isLong = (side === "L" || side === "買い");
            const currentPips = isLong ? (c - entryPrice) * 100 : (entryPrice - c) * 100;
            
            let shouldNotify = false;
            let nextStep = lastNotified;

            // 利益20pips以上で初動、以降10pips刻み
            if (currentPips >= 20) {
              if (lastNotified === 0) {
                shouldNotify = true;
                nextStep = 20;
              } else if (currentPips >= lastNotified + 10) {
                shouldNotify = true;
                nextStep = Math.floor(currentPips / 10) * 10;
              }
            }

            if (shouldNotify) {
              const direction = isLong ? "ロング" : "ショート";
              const posMsg = `💰 **ポジション利益更新**\n------------------\n状態: **${direction} 監視中**\nエントリー: ${entryPrice.toFixed(3)}\n現在の利益: **+${currentPips.toFixed(1)} pips**\n現在レート: ${c.toFixed(3)}\n------------------\n※決済したらD列に「済」と入力してください。`;
              UrlFetchApp.fetch(webhookUrl, {method: "post", contentType: "application/json", payload: JSON.stringify({content: posMsg})});
              
              // C列（3列目）に通知済みpipsを記録
              posSheet.getRange(index + 2, 3).setValue(nextStep);
            }
          }
        });
      }
    }

    // --- 2. 日足記録ロジック (午前9時台に1回) ---
    const lastRowLog = logSheet.getLastRow();
    const isTodayAlreadyLogged = lastRowLog > 0 && logSheet.getRange(lastRowLog, 1).getDisplayValue() === dateStr;

    if (currentHour === TARGET_HOUR && !isTodayAlreadyLogged) {
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

      const body = Math.abs(o - c), safeBody = Math.max(body, 0.015);
      const upperWick = h - Math.max(o, c), lowerWick = Math.min(o, c) - l;
      let signals = [];
      const checkWick = (wickLen, label, isLower) => {
        const ratio = wickLen / safeBody;
        if (ratio >= 0.7) signals.push(`${label} (${isLower ? "下" : "上"}ヒゲ${ratio.toFixed(1)}倍)`);
      };
      if (upperWick >= safeBody * 0.7 && (rsi >= 60 || h >= (ma20 + sd * 2))) checkWick(upperWick, "天井反転", false);
      if (lowerWick >= safeBody * 0.7 && (rsi <= 40 || l <= (ma20 - sd * 2))) checkWick(lowerWick, "底値反発", true);

      // 記録
      logSheet.appendRow([dateStr, c.toFixed(3), (c - cArr[i-1]).toFixed(3), trendType, rsi.toFixed(1), ((c - ma20)/ma20*100).toFixed(2), "v20多重監視中", signals.length > 0 ? signals.join(", ") : "なし"]);
      
      // 通知
      if (signals.length > 0) {
        const msg = `🔍 **定期診断(9時)** [${dateStr}]\n💰 ${c.toFixed(3)}円 / ${trendType}\n` + signals.join("\n");
        UrlFetchApp.fetch(webhookUrl, {method: "post", contentType: "application/json", payload: JSON.stringify({content: msg})});
      }
    }
  } catch (e) { console.error("実行エラー: " + e.toString()); }
}
