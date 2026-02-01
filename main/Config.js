/**
 * main/Config.js
 * [現物構造を完全死守・数値ロジック強化版]
 */
const CONFIG = {
  SSID: "1IE8S99OK8frNoG-UhJG1DVOUtYKNW0uKuBru9g7n0A",

  // Discord URL は GASのスクリプトプロパティから取得する
  get DISCORD_URL() {
    try {
      return PropertiesService.getScriptProperties().getProperty('DISCORD_URL');
    } catch (e) {
      return "";
    }
  },

  // 現物名称を厳守
  SHEETS: {
    CALC_LATEST: "計算用最新20",
    POSITION: "ポジション",
    DAILY_LOG: "日次記録ログ",
    TREND_4H: "4H診断ログ"
  },

  // 現物パラメータを厳守
  ANALYSIS: {
    MA_PERIOD: 20,
    RSI_PERIOD: 14,
    DATA_LIMIT: 100,
    PIPS_PROFIT: 20.0,
    PIPS_LOSS: -15.0,
    MA_DIFF_ALERT: 0.500
  },

  // 現物スケジュールを厳守
  MARKET: {
    CLOSE_DAY: 6, // 土曜
    CLOSE_HOUR: 7, 
    OPEN_DAY: 1,  // 月曜
    OPEN_HOUR: 5 
  },

  // 【追加：徹底的な数字としての分析ガード】
  // 現物のロジックを補強し、精神的安定を作るための定義
  GUARD: {
    // 価格取得判定の数値チェックガード: if (c && !isNaN(c))
    IS_VALID_NUM: (c) => (c !== null && c !== undefined && !isNaN(c) && typeof c === 'number'),
    // MA乖離計算の精度維持: .toFixed(3)
    FIXED: (val) => {
      const n = parseFloat(val);
      return !isNaN(n) ? n.toFixed(3) : "0.000";
    }
  }
};
