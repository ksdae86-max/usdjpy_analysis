/**
 * form/AssetRecorder.js
 * 資産記録およびLot計算シートの更新ロジック
 * [現物ロジックを完全に部品化]
 */

function executeAssetRecord(responses) {
  const ss = SpreadsheetApp.openById(CONFIG.SSID);
  const archiveSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ASSET_LOG);
  const lotSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.LOT_CALC);
  
  // 1. フォームからの資産額取得 (CONFIGのインデックスを使用)
  const currentAssets = parseFloat(responses[CONFIG.IDX.ASSET_VAL]);
  const timestamp = responses[CONFIG.IDX.TIMESTAMP];

  if (isNaN(currentAssets)) {
    console.error("資産額が数値ではありません。処理を中断します。");
    return;
  }

  // 2. 増減率の計算 [現物継承: toFixed(3)]
  const lastRowArchive = archiveSheet.getLastRow();
  let growthRateStr = "0.000%";
  
  if (lastRowArchive >= 2) {
    const prevAssets = archiveSheet.getRange(lastRowArchive, 2).getValue();
    if (prevAssets && !isNaN(prevAssets)) {
      const growthRate = ((currentAssets - prevAssets) / prevAssets) * 100;
      growthRateStr = growthRate.toFixed(3) + "%"; 
    }
  }
  
  // 3. 推奨Lotの計算 [現物継承: 係数25000]
  const calcLot = (currentAssets / CONFIG.LOT_COEFFICIENT).toFixed(2);
  
  // 4. 資産推移記録（アーカイブ）への追記
  // A:タイムスタンプ, B:資産額, C:増減率, D:推奨Lot
  archiveSheet.appendRow([timestamp, currentAssets, growthRateStr, calcLot]);

  // 5. Lot計算シートの更新 [現物継承: 常に最新1件のみを維持]
  const lastRowLot = lotSheet.getLastRow();
  if (lastRowLot >= 2) {
    lotSheet.deleteRows(2, lastRowLot - 1);
  }
  // A:タイムスタンプ, B:資産額, C:推奨Lot
  lotSheet.appendRow([timestamp, currentAssets, calcLot]);
  
  SpreadsheetApp.flush();
}
