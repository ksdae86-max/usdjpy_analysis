/**
 * main/MarketGuard.js
 * 市場の開場・閉場判定
 */
const MarketGuard = {
  /**
   * 現在時刻が取引時間内か判定
   */
  isMarketOpen: function() {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    
    // CONFIG.MARKET の現物階層を厳守
    const m = CONFIG.MARKET;
    
    // 土曜のクローズ以降
    if (day === m.CLOSE_DAY && hour >= m.CLOSE_HOUR) return false;
    // 日曜
    if (day === 0) return false;
    // 月曜のオープン前
    if (day === m.OPEN_DAY && hour < m.OPEN_HOUR) return false;
    
    return true;
  }
};
