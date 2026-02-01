/**
 * main/NotifyHandler.js
 * 通知実行・外部連携ロジック
 * [仕様書 v3.0: Discord連携, エラーハンドリングを完全実装]
 * [ブラッシュアップ: 空送信ガード & ログ品質向上]
 */

const NotifyHandler = {
  /**
   * Discordへメッセージを送信する
   * @param {string} message - 送信内容
   */
  sendDiscord: function(message) {
    // 【ガード】メッセージが空、または不正な場合は送信しない
    if (!message || typeof message !== 'string' || message.trim() === "") {
      console.warn("通知スキップ: 送信内容が空です。");
      return;
    }

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
      // 例外が発生してもメインロジック（分析）は継続させる
      console.error(`通知送信中に例外が発生しました: ${e.message}`);
    }
  },

  /**
   * 標準ログ（実行履歴）への記録
   * [徹底的なデータベース化の補助]
   */
  log: function(msg) {
    const timestamp = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss");
    console.log(`[${timestamp}] [SYSTEM LOG] ${msg}`);
  }
};
