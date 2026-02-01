/**
 * main/PositionMonitor.js
 * ポジション監視・利確・損切・逆クロス判定ロジック
 * [仕様書 v3.0: Pips計算, 通知条件, ステータス更新を完全継承]
 * [ブラッシュアップ: 数値チェックガード & 3桁精度維持]
 */

const PositionMonitor = {
  /**
   * ポジションを監視し、必要に応じて通知を送る
   * @param {Object} ss - Spreadsheetオブジェクト
   * @param {number} c - 現在価格
   * @param {number} ma20 - 算出済みのMA20
   */
  checkPosition: function(ss, c, ma20) {
    const posSheet = ss.getSheetByName(CONFIG.SHEETS.POSITION);
    // 仕様書: A-D列を参照 (A:価格, B:L/S, C:前回通知, D:ステータス)
    const posData = posSheet.getRange("A2:D2").getValues()[0];
    const entryPrice = posData[0];
    const side       = posData[1]; 
    const lastAlert  = posData[2];
    const status     = posData[3]; 

    // 【現物厳守ガード】現在価格とMA20が正しく取得できているかチェック
    if (!(c && !isNaN(c)) || !(ma20 && !isNaN(ma20))) {
      console.warn("監視中断: 現在価格またはMA20が不正な数値です。");
      return;
    }

    // ステータスが「空白」かつエントリー価格が存在する場合のみ監視
    if (status === "" && entryPrice && !isNaN(entryPrice)) {
      
      // 1. Pips計算 [現物ロジック: 100倍]
      const pips = (side === "L") ? (c - entryPrice) * 100 : (entryPrice - c) * 100;
      
      // 2. 利確・損切判定 [仕様書: CONFIG.ANALYSIS準拠]
      let currentAlert = "";
      if (pips >= CONFIG.ANALYSIS.PIPS_PROFIT) {
        currentAlert = "利確圏";
      } else if (pips <= CONFIG.ANALYSIS.PIPS_LOSS) {
        currentAlert = "損切圏";
      }

      // 通知（前回と同じアラートなら送らない）
      if (currentAlert !== "" && lastAlert !== currentAlert) {
        // Pipsは現物のtoFixed(1)を維持しつつ、価格cは分析精度に合わせて通知
        NotifyHandler.sendDiscord(
          `【決済アラート】${currentAlert}\n現在Pips: ${pips.toFixed(1)}\n価格: ${c}`
        );
        posSheet.getRange("C2").setValue(currentAlert);
      }

      // 3. MA20逆クロス監視 [現物ロジック継承]
      const crossTrigger = (side === "L" && c < ma20) ? "L逆クロス" : 
                           (side === "S" && c > ma20) ? "S逆クロス" : "";
      
      if (crossTrigger !== "" && lastAlert !== crossTrigger) {
        // 【徹底分析】MA20の表示を toFixed(3) で固定
        NotifyHandler.sendDiscord(
          `【決済検討】価格がMA20を逆方向にクロスしました。\n価格: ${c}\nMA20: ${ma20.toFixed(3)}`
        );
        posSheet.getRange("C2").setValue(crossTrigger);
      }
    }
  }
};
