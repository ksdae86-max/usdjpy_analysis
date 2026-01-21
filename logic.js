/**
 * logic.js - サバイバル・モード搭載版
 * Yahoo制限中（cArrなし）でも、Google価格で含み益を監視します。
 */
function executeMainLogic(params) {
  const { c, cArr, posSheet, logSheet, webhookUrl, now } = params;

  // 1. ポジション状況の確認（D列が空のものを探す）
  const data = posSheet.getDataRange().getValues();
  let activePosition = null;

  for (let i = 1; i < data.length; i++) {
    if (!data[i][3]) { // D列（ステータス）が未入力
      activePosition = {
        row: i + 1,
        entryPrice: data[i][0],
        side: data[i][1]
      };
      break; 
    }
  }

  // 保有ポジションがなければ、これ以上やることはないので終了
  if (!activePosition) return;

  // 2. 現在価格による利益計算（過去データ不要）
  const currentPrice = c;
  const entryPrice = activePosition.entryPrice;
  const side = activePosition.side;
  
  // 利益(pips)計算。ドル円を想定（0.01 = 1pip）
  let profitPips = (side === "L") ? (currentPrice - entryPrice) : (entryPrice - currentPrice);
  profitPips = profitPips * 100; 

  // --- 緊急通知判定（利確・損切り目安） ---
  // 例：20pips以上の利益、または-15pips以上の損失で通知
  if (profitPips > 20 || profitPips < -15) {
    const statusEmoji = profitPips > 0 ? "💰" : "⚠️";
    sendDiscordNotification(webhookUrl, 
      `${statusEmoji} 【価格監視アラート】\n` +
      `現在価格: ${currentPrice.toFixed(3)}\n` +
      `保有: ${activePosition.row}行目 [${side}]\n` +
      `損益: 約 ${profitPips.toFixed(1)} pips\n` +
      `(備考: 現在API制限中のため、MA判定を除外して価格のみで監視中)`
    );
  }

  // 3. MA20判定（ここから先は過去データが必要）
  if (!cArr || cArr.length < 20) {
    console.warn("過去データ不足のため、MA20判定をスキップします。価格監視は実行済み。");
    return;
  }

  // --- 通常のMA20ロジック ---
  try {
    const last20 = cArr.slice(-20);
    const ma20 = last20.reduce((a, b) => a + b, 0) / 20;

    const diff = currentPrice - ma20;
    // ロングでMAを下回った、またはショートでMAを上回った場合に通知
    const isMaTouched = (side === "L" && diff < 0) || (side === "S" && diff > 0);

    if (isMaTouched) {
      sendDiscordNotification(webhookUrl, 
        `【MA20タッチ】\n` +
        `価格(${currentPrice.toFixed(3)})がMA20(${ma20.toFixed(3)})をクロスしました。\n` +
        `決済を検討してください。`
      );
    }

    // ログ記録（データがある時のみ）
    if (logSheet) {
      logSheet.appendRow([now, currentPrice, ma20.toFixed(3), "保有中"]);
    }
  } catch (e) {
    console.error("MA分析エラー: " + e.toString());
  }
}

/**
 * Discord通知サブ関数
 */
function sendDiscordNotification(url, message) {
  if (!url) return;
  try {
    const payload = { "content": message };
    const options = {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    };
    UrlFetchApp.fetch(url, options);
  } catch (e) {
    console.error("通知送信エラー: " + e.toString());
  }
}
