/**
 * 1時間ごとの蓄積・監視ロジック (v4.1)
 * 日次記録ログのフル項目対応版
 */
function executeLogic(p) {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();

  // --- [1] 市場クローズ判定 ---
  if (day === 0 || (day === 1 && hour < 5) || (day === 6 && hour >= 7)) return;

  const { c, ss, dateStr } = p;
  const calcSheet = ss.getSheetByName("計算用最新20");
  const posSheet = ss.getSheetByName("ポジション");
  const dailyLogSheet = ss.getSheetByName("日次記録ログ");

  // --- [2] 現物仕様：数値チェックガード (`if (c && !isNaN(c))`) ---
  if (c && !isNaN(c)) {
    calcSheet.appendRow([c, dateStr]);

    // RSI精度向上のため100本保持
    if (calcSheet.getLastRow() > 100) calcSheet.deleteRow(1);

    const cArr = calcSheet.getRange(1, 1, calcSheet.getLastRow(), 1).getValues().flat().map(Number);

    // 指標計算に必要な最低限のデータ数
    if (cArr.length < 20) return;

    // 【継承】MA20計算
    const last20 = cArr.slice(-20);
    const ma20 = last20.reduce((a, b) => a + b) / 20;

    // --- [3] ポジション監視 (現物ロジックを完全維持) ---
    const posData = posSheet.getRange("A2:D2").getValues()[0];
    const entryPrice = posData[0];
    const side = posData[1]; 
    const lastNotified = posData[2];
    const status = posData[3]; 

    if (status === "" && entryPrice && !isNaN(entryPrice)) {
      const pips = (side === "L") ? (c - entryPrice) * 100 : (entryPrice - c) * 100;
      if (pips >= 20.0 || pips <= -15.0) {
        const currentAlert = pips >= 20.0 ? "利確圏" : "損切圏";
        if (lastNotified !== currentAlert) {
          sendDiscord(`【決済アラート】${currentAlert}\n現在Pips: ${pips.toFixed(1)}\n価格: ${c}`);
          posSheet.getRange("C2").setValue(currentAlert);
        }
      }
      const crossTrigger = (side === "L" && c < ma20) ? "L逆クロス" : (side === "S" && c > ma20) ? "S逆クロス" : "";
      if (crossTrigger && lastNotified !== crossTrigger) {
        sendDiscord(`【決済検討】価格がMA20を逆方向にクロスしました。\n価格: ${c}\nMA20: ${ma20.toFixed(3)}`);
        posSheet.getRange("C2").setValue(crossTrigger);
      }
    }

    // --- [4] 朝9時統計：フル項目記載 (100本データを活用) ---
    if (hour === 9 && dailyLogSheet) {
      // 1. RSI (MT5準拠ワイルダー方式)
      const rsi = calculateWilderRSI(cArr, 14);

      // 2. 前日比 (24本前との差分)
      const prev24Price = cArr.length >= 25 ? cArr[cArr.length - 25] : cArr[0];
      const dailyChange = (c - prev24Price).toFixed(3);

      // 3. トレンド
      const trend = c > ma20 ? "上昇" : "下降";

      // 4. MA乖離 (現物仕様：`diff.toFixed(3)`)
      const diff = (c - ma20).toFixed(3);

      // 5. BB位置 (20期間, 2σ計算)
      const sigma = Math.sqrt(last20.map(v => Math.pow(v - ma20, 2)).reduce((a, b) => a + b) / 20);
      const bbu2 = ma20 + (sigma * 2);
      const bbl2 = ma20 - (sigma * 2);
      let bbPos = (c >= bbu2) ? "+2σ超" : (c <= bbl2) ? "-2σ超" : (c >= ma20) ? "中央〜+2σ" : "-2σ〜中央";

      // 6. シグナル
      let signal = "待機";
      if (rsi >= 75 || rsi <= 25) signal = "過熱(反転警戒)";
      else if (c > ma20 && rsi > 50) signal = "押し目形成";
      else if (c < ma20 && rsi < 50) signal = "戻り売り圏";

      // 記載: [日付, 価格, 前日比, トレンド, RSI, MA乖離, BB位置, シグナル]
      dailyLogSheet.appendRow([
        dateStr, 
        c, 
        dailyChange, 
        trend, 
        rsi.toFixed(1), 
        diff, 
        bbPos, 
        signal
      ]);
    }
  }
}
