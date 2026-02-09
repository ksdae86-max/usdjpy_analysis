//+------------------------------------------------------------------+
//|                                  TradeManager_USDJPY_ATR_Pro_V1  |
//|                                  Copyright 2026, Gemini Custom   |
//+------------------------------------------------------------------+
#property strict

// --- 基本パラメータ (初期SLは裁量で行うためEAでは触れません) ---
input double Max_TP_Pips        = 50.0;    // 最大利確目標
input double Lock_Profit_Pips   = 20.0;    // 利益ロック(20pips)
input double Trail_Update_Pips  = 1.0;     // 最低更新間隔
input double Safety_Buffer_Pips = 1.0;     // 注文エラー回避用余裕

// --- ATR設定 (5分足・14期間・2.5倍) ---
input ENUM_TIMEFRAMES ATR_TF    = PERIOD_M5; 
input int    ATR_Period         = 14;        
input double ATR_Multi          = 2.5;       
input double Min_Trail_Pips     = 8.0;       // 最小幅（ボラ縮小時用）

int handle_atr;

int OnInit() {
    if(_Symbol != "USDJPY") { Print("USDJPY専用です"); return(INIT_FAILED); }
    handle_atr = iATR(_Symbol, ATR_TF, ATR_Period);
    if(handle_atr == INVALID_HANDLE) return(INIT_FAILED);
    SendNotification("EA起動: 管理開始（初期SLは手動設定を維持）");
    return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) { IndicatorRelease(handle_atr); }

void OnTick() {
    if(_Symbol != "USDJPY") return;

    double atr_buffer[];
    ArraySetAsSeries(atr_buffer, true);
    if(CopyBuffer(handle_atr, 0, 0, 1, atr_buffer) <= 0) return;
    
    // 動的な距離計算 (ATR 14 * 2.5倍)
    double dynamic_dist = (atr_buffer[0] * ATR_Multi) / (_Point * 10.0);
    if(dynamic_dist < Min_Trail_Pips) dynamic_dist = Min_Trail_Pips;

    for(int i = PositionsTotal() - 1; i >= 0; i--) {
        ulong ticket = PositionGetTicket(i);
        if(PositionSelectByTicket(ticket)) {
            
            double entry = PositionGetDouble(POSITION_PRICE_OPEN);
            double sl    = PositionGetDouble(POSITION_SL);
            double tp    = PositionGetDouble(POSITION_TP);
            ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
            
            double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
            double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
            double cur = (type == POSITION_TYPE_BUY) ? bid : ask;
            int dir = (type == POSITION_TYPE_BUY) ? 1 : -1;

            double stpLevel = SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL) * _Point;
            double pips = ( (cur - entry) * dir + 0.1 * _Point ) / (_Point * 10.0);

            double nextSL = sl;
            double nextTP = tp;
            string eventMsg = "";

            // --- 1. TPの自動セット (TPが未設定の場合のみ) ---
            if(tp == 0) {
                nextTP = entry + dir * Max_TP_Pips * 10 * _Point;
                eventMsg = "初期TP設定(50p)";
            }

            // --- 2. 建値移動 (ATR連動トリガー) ---
            if(pips >= dynamic_dist) {
                // まだSLが建値より不利な場合のみ更新
                if(sl == 0 || (type == POSITION_TYPE_BUY && sl < entry - 0.5 * _Point) || 
                   (type == POSITION_TYPE_SELL && (sl > entry + 0.5 * _Point || sl == 0))) {
                    nextSL = entry;
                    eventMsg = StringFormat("建値移動(ATR:%.1fp到達)", dynamic_dist);
                }
            }

            // --- 3. 20pipsロック ---
            double lockPrice = entry + dir * Lock_Profit_Pips * 10 * _Point;
            double lockTriggerPips = Lock_Profit_Pips + (stpLevel / (_Point * 10.0)) + Safety_Buffer_Pips;
            if(pips >= lockTriggerPips) {
                if((type == POSITION_TYPE_BUY && nextSL < lockPrice - 0.5 * _Point) ||
                   (type == POSITION_TYPE_SELL && (nextSL > lockPrice + 0.5 * _Point || nextSL == 0))) {
                    nextSL = lockPrice;
                    eventMsg = "20pips確定ロック";
                }
            }

            // --- 4. ATR連動トレール (利益の最大化・後退禁止) ---
            double trailPrice = cur - dir * dynamic_dist * 10 * _Point;
            double threshold = Trail_Update_Pips * 10 * _Point;
            
            if((type == POSITION_TYPE_BUY && trailPrice > nextSL + threshold) || 
               (type == POSITION_TYPE_SELL && (trailPrice < nextSL - threshold || nextSL == 0))) {
                
                // ストップレベル制限の厳密チェック
                bool isStorable = (type == POSITION_TYPE_BUY) ? (bid - trailPrice >= stpLevel + 0.2 * _Point) : (trailPrice - ask >= stpLevel + 0.2 * _Point);
                if(isStorable) {
                    nextSL = trailPrice;
                    eventMsg = StringFormat("ATR追従(Dist:%.1fp)", dynamic_dist);
                }
            }

            // --- 注文修正実行 ---
            if(MathAbs(nextSL - sl) > 0.5 * _Point || MathAbs(nextTP - tp) > 0.5 * _Point) {
                if(ModifyPos(ticket, nextSL, nextTP)) {
                    if(eventMsg != "") SendNotification(StringFormat("%s: Ticket#%d", eventMsg, ticket));
                }
            }
        }
    }
}

// 注文修正サブ関数 (数値ガード適用)
bool ModifyPos(ulong ticket, double nSL, double nTP) {
    MqlTradeRequest request = {}; MqlTradeResult result = {};
    ZeroMemory(request);
    request.action = TRADE_ACTION_SLTP;
    request.position = ticket;
    request.symbol = _Symbol;
    request.sl = NormalizeDouble(nSL, _Digits);
    request.tp = NormalizeDouble(nTP, _Digits);
    if(!OrderSend(request, result)) {
        Print("修正失敗(Code:", GetLastError(), ") Ticket:", ticket);
        return false;
    }
    return true;
}

