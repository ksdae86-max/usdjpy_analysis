function executeLogic(p) {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();

  // --- [1] 市場クローズ判定（月曜5時〜土曜7時） ---
  if (day === 0 || (day === 1 && hour < 5) || (day === 6 && hour >= 7)) return;

  const { c, ss, dateStr } = p;
  const calcSheet = ss.getSheetByName("計算用最新20");
  const posSheet = ss.getSheetByName("ポジション");
  const dailyLogSheet = ss.getSheetByName("日次記録ログ");

  // --- [2] 数値チェックガード（現物仕様） ---
  if (c && !isNaN(c)) {
    calcSheet.appendRow([c, dateStr]);
    if (calcSheet.getLastRow() > 20) calcSheet.deleteRow(1);

    const cArr = calcSheet.getRange(1, 1, calcSheet.getLastRow(), 1).getValues().flat().map(Number);
    if (cArr.length < 20) return; // データ不足時は計算中止

    const ma20 = cArr.reduce((a, b) => a + b) / cArr.length;

    // --- [3] ポジション監視（A:価格, B:L/S, C:前回通知, D:ステータス） ---
    const posData = posSheet.getRange("A2:D2").getValues()[0];
    const entryPrice = posData[0];
    const side = posData[1];
    const lastNotified = posData[2];
    const status = posData[3];

    if (status === "" && entryPrice && !isNaN(entryPrice)) {
      const pips = (side === "L") ? (c - entryPrice) * 100 : (entryPrice - c) * 100;
      
      // Pips通知（利確+20.0 / 損切-15.0）
      if (pips >= 20.0 || pips <= -15.0) {
        const currentAlert = pips >= 20.0 ? "利確圏" : "損切圏";
        if (lastNotified !== currentAlert) {
          sendDiscord(`【決済アラート】${currentAlert}\n現在Pips: ${pips.toFixed(1)}\n価格: ${c}`);
          posSheet.getRange("C2").setValue(currentAlert);
        }
      }
      
      // MA20逆クロス判定
      const crossTrigger = (side === "L" && c < ma20) ? "L逆クロス" : (side === "S" && c > ma20) ? "S逆クロス" : "";
      if (crossTrigger && lastNotified !== crossTrigger) {
        sendDiscord(`【決済検討】MA20を逆方向にクロスしました。\n価格: ${c} / MA20: ${ma20.toFixed(3)}`);
        posSheet.getRange("C2").setValue(crossTrigger);
      }
    }

    // --- [4] 朝9時統計（RSI14 + MA乖離） ---
    if (hour === 9 && dailyLogSheet) {
      let ups = 0, downs = 0;
      for (let i = 1; i < 15; i++) {
        const change = cArr[cArr.length - i] - cArr[cArr.length - i - 1];
        if (change > 0) ups += change; else downs -= change;
      }
      const rsi = (ups + downs === 0) ? 50 : (ups / (ups + downs)) * 100;
      dailyLogSheet.appendRow([dateStr, c, rsi.toFixed(1), (c - ma20).toFixed(3), "9時統計"]);
    }
  }
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
