function execute4hLogic(p) {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();

  // --- 土日・早朝スキップ（月曜5時〜土曜7時稼働） ---
  if (day === 0) return;
  if (day === 1 && hour < 5) return;
  if (day === 6 && hour >= 7) return;

  const { c, cArr, logSheet, webhookUrl, dateStr } = p;
  
  // 【現物仕様】20本未満は診断を中止
  if (cArr.length < 20) return;

  // 市場セッション判定
  let session = "時間外";
  if (hour >= 9 && hour < 15) session = "東京";
  else if (hour >= 16 && hour < 21) session = "欧州";
  else if (hour >= 22 || hour < 2) session = "NY";
  else if (hour === 15 || hour === 21) session = "重なり";

  // 【現物仕様】テクニカル計算ロジック
  const ma = cArr.reduce((a, b) => a + b) / cArr.length;
  const sigma = Math.sqrt(cArr.map(x => Math.pow(x - ma, 2)).reduce((a, b) => a + b) / cArr.length);
  const diff = c - ma; // MA乖離
  const prevC = cArr[cArr.length - 2];
  const move = Math.abs(c - prevC); // 反転確認用の値

  let signal = "様子見";
  let star = "☆☆☆";

  // 【現物仕様】判定アルゴリズム
  if (c > ma + 2 * sigma) {
    signal = (move > sigma * 0.7) ? "反転下落" : "売り検討";
    star = (signal === "反転下落") ? "★★★" : "★★☆";
  } else if (c < ma - 2 * sigma) {
    signal = (move > sigma * 0.7) ? "反転上昇" : "買い検討";
    star = (signal === "反転上昇") ? "★★★" : "★★☆";
  }

  // 【現物仕様】ログ書き込み（MA乖離の小数点整形含む）
  if (logSheet) {
    logSheet.appendRow([dateStr, c, signal, star, diff.toFixed(3), session]);
  }

  // 【現物仕様】Discord通知
  const payload = JSON.stringify({
    content: `【4H診断 / ${session}市場】\n価格: ${c}\n判定: ${signal} ${star}\nMA乖離: ${diff.toFixed(3)}\n時刻: ${dateStr}`
  });
  UrlFetchApp.fetch(webhookUrl, { method: "post", contentType: "application/json", payload: payload });
}
