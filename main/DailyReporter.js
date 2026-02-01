/**
 * main/DailyReporter.js
 * 朝9時の統計・日次記録ログ出力
 * [仕様書 v3.0: 24h比較, BB位置, RSIシグナル判定を完全移植]
 */

const DailyReporter = {
  /**
   * 統計データを日次ログへ記録する
   */
  executeDailyReport: function(ss, c, cArr, ma20, sigma, dateStr) {
    const dailyLogSheet = ss.getSheetByName(CONFIG.SHEETS.DAILY_LOG);
    if (!dailyLogSheet) return;

    // 1. 前日比 (24時間前＝25本前) の算出
    const prev24Price = cArr.length >= 25 ? cArr[cArr.length - 25] : cArr[0];
    const dailyChange = (c - prev24Price).toFixed(3);

    // 2. トレンド & 乖離
    const trend = c > ma20 ? "上昇" : "下降";
    const diff = (c - ma20).toFixed(3);

    // 3. ボリンジャーバンド位置判定 (BB Pos)
    const bbu2 = ma20 + (sigma * 2);
    const bbl2 = ma20 - (sigma * 2);
    let bbPos = (c >= bbu2) ? "+2σ超" : 
                (c <= bbl2) ? "-2σ超" : 
                (c >= ma20) ? "中央〜+2σ" : "-2σ〜中央";

    // 4. RSI(14) 算出
    const rsi = CalcEngine.calculateWilderRSI(cArr, 14);

    // 5. シグナル判定 [仕様書準拠]
    let signal = "待機";
    if (rsi >= 75 || rsi <= 25) signal = "過熱(反転警戒)";
    else if (c > ma20 && rsi > 50) signal = "押し目形成";
    else if (c < ma20 && rsi < 50) signal = "戻り売り圏";

    // 6. ログ記録
    // 列: 日時, 価格, 前日比, トレンド, RSI, 乖離, BB位置, シグナル
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

    console.log(`朝9時統計を記録しました: ${signal}`);
  }
};
