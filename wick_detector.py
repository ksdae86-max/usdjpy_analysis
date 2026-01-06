import os
import requests
import pandas as pd
import numpy as np

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
    api_key = os.getenv("ALPHAVANTAGE_API_KEY")
    # APIからドル円の日足データを取得
    url = f'https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=USD&to_symbol=JPY&outputsize=compact&apikey={api_key}'
    
    try:
        response = requests.get(url, timeout=20)
        data = response.json()
        
        if "Time Series FX (Daily)" not in data:
            print("APIエラー:", data.get("Note", data.get("Information", "Unknown Error")))
            return
        
        # DataFrame整形
        df = pd.DataFrame.from_dict(data["Time Series FX (Daily)"], orient='index').astype(float)
        df.index = pd.to_datetime(df.index)
        df = df.sort_index()
        df.columns = ['Open', 'High', 'Low', 'Close']
    except Exception as e:
        print(f"データ取得・処理失敗: {e}")
        return

    # --- テクニカル指標の計算 ---
    # RSI (14日 Wilder's Smoothing)
    window = 14
    delta = df['Close'].diff()
    gain = delta.where(delta > 0, 0).ewm(alpha=1/window, min_periods=window).mean()
    loss = -delta.where(delta < 0, 0).ewm(alpha=1/window, min_periods=window).mean()
    df['RSI'] = 100 - (100 / (1 + (gain / loss)))
    
    # ボリンジャーバンド (20日, 2σ)
    df['MA20'] = df['Close'].rolling(window=20).mean()
    df['STD'] = df['Close'].rolling(window=20).std()
    df['Upper'] = df['MA20'] + (df['STD'] * 2)
    df['Lower'] = df['MA20'] - (df['STD'] * 2)

    # 最新の確定足（Alpha Vantageの最新行）を取得
    target = df.iloc[-1]
    o, h, l, c = target['Open'], target['High'], target['Low'], target['Close']
    
    # ヒゲと実体の計算
    body = abs(o - c)
    upper_wick = h - max(o, c)
    lower_wick = min(o, c) - l
    
    # 判定ロジック (実体が極小の場合の0除算防止)
    safe_body = max(body, 0.01)
    msg_list = []

    # 上ヒゲ判定
    if upper_wick >= safe_body:
        ratio = upper_wick / safe_body
        emoji = "🚨【緊急】" if ratio >= 2.0 else "⚠️【通常】"
        msg_list.append(f"{emoji}上ヒゲ検知 (実体の{ratio:.1f}倍 / {upper_wick:.3f}円)")

    # 下ヒゲ判定
    if lower_wick >= safe_body:
        ratio = lower_wick / safe_body
        emoji = "🚨【緊急】" if ratio >= 2.0 else "⚠️【通常】"
        msg_list.append(f"{emoji}下ヒゲ検知 (実体の{ratio:.1f}倍 / {lower_wick:.3f}円)")

    # 条件合致時のみ通知
    if msg_list:
        u_band, l_band = target['Upper'], target['Lower']
        pos_pct = (c - l_band) / (u_band - l_band) * 100
        
        bb_status = f"バンド内 {pos_pct:.1f}%"
        if c >= u_band: bb_status = "🔥 +2σを上抜け中"
        elif c <= l_band: bb_status = "❄️ -2σを下抜け中"

        full_msg = (
            f"📊 **USD/JPY API診断** ({target.name.strftime('%Y-%m-%d')})\n"
            f"━━━━━━━━━━━━━━━━\n"
            f"💰 終値: {c:.2f}\n"
            f"📈 RSI(14): {target['RSI']:.1f}\n"
            f"🌐 BB(2σ): {bb_status}\n"
            f"━━━━━━━━━━━━━━━━\n"
            + "\n".join(msg_list)
        )
        send_discord(full_msg)
    else:
        print(f"{target.name.strftime('%Y-%m-%d')}: 通知条件を満たすヒゲはありませんでした。")

if __name__ == "__main__":
    analyze_market()
