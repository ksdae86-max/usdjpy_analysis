//+------------------------------------------------------------------+
//|                                  TradeManager_USDJPY_ATR_Pro_V4  |
//|                                  Copyright 2026, Gemini Custom   |
//+------------------------------------------------------------------+
#property strict

// --- 基本パラメータ ---
input double Max_TP_Pips        = 50.0;    // 最大利確
input double Lock_10_Trigger    = 10.0;    // 10pips建値移動
input double Lock_Profit_Pips   = 20.0;    // 20pipsロック
input double Trail_Update_Pips  = 1.0;     // 更新間隔
input double Safety_Buffer_Pips = 1.0;     // エラー回避余裕

// --- ATR設定 ---
input ENUM_TIMEFRAMES ATR_TF    = PERIOD_M5; 
input int    ATR_Period         = 14;        
input double ATR_Multi          = 2.5;       
input double Min_Trail_Pips     = 8.0;       

int handle_atr = INVALID_HANDLE;

// --- 数値ガード：物理的にエラーが出ない構成 [cite: 2026-02-02] ---
bool IsValid(double val) 
{
    if(MathIsNaN(val)) return false;
    if(val <= 0.0) return false;
    if(val == EMPTY_VALUE) return false;
    return true;
}

// 注文修正サブ関数
bool ModifyPos(ulong ticket, double nSL, double nTP) 
{
    MqlTradeRequest request = {}; 
    MqlTradeResult result = {};
    ZeroMemory(request);
    request.action = TRADE_ACTION_SLTP;
    request.position = ticket;
    request.symbol = _Symbol;
    request.sl = NormalizeDouble(nSL, _Digits);
    request.tp = NormalizeDouble(nTP, _Digits);
    return OrderSend(request, result);
}

int OnInit() 
{
    if(_Symbol != "USDJPY") return(INIT_FAILED);
    handle_atr = iATR(_Symbol, ATR_TF, ATR_Period);
    if(handle_atr == INVALID_HANDLE) return(INIT_FAILED);
    return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) 
{ 
    if(handle_atr != INVALID_HANDLE) IndicatorRelease(handle_atr); 
}

void OnTick() 
{
    if(_Symbol != "USDJPY" || handle_atr == INVALID_HANDLE) return;

    double atr_buffer[];
    ArraySetAsSeries(atr_buffer, true);
    if(CopyBuffer(handle_atr, 0, 0, 1, atr_buffer) <= 0) return;
    
    double p_size = _Point * 10.0;
    double d_dist = (atr_buffer[0] * ATR_Multi) / p_size;
    if(d_dist < Min_Trail_Pips) d_dist = Min_Trail_Pips;

    for(int i = PositionsTotal() - 1; i >= 0; i--) 
    {
        ulong t = PositionGetTicket(i);
        if(PositionSelectByTicket(t)) 
        {
            double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
            double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
            if(!IsValid(bid) || !IsValid(ask)) continue;

            double ent = PositionGetDouble(POSITION_PRICE_OPEN);
            double sl  = PositionGetDouble(POSITION_SL);
            double tp  = PositionGetDouble(POSITION_TP);
            int dir = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? 1 : -1;
            
            double cur = (dir == 1) ? bid : ask;
            double pips = ((cur - ent) * dir) / p_size;
            double stp = SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL) * _Point;

            double nSL = sl;
            double nTP = tp;

            // 1. TPセット
            if(tp <= 0) nTP = NormalizeDouble(ent + dir * Max_TP_Pips * p_size, _Digits);

            // 2. 10pips保護
            if(pips >= Lock_10_Trigger) 
            {
                if(sl == 0 || (dir == 1 && sl < ent - 0.1 * _Point) || (dir == -1 && (sl > ent + 0.1 * _Point || sl == 0)))
                    nSL = ent;
            }

            // 3. 20pipsロック
            double l_prc = ent + dir * Lock_Profit_Pips * p_size;
            if(pips >= Lock_Profit_Pips + Safety_Buffer_Pips) 
            {
                if((dir == 1 && nSL < l_prc - 0.1 * _Point) || (dir == -1 && (nSL > l_prc + 0.1 * _Point || nSL == 0)))
                    nSL = l_prc;
            }

            // 4. ATRトレール
            double t_prc = cur - dir * d_dist * p_size;
            if((dir == 1 && t_prc > nSL + p_size) || (dir == -1 && (t_prc < nSL - p_size || nSL == 0))) 
            {
                bool can = (dir == 1) ? (bid - t_prc >= stp) : (t_prc - ask >= stp);
                if(can) nSL = t_prc;
            }

            if(MathAbs(nSL - sl) > 0.1 * _Point || MathAbs(nTP - tp) > 0.1 * _Point) 
                ModifyPos(t, nSL, nTP);
        }
    }
}
