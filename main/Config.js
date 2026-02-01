/**
 * main/Config.js
 */
const CONFIG = {
  SSID: "1IE8S99OK8frNoG-UhJG1DVOUtYKNW0uKuBru9g7n0A",
  
  // Discord URL は GASのスクリプトプロパティから取得する
  // (GitHub上には生のURLを残さない)
  get DISCORD_URL() {
    try {
      return PropertiesService.getScriptProperties().getProperty('DISCORD_URL');
    } catch (e) {
      return "";
    }
  },

  SHEETS: {
    CALC_LATEST: "計算用最新20",
    POSITION: "ポジション",
    DAILY_LOG: "日次記録ログ",
    TREND_4H: "4H診断ログ"
  },

  ANALYSIS: {
    MA_PERIOD: 20,
    RSI_PERIOD: 14,
    DATA_LIMIT: 100,
    PIPS_PROFIT: 20.0,
    PIPS_LOSS: -15.0,
    MA_DIFF_ALERT: 0.500
  },

  MARKET: {
    CLOSE_DAY: 6, // 土曜
    CLOSE_HOUR: 7, 
    OPEN_DAY: 1,  // 月曜
    OPEN_HOUR: 5 
  }
};
