/**
 * main/Divergence.js
 * ダイバージェンス（逆行現象）検知ロジック
 * [仕様書 v4.3: CONFIG.GUARD 適用・不純物排除版]
 */

const Divergence = {
  /**
   * 4H診断ログを参照し、ダイバージェンスを判定する
   */
  detect: function(ss) {
    const logSheet = ss.getSheetByName(CONFIG.SHEETS.TREND_4H);
    if (!logSheet) return null;
    
    const lastRow = logSheet.getLastRow();
    if (lastRow < 11) return null; // 最低10本必要

    // 1. 過去10本分のデータを取得 (B:価格, E:乖離, G:RSI)
    const data = logSheet.getRange(lastRow - 9, 1, 10, 7).getValues();

    // 直近3本とそれ以前（始点となる10本前）を比較
    const recent3 = data.slice(-3);
    const startPoint = data[0]; // 10本前のデータ

    // 2. 条件(1): 過去3本以内に過熱があるか (CONFIG.GUARD.IS_VALID_NUMで検証)
    const hasExtreme = recent3.some(row => {
      const rsi = Number(row[6]);
      const diff = Number(row[4]);
      if (!CONFIG.GUARD.IS_VALID_NUM(rsi)) return false;

      // 仕様書準拠: RSI 75/25, 乖離 0.7
      return (rsi >= 75 || rsi <= 25 || Math.abs(diff) >= 0.7);
    });

    if (!hasExtreme) return null;

    // 3. 条件(2): 逆行現象の検知
    const currentPrice = Number(data[9][1]);
    const prevPrice    = Number(startPoint[1]);
    const currentRsi   = Number(data[9][6]);
    const prevRsi      = Number(startPoint[6]);

    // 【数値ガード】
    if (![currentPrice, prevPrice, currentRsi, prevRsi].every(CONFIG.GUARD.IS_VALID_NUM)) {
      console.warn("Divergence: 数値不備のためスキップ");
      return null;
    }

    let divMsg = "";
    // 強気ダイバージェンス (価格安値更新、RSI上昇)
    if (currentPrice < prevPrice && currentRsi > prevRsi) {
      divMsg = `⚠️【ダイバージェンス】価格安値更新(${currentPrice})に対しRSI(${CONFIG.GUARD.FIXED_STR(currentRsi)})が切り上がっています (反転上昇注意)`;
    }
    // 弱気ダイバージェンス (価格高値更新、RSI下落)
    else if (currentPrice > prevPrice && currentRsi < prevRsi) {
      divMsg = `⚠️【ダイバージェンス】価格高値更新(${currentPrice})に対しRSI(${CONFIG.GUARD.FIXED_STR(currentRsi)})が切り下がっています (反転下落注意)`;
    }

    return divMsg;
  }
};
