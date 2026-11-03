import { useTranslation } from "react-i18next";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetFooter,
} from "@/shared/ds/bottom-sheet";
import { Button } from "@/shared/ds/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
} from "@/shared/ds/dialog";
import { List } from "@/shared/ds/list";
import { useWideSurface } from "@/shared/ds/overlay";
import { MINUS, money } from "@/shared/lib/groo/format";
import { useTradeLabel } from "./trade-label";
import { qtyNumber, type AssetTrade } from "@/entities/asset";
import { KvRow } from "./KvRow";

/**
 * 거래 기록 상세(I-17 50 · 10-25 줄 끝 ⋮ 원칙) — 줄을 누르면 들어간다: 종류 · 종목 · 수량 · 단가 · 금액 · 일시 키-값 줄(조회).
 * 동작은 들어간 화면 바닥 왼쪽 [거래 취소] ghost critical 하나 → 확인창. 1280 미만 Bottom Sheet(최대 480) · 이상 Dialog 480 — 조회라
 * 바깥 · 끌어내림 · Esc 로 닫힌다(21-1 상세 표면과 같은 규칙). `mask` 는 금액 가림.
 */
export function TradeDetailSurface({
  trade,
  mask,
  onClose,
  onCancelTrade,
}: {
  trade: AssetTrade;
  mask: (text: string) => string;
  onClose: () => void;
  onCancelTrade: () => void;
}) {
  const { t } = useTranslation("asset");
  const wide = useWideSurface();
  const label = useTradeLabel(trade);
  const qty = qtyNumber(trade.quantity) ?? 0;
  const unit = qty > 0 ? Math.round(trade.amount / qty) : null;
  const sell = trade.tradeType === "SELL";
  const body = (
    <List aria-label={t("trade.detailTitle")}>
      <KvRow
        label={t("trade.kind")}
        value={sell ? t("trade.sell") : t("trade.buy")}
      />
      <KvRow label={t("trade.holding")} value={label.name} />
      <KvRow label={t("trade.quantity")} value={label.qty} />
      <KvRow
        label={t("trade.unitPrice")}
        value={unit != null ? mask(money(unit)) : null}
      />
      <KvRow label={t("trade.amountLabel")} value={mask(money(trade.amount))} />
      <KvRow
        label={t("trade.feeLabel")}
        value={trade.fee > 0 ? mask(money(trade.fee)) : null}
      />
      <KvRow
        label={t("trade.realizedPreview")}
        value={
          sell && trade.realizedPl != null && trade.realizedPl !== 0
            ? mask(
                `${trade.realizedPl > 0 ? "+" : MINUS}${money(Math.abs(trade.realizedPl))}`,
              )
            : null
        }
      />
      <KvRow
        label={t("trade.date")}
        value={trade.tradeDate.slice(0, 16).replace("T", " ")}
      />
    </List>
  );
  const cancel = (
    <Button
      type="button"
      variant="ghost"
      ghostColor="critical"
      flush={wide ? undefined : "left"}
      size={wide ? undefined : "large"}
      className={wide ? "mr-auto" : "shrink-0"}
      onClick={onCancelTrade}
    >
      {t("trade.deleteAction")}
    </Button>
  );
  if (wide)
    return (
      <Dialog open onOpenChange={(next) => !next && onClose()}>
        <DialogContent title={t("trade.detailTitle")}>
          <DialogBody>
            <div className="-mx-x6">{body}</div>
          </DialogBody>
          <DialogFooter>{cancel}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  return (
    <BottomSheet open onOpenChange={(next) => !next && onClose()}>
      <BottomSheetContent title={t("trade.detailTitle")}>
        <BottomSheetBody>
          <div className="-mx-x6">{body}</div>
        </BottomSheetBody>
        <BottomSheetFooter>
          <div className="flex w-full items-center">{cancel}</div>
        </BottomSheetFooter>
      </BottomSheetContent>
    </BottomSheet>
  );
}
