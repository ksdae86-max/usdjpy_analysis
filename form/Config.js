/**
 * form/Config.js
 * フォーム送信処理に関連する共通設定とインデックス定義
 * [FormLink.gs の変数名 COL_ACTION 等に完全準拠]
 */

const CONFIG = {
  // 1. 基本情報
  SSID: "1IE8S99OK8frNoG-UhJG1DVOUtYKNW0uKuBru9g7n0A",
  
  // 2. シート名の定義 [EntryHandler.js 等の参照に合わせる]
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

  // 3. フォーム回答(e.values)のインデックス定義
  // [FormLink.gs が使用する COL_ 定義形式を厳守し、画像1000003141の列順に適合]
  COL_TIMESTAMP: 0, // A列
  COL_ACTION: 1,    // B列: ここが FormLink.gs で使われる重要項目
  COL_SIDE: 2,      // C列: 売買【新規用】
  COL_TARGET: 3,    // D列: 対象ポジション【決済用】
  COL_ASSET: 4,     // E列: 資産記録

  // 4. EntryHandler.js 内で参照している IDX 形式も維持（二重定義でガード）
  IDX: {
    TIMESTAMP: 0,
    ACTION: 1,
    SIDE: 2,
    TARGET_POS: 3,
    ASSET_VAL: 4
  }
};
