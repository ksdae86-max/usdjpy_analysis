/**
 * logic.js - Grand Master v21
 * --------------------------------------------------
 * 1. 利益監視：実行のたびにD列空欄の全ポジションを計算・通知
 * 2. 定時記録：午前9時台に日足データをシートへ1行追記
 * 3. 列構成：[日付, 終値, 前日比, トレンド, RSI, BB乖離, 判定]
 * --------------------------------------------------
 */
function executeMain() {
  const webhookUrl = PropertiesService.getScriptProperties().getProperty('DISCORD_URL');
  const ticker = "JPY=X";
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheets()[0]; 
  const posSheet = ss.getSheetByName("ポジション");

  // シート記録を行うターゲット時間（9時台）
  const TARGET_HOUR = 9; 

  // Yahoo Finance API取得ヘルパー
  const fetchYahoo = (url) => {
    try {
      const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (res.getResponseCode() !== 200) {
        Utilities.sleep(2000); // 失敗時は2秒待機して再試行
        return JSON.parse(UrlFetchApp.fetch(url).getContentText());
      }
      return JSON.parse(res.getContentText());
    } catch (e) {
      console.error("Fetch Error: " + e.message);
      return null;
    }
  };

  try {
    const now = new Date();
    const currentHour = now.getHours();
    const dateStr = Utilities.formatDate(now, "JST", "yyyy/MM/dd(E)");

    // 1h足から最新価格を取得（ポーリング監視用）
    const jsonH = fetchYahoo(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1h&range=2d`);
    if (!jsonH) return;
    const qH = jsonH.chart.result[0].indicators.quote[0];
    const pricesH = qH.close.filter(v => v != null);
    const c = pricesH[pricesH.length - 1];

    // --- 1. 複数ポジション監視ロジック ---
    if (posSheet) {
      const lastRowPos = posSheet.getLastRow();
      if (lastRowPos >= 2) {
        // A列からD列まで取得
        const posRange = posSheet.getRange(2, 1, lastRowPos - 1, 4);
        const posValues = posRange.getValues();

        posValues.forEach((row, index) => {
          const entryPrice = row[0], side = row[1], lastNotified = row[2] || 0, status = row[3];
          
          // D列が空（決済前）の場合のみ処理
          if (entryPrice && side && !status) {
            const isLong = (side === "L" || side === "買い");
            const currentPips = isLong ? (c - entryPrice) * 100 : (entryPrice - c) * 100;
            
            let shouldNotify = false;
            let nextStep = lastNotified;

            // 20pips以上で初報、以降10pips刻み
            if (currentPips >= 20) {
              if (lastNotified === 0 || currentPips >= lastNotified + 10) {
                shouldNotify = true;
                nextStep = Math.floor(currentPips / 10) * 10;
              }
            }

            if (shouldNotify) {
              const direction = isLong ? "ロング" : "ショート";
              const posMsg = `💰 **利益更新通知**\n──────────────────\n方向: **${direction}**\n入口: ${entryPrice.toFixed(3)} → 現在: ${c.toFixed(3)}\n損益: **+${currentPips.toFixed(1)} pips**\n──────────────────`;
              UrlFetchApp.fetch(webhookUrl, {method: "post", contentType: "application/json", payload: JSON.stringify({content: posMsg})});
              posSheet.getRange(index + 2, 3).setValue(nextStep);
            }
          }
        });
      }
    }

    // --- 2. シートへの記録ロジック ---
    const lastRowLog = logSheet.getLastRow();
    const isTodayLogged = lastRowLog > 0 && logSheet.getRange(lastRowLog, 1).getDisplayValue() === dateStr;

    // 9時台かつ、今日まだ記録していなければ実行
    if (currentHour === TARGET_HOUR && !isTodayLogged) {
      const jsonD = fetchYahoo(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=90d`);
      if (!jsonD) return;
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
        if (ratio >= 0.7) signals.push(`${label}(${isLower ? "下" : "上"}1.${Math.round(ratio*10)}倍)`);
      };
      if (upperWick >= safeBody * 0.7 && (rsi >= 60 || h >= (ma20 + sd * 2))) checkWick(upperWick, "天井反転", false);
      if (lowerWick >= safeBody * 0.7 && (rsi <= 40 || l <= (ma20 - sd * 2))) checkWick(lowerWick, "底値反発", true);

      // 列順：[日付, 終値, 前日比, トレンド, RSI, BB乖離率, 判定]
      logSheet.appendRow([
        dateStr, 
        c.toFixed(3), 
        (c - cArr[i-1]).toFixed(3), 
        trendType, 
        rsi.toFixed(1), 
        ((c - ma20)/ma20*100).toFixed(2), 
        signals.length > 0 ? signals.join(", ") : "なし"
      ]);
      
      if (signals.length > 0) {
        const msg = `🔍 **定時診断報告** [${dateStr}]\n💰 現在価格: ${c.toFixed(3)}円\n📊 トレンド: ${trendType}\n💡 判定: ${signals.join(", ")}`;
        UrlFetchApp.fetch(webhookUrl, {method: "post", contentType: "application/json", payload: JSON.stringify({content: msg})});
      }
    }
  } catch (e) { console.error("Critical Error: " + e.toString()); }
}
