function executeLogic(p) {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();

  // 市場クローズ判定 (月曜5時〜土曜7時稼働)
  if (day === 0) return;
  if (day === 1 && hour < 5) return;
  if (day === 6 && hour >= 7) return;

  const { c, ss, dateStr } = p;
  const calcSheet = ss.getSheetByName("計算用最新20");
  const posSheet = ss.getSheetByName("ポジション");
  const dailyLogSheet = ss.getSheetByName("日次記録ログ");

  // 【重要】数値チェックガードを維持
  if (c && !isNaN(c)) {
    // --- 1. 計算用最新20のデータ維持 (Queueロジック) ---
    calcSheet.appendRow([c, dateStr]);
    if (calcSheet.getLastRow() > 20) {
      calcSheet.deleteRow(1); // 常に20本に維持
    }

    const cArr = calcSheet.getRange(1, 1, calcSheet.getLastRow(), 1).getValues().flat().map(Number);
    
    if (cArr.length >= 20) {
      const ma20 = cArr.reduce((a, b) => a + b) / cArr.length;

      // --- 2. ポジションシートからの情報取得 ---
      // A2: 入値, B2: 種別(L/S) を想定
      const posData = posSheet.getRange("A2:B2").getValues()[0];
      const entryPrice = posData[0];
      const positionType = posData[1];

      if (entryPrice && !isNaN(entryPrice)) {
        const pips = (positionType === "L") ? (c - entryPrice) * 100 : (entryPrice - c) * 100;
        
        // Pips監視 (利確+20/損切-15)
        if (pips >= 20.0 || pips <= -15.0) {
          sendDiscord(`【決済アラート】現在Pips: ${pips.toFixed(1)}\n価格: ${c}`);
        }
        
        // MA20クロス決済検討
        if ((positionType === "L" && c < ma20) || (positionType === "S" && c > ma20)) {
          sendDiscord(`【決済検討】MA20をクロスしました。\n価格: ${c} / MA20: ${ma20.toFixed(3)}`);
        }
      }

      // --- 3. 朝9時統計 (日次記録ログへの書き込み) ---
      if (hour === 9 && dailyLogSheet) {
        // RSI(14)計算
        let ups = 0, downs = 0;
        for (let i = 1; i < 15; i++) {
          const change = cArr[cArr.length - i] - cArr[cArr.length - i - 1];
          if (change > 0) ups += change; else downs -= change;
        }
        const rsi = (ups + downs === 0) ? 50 : (ups / (ups + downs)) * 100;
        const maDiff = c - ma20;

        // [日時, 価格, RSI, MA乖離, 判定]
        dailyLogSheet.appendRow([dateStr, c, rsi.toFixed(1), maDiff.toFixed(3), "9時統計"]);
      }
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
