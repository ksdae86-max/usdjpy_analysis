import os
import requests
import pandas as pd
import numpy as np
import yfinance as yf
from datetime import datetime

def send_discord(message):
    webhook_url = os.getenv("DISCORD_WEBHOOK")
    if not webhook_url: return
    try:
        res = requests.post(webhook_url, json={"content": message}, timeout=15)
        res.raise_for_status()
    except Exception as e:
        print(f"Discord送信失敗: {e}")

def send_spreadsheet(data):
    sheet_url = os.getenv("GSHEET_URL")
    if not sheet_url: return
    try:
        res = requests.post(sheet_url, json=data, timeout=15)
        print(f"スプレッドシート送信結果: {res.text}")
    except Exception as e:
        print(f"スプレッドシート送信失敗: {e}")

def analyze_market():
    try:
        # ドル円データを取得
        ticker = yf.Ticker("JPY=X")
        df = ticker.history(period="40d", interval="1d")
        if df.empty: return
        
        df = df[['Open', 'High', 'Low', 'Close']]
        df.index = pd.to_datetime(df.index)
        df = df.sort_index()
    except Exception as e:
        print(f"データ取得失敗: {e}"); return

    # インジケーター計算
    window = 14
    delta = df['Close'].diff()
    gain = delta.clip(lower=0).ewm(alpha=1/window, adjust=False).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1/window, adjust=False).mean()
    df['RSI'] = 100 - (100 / (1 + (gain / loss.replace(0, np.nan))))

    df['MA20'] = df['Close'].rolling(window=20).mean()
    df['STD'] = df['Close'].rolling(window=20).std()
    df['Upper'] = df['MA20'] + (df['STD'] * 2)
    df['Lower'] = df['MA20'] - (df['STD'] * 2)

    # 最新の確定足（前日分）を抽出
    target = df.iloc[-1]
    prev = df.iloc[-2]
    o, h, l, c = target['Open'], target['High'], target['Low'], target['Close']
    
    # 乖離率・トレンド
    ma_slope = (target['MA20'] - df['MA20'].iloc[-5]) / 5
    trend_type = "📈上昇" if ma_slope > 0.02 else "📉下落" if ma_slope < -0.02 else "➡️横ばい"
    ma_diff = ((c - target['MA20']) / target['MA20']) * 100

    # ヒゲ計算
    body = abs(o - c)
    upper_wick = h - max(o, c)
    lower_wick = min(o, c) - l
    safe_body = max(body, 0.015) # 最小実体幅を確保

    signals, log_signals = [], []
    max_priority = 0

    def add_signal(wick_len, label, is_buy):
        nonlocal max_priority
        ratio = wick_len / safe_body
        direction = "下ヒゲ" if is_buy else "上ヒゲ"
        if ratio >= 1.8: p, pref = 2, "🚨 **【強烈】**"
        elif ratio >= 0.9: p, pref = 1, "⚠️ **【注目】**"
        else: p, pref = 0, "🔍 **【要チェック】**"
        log_signals.append(f"{label}({direction}{ratio:.1f}倍)")
        signals.append(f"{pref}{label}\n　　└ {direction} {ratio:.1f}倍")
        max_priority = max(max_priority, p)

    # 判定
    rsi_val = target['RSI']
    if upper_wick >= safe_body * 0.7:
        if rsi_val >= 65 or h >= target['Upper']: add_signal(upper_wick, "天井反転/戻り売り", False)
        elif rsi_val >= 60: add_signal(upper_wick, "反転予兆(RSI60超)", False)
    if lower_wick >= safe_body * 0.7:
        if rsi_val <= 35 or l <= target['Lower']: add_signal(lower_wick, "底値反発/押し目買い", True)
        elif rsi_val <= 40: add_signal(lower_wick, "反発予兆(RSI40以下)", True)

    # 記録データ
    log_data = {
        "date": f"{target.name.strftime('%Y/%m/%d')}({['月','火','水','木','金','土','日'][target.name.weekday()]})",
        "price": round(c, 2),
        "change": round(c - prev['Close'], 2),
        "trend": trend_type,
        "rsi": round(rsi_val, 1) if not np.isnan(rsi_val) else 50,
        "ma_diff": round(ma_diff, 2),
        "bb_pos": round((c - target['Lower']) / (target['Upper'] - target['Lower']) * 100, 1),
        "signal": ", ".join(log_signals) if log_signals else "なし"
    }

    send_spreadsheet(log_data)
    if signals:
        emoji = "🚨" if max_priority == 2 else "⚠️" if max_priority == 1 else "🔍"
        send_discord(f"{emoji} **USD/JPY 診断**\n📅 {log_data['date']}\n💰 {c:.2f}円\n📈 RSI: {log_data['rsi']} / 乖離: {log_data['ma_diff']}%\n" + "\n".join(signals))

if __name__ == "__main__":
    analyze_market()
