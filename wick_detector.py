import os
import requests
import pandas as pd
import numpy as np
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
    if not sheet_url: 
        print("GSHEET_URLが設定されていないため、シートへの記録をスキップします。")
        return
    try:
        res = requests.post(sheet_url, json=data, timeout=15)
        print(f"スプレッドシート送信結果: {res.text}")
    except Exception as e:
        print(f"スプレッドシート送信失敗: {e}")

def analyze_market():
    api_key = os.getenv("ALPHAVANTAGE_API_KEY")
    url = f'https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=USD&to_symbol=JPY&outputsize=compact&apikey={api_key}'
    
    try:
        response = requests.get(url, timeout=20)
        data = response.json()
        if "Time Series FX (Daily)" not in data:
            print(f"APIエラー: {data.get('Note', 'データなし')}")
            return
        
        df = pd.DataFrame.from_dict(data["Time Series FX (Daily)"], orient='index').astype(float)
        df.index = pd.to_datetime(df.index)
        df = df.sort_index()
        df.columns = ['Open', 'High', 'Low', 'Close']
    except Exception as e:
        print(f"データ取得失敗: {e}")
        return

    # --- インジケーター計算 ---
    window = 14
    delta = df['Close'].diff()
    gain = delta.clip(lower=0).ewm(alpha=1/window, adjust=False).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1/window, adjust=False).mean()
    df['RSI'] = 100 - (100 / (1 + (gain / loss)))
    
    df['MA20'] = df['Close'].rolling(window=20).mean()
    df['STD'] = df['Close'].rolling(window=20).std()
    df['Upper'] = df['MA20'] + (df['STD'] * 2)
    df['Lower'] = df['MA20'] - (df['STD'] * 2)

    # --- ターゲット抽出 ---
    target = df.iloc[-1]
    prev = df.iloc[-2]
    o, h, l, c = target['Open'], target['High'], target['Low'], target['Close']
    ma_slope = (target['MA20'] - df['MA20'].iloc[-5]) / 5
    trend_type = "📈上昇" if ma_slope > 0.03 else "📉下落" if ma_slope < -0.03 else "➡️横ばい"
    
    body = abs(o - c)
    upper_wick = h - max(o, c)
    lower_wick = min(o, c) - l
    safe_body = max(body, 0.015)
    
    signals = []
    log_signals = [] # シート記録用
    max_priority = 0

    def add_signal(wick_len, label, is_buy):
        nonlocal max_priority
        ratio = wick_len / safe_body
        direction = "下ヒゲ" if is_buy else "上ヒゲ"
        log_signals.append(f"{label}({direction}{ratio:.1f}倍)")
        
        if ratio >= 2.0:
            signals.append(f"🚨 **【強烈】{label}**\n　　└ {direction} {ratio:.1f}倍")
            max_priority = max(max_priority, 2)
        elif ratio >= 1.0:
            signals.append(f"⚠️ **【注目】{label}**\n　　└ {direction} {ratio:.1f}倍")
            max_priority = max(max_priority, 1)

    # A. 押し目・戻り判定
    if ma_slope > 0.03 and 35 <= target['RSI'] <= 62:
        if lower_wick >= safe_body: add_signal(lower_wick, "上昇押し目", True)
    elif ma_slope < -0.03 and 38 <= target['RSI'] <= 65:
        if upper_wick >= safe_body: add_signal(upper_wick, "下落戻り売り", False)

    # B. 天井・底打ち判定
    if target['RSI'] > 68 or h >= target['Upper'] * 0.998:
        if upper_wick >= safe_body: add_signal(upper_wick, "天井反転", False)
    if target['RSI'] < 32 or l <= target['Lower'] * 1.002:
        if lower_wick >= safe_body: add_signal(lower_wick, "底値反発", True)

    # --- 3. スプレッドシート送信データ構築 ---
    pos_pct = (c - target['Lower']) / (target['Upper'] - target['Lower']) * 100
    ma_diff = ((c - target['MA20']) / target['MA20']) * 100
    
    log_data = {
        "date": target.name.strftime('%Y/%m/%d'),
        "price": round(c, 2),
        "change": round(c - prev['Close'], 2),
        "trend": trend_type,
        "rsi": round(target['RSI'], 1),
        "ma_diff": round(ma_diff, 2),
        "bb_pos": round(pos_pct, 1),
        "signal": ", ".join(log_signals) if log_signals else "なし"
    }
    
    # 毎日記録を実行
    send_spreadsheet(log_data)

    # --- 4. Discord通知実行 ---
    if signals:
        emoji = "🚨" if max_priority == 2 else "⚠️"
        full_msg = (
            f"{emoji} **USD/JPY 階層型マーケット診断**\n"
            f"📅 {target.name.strftime('%Y/%m/%d')} 確定\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"💰 **価格**: {c:.2f}円 ({log_data['change']:+.2f})\n"
            f"🌊 **地合い**: {trend_type} (MA傾き: {ma_slope:+.3f})\n"
            f"📈 **RSI**: {log_data['rsi']} / **MA乖離**: {log_data['ma_diff']:+.2f}%\n"
            f"🌐 **BB位置**: {log_data['bb_pos']}% (2σ圏内)\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"【シグナル検出】\n" + "\n".join(signals)
        )
        send_discord(full_msg)
    else:
        print(f"{target.name.strftime('%m/%d')}: シグナルなし(RSI:{target['RSI']:.1f})、記録のみ完了")

if __name__ == "__main__":
    analyze_market()
