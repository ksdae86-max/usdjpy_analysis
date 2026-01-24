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
  if (cArr.length < 20) return;

  // セッション定義
  let session = "深夜";
  if (hour >= 9 && hour < 15) session = "東京";
  else if (hour >= 15 && hour < 21) session = "欧州";
  else if (hour >= 21 || hour < 3) session = "ＮＹ";

  const ma = cArr.reduce((a, b) => a + b) / cArr.length;
  const sigma = Math.sqrt(cArr.map(x => Math.pow(x - ma, 2)).reduce((a, b) => a + b) / cArr.length);
  const currentSigma = (c - ma) / sigma;
  const diff = c - ma;
  const prevC = cArr[cArr.length - 2];

  // RSI(14)
  let ups = 0, downs = 0;
  for (let i = 1; i < 15; i++) {
    const change = cArr[cArr.length - i] - cArr[cArr.length - i - 1];
    if (change > 0) ups += change; else downs -= change;
  }
  const rsi = (ups + downs === 0) ? 50 : (ups / (ups + downs)) * 100;

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
    logSheet.appendRow([dateStr, c, signal, star, diff.toFixed(3), session, rsi.toFixed(1)]);
  }

  // Discord通知
  const webhookUrl = PropertiesService.getScriptProperties().getProperty('DISCORD_URL');
  if (webhookUrl) {
    let content = `【4H診断 / ${session}市場】\n価格: ${c}\n判定: ${signal} ${star}\nMA乖離: ${diff.toFixed(3)}\nRSI: ${rsi.toFixed(1)}\n時刻: ${dateStr}`;
    if (Math.abs(diff) >= 0.500) content = "⚠️【MA乖離警告】\n" + content;

    UrlFetchApp.fetch(webhookUrl, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ content: content }),
      muteHttpExceptions: true
    });
  }
}
