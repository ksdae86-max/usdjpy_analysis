import os
import requests
import pandas as pd
import numpy as np
from datetime import datetime

# --- 通知・記録用関数 ---
def send_discord(message):
    webhook_url = os.getenv("DISCORD_WEBHOOK")
    if not webhook_url: return
    try:
        res = requests.post(webhook_url, json={"content": message}, timeout=15)
        res.raise_for_status()
    except Exception as e: print(f"Discord送信失敗: {e}")

def send_spreadsheet(data):
    sheet_url = os.getenv("GSHEET_URL")
    if not sheet_url: 
        print("GSHEET_URL未設定のため記録をスキップします。")
        return
    try:
        # シグナルの有無に関わらずデータをPOST
        res = requests.post(sheet_url, json=data, timeout=15)
        print(f"スプレッドシート送信結果: {res.text}")
    except Exception as e: print(f"スプレッドシート送信失敗: {e}")

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
        print(f"データ取得失敗: {e}"); return

    # --- インジケーター計算 ---
    window = 14
    delta = df['Close'].diff()
    gain = delta.clip(lower=0).ewm(alpha=1/window, adjust=False).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1/window, adjust=False).mean()
    df['RSI'] = 100 - (100 / (1 + (gain / loss.replace(0, np.nan))))
    df['MA20'] = df['Close'].rolling(window=20).mean()
    df['STD'] = df['Close'].rolling(window=20).std()
    df['Upper'] = df['MA20'] + (df['STD'] * 2)
    df['Lower'] = df['MA20'] - (df['STD'] * 2)

    # --- データ抽出 ---
    target = df.iloc[-1]
    prev = df.iloc[-2]
    o, h, l, c = target['Open'], target['High'], target['Low'], target['Close']
    weekday_str = ["月", "火", "水", "木", "金", "土", "日"][target.name.weekday()]
    
    ma_slope = (target['MA20'] - df['MA20'].iloc[-5]) / 5
    trend_type = "📈上昇" if ma_slope > 0.02 else "📉下落" if ma_slope < -0.02 else "➡️横ばい"

    body, upper_wick, lower_wick = abs(o - c), h - max(o, c), min(o, c) - l
    safe_body = max(body, 0.015)

    signals, log_signals = [], []
    max_priority = 0

    def add_signal(wick_len, label, is_buy):
        nonlocal max_priority
        ratio = wick_len / safe_body
        direction = "下ヒゲ" if is_buy else "上ヒゲ"
        if ratio >= 1.8: p_val, prefix = 2, "🚨 **【強烈】**"
        elif ratio >= 0.9: p_val, prefix = 1, "⚠️ **【注目】**"
        else: p_val, prefix = 0, "🔍 **【要チェック】**"
        log_signals.append(f"{label}({direction}{ratio:.1f}倍)")
        signals.append(f"{prefix}{label}\n　　└ {direction} {ratio:.1f}倍")
        max_priority = max(max_priority, p_val)

    # --- 条件判定 ---
    rsi_val = target['RSI']
    if upper_wick >= safe_body * 0.7:
        if rsi_val >= 65 or h >= target['Upper']: add_signal(upper_wick, "天井反転/戻り売り", False)
        elif rsi_val >= 60: add_signal(upper_wick, "反転予兆(RSI60超)", False)
    if lower_wick >= safe_body * 0.7:
        if rsi_val <= 35 or l <= target['Lower']: add_signal(lower_wick, "底値反発/押し目買い", True)
        elif rsi_val <= 40: add_signal(lower_wick, "反発予兆(RSI40以下)", True)

    # --- 共通ログデータ作成 ---
    pos_pct = (c - target['Lower']) / (target['Upper'] - target['Lower']) * 100
    ma_diff = ((c - target['MA20']) / target['MA20']) * 100

    log_data = {
        "date": f"{target.name.strftime('%Y/%m/%d')}({weekday_str})",
        "price": round(c, 2),
        "change": round(c - prev['Close'], 2),
        "trend": trend_type,
        "rsi": round(rsi_val, 1) if not np.isnan(rsi_val) else 50,
        "ma_diff": round(ma_diff, 2),
        "bb_pos": round(pos_pct, 1),
        "signal": ", ".join(log_signals) if log_signals else "なし" # ここで「なし」と入る
    }

    # 【重要】シグナルの有無に関わらずスプレッドシートへ送信
    send_spreadsheet(log_data)

    # Discordはシグナルがある時だけ通知
    if signals:
        emoji = "🚨" if max_priority == 2 else "⚠️" if max_priority == 1 else "🔍"
        full_msg = (
            f"{emoji} **USD/JPY 階層型マーケット診断**\n"
            f"📅 {log_data['date']} 確定\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"💰 **価格**: {c:.2f}円 ({log_data['change']:+.2f})\n"
            f"🌊 **地合い**: {trend_type} (MA傾き: {ma_slope:+.3f})\n"
            f"📈 **RSI**: {log_data['rsi']} / **MA乖離**: {log_data['ma_diff']:+.2f}%\n"
            f"🌐 **BB位置**: {log_data['bb_pos']}% (2σ基準)\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"【シグナル検出】\n" + "\n".join(signals)
        )
        send_discord(full_msg)
    else:
        print(f"{target.name.strftime('%m/%d')}: シグナルなし(RSI:{rsi_val:.1f})。スプレッドシートのみ記録しました。")

if __name__ == "__main__":
    analyze_market()
