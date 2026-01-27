/**
 * 4時間ごとの環境認識ロジック
 * @param {Object} p - {c: price, cArr: array, logSheet: sheet, dateStr: string}
 */
function execute4hLogic(p) {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();

  // 市場クローズ判定
  if (day === 0 || (day === 1 && hour < 5) || (day === 6 && hour >= 7)) return;

  const { c, cArr, logSheet, dateStr } = p;
  
  // 指標計算に必要な最低限のデータ数
  if (cArr.length < 20) return;

  // セッション定義
  let session = "深夜";
  if (hour >= 9 && hour < 15) session = "東京";
  else if (hour >= 15 && hour < 21) session = "欧州";
  else if (hour >= 21 || hour < 3) session = "ＮＹ";

  // --- 【修正】MA(20) & Sigma(20) 計算 ---
  // データが100個あっても、MAとSigmaは直近20本に固定
  const analysisArr = cArr.slice(-20);
  const ma = analysisArr.reduce((a, b) => a + b) / 20;
  const sigma = Math.sqrt(analysisArr.map(x => Math.pow(x - ma, 2)).reduce((a, b) => a + b) / 20);
  const currentSigma = (c - ma) / sigma;
  const diff = c - ma;
  const prevC = cArr[cArr.length - 2];

  // --- 【修正】MT5準拠 RSI(14) 算出 ---
  // ワイルダー方式（平滑化）を適用。cArrの全データ（最大100件）を使用して精度を向上。
  const rsi = calculateWilderRSI(cArr, 14);

  // 判定
  let signal = "様子見";
  let star = "☆☆☆";

  if (currentSigma > 1.8 || rsi > 70) {
    signal = (currentSigma > 1.5 && c < prevC) ? "上ヒゲ出現" : "売り検討";
    star = (currentSigma > 2.2 && rsi > 75) ? "★★★" : "★★☆";
  } else if (currentSigma < -1.8 || rsi < 30) {
    signal = (currentSigma < -1.5 && c > prevC) ? "下ヒゲ出現" : "買い検討";
    star = (currentSigma < -2.2 && rsi < 25) ? "★★★" : "★★☆";
  }

  // 4H診断ログ
  if (logSheet) {
    // 列構成: 日時, 価格, 判定, 判定(★), MA乖離, 時間帯, RSI
    logSheet.appendRow([dateStr, c, signal, star, diff.toFixed(3), session, rsi.toFixed(1)]);
  }

  // Discord通知
  const webhookUrl = PropertiesService.getScriptProperties().getProperty('DISCORD_URL');
  if (webhookUrl) {
    let content = `【4H診断 / ${session}市場】\n価格: ${c}\n判定: ${signal} ${star}\nMA乖離: ${diff.toFixed(3)}\nRSI: ${rsi.toFixed(1)}\n時刻: ${dateStr}`;
    // 0.500 pips以上の乖離で警告付与
    if (Math.abs(diff) >= 0.500) content = "⚠️【MA乖離警告】\n" + content;

    UrlFetchApp.fetch(webhookUrl, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ content: content }),
      muteHttpExceptions: true
    });
  }
}

/**
 * MT5準拠 RSI計算 (ワイルダーの修正移動平均)
 */
function calculateWilderRSI(prices, period) {
  if (prices.length <= period) return 50;
  
  let diffs = [];
  for (let i = 1; i < prices.length; i++) {
    diffs.push(prices[i] - prices[i - 1]);
  }

  let upSum = 0;
  let downSum = 0;
  // 初回計算（最初のperiod分は単純平均）
  for (let i = 0; i < period; i++) {
    let d = diffs[i];
    if (d > 0) upSum += d; else if (d < 0) downSum -= d;
  }
  let upAvg = upSum / period;
  let downAvg = Math.abs(downSum) / period;

  // ワイルダーの平滑化（過去の平均を13/14引き継ぐMT5方式）
  for (let i = period; i < diffs.length; i++) {
    let d = diffs[i];
    let up = d > 0 ? d : 0;
    let down = d < 0 ? Math.abs(d) : 0;
    upAvg = (upAvg * (period - 1) + up) / period;
    downAvg = (downAvg * (period - 1) + down) / period;
  }

  return downAvg === 0 ? 100 : 100 - (100 / (1 + upAvg / downAvg));
}
