/**
 * ダイバージェンス & 初動分析 (Divergence.js)
 * ロジック：ボラティリティ初動を起点とした動的スキャン & データベース記録
 */
function executeDivergenceLogic(p) {
  const { ss, logSheet, dateStr } = p;
  const lastRow = logSheet.getLastRow();
  // 文脈把握のため直近50本分を取得（100本蓄積を活用）
  if (lastRow < 20) return; 

  // [0:日時, 1:価格, 2:判定, 3:★, 4:MA乖離, 5:時間帯, 6:RSI]
  const data = logSheet.getRange(Math.max(1, lastRow - 49), 1, Math.min(lastRow, 50), 7).getValues();
  const prices = data.map(r => r[1]);
  
  const now = { p: data[data.length-1][1], rsi: data[data.length-1][6], diff: data[data.length-1][4], hour: data[data.length-1][5] };
  const prev = { p: data[data.length-2][1], rsi: data[data.length-2][6], diff: data[data.length-2][4] };
  const pprev = { p: data[data.length-3][1], rsi: data[data.length-3][6] };

  // --- 1. 初動の動的スキャン ---
  let originP = 0; 
  let originIdx = 0;
  let direction = ""; 

  // 直近20本から「平均ボラの2倍超」の突き抜け足を探す
  for (let i = data.length - 20; i < data.length; i++) {
    const change = prices[i] - prices[i-1];
    let avgMove = 0;
    for (let j = i - 5; j < i; j++) { avgMove += Math.abs(prices[j] - prices[j-1]); }
    avgMove /= 5;

    if (Math.abs(change) > avgMove * 2.0 && Math.abs(change) > 0.15) {
      originP = prices[i-1]; // 初動足の始値
      originIdx = i;
      direction = change < 0 ? "DOWN" : "UP";
    }
  }

  // 初動が見つからない場合は終了
  if (!direction) return; 

  // --- 2. 形状・速度分析 ---
  const subPrices = prices.slice(originIdx);
  const extremeP = (direction === "DOWN") ? Math.min(...subPrices) : Math.max(...subPrices);
  const extremeIdx = prices.lastIndexOf(extremeP);
  const totalRange = Math.abs(originP - extremeP);
  
  if (totalRange < 0.3) return; // 30pips未満の波は分析対象外

  const retraceRatio = Math.abs(now.p - extremeP) / totalRange;
  const recoveryTime = (data.length - 1) - extremeIdx; // 極値からの経過時間
  const moveTime = extremeIdx - originIdx;           // 初動から極値までの時間
  
  // 速度比：(戻り率 / 戻り時間) / (1.0 / 初動時間)
  const speedRatio = recoveryTime > 0 ? (retraceRatio / recoveryTime) / (1.0 / moveTime) : 0;

  // --- 3. 【データベース化】最新行のH-K列へ記録 ---
  // H:起点価格, I:経過(h), J:戻り率(%), K:速度比
  const dbData = [
    originP.toFixed(3), 
    ((data.length - 1 - originIdx) * 4) + "h", 
    (retraceRatio * 100).toFixed(1) + "%", 
    speedRatio.toFixed(2)
  ];
  logSheet.getRange(lastRow, 8, 1, 4).setValues([dbData]);

  // --- 4. 判定ロジック (現物のダイバージェンス構造を継承) ---
  const isExtreme = data.slice(-3).some(r => r[6] >= 75 || r[6] <= 25 || Math.abs(r[4]) >= 0.7);
  const diffReduction = Math.abs(prev.diff) - Math.abs(now.diff);
  const isVolSlowing = Math.abs(now.p - prev.p) < Math.abs(prev.p - pprev.p);

  let alertType = "";
  let msg = "";

  // トレンド順行・反転判定
  if (retraceRatio < 0.382) {
    alertType = direction === "DOWN" ? "📉【急落・順行警戒】" : "📈【急騰・順行警戒】";
    msg = `初動始値 ${originP.toFixed(3)} からの戻りが ${dbData[2]} と極めて浅い状態です。`;
  } else if (retraceRatio >= 0.618) {
    alertType = "⚡【V字反転・全戻し圏】";
    msg = `初動を打ち消す強い戻り(${dbData[2]})を検知しました。`;
  }

  // ダイバージェンス補足
  if (isExtreme && diffReduction > 0) {
    if (direction === "DOWN" && now.rsi > prev.rsi) {
      msg += `\n🔵 底値圏でRSIが反転上昇中。売り圧力が減衰しています。`;
    } else if (direction === "UP" && now.rsi < prev.rsi) {
      msg += `\n🔴 天井圏でRSIが低下中。上昇エネルギーが枯渇しています。`;
    }
  }

  // --- 5. 通知の実行 ---
  if (alertType !== "") {
    const probability = isVolSlowing ? "高 [ボラ縮小を伴う]" : "中";
    const finalMsg = `🔔 **${alertType}**\n${msg}\n反転期待度: ${probability}\n経過: ${dbData[1]} / 速度比: ${dbData[3]}\n時刻: ${dateStr}`;
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
