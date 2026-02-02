/**
 * main/CalcEngine.js
 * 指標計算共通ライブラリ (v4.0 / MT5準拠)
 */
const CalcEngine = {
  /**
   * 単純移動平均 (SMA) 3桁固定
   */
  calculateMA: function(prices, period) {
    const target = prices.slice(-period);
    if (target.length < period) return null;
    const ma = target.reduce((a, b) => a + b, 0) / period;
    return Number(ma.toFixed(3));
  },

  /**
   * 標準偏差 (Sigma) 3桁固定
   */
  calculateSigma: function(prices, period, ma) {
    const target = prices.slice(-period);
    if (target.length < period) return null;
    const avg = ma || this.calculateMA(target, period);
    if (avg === null) return null;

    const squareDiffs = target.map(v => Math.pow(v - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / period;
    return Number(Math.sqrt(avgSquareDiff).toFixed(3));
  },

  /**
   * Wilder's RSI 3桁固定
   */
  calculateWilderRSI: function(prices, period) {
    if (prices.length <= period) return 50.000;

    let diffs = [];
    for (let i = 1; i < prices.length; i++) diffs.push(prices[i] - prices[i - 1]);

    let upSum = 0, downSum = 0;
    for (let i = 0; i < period; i++) {
      let d = diffs[i];
      if (d > 0) upSum += d; else if (d < 0) downSum -= d;
    }
    let upAvg = upSum / period, downAvg = Math.abs(downSum) / period;

    for (let i = period; i < diffs.length; i++) {
      let d = diffs[i];
      upAvg = (upAvg * (period - 1) + (d > 0 ? d : 0)) / period;
      downAvg = (downAvg * (period - 1) + (d < 0 ? Math.abs(d) : 0)) / period;
    }

    const rsi = downAvg === 0 ? 100 : 100 - (100 / (1 + upAvg / downAvg));
    return Number(rsi.toFixed(3));
  }
};
