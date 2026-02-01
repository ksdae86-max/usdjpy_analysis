/**
 * form/NotifyHandler.js
 * フォーム操作時の通知用部品
 */

const NotifyHandler = {
  send: function(message) {
    // form/Config.js に定義した通知先（またはメイン共通のプロパティ）を使用
    const url = CONFIG.DISCORD_URL; 
    if (!url) return;

    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ content: message }),
      muteHttpExceptions: true
    };

    try {
      UrlFetchApp.fetch(url, options);
    } catch (e) {
      console.error("フォーム通知送信失敗: " + e.message);
    }
  }
};
