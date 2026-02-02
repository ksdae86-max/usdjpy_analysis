/**
 * main/PositionMonitor.js
 * ポジション監視・利確・損切・逆クロス判定ロジック
 * [仕様書 v4.3: CONFIG.GUARD 適用・3桁精度統一版]
 */

const PositionMonitor = {
  /**
   * ポジションを監視し、必要に応じて通知を送る
   */
  checkPosition: function(ss, c, ma20) {
    const posSheet = ss.getSheetByName(CONFIG.SHEETS.POSITION);
    if (!posSheet) return;

    // A:エントリー価格, B:L/S, C:前回通知, D:ステータス
    const posData = posSheet.getRange("A2:D2").getValues()[0];
    const entryPrice = posData[0];
    const side       = posData[1]; 
    const lastAlert  = posData[2];
    const status     = posData[3]; 

    // 【徹底分析ガード】CONFIG.GUARD を使用して数値の妥当性を厳格にチェック
    if (!CONFIG.GUARD.IS_VALID_NUM(c) || !CONFIG.GUARD.IS_VALID_NUM(ma20)) {
      console.warn("監視中断: 現在価格またはMA20が不正な数値です。");
      return;
    }

    // ステータスが「空白」かつ有効なエントリー価格がある場合のみ監視
    if (status === "" && CONFIG.GUARD.IS_VALID_NUM(entryPrice)) {

      // 1. Pips計算 [現物ロジック維持]
      const pips = (side === "L") ? (c - entryPrice) * 100 : (entryPrice - c) * 100;

      // 2. 利確・損切判定 [CONFIG.ANALYSIS 準拠]
      let currentAlert = "";
      if (pips >= CONFIG.ANALYSIS.PIPS_PROFIT) {
        currentAlert = "利確圏";
      } else if (pips <= CONFIG.ANALYSIS.PIPS_LOSS) {
        currentAlert = "損切圏";
      }

      // 通知（前回と異なるアラートの場合のみ送信）
      if (currentAlert !== "" && lastAlert !== currentAlert) {
        // Pipsは視認性のための1桁、価格は分析精度の3桁を表示
        NotifyHandler.sendDiscord(
          `【決済アラート】${currentAlert}\n` +
          `現在Pips: ${pips.toFixed(1)}\n` +
          `現在価格: ${CONFIG.GUARD.FIXED_STR(c)}`
        );
        posSheet.getRange("C2").setValue(currentAlert);
      }

      // 3. MA20逆クロス監視 [徹底分析仕様]
      const crossTrigger = (side === "L" && c < ma20) ? "L逆クロス" : 
                           (side === "S" && c > ma20) ? "S逆クロス" : "";

      if (crossTrigger !== "" && lastAlert !== crossTrigger) {
        NotifyHandler.sendDiscord(
          `【決済検討】価格がMA20を逆クロスしました。\n` +
          `現在価格: ${CONFIG.GUARD.FIXED_STR(c)}\n` +
          `MA20数値: ${CONFIG.GUARD.FIXED_STR(ma20)}`
        );
        posSheet.getRange("C2").setValue(crossTrigger);
      }
    }
  }
};
