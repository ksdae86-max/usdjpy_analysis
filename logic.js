/**
 * MainHourly.gs
 * GitHubから最新ロジックを読み込み、シート更新とポジション監視を実行します。
 */
function runAnalysis() {
  const now = new Date();
  // 土日は実行しない
  if (now.getDay() === 0 || now.getDay() === 6) return; 

  // キャッシュ回避のためタイムスタンプを付与
  const GITHUB_RAW_URL = "https://raw.githubusercontent.com/ksdae86-max/usdjpy_analysis/refs/heads/main/logic.js?t=" + now.getTime();
  
  try {
    const response = UrlFetchApp.fetch(GITHUB_RAW_URL, { "muteHttpExceptions": true });
    if (response.getResponseCode() !== 200) throw new Error("GitHub接続失敗");

    const scriptText = response.getContentText();
    eval(scriptText); // GitHubのコードを読み込み

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const res = UrlFetchApp.fetch("https://query1.finance.yahoo.com/v8/finance/chart/JPY=X?interval=1h&range=5d");
    const q = JSON.parse(res.getContentText()).chart.result[0].indicators.quote[0];
    const cArr = q.close.filter(v => v != null);

    // シート指定
    const logSheet = ss.getSheetByName("シート1");
    const posSheet = ss.getSheetByName("ポジション");

    if (!logSheet) throw new Error("「シート1」が見つかりません");

    const params = {
      c: cArr[cArr.length - 1],
      cArr: cArr,
      hArr: q.high.filter(v => v != null),
      lArr: q.low.filter(v => v != null),
      posSheet: posSheet,
      logSheet: logSheet, 
      webhookUrl: PropertiesService.getScriptProperties().getProperty('DISCORD_URL'),
      now: now 
    };

    // GitHub側のメインロジック(executeMainLogic)を実行
    executeMainLogic(params);
    console.log("正常終了: 価格 " + params.c);
    
  } catch (e) {
    console.error("Fatal Error: " + e.toString());
    const url = PropertiesService.getScriptProperties().getProperty('DISCORD_URL');
    if (url) UrlFetchApp.fetch(url, {method:"post", contentType:"application/json", payload:JSON.stringify({content:"🚨 GAS実行エラー: " + e.toString()})});
  }
}
