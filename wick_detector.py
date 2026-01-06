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
        if "Time Series FX (Daily)" not in data:
            print(f"APIエラー: {data.get('Note', 'データなし')}")
            return
        
        df = pd.DataFrame.from_dict(data["Time Series FX (Daily)"], orient='index').astype(float)
        df.index = pd.to_datetime(df.index)
        df = df.sort_index()
        df.columns = ['Open', 'High', 'Low', 'Close']
        
        # 10回ブラッシュアップ①: データの十分性チェック
        if len(df) < 30:
            print("計算に必要なデータ件数が不足しています")
            return
            
    except Exception as e:
        print(f"システムエラー: {e}")
        return

    # 10回ブラッシュアップ②: RSI計算の精密化（Wilderの平滑化を再現）
    window = 14
    delta = df['Close'].diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1/window, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1/window, adjust=False).mean()
    df['RSI'] = 100 - (100 / (1 + (avg_gain / avg_loss)))
    
    # 10回ブラッシュアップ③: ボリンジャーバンドとMA20
    df['MA20'] = df['Close'].rolling(window=20).mean()
    df['STD'] = df['Close'].rolling(window=20).std()
    df['Upper'] = df['MA20'] + (df['STD'] * 2)
    df['Lower'] = df['MA20'] - (df['STD'] * 2)

    # 10回ブラッシュアップ④: データの抽出と型保証
    target = df.iloc[-1]
    prev = df.iloc[-2]
    o, h, l, c = target['Open'], target['High'], target['Low'], target['Close']
    
    # 10回ブラッシュアップ⑤: トレンド強度の数値化 (MA20の傾き)
    ma_slope = (target['MA20'] - df['MA20'].iloc[-5]) / 5
    trend_type = "📈 強気" if ma_slope > 0.05 else "📉 弱気" if ma_slope < -0.05 else "➡️ 横ばい"
    
    # 10回ブラッシュアップ⑥: 厳格なヒゲ計算（浮動小数点の誤差を考慮）
    body = abs(o - c)
    upper_wick = h - max(o, c)
    lower_wick = min(o, c) - l
    safe_body = max(body, 0.015) # 1.5ピップス以下の実体は極小とみなす
    
    alerts = []
    # 10回ブラッシュアップ⑦: 厳格な「2.0倍」基準の適用
    RATIO = 2.0

    # 10回ブラッシュアップ⑧: 文脈依存のシグナル判定
    # A. 押し目買い（上昇中 ＋ RSI 40-55 ＋ 長い下ヒゲ）
    if ma_slope > 0 and 38 <= target['RSI'] <= 58:
        if lower_wick >= safe_body * RATIO:
            alerts.append(f"✅ **押し目買い好機**: 上昇トレンド中の強い反発（下ヒゲ {lower_wick/safe_body:.1f}倍）")

    # B. 戻り売り（下落中 ＋ RSI 42-62 ＋ 長い上ヒゲ）
    if ma_slope < 0 and 42 <= target['RSI'] <= 62:
        if upper_wick >= safe_body * RATIO:
            alerts.append(f"✅ **戻り売り好機**: 下落トレンド中の戻り叩き（上ヒゲ {upper_wick/safe_body:.1f}倍）")

    # C. 極値反転（過熱 ＋ BB2σ到達 ＋ 長い逆ヒゲ）
    if target['RSI'] > 68 or h >= target['Upper']:
        if upper_wick >= safe_body * RATIO:
            alerts.append(f"⚠️ **天井警戒**: 過熱圏での強烈な拒絶（上ヒゲ {upper_wick/safe_body:.1f}倍）")
            
    if target['RSI'] < 32 or l <= target['Lower']:
        if lower_wick >= safe_body * RATIO:
            alerts.append(f"⚠️ **底打ち警戒**: 売られすぎ圏での強い買い戻し（下ヒゲ {lower_wick/safe_body:.1f}倍）")

    # 10回ブラッシュアップ⑨: 通知ロジックの整理
    if alerts:
        diff_ma = ((c - target['MA20']) / target['MA20']) * 100
        pos_pct = (c - target['Lower']) / (target['Upper'] - target['Lower']) * 100
        
        # 10回ブラッシュアップ⑩: メッセージの視覚的構造化
        full_msg = (
            f"🏛️ **USD/JPY 厳格マーケット分析**\n"
            f"📅 {target.name.strftime('%Y/%m/%d')} 確定値\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"💰 **価格**: {c:.2f}円 ({c - prev['Close']:+.2f})\n"
            f"🌊 **地合い**: {trend_type} (MA傾き: {ma_slope:+.3f})\n"
            f"📏 **MA乖離**: {diff_ma:+.2f}% / **RSI**: {target['RSI']:.1f}\n"
            f"🌐 **BB位置**: {pos_pct:.1f}% (-2σ=0% ~ +2σ=100%)\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"【シグナル判定】\n" + "\n".join(alerts)
        )
        send_discord(full_msg)
    else:
        print(f"分析完了: {target.name.strftime('%m/%d')} は厳格基準を満たしませんでした。")

if __name__ == "__main__":
    analyze_market()
