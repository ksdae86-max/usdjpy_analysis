/**
 * main/DailyReporter.js
 * 朝9時の統計・日次記録ログ出力
 * [仕様書 v4.3: CONFIG.GUARD による3桁精度統一版]
 */

const DailyReporter = {
  /**
   * 統計データを日次ログへ記録する
   */
  executeDailyReport: function(ss, c, cArr, ma20, sigma, dateStr) {
    const dailyLogSheet = ss.getSheetByName(CONFIG.SHEETS.DAILY_LOG);
    if (!dailyLogSheet) return;

    // 【数値ガード】
    if (!CONFIG.GUARD.IS_VALID_NUM(c) || !CONFIG.GUARD.IS_VALID_NUM(ma20) || !CONFIG.GUARD.IS_VALID_NUM(sigma)) {
      console.error("DailyReporter: 数値不正のため中断");
      return;
    }

    // 1. 前日比 (24時間前＝25本前) の算出
    const prev24Price = cArr.length >= 25 ? cArr[cArr.length - 25] : cArr[0];
    const dailyChange = CONFIG.GUARD.FIXED_STR(c - prev24Price);

    // 2. トレンド & 乖離
    const trend = c > ma20 ? "上昇" : "下降";
    const diff = CONFIG.GUARD.FIXED_STR(c - ma20);

    // 3. ボリンジャーバンド位置判定
    const bbu2 = ma20 + (sigma * 2);
    const bbl2 = ma20 - (sigma * 2);
    let bbPos = (c >= bbu2) ? "+2σ超" : 
                (c <= bbl2) ? "-2σ超" : 
                (c >= ma20) ? "中央〜+2σ" : "-2σ〜中央";

    // 4. RSI(14) 算出 (CalcEngineを使用)
    const rsi = CalcEngine.calculateWilderRSI(cArr, CONFIG.ANALYSIS.RSI_PERIOD || 14);

    // 5. シグナル判定
    let signal = "待機";
    if (rsi >= 75 || rsi <= 25) signal = "過熱(反転警戒)";
    else if (c > ma20 && rsi > 50) signal = "押し目形成";
    else if (c < ma20 && rsi < 50) signal = "戻り売り圏";

    // 6. ログ記録 (徹底的な3桁精度データベース化)
    dailyLogSheet.appendRow([
      dateStr, 
      c, 
      dailyChange, 
      trend, 
      CONFIG.GUARD.FIXED_STR(rsi), 
      diff, 
      bbPos, 
      signal
    ]);

    console.log(`[DailyReport] 完了: ${signal} (RSI: ${CONFIG.GUARD.FIXED_STR(rsi)})`);
  }
};
