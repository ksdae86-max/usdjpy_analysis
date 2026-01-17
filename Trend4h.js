/**
 * Trend4h.js - Trend4h用ロジック (v31)
 * 診断：トレンド方向への押し目(順張り) + 異常乖離からの反転(逆張り)
 */
(function(scope) {
  scope.execute4hLogic = function(params) {
    const { c, o, h, l, cArr, webhookUrl, dateStr } = params;

    // テクニカル指標計算
    const slice20 = cArr.slice(-20);
    const ma20 = slice20.reduce((a, b) => a + b) / 20;
    const sd = Math.sqrt(slice20.reduce((s, v) => s + Math.pow(v - ma20, 2), 0) / 20);
    const bbUpper = ma20 + (sd * 2);
    const bbLower = ma20 - (sd * 2);
    const bbPos = (c - ma20) / sd;

    // トレンド強度判定（MA20の傾き）
    const prevMa20 = cArr.slice(-21, -1).reduce((a, b) => a + b) / 20;
    const maSlope = (ma20 - prevMa20); 
    const isStrongUp = maSlope > 0.035;   
    const isStrongDown = maSlope < -0.035;

    // ローソク足判定
    const body = Math.abs(o - c), safeBody = Math.max(body, 0.015);
    const upWick = h - Math.max(o, c), loWick = Math.min(o, c) - l;
    
    let signal = "", subMsg = "";

    // A: 順張りシグナル（強いトレンド中の中心線反発）
    if (isStrongUp && loWick >= safeBody * 0.7 && Math.abs(c - ma20) < sd * 0.4) {
      signal = "📈 **押し目買いチャンス（順張り期待）**";
      subMsg = "上昇トレンド継続中、中心線付近でサポートを確認。\n期待値：BB上限まで約" + ((bbUpper - c) * 100).toFixed(0) + " pips";
    } 
    else if (isStrongDown && upWick >= safeBody * 0.7 && Math.abs(c - ma20) < sd * 0.4) {
      signal = "📉 **戻り売りチャンス（順張り期待）**";
      subMsg = "下落トレンド継続中、中心線付近でレジスタンスを確認。\n期待値：BB下限まで約" + ((c - bbLower) * 100).toFixed(0) + " pips";
    }
    // B: 逆張りシグナル（±2σでの行き過ぎ）
    else if (upWick >= safeBody * 0.9 && bbPos > 1.8) {
      signal = "🔔 **天井反転アラート（逆張り警戒）**";
      subMsg = "買われすぎ水準での上ヒゲ発生。\n第一目標：中心線(MA20)まで約" + ((c - ma20) * 100).toFixed(0) + " pips";
    } 
    else if (loWick >= safeBody * 0.9 && bbPos < -1.8) {
      signal = "🔔 **底値反発アラート（逆張り警戒）**";
      subMsg = "売られすぎ水準での下ヒゲ発生。\n第一目標：中心線(MA20)まで約" + ((ma20 - c) * 100).toFixed(0) + " pips";
    }

    if (signal) {
      const msg = `🕒 **4H足 トレード診断** [${dateStr}]\n──────────────────\n${signal}\n\n${subMsg}\n価格: ${c.toFixed(3)}\n──────────────────`;
      UrlFetchApp.fetch(webhookUrl, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({ content: msg })
      });
    }
  };
})(this);
