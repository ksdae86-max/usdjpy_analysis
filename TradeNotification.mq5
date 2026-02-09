//+------------------------------------------------------------------+
//|                                  SignalNotifier_USDJPY_Only_H1   |
//|                                  Copyright 2026, Gemini Custom   |
//|  - USDJPY / H1足 専用 (他銘柄での動作を完全拒否)                 |
//|  - 40pips以上の過熱相場切り捨て / 通知成功判定ガード             |
//+------------------------------------------------------------------+
#property strict

// --- 設定パラメータ ---
input group "=== RSI Settings ==="
input int    InpRSIPeriod   = 14;
input double InpRSIUpper    = 65.0;
input double InpRSILower    = 35.0;

input group "=== BB Settings (Squeeze/Mid) ==="
input int    InpBBPeriod    = 20;
input double InpBBDev       = 2.0;
input double InpSqueezePips = 50.0;    // 50pips以下の収縮
input double InpMidBuffer   = 2.0;     // 中心線通知の遊び(pips)

input group "=== Analysis Settings (ADX/ATR) ==="
input int    InpADXPeriod   = 14;
input double InpADXMin      = 25.0;    // トレンドの最低ライン
input int    InpATRPeriod   = 14;
input double InpPanicATR    = 40.0;    // 40pips以上は継続性なしと判断

// --- グローバル変数 ---
int handle_rsi, handle_bb, handle_adx, handle_atr;
datetime last_alert_time = 0;
const string TARGET_SYMBOL = "USDJPY"; // 銘柄を完全固定

// --- 数値ガード関数 [cite: 2026-02-02] ---
bool IsValidValue(double val) {
    return (val > 0 && !MathIsNaN(val) && val != EMPTY_VALUE);
}

//+------------------------------------------------------------------+
int OnInit() {
    // 銘柄チェック：USDJPY以外なら起動しない [cite: 2026-02-01]
    if(_Symbol != TARGET_SYMBOL) {
        Alert("このEAは " + TARGET_SYMBOL + " 専用です。銘柄を確認してください。");
        return(INIT_FAILED);
    }

    handle_rsi = iRSI(TARGET_SYMBOL, PERIOD_H1, InpRSIPeriod, PRICE_CLOSE);
    handle_bb  = iBands(TARGET_SYMBOL, PERIOD_H1, InpBBPeriod, 0, InpBBDev, PRICE_CLOSE);
    handle_adx = iADX(TARGET_SYMBOL, PERIOD_H1, InpADXPeriod);
    handle_atr = iATR(TARGET_SYMBOL, PERIOD_H1, InpATRPeriod);
    
    if(handle_rsi == INVALID_HANDLE || handle_bb == INVALID_HANDLE || 
       handle_adx == INVALID_HANDLE || handle_atr == INVALID_HANDLE) return(INIT_FAILED);

    Print(TARGET_SYMBOL + " H1分析EA 正常に起動しました。");
    return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
void OnTick() {
    // 1時間に1回の判定（確定足ベース）
    datetime currentBar = iTime(TARGET_SYMBOL, PERIOD_H1, 0);
    if(last_alert_time == currentBar) return;

    // データ取得
    double rsi[], up[], lw[], mid[], adx[], atr[];
    ArraySetAsSeries(rsi, true); ArraySetAsSeries(up, true);
    ArraySetAsSeries(lw, true);  ArraySetAsSeries(mid, true);
    ArraySetAsSeries(adx, true); ArraySetAsSeries(atr, true);

    if(CopyBuffer(handle_rsi, 0, 0, 1, rsi) <= 0) return;
    if(CopyBuffer(handle_bb, 1, 0, 1, up) <= 0) return;
    if(CopyBuffer(handle_bb, 2, 0, 1, lw) <= 0) return;
    if(CopyBuffer(handle_bb, 0, 0, 1, mid) <= 0) return;
    if(CopyBuffer(handle_adx, 0, 0, 1, adx) <= 0) return;
    if(CopyBuffer(handle_atr, 0, 0, 1, atr) <= 0) return;

    double bid = SymbolInfoDouble(TARGET_SYMBOL, SYMBOL_BID);
    double point = SymbolInfoDouble(TARGET_SYMBOL, SYMBOL_POINT);

    // 数値ガード実行 [cite: 2026-02-02]
    if(!IsValidValue(bid) || !IsValidValue(up[0]) || !IsValidValue(point)) return;

    string msg = "";
    double atr_pips = (atr[0] / (point * 10.0));
    double bb_width = (up[0] - lw[0]) / (point * 10.0);

    // --- ロジック1：中心線（ミドル）通知 ---
    if(MathAbs(bid - mid[0]) <= (InpMidBuffer * point * 10.0)) {
        msg += StringFormat("\n⚓ミドル付近:%.3f", mid[0]);
    }

    // --- ロジック2：過熱相場の切り捨て（最優先分析） [cite: 2026-01-24] ---
    if(atr_pips >= InpPanicATR) {
        msg += StringFormat("\n⚠️高ボラ静観:%.1fp", atr_pips);
    } 
    else {
        // --- ロジック3：スクイーズ＆ブレイク分析 ---
        if(bb_width <= InpSqueezePips) {
            if(bid > up[0] && adx[0] >= InpADXMin) msg += "\n🚀好機(上抜け)";
            else if(bid < lw[0] && adx[0] >= InpADXMin) msg += "\n📉好機(下抜け)";
            else msg += StringFormat("\n💎スクイーズ:%.1fp", bb_width);
        }
        
        // RSI判定
        if(rsi[0] >= InpRSIUpper) msg += StringFormat("\n[RSI]高値圏(%.1f)", rsi[0]);
        if(rsi[0] <= InpRSILower) msg += StringFormat("\n[RSI]安値圏(%.1f)", rsi[0]);
    }

    // --- 通知実行：成功時のみ時刻更新 [cite: 2026-02-02] ---
    if(msg != "") {
        string finalMsg = TARGET_SYMBOL + " H1分析:" + msg;
        if(SendNotification(finalMsg)) {
            last_alert_time = currentBar;
            Print("通知成功: " + finalMsg);
        }
    }
}
