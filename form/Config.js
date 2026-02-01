/**
 * form/Config.js
 * フォーム送信処理に関連する共通設定とインデックス定義
 * [現物コード・仕様書・実測列順を完全統合した最終版]
 */

const CONFIG = {
  // 1. 基本情報 [現物継承]
  SSID: "1IE8S99OK8frNoG-UhJG1DVOUtYKNW0uKuBru9g7n0A",
  FORM_URL: "https://docs.google.com/forms/d/14KdKeidzyPjV9ZKz4yQNAl4vKrATrIX2N_RQr7vcv3c/edit",

  // 2. 資産管理パラメータ [現物継承]
  LOT_COEFFICIENT: 25000,

  // 3. シート名の定義 [重要：名称の揺れを完全吸収]
  // プログラムが「SHEETS」でも「SHEET_NAMES」でも参照できるように二重定義します
  SHEET_NAMES: {
    ASSET_LOG: "資産推移記録",
    LOT_CALC: "Lot計算",
    POSITION: "ポジション"
  },
  SHEETS: {
    ASSET_LOG: "資産推移記録",
    LOT_CALC: "Lot計算",
    POSITION: "ポジション"
  },

  // 4. フォーム回答(e.values)のインデックス定義
  // [画像1000003141の実際の列順に完全準拠]
  IDX: {
    TIMESTAMP: 0,  // A列: タイムスタンプ
    ACTION: 1,     // B列: アクション（新規エントリー / 決済 / 資産記録）
    SIDE: 2,       // C列: 売買【新規用】
    TARGET_POS: 3, // D列: 対象ポジション【決済用】
    ASSET_VAL: 4   // E列: 資産記録
  },

  // 5. ロジック判定用定数 [現物コード内の文字列と完全一致させる]
  // ここがズレると、プログラムが「新規エントリー」だと認識できず書き込みをスキップします
  ACTIONS: {
    ENTRY: "新規エントリー",
    EXIT: "決済",
    ASSET: "資産記録"
  }
};
