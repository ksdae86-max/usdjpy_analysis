/**
 * 1時間ごとの蓄積・監視ロジック
 * @param {Object} p - {c: price, ss: spreadsheet, dateStr: string}
 */
function executeLogic(p) {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();

  // --- [1] 市場クローズ判定 (月曜5時〜土曜7時) ---
  if (day === 0 || (day === 1 && hour < 5) || (day === 6 && hour >= 7)) return;

  const { c, ss, dateStr } = p;
  const calcSheet = ss.getSheetByName("計算用最新20"); // シート名は現物維持
  const posSheet = ss.getSheetByName("ポジション");
  const dailyLogSheet = ss.getSheetByName("日次記録ログ");

  // --- [2] 現物仕様：数値チェックガード ---
  if (c && !isNaN(c)) {
    calcSheet.appendRow([c, dateStr]);
    
    // 【修正】MT5のRSI精度向上のため保持数を100に拡大
    if (calcSheet.getLastRow() > 100) calcSheet.deleteRow(1);

    const cArr = calcSheet.getRange(1, 1, calcSheet.getLastRow(), 1).getValues().flat().map(Number);
    
    // 指標計算に必要な最低限のデータ数（MA20等）
    if (cArr.length < 20) return;

    // 【継承】MAは常に直近20本で計算
    const ma20 = cArr.slice(-20).reduce((a, b) => a + b) / 20;

    // --- [3] ポジション監視 (ステータスが空白時のみ) ---
    const posData = posSheet.getRange("A2:D2").getValues()[0];
    const entryPrice = posData[0];
    const side = posData[1]; 
    const lastNotified = posData[2];
    const status = posData[3]; 

    if (status === "" && entryPrice && !isNaN(entryPrice)) {
      const pips = (side === "L") ? (c - entryPrice) * 100 : (entryPrice - c) * 100;

      // 利確・損切監視
      if (pips >= 20.0 || pips <= -15.0) {
        const currentAlert = pips >= 20.0 ? "利確圏" : "損切圏";
        if (lastNotified !== currentAlert) {
          sendDiscord(`【決済アラート】${currentAlert}\n現在Pips: ${pips.toFixed(1)}\n価格: ${c}`);
          posSheet.getRange("C2").setValue(currentAlert);
        }
      }

      // MA20逆クロス監視
      const crossTrigger = (side === "L" && c < ma20) ? "L逆クロス" : (side === "S" && c > ma20) ? "S逆クロス" : "";
      if (crossTrigger && lastNotified !== crossTrigger) {
        sendDiscord(`【決済検討】価格がMA20を逆方向にクロスしました。\n価格: ${c}\nMA20: ${ma20.toFixed(3)}`);
        posSheet.getRange("C2").setValue(crossTrigger);
      }
    }

    // --- [4] 朝9時統計 (MT5準拠ワイルダー方式) ---
    if (hour === 9 && dailyLogSheet) {
      const rsi = calculateWilderRSI(cArr, 14);
      // MA乖離計算 (c - ma20) は現物通り20期間ベース
      dailyLogSheet.appendRow([dateStr, c, rsi.toFixed(1), (c - ma20).toFixed(3), "9時統計"]);
    }
  }
}

/**
 * MT5準拠 RSI計算 (ワイルダーの修正移動平均)
 * @param {Array} prices - 価格配列
 * @param {Number} period - 期間 (14)
 */
function calculateWilderRSI(prices, period) {
  if (prices.length <= period) return 50;
  
  let diffs = [];
  for (let i = 1; i < prices.length; i++) {
    diffs.push(prices[i] - prices[i - 1]);
  }

  let upSum = 0;
  let downSum = 0;
  // 初回計算
  for (let i = 0; i < period; i++) {
    let d = diffs[i];
    if (d > 0) upSum += d; else if (d < 0) downSum -= d;
  }
  let upAvg = upSum / period;
  let downAvg = Math.abs(downSum) / period;

  // ワイルダーの平滑化 (MT5方式)
  for (let i = period; i < diffs.length; i++) {
    let d = diffs[i];
    let up = d > 0 ? d : 0;
    let down = d < 0 ? Math.abs(d) : 0;
    upAvg = (upAvg * (period - 1) + up) / period;
    downAvg = (downAvg * (period - 1) + down) / period;
  }

  return downAvg === 0 ? 100 : 100 - (100 / (1 + upAvg / downAvg));
}

function sendDiscord(msg) {
  const url = PropertiesService.getScriptProperties().getProperty('DISCORD_URL');
  if (!url) return;
  UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ content: msg }),
    muteHttpExceptions: true
  });
}
