function executeLogic(p) {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();

  // --- 土日・早朝スキップ（月曜5時〜土曜7時稼働） ---
  if (day === 0) return; 
  if (day === 1 && hour < 5) return; 
  if (day === 6 && hour >= 7) return; 

  const { c, ss, dateStr } = p;
  const calcSheet = ss.getSheetByName("計算用最新20");

  // 【現物仕様】数値が正常な場合のみ蓄積を実行
  if (c && !isNaN(c)) {
    calcSheet.appendRow([c, dateStr]);
    
    // 【現物仕様】21本目で1行目を削除し、Queue構造を維持
    if (calcSheet.getLastRow() > 20) {
      calcSheet.deleteRow(1);
    }
  }
}
