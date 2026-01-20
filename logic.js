(function(scope) {
  scope.executeMainLogic = function(params) {
    const { c, cArr, logSheet, webhookUrl, now } = params;
    
    // --- 1. テクニカル指標の計算 ---
    const slice20 = cArr.slice(-20);
    const ma20 = slice20.reduce((a, b) => a + b) / 20;
    const sd = Math.sqrt(slice20.reduce((s, v) => s + Math.pow(v - ma20, 2), 0) / 20);
    const bbPos = ((c - ma20) / sd).toFixed(2);
    const maDiff = (c - ma20).toFixed(3);
    
    // 前日比 (24時間前との差)
    const prevDayC = cArr[cArr.length - 25] || cArr[0];
    const dayChange = (c - prevDayC).toFixed(3);
    
    // RSI (14期間)
    const rsi = (function() {
      let up = 0, down = 0;
      for (let i = cArr.length - 14; i < cArr.length; i++) {
        let diff = cArr[i] - cArr[i-1];
        if (diff > 0) up += diff; else down -= diff;
      }
      return (up + down) !== 0 ? (up / (up + down) * 100).toFixed(1) : "50.0";
    })();

    // トレンド判定
    const prevMa20 = cArr.slice(-21, -1).reduce((a, b) => a + b) / 20;
    const trend = (ma20 > prevMa20 + 0.01) ? "上昇" : (ma20 < prevMa20 - 0.01) ? "下落" : "横ばい";

    // --- 2. シートの2行目を更新 (9時台に限定せず、毎時更新でOKなら条件を外せます) ---
    // ひとまず、ぽけさんの運用に合わせて9時台に更新するようにします
    if (now.getHours() === 9) {
      const dateStr = Utilities.formatDate(now, "JST", "yyyy/MM/dd(E)");
      
      // シート1の項目順: [日付, 価格, 前日比, トレンド, RSI, MA乖離, BB位置, シグナル]
      const dashboardRow = [
        dateStr,    // 日付
        c.toFixed(3), // 価格
        dayChange,  // 前日比
        trend,      // トレンド
        rsi,        // RSI
        maDiff,     // MA乖離
        bbPos,      // BB位置
        "判定中"      // シグナル
      ];
      
      // 2行目に上書き (行を追加せず、既存の数値を更新)
      logSheet.getRange(2, 1, 1, 8).setValues([dashboardRow]);
      
      // 完了報告
      UrlFetchApp.fetch(webhookUrl, {
        method: "post", 
        contentType: "application/json", 
        payload: JSON.stringify({content: "📊 シート1の分析データを更新しました。"})
      });
    }
  };
})(this);
