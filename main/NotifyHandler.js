/**
 * main/NotifyHandler.js
 * 通知実行・外部連携ロジック
 * [仕様書 v4.3: PropertiesService参照・完全移行版]
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

    // 【重要】スクリプトプロパティからWebhook URLを直接取得
    // これにより GitHub 上に URL を残さず安全に運用可能
    const url = PropertiesService.getScriptProperties().getProperty('DISCORD_URL');

    if (!url) {
      console.warn("通知スキップ: スクリプトプロパティ 'DISCORD_URL' が未設定です。GASの「プロジェクトの設定」を確認してください。");
      return;
    }

    const payload = {
      content: message
    };

    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      // 仕様書準拠: 通信エラー等でメイン処理を止めない
      muteHttpExceptions: true
    };

    try {
      const res = UrlFetchApp.fetch(url, options);
      const code = res.getResponseCode();
      if (code >= 200 && code < 300) {
        console.log("Discord通知成功");
      } else {
        // 401:認証エラー, 404:URL間違い 等の判定用
        console.error(`Discord通知失敗 (Status: ${code}): ${res.getContentText()}`);
      }
    } catch (e) {
      // ネットワーク切断等でもメインロジック（分析）は継続
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
