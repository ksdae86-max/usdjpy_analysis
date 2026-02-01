/**
 * main/Divergence.js
 * ダイバージェンス（逆行現象）検知ロジック
 * [仕様書 v3.0: 過去10本(40h)の履歴から反転の予兆を検知]
 * [ブラッシュアップ: 数値判定ガード & 精度検証を注入]
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
    // A-G列(7列分)を取得。インデックス: [0:日時, 1:価格, 2:MA, 3:乖離...6:RSI]
    const data = logSheet.getRange(lastRow - 9, 1, 10, 7).getValues();

    // 直近3本とそれ以前（過去7本）に分解
    const recent3 = data.slice(-3);
    const past7   = data.slice(0, 7);

    // 2. 条件(1): 過去3本以内に極端な過熱があるか
    const hasExtreme = recent3.some(row => {
      // 【徹底ガード】数値チェックガードを適用
      const rsi = parseFloat(row[6]);
      const diff = parseFloat(row[4]);
      
      if (isNaN(rsi) || isNaN(diff)) return false;

      // 仕様書準拠: RSI 75/25, 乖離 0.7
      return (rsi >= 75 || rsi <= 25 || Math.abs(diff) >= 0.7);
    });

    if (!hasExtreme) return null;

    // 3. 条件(2): 逆行現象の検知
    // 価格と指標の数値を数値型として確定
    const currentPrice = parseFloat(data[9][1]);
    const prevPrice    = parseFloat(data[0][1]);
    const currentRsi   = parseFloat(data[9][6]);
    const prevRsi      = parseFloat(data[0][6]);

    // 【数値ガード】一つでもNaNがあれば判定不能として中断
    if ([currentPrice, prevPrice, currentRsi, prevRsi].some(v => isNaN(v))) {
      console.warn("Divergence: 判定用の数値に不純物が含まれているためスキップします。");
      return null;
    }

    let divMsg = "";
    // 強気ダイバージェンス (価格安値更新、RSI上昇)
    if (currentPrice < prevPrice && currentRsi > prevRsi) {
      // 徹底分析: 数値を表示する際は精度を明示
      divMsg = `⚠️【ダイバージェンス】価格安値更新(${currentPrice})に対しRSI(${currentRsi.toFixed(3)})が切り上がっています (反転上昇注意)`;
    }
    // 弱気ダイバージェンス (価格高値更新、RSI下落)
    else if (currentPrice > prevPrice && currentRsi < prevRsi) {
      divMsg = `⚠️【ダイバージェンス】価格高値更新(${currentPrice})に対しRSI(${currentRsi.toFixed(3)})が切り下がっています (反転下落注意)`;
    }

    return divMsg;
  }
};
