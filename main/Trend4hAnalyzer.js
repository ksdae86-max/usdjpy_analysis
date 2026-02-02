/**
 * main/Trend4hAnalyzer.js
 * 4時間ごとの環境認識ロジック
 * [仕様書 v4.3: ファイル名確定・CONFIG.GUARD完全適用版]
 */

const Trend4hAnalyzer = {
  /**
   * 4時間ごとの診断を実行する
   */
  execute4hAnalysis: function(ss, c, cArr, dateStr) {
    const logSheet = ss.getSheetByName(CONFIG.SHEETS.TREND_4H);
    const hour = new Date().getHours();

    // 1. セッション判定 [仕様書 v4.2 準拠]
    let session = "深夜";
    if (hour >= 9 && hour < 15) session = "東京";
    else if (hour >= 15 && hour < 21) session = "欧州";
    else if (hour >= 21 || hour < 3) session = "ＮＹ";

    // 2. 指標計算 (CalcEngineを使用)
    const ma = CalcEngine.calculateMA(cArr, CONFIG.ANALYSIS.MA_PERIOD);
    const sigmaVal = CalcEngine.calculateSigma(cArr, CONFIG.ANALYSIS.MA_PERIOD, ma);
    const rsi = CalcEngine.calculateWilderRSI(cArr, CONFIG.ANALYSIS.RSI_PERIOD);

    // 【徹底分析ガード】数値の妥当性をチェック
    if (!CONFIG.GUARD.IS_VALID_NUM(ma) || !CONFIG.GUARD.IS_VALID_NUM(sigmaVal)) {
      console.error("Trend4hAnalyzer: 指標計算に失敗したため診断を中断します。");
      return "【診断エラー】指標の算出に失敗しました。";
    }

    // 【ゼロ除算ガード】
    const currentSigma = (sigmaVal !== 0) ? (c - ma) / sigmaVal : 0;
    const diff = c - ma;
    const prevC = cArr[cArr.length - 2] || c;

    // 3. 期待度 (Star) & 判定ロジック [仕様書 v4.2 継承]
    let signal = "様子見";
    let star = "☆☆☆";

    if (currentSigma > 1.8 || rsi > 70) {
      signal = (currentSigma > 1.5 && c < prevC) ? "上ヒゲ出現" : "売り検討";
      star = (currentSigma > 2.2 && rsi > 75) ? "★★★" : "★★☆";
    } else if (currentSigma < -1.8 || rsi < 30) {
      signal = (currentSigma < -1.5 && c > prevC) ? "下ヒゲ出現" : "買い検討";
      star = (currentSigma < -2.2 && rsi < 25) ? "★★★" : "★★☆";
    }

    // 4. ログ記録 (徹底的なデータベース化)
    if (logSheet) {
      logSheet.appendRow([
        dateStr, 
        c, 
        signal, 
        star, 
        CONFIG.GUARD.FIXED_STR(diff), // 3桁精度
        session, 
        CONFIG.GUARD.FIXED_STR(rsi)   // 3桁精度
      ]);
    }

    // 5. 通知内容の生成 (CONFIG.GUARD.FIXED_STR を多用して美しく整形)
    let message = `【4H診断 / ${session}市場】\n` +
                  `価格: ${c}\n` +
                  `判定: ${signal} ${star}\n` +
                  `MA乖離: ${CONFIG.GUARD.FIXED_STR(diff)}\n` +
                  `RSI: ${CONFIG.GUARD.FIXED_STR(rsi)}\n` +
                  `時刻: ${dateStr}`;

    // MA乖離警告判定
    if (Math.abs(diff) >= CONFIG.ANALYSIS.MA_DIFF_ALERT) {
      message = "⚠️【MA乖離警告】\n" + message;
    }

    return message;
  }
};
