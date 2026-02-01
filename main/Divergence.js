/**
 * main/Divergence.js
 * ダイバージェンス（逆行現象）検知ロジック
 * [仕様書 v3.0: 過去10本(40h)の履歴から反転の予兆を検知]
 */

const Divergence = {
  /**
   * 4H診断ログを参照し、ダイバージェンスを判定する
   */
  detect: function(ss) {
    const logSheet = ss.getSheetByName(CONFIG.SHEETS.TREND_4H);
    const lastRow = logSheet.getLastRow();
    if (lastRow < 11) return null; // 最低10本必要

    // 1. 過去10本分のデータを取得 (B:価格, E:乖離, G:RSI)
    const data = logSheet.getRange(lastRow - 9, 1, 10, 7).getValues();
    
    // 直近3本とそれ以前（過去7本）に分解
    const recent3 = data.slice(-3);
    const past7   = data.slice(0, 7);

    // 2. 条件(1): 過去3本以内に極端な過熱があるか
    const hasExtreme = recent3.some(row => {
      const rsi = parseFloat(row[6]);
      const diff = Math.abs(parseFloat(row[4]));
      return (rsi >= 75 || rsi <= 25 || diff >= 0.7);
    });

    if (!hasExtreme) return null;

    // 3. 条件(2): 逆行現象の検知
    // 価格は高値を更新（または維持）しているが、RSI/乖離が縮小しているか
    const currentPrice = data[9][1];
    const prevPrice    = data[0][1];
    const currentRsi   = data[9][6];
    const prevRsi      = data[0][6];

    let divMsg = "";
    // 強気ダイバージェンス (価格安値更新、RSI上昇)
    if (currentPrice < prevPrice && currentRsi > prevRsi) {
      divMsg = "⚠️【ダイバージェンス】価格安値更新に対しRSIが切り上がっています (反転上昇注意)";
    }
    // 弱気ダイバージェンス (価格高値更新、RSI下落)
    else if (currentPrice > prevPrice && currentRsi < prevRsi) {
      divMsg = "⚠️【ダイバージェンス】価格高値更新に対しRSIが切り下がっています (反転下落注意)";
    }

    return divMsg;
  }
};
