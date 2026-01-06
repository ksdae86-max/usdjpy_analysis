import yfinance as yf
import os
import requests
import pandas as pd
import numpy as np
from datetime import datetime

def send_discord(message):
    webhook_url = os.getenv("DISCORD_WEBHOOK")
    if not webhook_url:
        print("Error: DISCORD_WEBHOOK is not set.")
        return
    try:
        res = requests.post(webhook_url, json={"content": message}, timeout=15)
        res.raise_for_status()
    except Exception as e:
        print(f"Discord送信失敗: {e}")

def analyze_market():
    ticker_symbol = "USDJPY=X"
    # 週末をまたいでも計算できるよう60日分取得
    df = yf.download(ticker_symbol, period="60d", interval="1d", progress=False)
    
    if df.empty or len(df) < 20:
        print("十分なデータが取得できませんでした。")
        return

    # インジケーター計算
    window = 14
    delta = df['Close'].diff()
    gain = delta.where(delta > 0, 0)
    loss = -delta.where(delta < 0, 0)
    avg_gain = gain.ewm(alpha=1/window, min_periods=window).mean()
    avg_loss = loss.ewm(alpha=1/window, min_periods=window).mean()
    rs = avg_gain / avg_loss
    df['RSI'] = 100 - (100 / (1 + rs))
    
    df['MA20'] = df['Close'].rolling(window=20).mean()
    df['STD'] = df['Close'].rolling(window=20).std()
    df['Upper'] = df['MA20'] + (df['STD'] * 2)
    df['Lower'] = df['MA20'] - (df['STD'] * 2)

    # 前日の確定足を特定（最新のiloc[-1]は当日未確定分になることがあるため）
    target = df.iloc[-2]
    
    o, h, l, c = float(target['Open']), float(target['High']), float(target['Low']), float(target['Close'])
    
    # 判定ロジック
    body = abs(o - c)
    upper_wick = h - max(o, c)
    lower_wick = min(o, c) - l
    safe_body = max(body, 0.01) # 1pips以下の十字線対策
    
    msg_list = []
    if upper_wick >= safe_body:
        ratio = upper_wick / safe_body
        emoji = "🚨【緊急】" if ratio >= 2.0 else "⚠️【通常】"
        msg_list.append(f"{emoji}上ヒゲ検知 (実体の{ratio:.1f}倍 / {upper_wick:.3f}円)")

    if lower_wick >= safe_body:
        ratio = lower_wick / safe_body
        emoji = "🚨【緊急】" if ratio >= 2.0 else "⚠️【通常】"
        msg_list.append(f"{emoji}下ヒゲ検知 (実体の{ratio:.1f}倍 / {lower_wick:.3f}円)")

    if msg_list:
        rsi_val = float(target['RSI'])
        u_band, l_band = float(target['Upper']), float(target['Lower'])
        
        # バンド内の位置(%)
        pos_pct = (c - l_band) / (u_band - l_band) * 100
        bb_status = f"位置: バンド内 {pos_pct:.1f}%"
        if c >= u_band: bb_status = "🔥 +2σを上抜け"
        elif c <= l_band: bb_status = "❄️ -2σを下抜け"

        full_msg = (
            f"📊 **USD/JPY 日足診断** ({target.name.strftime('%Y-%m-%d')})\n"
            f"━━━━━━━━━━━━━━━━\n"
            f"💰 終値: {c:.2f}\n"
            f"📈 RSI(14): {rsi_val:.1f}\n"
            f"🌐 BB(2σ): {bb_status}\n"
            f"━━━━━━━━━━━━━━━━\n" + "\n".join(msg_list)
        )
        send_discord(full_msg)
    else:
        print("条件未達のため通知スキップ")

if __name__ == "__main__":
    analyze_market()
