/**
 * ダイバージェンス & 初動分析 (Divergence.js v4.0)
 * 【10段階のブラッシュアップ適用済】
 */
function executeDivergenceLogic(p) {
  const { logSheet, dateStr } = p;
  const lastRow = logSheet.getLastRow();
  if (lastRow < 20) return; 

  // 1. 【広域スキャン】100本蓄積をフル活用し、文脈を正確に把握
  const data = logSheet.getRange(Math.max(1, lastRow - 99), 1, Math.min(lastRow, 100), 11).getValues();
  const prices = data.map(r => r[1]);
  
  const now = { p: data[data.length-1][1], rsi: data[data.length-1][6], diff: data[data.length-1][4], hour: data[data.length-1][5] };
  const prev = { p: data[data.length-2][1], rsi: data[data.length-2][6], diff: data[data.length-2][4] };
  const pprev = { p: data[data.length-3][1], rsi: data[data.length-3][6] };

  // 2. 【動的起点検知】ボラティリティ急増の「質」を判定
  let originP = 0, originIdx = 0, direction = ""; 
  for (let i = data.length - 25; i < data.length; i++) {
    const change = prices[i] - prices[i-1];
    // 3. 【適応型閾値】直近5本の平均変動幅に対し、2.5倍の「突き抜け」を要求（ノイズ除去）
    let avgMove = 0;
    for (let j = i - 5; j < i; j++) { avgMove += Math.abs(prices[j] - prices[j-1]); }
    avgMove /= 5;

    if (Math.abs(change) > avgMove * 2.5 && Math.abs(change) > 0.20) {
      originP = prices[i-1]; 
      originIdx = i;
      direction = change < 0 ? "DOWN" : "UP";
    }
  }

  if (!direction) return; 

  // 4. 【極値の再定義】初動後の「本物の底/天井」を正確に特定
  const subPrices = prices.slice(originIdx);
  const extremeP = (direction === "DOWN") ? Math.min(...subPrices) : Math.max(...subPrices);
  const extremeIdx = prices.lastIndexOf(extremeP);
  const totalRange = Math.abs(originP - extremeP);
  
  // 5. 【最小ボラティリティ制限】30pips未満は「ただのノイズ」として除外
  if (totalRange < 0.3) return; 

  // 6. 【時間と価格の多次元分析】
  const retraceRatio = Math.abs(now.p - extremeP) / totalRange;
  const recoveryTime = (data.length - 1) - extremeIdx;
  const moveTime = extremeIdx - originIdx;
  const speedRatio = recoveryTime > 0 ? (retraceRatio / recoveryTime) / (1.0 / moveTime) : 0;
  const totalElapsedTime = (data.length - 1 - originIdx) * 4; // 初動からの合計時間(h)

  // 7. 【データベース自動記録】H-K列への書き込み
  const dbData = [originP.toFixed(3), totalElapsedTime + "h", (retraceRatio * 100).toFixed(1) + "%", speedRatio.toFixed(2)];
  logSheet.getRange(lastRow, 8, 1, 4).setValues([dbData]);

  // 8. 【高度なシグナルフィルタリング】
  const isExtreme = data.slice(-3).some(r => r[6] >= 75 || r[6] <= 25 || Math.abs(r[4]) >= 0.7);
  const diffReduction = Math.abs(prev.diff) - Math.abs(now.diff);
  const isVolSlowing = Math.abs(now.p - prev.p) < Math.abs(prev.p - pprev.p);

  let alertType = "";
  let msg = "";

  // 9. 【トレンド有効期限】初動から48時間以上経過した波は「鮮度が落ちた」とみなす
  const isFresh = totalElapsedTime <= 48;

  if (isFresh && retraceRatio < 0.382) {
    alertType = direction === "DOWN" ? "📉【急落・順行警戒】" : "📈【急騰・順行警戒】";
    msg = `初動始値 ${originP.toFixed(3)} に対する戻り ${dbData[2]}。強烈な順行サインです。`;
    if (speedRatio < 0.25) msg += `\n⏳ 戻り速度が極めて鈍く、再ブレイクの準備中と推測。`;
  } else if (retraceRatio >= 0.618) {
    alertType = "⚡【転換・V字反転】";
    msg = `初動を打ち消す強い戻りを検知。トレンド崩壊の可能性。`;
  }

  // ダイバージェンスの統合
  if (isExtreme && diffReduction > 0) {
    const isDiv = (direction === "DOWN" && now.rsi > prev.rsi) || (direction === "UP" && now.rsi < prev.rsi);
    if (isDiv) {
      alertType = alertType || "🔵【勢い減衰・逆行】";
      msg += `\n⚠️価格とRSIの逆行を確認。極値でのエネルギー切れが鮮明です。`;
    }
  }

  // 10. 【期待度のスコアリング】
  if (alertType !== "") {
    // 速度比が低く、ボラが縮小しているほど「鉄板」に近い
    const conviction = (speedRatio < 0.3 && isVolSlowing) ? "🔥 鉄板級 [時間・価格・ボラ一致]" : 
                       (isVolSlowing) ? "高 [反転準備中]" : "中";
                       
    const finalMsg = `🔔 **${alertType}**\n${msg}\n期待度: ${conviction}\n速度比: ${dbData[3]} / RSI: ${now.rsi.toFixed(1)}\n時刻: ${dateStr}`;
    sendDiscord(finalMsg);
  }
}

function sendDiscord(msg) {
  const url = PropertiesService.getScriptProperties().getProperty('DISCORD_URL');
  if (!url) return;
  UrlFetchApp.fetch(url, {
    method: "post", contentType: "application/json",
    payload: JSON.stringify({ content: msg }), muteHttpExceptions: true
  });
}
