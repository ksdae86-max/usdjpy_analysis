/**
 * form/Config.js
 * フォーム送信処理に関連する共通設定とインデックス定義
 * [現物コード・仕様書を厳守しつつ、列順を実態に最適化]
 */

const CONFIG = {
  // 1. スプレッドシート及びフォームの基本情報
  SSID: "1IE8S99OK8frNoG-UhJG1DVOUtYKNW0uKuBru9g7n0A",
  FORM_URL: "https://docs.google.com/forms/d/14KdKeidzyPjV9ZKz4yQNAl4vKrATrIX2N_RQr7vcv3c/edit",

  // 2. 資産管理・Lot計算のパラメータ [現物継承]
  LOT_COEFFICIENT: 25000,

  // 3. シート名の定義 [現物継承]
  SHEET_NAMES: {
    ASSET_LOG: "資産推移記録",
    LOT_CALC: "Lot計算",
    POSITION: "ポジション"
  },

  // 4. フォーム回答(e.values)のインデックス定義
  // [画像1000003141の実際の列並びに完全準拠させ、ロジック崩壊を防止]
  IDX: {
    TIMESTAMP: 0,   // A列: タイムスタンプ
    ACTION: 1,      // B列: アクション
    SIDE: 2,        // C列: 売買【新規用】 (旧IDX: 3から修正)
    TARGET_POS: 3,  // D列: 対象ポジション【決済用】 (旧IDX: 4から修正)
    ASSET_VAL: 4    // E列: 資産記録 (旧IDX: 2から修正)
  },

  // 5. [ブラッシュアップ] バリデーション用ガード
  // 数値取得時のガード条件を維持するための定義
  VALIDATION: {
    IS_NUM: (v) => v && !isNaN(v)
  }
};
