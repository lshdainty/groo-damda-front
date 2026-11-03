import { useTranslation } from "react-i18next";
import { HOLDING_UNIT_KEY, formatQty, type AssetTrade } from "@/entities/asset";
import { useStockSymbolName } from "@/features/stock/model/useStockMaster";

/**
 * 거래 기록 한 건의 표시 이름 · 수량 — 연동 종목은 종목 이름(마스터에 없으면 티커), 수량은 "{수량}주"(소수 끝 0 제거).
 * 서버 수량은 DECIMAL(28,8) 문자열("30.00000000")이라 그대로 쓰지 않는다.
 */
export function useTradeLabel(trade: AssetTrade): {
  name: string;
  qty: string;
} {
  const { t } = useTranslation("asset");
  const { data: masterName } = useStockSymbolName(
    trade.linked ? trade.holdingKey : "",
  );
  const type = trade.holdingType ?? "STOCK";
  return {
    name: trade.linked ? (masterName ?? trade.holdingKey) : trade.holdingKey,
    qty: `${formatQty(trade.quantity, type)}${t(HOLDING_UNIT_KEY[type])}`,
  };
}
