/**
 * form/EntryHandler.js
 * 新規エントリー時の価格取得およびポジション記録
 * [現物APIロジックと4列構成を完全継承]
 */

function executeEntry(responses) {
  const ss = SpreadsheetApp.openById(CONFIG.SSID);
  const posSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.POSITION);
  
  // 1. フォームからの売買区分取得 (L or S)
  const side = (responses[CONFIG.IDX.SIDE] || "").toString().trim();
  const timestamp = responses[CONFIG.IDX.TIMESTAMP];

  try {
    // 2. 価格取得 [現物継承: Yahoo Finance API]
    const apiUrl = "https://query1.finance.yahoo.com/v8/finance/chart/JPY=X?interval=1m&range=1m";
    const res = UrlFetchApp.fetch(apiUrl);
    const result = JSON.parse(res.getContentText());
    const price = result.chart.result[0].meta.regularMarketPrice;

    // 3. 数値チェックガード & 書き込み
    if (price && !isNaN(price)) {
      // 仕様書順守: [A:価格, B:L/S, C:前回通知(空), D:ステータス(空)]
      // 前回通知を空にすることで、1hスクリプトが「初回通知対象」と認識できるようにします
      posSheet.appendRow([price, side, "", ""]);
      
      SpreadsheetApp.flush();
      console.log(`新規エントリー記録完了: ${side} @ ${price}`);
    } else {
      console.error("取得価格が不正です:", price);
    }

  } catch (err) {
    console.error("EntryHandlerでエラーが発生しました:", err.message);
  }
}
