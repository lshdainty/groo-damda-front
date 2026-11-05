import { useTranslation } from "react-i18next";
import { ExpenseRow, isRefundedTx, type Expense } from "@/entities/expense";
import { TransferRow, type AssetTransfer, type Asset } from "@/entities/asset";
import { useAssetCurrencyOf } from "@/features/asset";
import { KRW, MINUS, formatDay } from "@/shared/lib/groo/format";
import { MaskAmount, WonUnit } from "@/shared/lib/groo/hide-amounts";
import { wonPre } from "@/shared/lib/groo/hide-amounts-core";
import {
  LedgerDayDate,
  LedgerDayGroup,
  LedgerDayHead,
  LedgerDaySum,
  LedgerList,
} from "@/shared/ui/groo/ledger";
import type { AssetLedgerItem } from "./detail-shared";

/**
 * 자산 상세의 내역 줄 묶음(I-17 49) — 가계부 공용 거래 줄 · 이체 줄 · 날짜 머리 그대로(줄 모양은 바꾸지 않는다).
 * 줄을 누르면 거래 상세가 열린다(51) — 여는 자리만 잇는다. 줄이 제 좌우 24 를 갖는다(`gutter` — 이 화면이 옛 바깥 24 를 걷는다).
 * 일 합계는 지출 · 수입만이고 이체는 어느 쪽에도 넣지 않는다. 환불된 거래는 줄로는 남되(취소선) 합계에서 뺀다(23차 8).
 */
export function LedgerGroups({
  groups,
  asset,
  onExpense,
  onTransfer,
}: {
  groups: [string, AssetLedgerItem[]][];
  asset: Asset;
  onExpense: (e: Expense) => void;
  onTransfer: (t: AssetTransfer) => void;
}) {
  // 이 계좌 관점의 이체 금액은 그 계좌 통화로(I-13 — 외화 계좌에서 나간 $1,000 이 "1,000원" 으로 찍히지 않게)
  const currencyOf = useAssetCurrencyOf();
  return (
    <LedgerList>
      {groups.map(([d, items]) => {
        const { md, dow } = formatDay(d);
        const counted = items.flatMap((i) =>
          i.kind === "expense" && !isRefundedTx(i.expense) ? [i.expense] : [],
        );
        const out = counted
          .filter((tx) => tx.expenseType === "EXPENSE")
          .reduce((s, tx) => s + Math.abs(tx.amount), 0);
        const inn = counted
          .filter((tx) => tx.expenseType === "INCOME")
          .reduce((s, tx) => s + Math.abs(tx.amount), 0);
        return (
          <LedgerDayGroup key={d} day={d}>
            <DayHead md={md} dow={dow} out={out} inn={inn} />
            {items.map((item) =>
              item.kind === "expense" ? (
                <ExpenseRow
                  key={`e${item.expense.rowId}`}
                  expense={item.expense}
                  gutter
                  onClick={onExpense}
                />
              ) : (
                <TransferRow
                  key={`t${item.transfer.rowId}`}
                  transfer={item.transfer}
                  perspectiveAssetRowId={asset.rowId}
                  currencyOf={currencyOf}
                  gutter
                  onClick={onTransfer}
                />
              ),
            )}
          </LedgerDayGroup>
        );
      })}
    </LedgerList>
  );
}

function DayHead({
  md,
  dow,
  out,
  inn,
}: {
  md: string;
  dow: string;
  out: number;
  inn: number;
}) {
  const { t } = useTranslation("asset");
  return (
    <LedgerDayHead gutter>
      <LedgerDayDate>
        {md} ({dow})
      </LedgerDayDate>
      {(out > 0 || inn > 0) && (
        <LedgerDaySum>
          {out > 0 && (
            <span className="text-fg-neutral">
              <MaskAmount card="ledger.txList" kind="expense">
                {MINUS}
                {wonPre()}
                {KRW(out)}
              </MaskAmount>
              <WonUnit card="ledger.txList" kind="expense" />
              <span className="sr-only">{t("assetDetail.daySumOut")}</span>
            </span>
          )}
          {inn > 0 && (
            <span className="ml-x2 text-fg-brand">
              <MaskAmount card="ledger.txList" kind="income">
                +{wonPre()}
                {KRW(inn)}
              </MaskAmount>
              <WonUnit card="ledger.txList" kind="income" />
              <span className="sr-only">{t("assetDetail.daySumIn")}</span>
            </span>
          )}
        </LedgerDaySum>
      )}
    </LedgerDayHead>
  );
}

/** 묶음 없이 늘어놓는 줄(이용 내역의 고액순 · 카테고리별) — 지금 그대로 */
export function PlainExpenseRows({
  list,
  onExpense,
}: {
  list: Expense[];
  onExpense: (e: Expense) => void;
}) {
  return (
    <LedgerList>
      {list.map((tx) => (
        <ExpenseRow key={tx.rowId} expense={tx} gutter onClick={onExpense} />
      ))}
    </LedgerList>
  );
}
