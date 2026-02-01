/**
 * main/TrendAnalyzer.js
 * 4時間ごとの環境認識ロジック
 * [仕様書 v3.0: セッション判定, 星(★)判定, ヒゲ判定を完全実装]
 * [ブラッシュアップ: ゼロ除算ガード & 精度固定(toFixed)を徹底]
 */

const TrendAnalyzer = {
  /**
   * 4時間ごとの診断を実行する
   */
  execute4hAnalysis: function(ss, c, cArr, dateStr) {
    const logSheet = ss.getSheetByName(CONFIG.SHEETS.TREND_4H);
    const now = new Date();
    const hour = now.getHours();

    // 1. セッション判定 [仕様書準拠]
    let session = "深夜";
    if (hour >= 9 && hour < 15) session = "東京";
    else if (hour >= 15 && hour < 21) session = "欧州";
    else if (hour >= 21 || hour < 3) session = "ＮＹ";

    // 2. 指標計算 (CalcEngineを使用)
    const ma = CalcEngine.calculateMA(cArr, CONFIG.ANALYSIS.MA_PERIOD);
    const sigmaVal = CalcEngine.calculateSigma(cArr, CONFIG.ANALYSIS.MA_PERIOD, ma);
    const rsi = CalcEngine.calculateWilderRSI(cArr, CONFIG.ANALYSIS.RSI_PERIOD);

    // 【数値チェックガード】MAやSigmaが取得できない場合は中断
    if (ma === null || sigmaVal === null || isNaN(ma) || isNaN(sigmaVal)) {
      console.error("TrendAnalyzer: 指標計算に失敗したため診断を中断します。");
      return "【診断エラー】指標の算出に失敗しました。";
    }

    // 【ゼロ除算ガード】ボラティリティ0時のInfinity回避
    const currentSigma = (sigmaVal !== 0) ? (c - ma) / sigmaVal : 0;
    const diff = c - ma;
    const prevC = cArr[cArr.length - 2] || c; // 前値がない場合は現在値

    // 3. 期待度 (Star) & 判定ロジック [仕様書 v3.0 継承]
    let signal = "様子見";
    let star = "☆☆☆";

    // 売り/買い検討基準 (currentSigmaによる統計的判定)
    if (currentSigma > 1.8 || rsi > 70) {
      signal = (currentSigma > 1.5 && c < prevC) ? "上ヒゲ出現" : "売り検討";
      star = (currentSigma > 2.2 && rsi > 75) ? "★★★" : "★★☆";
    } else if (currentSigma < -1.8 || rsi < 30) {
      signal = (currentSigma < -1.5 && c > prevC) ? "下ヒゲ出現" : "買い検討";
      star = (currentSigma < -2.2 && rsi < 25) ? "★★★" : "★★☆";
    }

    // 4. ログ記録 (日時, 価格, 判定, 判定(★), MA乖離, 時間帯, RSI)
    if (logSheet) {
      logSheet.appendRow([
        dateStr, 
        c, 
        signal, 
        star, 
        diff.toFixed(3), // 徹底分析: 乖離は3桁
        session, 
        rsi.toFixed(3)   // 徹底分析: RSIも3桁でデータベース化
      ]);
    }

    // 5. 通知内容の生成 (返却してNotifyHandlerで送信)
    // 徹底分析: 表示の美しさと数値の厳密さを両立
    let message = `【4H診断 / ${session}市場】\n価格: ${c}\n判定: ${signal} ${star}\nMA乖離: ${diff.toFixed(3)}\nRSI: ${rsi.toFixed(3)}\n時刻: ${dateStr}`;

    // MA乖離 0.500以上で警告付与 [仕様書準拠]
    if (Math.abs(diff) >= CONFIG.ANALYSIS.MA_DIFF_ALERT) {
      message = "⚠️【MA乖離警告】\n" + message;
    }

    return message;
  }
};
