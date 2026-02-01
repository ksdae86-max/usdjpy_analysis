/**
 * form/Config.js
 * フォーム送信処理に関連する共通設定とインデックス定義
 * [現物コード・仕様書から完全に継承]
 */

// 1. スプレッドシート及びフォームの基本情報
const CONFIG = {
  SSID: "1IE8S99OK8frNoG-UhJG1DVOUtYKNW0uKuBru9g7n0A",
  FORM_URL: "https://docs.google.com/forms/d/14KdKeidzyPjV9ZKz4yQNAl4vKrATrIX2N_RQr7vcv3c/edit",
  
  // 資産管理・Lot計算のパラメータ [現物継承]
  LOT_COEFFICIENT: 25000,
  
  // シート名の定義
  SHEET_NAMES: {
    ASSET_LOG: "資産推移記録",
    LOT_CALC: "Lot計算",
    POSITION: "ポジション"
  },

  // フォーム回答(e.values)のインデックス定義 [画像1000003118準拠]
  // 0: タイムスタンプ
  // 1: アクション
  // 2: 資産記録（数値入力）
  // 3: 売買【新規用】
  // 4: 対象ポジション【決済用】
  IDX: {
    TIMESTAMP: 0,
    ACTION: 1,
    ASSET_VAL: 2,
    SIDE: 3,
    TARGET_POS: 4
  }
};
