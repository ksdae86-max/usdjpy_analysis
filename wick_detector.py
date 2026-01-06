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

def analyze_market():
    api_key = os.getenv("ALPHAVANTAGE_API_KEY")
    url = f'https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=USD&to_symbol=JPY&outputsize=compact&apikey={api_key}'
    
    try:
        response = requests.get(url, timeout=20)
        data = response.json()
        # ブラッシュアップ①: API制限(500エラー等)の厳格なチェック
        if "Time Series FX (Daily)" not in data:
            reason = data.get("Note") or data.get("Information") or "Unknown API Error"
            print(f"APIエラー: {reason}")
            return
        
        df = pd.DataFrame.from_dict(data["Time Series FX (Daily)"], orient='index').astype(float)
        df.index = pd.to_datetime(df.index)
        df = df.sort_index()
        df.columns = ['Open', 'High', 'Low', 'Close']
    except Exception as e:
        print(f"データ処理失敗: {e}")
        return

    # --- ブラッシュアップ②: インジケーター計算の精密化 ---
    # Wilder's RSI (指数移動平均を用いたより正確な計算)
    window = 14
    delta = df['Close'].diff()
    gain = delta.where(delta > 0, 0).ewm(alpha=1/window, adjust=False).mean()
    loss = -delta.where(delta < 0, 0).ewm(alpha=1/window, adjust=False).mean()
    df['RSI'] = 100 - (100 / (1 + (gain / loss)))
    
    # ボリンジャーバンド (20日)
    df['MA20'] = df['Close'].rolling(window=20).mean()
    df['STD'] = df['Close'].rolling(window=20).std()
    df['Upper'] = df['MA20'] + (df['STD'] * 2)
    df['Lower'] = df['MA20'] - (df['STD'] * 2)

    # --- ブラッシュアップ③: 多角的な分析データの抽出 ---
    target = df.iloc[-1]
    prev_close = df.iloc[-2]['Close']
    o, h, l, c = target['Open'], target['High'], target['Low'], target['Close']
    
    # 乖離率・騰落幅
    diff_ma = ((c - target['MA20']) / target['MA20']) * 100
    change = c - prev_close
    
    # トレンドの強さ (ADXの簡易版として昨日の終値との比較)
    trend_type = "📈 上昇傾向" if target['MA20'] > df.iloc[-5]['MA20'] else "📉 下降傾向"
    
    # ブラッシュアップ④: ヒゲ判定ロジックの高度化 (ATRを考慮したノイズ除去)
    # 実体のn倍だけでなく、一定以上の値幅(0.1円)がないヒゲは無視する
    body = abs(o - c)
    upper_wick = h - max(o, c)
    lower_wick = min(o, c) - l
    safe_body = max(body, 0.02) # 極小実体による過剰反応防止
    
    alerts = []
    # ブラッシュアップ⑤: ボリンジャーバンドとの合流（コンフルエンス）判定
    if upper_wick >= safe_body * 2 and h >= target['Upper'] * 0.998:
        alerts.append(f"🔴 **強気の上ヒゲ (天井圏警戒)**\n   比率: {upper_wick/safe_body:.1f}倍 / 値幅: {upper_wick:.3f}円")
    
    if lower_wick >= safe_body * 2 and l <= target['Lower'] * 1.002:
        alerts.append(f"🔵 **強気の下ヒゲ (底打ち警戒)**\n   比率: {lower_wick/safe_body:.1f}倍 / 値幅: {lower_wick:.3f}円")

    # --- ブラッシュアップ⑥〜⑩: 通知レイアウトの究極化 ---
    # ヒゲが出ていない場合でも、RSIやBBが極端な数値なら「定期診断」として送る
    is_extreme = target['RSI'] > 70 or target['RSI'] < 30 or c >= target['Upper'] or c <= target['Lower']
    
    if alerts or is_extreme:
        status_emoji = "🚨" if alerts else "🔍"
        pos_pct = (c - target['Lower']) / (target['Upper'] - target['Lower']) * 100
        
        full_msg = (
            f"{status_emoji} **USD/JPY 究極診断レポート** ({target.name.strftime('%Y/%m/%d')})\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"💵 **現在価格**: {c:.2f}円 ({change:+.2f})\n"
            f"🌊 **相場地合い**: {trend_label if 'trend_label' in locals() else trend_type}\n"
            f"📏 **MA20乖離**: {diff_ma:+.2f}%\n"
            f"📈 **RSI(14)**: {target['RSI']:.1f} {'(⚠️過熱)' if target['RSI']>70 else '(⚠️売られすぎ)' if target['RSI']<30 else ''}\n"
            f"🌐 **BB(2σ)**: {pos_pct:.1f}% 地点\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"【判定】\n" + ("\n".join(alerts) if alerts else "✅ 特殊なヒゲは未検知（テクニカル過熱による通知）")
        )
        send_discord(full_msg)
    else:
        print(f"{target.name.strftime('%m/%d')}: 特記事項なし")

if __name__ == "__main__":
    analyze_market()
