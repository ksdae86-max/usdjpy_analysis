/**
 * main/NotifyHandler.js
 * 通知実行・外部連携ロジック
 * [仕様書 v3.0: Discord連携, エラーハンドリングを完全実装]
 */

const NotifyHandler = {
  /**
   * Discordへメッセージを送信する
   * @param {string} message - 送信内容
   */
  sendDiscord: function(message) {
    const url = CONFIG.DISCORD_URL;
    if (!url) {
      console.warn("Discord Webhook URLが設定されていないため、送信をスキップします。");
      return;
    }

    const payload = {
      content: message
    };

    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      // 仕様書準拠: ネットワークエラー等でメイン処理を止めない設定
      muteHttpExceptions: true
    };

    try {
      const res = UrlFetchApp.fetch(url, options);
      const code = res.getResponseCode();
      if (code >= 200 && code < 300) {
        console.log("Discord通知成功");
      } else {
        console.error(`Discord通知失敗 (Status: ${code}): ${res.getContentText()}`);
      }
    } catch (e) {
      console.error(`通知送信中に例外が発生しました: ${e.message}`);
    }
  },

  /**
   * 標準ログ（実行履歴）への記録
   */
  log: function(msg) {
    console.log(`[SYSTEM LOG] ${msg}`);
  }
};
