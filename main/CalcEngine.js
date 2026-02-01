/**
 * main/CalcEngine.js
 * 指標計算共通ライブラリ (MT5準拠)
 * [仕様書 v3.0: RSI(14), MA(20), Sigma(20) を完全実装]
 * [精度管理: 出力値を小数点第3位に統一]
 */

const CalcEngine = {
  /**
   * 単純移動平均 (SMA) の算出
   */
  calculateMA: function(prices, period) {
    const target = prices.slice(-period);
    // 【ガード】期間不足時はnullを返し、後続のtoFixedエラーを防ぐ
    if (target.length < period) return null;
    
    const ma = target.reduce((a, b) => a + b, 0) / period;
    
    // 【徹底分析】数値として返しつつ、精度を3桁に固定（Numberで数値型に戻す）
    return Number(ma.toFixed(3));
  },

  /**
   * 標準偏差 (Sigma) の算出
   */
  calculateSigma: function(prices, period, ma) {
    const target = prices.slice(-period);
    if (target.length < period) return null;
    
    // 引数のmaがない場合は再計算（ここでもガードを意識）
    const avg = ma || this.calculateMA(target, period);
    if (avg === null) return null;

    const squareDiffs = target.map(v => Math.pow(v - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / period;
    const sigma = Math.sqrt(avgSquareDiff);

    // 【徹底分析】標準偏差も3桁固定
    return Number(sigma.toFixed(3));
  },

  /**
   * MT5準拠 RSI算出 (ワイルダーの平滑化移動平均)
   * [現物ロジックを完全継承]
   */
  calculateWilderRSI: function(prices, period) {
    // 100本に満たない場合でも計算は継続するが、期間以下なら50を返す現物仕様
    if (prices.length <= period) return 50.000;

    let diffs = [];
    for (let i = 1; i < prices.length; i++) {
      diffs.push(prices[i] - prices[i - 1]);
    }

    let upSum = 0;
    let downSum = 0;
    // 初回計算（最初のperiod分）
    for (let i = 0; i < period; i++) {
      let d = diffs[i];
      if (d > 0) upSum += d; else if (d < 0) downSum -= d;
    }
    let upAvg = upSum / period;
    let downAvg = Math.abs(downSum) / period;

    // ワイルダーの平滑化（MT5方式）
    for (let i = period; i < diffs.length; i++) {
      let d = diffs[i];
      let up = d > 0 ? d : 0;
      let down = d < 0 ? Math.abs(d) : 0;
      upAvg = (upAvg * (period - 1) + up) / period;
      downAvg = (downAvg * (period - 1) + down) / period;
    }

    const rsi = downAvg === 0 ? 100 : 100 - (100 / (1 + upAvg / downAvg));
    
    // 【徹底分析】RSIも3桁固定でデータベースのロジックを形成
    return Number(rsi.toFixed(3));
  }
};
