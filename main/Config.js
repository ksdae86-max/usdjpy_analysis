/**
 * main/Config.js
 * [仕様書 v4.3: プロパティ完全移行 & 数値ガード徹底版]
 */

const CONFIG = {
  // 【修正】SSIDをスクリプトプロパティから取得。未設定時は実行中のスプレッドシートを参照
  get SSID() {
    return PropertiesService.getScriptProperties().getProperty('SSID') || SpreadsheetApp.getActiveSpreadsheet().getId();
  },

  // Discord URL もプロパティから取得
  get DISCORD_URL() {
    return PropertiesService.getScriptProperties().getProperty('DISCORD_URL') || "";
  },

  // 【現物名称を厳守】
  SHEETS: {
    CALC_LATEST: "計算用最新20",
    POSITION: "ポジション",
    DAILY_LOG: "日次記録ログ",
    TREND_4H: "4H診断ログ"
  },

  // 【現物パラメータを厳守】
  ANALYSIS: {
    MA_PERIOD: 20,
    RSI_PERIOD: 14,
    DATA_LIMIT: 100,
    PIPS_PROFIT: 20.0,
    PIPS_LOSS: -15.0,
    MA_DIFF_ALERT: 0.500
  },

  // 【現物スケジュールを厳守】
  MARKET: {
    CLOSE_DAY: 6, // 土曜
    CLOSE_HOUR: 7, 
    OPEN_DAY: 1,  // 月曜
    OPEN_HOUR: 5 
  },

  /**
   * 【目標：徹底的な数字としての分析ガード】
   * 精神的安定を作るための厳格な数値チェックと精度固定
   */
  GUARD: {
    // 価格取得判定の数値チェックガード: if (c && !isNaN(c))
    // 型チェックを強化し、0より大きい数値のみを有効とする
    IS_VALID_NUM: (c) => {
      const n = Number(c);
      return (c !== null && c !== undefined && !isNaN(n) && n > 0);
    },

    // MA乖離計算・価格・RSIの精度維持: .toFixed(3)
    // 出力は計算にそのまま使えるよう Number 型で返す
    FIXED_VAL: (val) => {
      const n = parseFloat(val);
      return !isNaN(n) ? Number(n.toFixed(3)) : 0.000;
    },

    // 文字列として表示用の .toFixed(3)
    FIXED_STR: (val) => {
      const n = parseFloat(val);
      return !isNaN(n) ? n.toFixed(3) : "0.000";
    }
  }
};
