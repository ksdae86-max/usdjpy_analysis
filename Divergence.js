/**
 * ダイバージェンス判定ロジック (Divergence.js) - 10段階ブラッシュアップ版
 * 判定ソース: 4H診断ログ (A:日時, B:価格, C:判定, D:★, E:MA乖離, F:時間帯, G:RSI)
 */
function executeDivergenceLogic(p) {
  const { ss, logSheet, dateStr } = p;
  const lastRow = logSheet.getLastRow();
  if (lastRow < 10) return; // 10本分（40時間）の文脈を読み取る

  // 10本分のデータを取得 [0:日時, 1:価格, 2:判定, 3:★, 4:MA乖離, 5:時間帯, 6:RSI]
  const data = logSheet.getRange(lastRow - 9, 1, 10, 7).getValues();
  
  // 各指標の定義 (now:最新, prev:4H前, pprev:8H前)
  const now = { p: data[9][1], diff: data[9][4], rsi: data[9][6] };
  const prev = { p: data[8][1], diff: data[8][4], rsi: data[8][6] };
  const pprev = { p: data[7][1], diff: data[7][4], rsi: data[7][6] };

  // --- ブラッシュアップ内容（1〜10） ---
  // 1. 過去10本(40時間)の最高値・最安値を特定し、現在地との距離を測定
  const windowPrices = data.map(r => r[1]);
  const maxP = Math.max(...windowPrices);
  const minP = Math.min(...windowPrices);

  // 2. 過熱感の定義：過去3本にRSI 75以上/25以下、またはMA乖離 0.7以上のスパイクがあったか
  const isExtreme = data.slice(6, 9).some(r => r[6] >= 75 || r[6] <= 25 || Math.abs(r[4]) >= 0.7);

  // 3. 勢いの減衰率：MA乖離がピークから何％縮小したか
  const diffReduction = Math.abs(prev.diff) - Math.abs(now.diff);

  // 4. 加速停止判定：価格の変動幅が直近3本で縮小しているか
  const isVolSlowing = Math.abs(now.p - prev.p) < Math.abs(prev.p - pprev.p);

  let msg = "";
  let alertType = "";

  // --- 判定ロジック：弱気（天井圏での反転） ---
  // 5. 天井固め判定：最高値付近にいるが、RSIは直近3本で連続下降している
  if (isExtreme && now.p >= maxP * 0.999) {
    if (now.rsi < prev.rsi && now.rsi < pprev.rsi && diffReduction > 0) {
      alertType = "🔴【天井圏・弱気ダイバージェンス】";
      msg = `価格は最高値(${now.p})付近で粘っていますが、RSIは2期連続で低下。` +
            `MA乖離も ${now.diff} まで縮小しており、上昇エネルギーが枯渇しました。`;
    }
  }

  // --- 判定ロジック：強気（底値圏での反発） ---
  // 6. 底固め判定：最安値付近にいるが、RSIは反転上昇を開始している
  if (isExtreme && now.p <= minP * 1.001) {
    if (now.rsi > prev.rsi && now.rsi > pprev.rsi && diffReduction > 0) {
      alertType = "🔵【底値圏・強気ダイバージェンス】";
      msg = `価格は安値(${now.p})を試していますが、RSIは反転上昇中。` +
            `乖離幅も ${now.diff} へ縮小し、売り圧力が買い戻しに負け始めています。`;
    }
  }

  // 7. 通知トリガーの実行
  if (alertType !== "") {
    // 8. 時間帯情報の付与（ロジック形成用）
    const timeInfo = `（${data[9][5]}時台 確定値）`;
    // 9. 期待度の可視化（ダイバージェンス＋ボラ縮小なら高確率）
    const probability = isVolSlowing ? "高 [ボラ縮小を伴う反転]" : "中 [価格停滞]";
    
    // 10. 最終メッセージ形成
    const finalMsg = `🔔 **${alertType}**\n${msg}\n反転期待度: ${probability}\n${timeInfo}`;
    sendDiscord(finalMsg);
  }
}

function sendDiscord(msg) {
  const url = PropertiesService.getScriptProperties().getProperty('DISCORD_URL');
  if (!url) return;
  UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ content: msg }),
    muteHttpExceptions: true
  });
}
