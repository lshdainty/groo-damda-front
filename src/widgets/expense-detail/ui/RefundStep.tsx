import { useState, type ReactNode } from "react";
import { CalendarDays } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";

import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetFooter,
} from "@/shared/ds/bottom-sheet";
import { Button } from "@/shared/ds/button";
import { Callout } from "@/shared/ds/callout";
import { DatePicker, dayKey, parseDayKey } from "@/shared/ds/date-picker";
import { useInputButtonSurface } from "@/shared/ds/input-button";
import { List, ListButtonItem } from "@/shared/ds/list";
import {
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverFooter,
  PopoverTrigger,
} from "@/shared/ds/popover";
import { formatDateSmart, formatMonthDayDow } from "@/shared/lib/date";
import { KRW, isEn } from "@/shared/lib/groo/format";
import { MaskAmount } from "@/shared/lib/groo/hide-amounts";
import { wonPre } from "@/shared/lib/groo/hide-amounts-core";
import type { HideKind } from "@/shared/lib/groo/hide-amounts-cards";
import { closedCycleNoteText } from "@/features/expense/lib/closed-cycle-note";
import type { ClosedCycleSpan } from "@/entities/expense";

interface RefundStepProps {
  /** 거래 금액(절댓값) */
  amount: number;
  kind: HideKind;
  /** 거래한 날 yyyy-MM-dd — 환불일의 최소 */
  txDay: string;
  /** 오늘 yyyy-MM-dd — 환불일의 최대 */
  today: string;
  /** 고른 환불일 yyyy-MM-dd */
  value: string;
  onChange: (day: string) => void;
  closedSpan: ClosedCycleSpan | null;
  /** 돈이 돌아가는 계좌·카드 이름 — 없으면 문장에서 뺀다 */
  assetName: string | null;
  /** 결제계좌 없는 신용카드 */
  cardNoPaymentAccount: boolean;
}

/**
 * 환불 단계 — 상세 안 한 단계(I-21 I 46). 문장 · (Callout) · 환불일 줄 → Date Picker · 안내.
 * 바닥 [환불 처리]와 처리 요청은 부르는 쪽이 든다. 확인창 안 날짜 칸을 대신한다(alert-dialog.md:57).
 */
export function RefundStep({
  amount,
  kind,
  txDay,
  today,
  value,
  onChange,
  closedSpan,
  assetName,
  cardNoPaymentAccount,
}: RefundStepProps) {
  const { t } = useTranslation("expense");
  const dayText =
    value === today
      ? t("txDetail.refundDateToday", { date: formatMonthDayDow(value) })
      : formatMonthDayDow(value);
  // 닫힌 회차 · 계좌·카드 없음: 돌아갈 곳이 없으니 "돌아가요" 를 빼고 표시만 말한다(조사가 이름에 붙지 않게)
  const onlyMark = closedSpan != null || assetName == null;
  const amountText = `${wonPre()}${KRW(amount)}${isEn() ? "" : "원"}`;
  return (
    <div data-testid="refund-step">
      <p
        data-slot="refund-text"
        className="m-0 px-global-gutter pb-x2 pt-x1 font-sans text-article-body text-fg-neutral"
      >
        {onlyMark ? (
          t("txDetail.refundConfirmBodyClosed")
        ) : (
          <Trans
            t={t}
            i18nKey="txDetail.refundConfirmBody"
            values={{ amount: amountText, asset: assetName }}
            components={{
              b: <strong className="font-bold" />,
              amt: (
                <MaskAmount card="ledger.txDetail" kind={kind}>
                  {""}
                </MaskAmount>
              ),
            }}
          />
        )}
      </p>
      {(closedSpan != null || cardNoPaymentAccount) && (
        <div className="px-global-gutter pb-x2 pt-x1">
          <Callout tone="neutral">
            {closedSpan != null
              ? closedCycleNoteText(t, closedSpan)
              : t("txDetail.refundConfirmBodyCardNoAccount")}
          </Callout>
        </div>
      )}
      <List>
        <RefundDatePick
          title={t("txDetail.refundDate")}
          value={value}
          min={txDay}
          max={today}
          onConfirm={onChange}
          trigger={(api) => (
            <ListButtonItem
              data-testid="refund-date-row"
              prefix={
                <span className="inline-flex size-[22px] items-center justify-center text-fg-neutral [&>svg]:size-[22px]">
                  <CalendarDays aria-hidden />
                </span>
              }
              title={t("txDetail.refundDate")}
              suffixText
              suffix={<span className="block text-end">{dayText}</span>}
              aria-haspopup="dialog"
              aria-expanded={api.open}
              onClick={api.onClick}
            />
          )}
        />
      </List>
      <p
        data-slot="refund-hint"
        className="m-0 px-global-gutter pb-x3 pt-x2 font-sans text-t3 text-fg-neutral-subtle"
      >
        {t("txDetail.refundDateHint", { date: formatDateSmart(txDay) })}
      </p>
    </div>
  );
}

/**
 * 환불일을 달력으로 고른다 — 거래한 날 ~ 오늘만(그 밖은 흐리고 누를 수 없다, 서버 D16). 1280 미만은 시트, 이상은 그 자리 Popover.
 * 고르는 동안 줄 값은 그대로이고 "완료" 에 들어간다.
 */
function RefundDatePick({
  title,
  value,
  min,
  max,
  onConfirm,
  trigger,
}: {
  title: string;
  value: string;
  min: string;
  max: string;
  onConfirm: (day: string) => void;
  trigger: (api: { open: boolean; onClick: () => void }) => ReactNode;
}) {
  const { t: tc } = useTranslation("common");
  const surface = useInputButtonSurface();
  const [open, setOpen] = useState(false);
  const current = parseDayKey(value);
  const [draft, setDraft] = useState<Date | undefined>(current);
  const node = trigger({
    open,
    onClick: () => {
      setDraft(current);
      setOpen(true);
    },
  });
  const picker = (
    <DatePicker
      selection="single"
      visibleRange="month"
      aria-label={title}
      value={draft}
      onValueChange={setDraft}
      min={parseDayKey(min)}
      max={parseDayKey(max)}
      autoFocus
    />
  );
  const done = (
    <Button
      disabled={!draft}
      onClick={() => {
        if (draft) onConfirm(dayKey(draft));
        setOpen(false);
      }}
    >
      {tc("done")}
    </Button>
  );
  return surface === "sheet" ? (
    <BottomSheet open={open} dismissible={false} onOpenChange={setOpen}>
      {node}
      <BottomSheetContent title={title}>
        <BottomSheetBody>{picker}</BottomSheetBody>
        <BottomSheetFooter>{done}</BottomSheetFooter>
      </BottomSheetContent>
    </BottomSheet>
  ) : (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{node}</PopoverTrigger>
      <PopoverContent aria-label={title} align="start">
        <PopoverBody>{picker}</PopoverBody>
        <PopoverFooter>{done}</PopoverFooter>
      </PopoverContent>
    </Popover>
  );
}
