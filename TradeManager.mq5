//+------------------------------------------------------------------+
//|                                  TradeManager_USDJPY_ATR_Pro_V2  |
//|                                  Copyright 2026, Gemini Custom   |
//+------------------------------------------------------------------+
#property strict

// --- 基本パラメータ ---
input double Max_TP_Pips        = 50.0;    // 最大利確目標
input double Lock_10_Trigger    = 15.0;    // 10pipsロックのトリガー (15pips到達時)
input double Lock_10_Pips       = 10.0;    // 10pipsの利益確保
input double Lock_20_Pips       = 20.0;    // 20pipsの利益確保
input double Trail_Update_Pips  = 1.0;     // 最低更新間隔
input double Safety_Buffer_Pips = 1.0;     // 注文エラー回避用余裕

// --- ATR設定 ---
input ENUM_TIMEFRAMES ATR_TF    = PERIOD_M5; 
input int    ATR_Period         = 14;        
input double ATR_Multi          = 2.5;       
input double Min_Trail_Pips     = 8.0;       

int handle_atr;

// --- 【必須】数値ガード関数 [cite: 2026-02-02] ---
bool IsValidValue(double val) {
    if(MathIsNaN(val)) return false;
    if(val <= 0) return false;
    if(val == EMPTY_VALUE) return false;
    return true;
}

int OnInit() {
    if(_Symbol != "USDJPY") { Print("USDJPY専用です"); return(INIT_FAILED); }
    handle_atr = iATR(_Symbol, ATR_TF, ATR_Period);
    if(handle_atr == INVALID_HANDLE) return(INIT_FAILED);
    SendNotification("管理EA起動: 10pips/20pips利益確保ロジック有効");
    return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) { IndicatorRelease(handle_atr); }

void OnTick() {
    if(_Symbol != "USDJPY") return;

    double atr_buffer[];
    ArraySetAsSeries(atr_buffer, true);
    if(CopyBuffer(handle_atr, 0, 0, 1, atr_buffer) <= 0) return;

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
            
            // 数値ガード実行 [cite: 2026-02-02]
            if(!IsValidValue(bid) || !IsValidValue(ask)) continue;

            double cur = (type == POSITION_TYPE_BUY) ? bid : ask;
            int dir = (type == POSITION_TYPE_BUY) ? 1 : -1;
            double pips = ( (cur - entry) * dir ) / (_Point * 10.0);

            double nextSL = sl;
            double nextTP = tp;
            string eventMsg = "";

            // --- 1. TP自動セット ---
            if(tp == 0) {
                nextTP = entry + dir * Max_TP_Pips * 10 * _Point;
                eventMsg = "初期TP設定(50p)";
            }

            // --- 2. 建値移動 (ATRトリガー) ---
            if(pips >= dynamic_dist && (sl == 0 || (dir == 1 ? sl < entry : sl > entry || sl == 0))) {
                nextSL = entry;
                eventMsg = "建値移動";
            }

            // --- 3. 【復活】10pips利益確保 (15pips到達で発動) ---
            double lock10Price = entry + dir * Lock_10_Pips * 10 * _Point;
            if(pips >= Lock_10_Trigger) {
                if((dir == 1 && nextSL < lock10Price - 0.1 * _Point) ||
                   (dir == -1 && (nextSL > lock10Price + 0.1 * _Point || nextSL == 0))) {
                    nextSL = lock10Price;
                    eventMsg = "10pips確保ロック";
                }
            }

            // --- 4. 20pips利益確保 ---
            double lock20Price = entry + dir * Lock_20_Pips * 10 * _Point;
            if(pips >= Lock_20_Pips + Safety_Buffer_Pips) {
                if((dir == 1 && nextSL < lock20Price - 0.1 * _Point) ||
                   (dir == -1 && (nextSL > lock20Price + 0.1 * _Point || nextSL == 0))) {
                    nextSL = lock20Price;
                    eventMsg = "20pips確保ロック";
                }
            }

            // --- 5. ATR連動トレール ---
            double trailPrice = cur - dir * dynamic_dist * 10 * _Point;
            double threshold = Trail_Update_Pips * 10 * _Point;
            if((dir == 1 && trailPrice > nextSL + threshold) || 
               (dir == -1 && (trailPrice < nextSL - threshold || nextSL == 0))) {
                nextSL = trailPrice;
                eventMsg = "ATR追従";
            }

            // 注文修正実行
            if(MathAbs(nextSL - sl) > 0.5 * _Point || MathAbs(nextTP - tp) > 0.5 * _Point) {
                if(ModifyPos(ticket, nextSL, nextTP)) {
                    if(eventMsg != "") SendNotification(StringFormat("%s\nSL: %.3f", eventMsg, nextSL));
                }
            }
        }
    }
}

bool ModifyPos(ulong ticket, double nSL, double nTP) {
    MqlTradeRequest request = {}; MqlTradeResult result = {};
    request.action = TRADE_ACTION_SLTP;
    request.position = ticket;
    request.symbol = _Symbol;
    request.sl = NormalizeDouble(nSL, _Digits);
    request.tp = NormalizeDouble(nTP, _Digits);
    return OrderSend(request, result);
}
