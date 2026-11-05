import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/ds/badge";
import { List, ListButtonItem, ListItem, ListTile } from "@/shared/ds/list";
import { TagGroup, TagGroupItem } from "@/shared/ds/tag-group";
import { cn } from "@/shared/lib/cn";
import { useTallTitle } from "@/shared/lib/groo/use-tall-title";
import { KRW, MINUS, isEn } from "@/shared/lib/groo/format";
import {
  formatAssetAmount,
  isForeignCurrency,
} from "@/shared/lib/groo/currency";
import { dsLocale } from "@/shared/ds/i18n";
import { HideUnit, MaskAmount } from "@/shared/lib/groo/hide-amounts";
import {
  isScheduledDate,
  txDateFull,
  txTimeLabel,
} from "@/shared/lib/groo/ledger-format";
import { Icon } from "@/shared/ui/groo/primitives";
import type { AssetTransfer } from "../model/types";

/**
 * 이체 한 건.
 *
 * 거래 줄(`ExpenseRow`)과 같은 ds List 줄 값이다(I-07 5 — list.md): 앞 타일 40 · 모서리 12 · **회색**(이체는 회색 —
 * list.md Prefix), 제목 t5 · 400 줄바꿈, 설명 t3 한 줄 말줄임(Tag Group), 뒤 금액 t5 · 700 · 원까지 한 줄. 예정 이체는
 * 흐리게 하지 않고 금액만 fg-neutral-subtle — 배지가 말한다.
 *
 * 지출/수입과 달리 한 건이 자산 두 개에 걸쳐서, 부호가 "보는 관점"에 따라 달라진다.
 * - `perspectiveAssetRowId` 없음(전체 거래 목록): 관점이 없으므로 중립 — "A → B" 와 금액만.
 *   이체는 순자산 증감이 0(수수료 제외)이라 +/- 를 붙이면 지출·수입 합계와 헷갈린다.
 * - `perspectiveAssetRowId` 있음(자산 상세): 그 자산 기준으로 출금이면 -(금액+수수료), 입금이면 +금액.
 *   수수료는 보내는 쪽에서만 빠진다(백엔드 recordTransfer 와 동일 규칙).
 * - 금액 · 수수료는 보내는 계좌 통화, 받는 쪽 관점은 받은 금액(`toAmount`, 없으면 amount)을 받는 계좌 통화로(I-13).
 *   통화가 다른 이체는 금액 아래 작게 "받는 금액 $1,000.00" 이 붙는다. 통화를 모르면(`currencyOf` 없음) 원화로 찍는다.
 */
export function TransferRow({
  transfer,
  perspectiveAssetRowId,
  onClick,
  showDate,
  gutter = false,
  selectSpace = false,
  currencyOf,
}: {
  transfer: AssetTransfer;
  perspectiveAssetRowId?: number;
  onClick?: (t: AssetTransfer) => void;
  showDate?: boolean;
  /**
   * **임시 인자 — 거래 줄(`ExpenseRow`)의 `gutter` 와 같은 뜻이다.** 줄이 제 좌우 24 를 갖는가(ds List 기본). 기본 false 는
   * 호스트(가계부 · 자산 상세 · 거래 상세)가 아직 바깥 24 를 쥐고 있어서다. I-06 이 머지된 뒤 가계부가 두 줄을 함께 켠다(I-07 4).
   */
  gutter?: boolean;
  /** 고르기 모드 — 이체는 고를 수 없어 체크 자리만 비운다(글자 자리는 거래 줄과 같다, I-07 Q6-A) */
  selectSpace?: boolean;
  /** 계좌 rowId → 통화(`useAssetCurrencyOf`). 없으면 원화로 본다 */
  currencyOf?: (assetRowId: number) => string | null | undefined;
}) {
  const tallRef = useTallTitle();
  const { t } = useTranslation("expense");
  const { t: tc } = useTranslation("common");
  const fee = transfer.fee ?? 0;
  const isOut =
    perspectiveAssetRowId != null &&
    transfer.fromAssetRowId === perspectiveAssetRowId;
  const isIn =
    perspectiveAssetRowId != null &&
    transfer.toAssetRowId === perspectiveAssetRowId;
  const fromCurrency = currencyOf?.(transfer.fromAssetRowId) ?? null;
  const toCurrency = currencyOf?.(transfer.toAssetRowId) ?? null;
  const received = transfer.toAmount ?? transfer.amount;
  const signed = isOut ? -(transfer.amount + fee) : isIn ? received : null;
  // 줄 금액의 통화 — 받는 쪽 관점만 받는 계좌 통화
  const shownCurrency = isIn ? toCurrency : fromCurrency;
  const foreignText = (n: number, code: string | null) =>
    formatAssetAmount(Math.abs(n), code!, dsLocale());
  // 이체도 미래 날짜로 넣을 수 있다 — 거래와 같은 표시를 준다. 합계에 안 드는 줄이라 금액만 옅게
  const scheduled = isScheduledDate(transfer.transferDate);
  const time = txTimeLabel(transfer.transferDate);

  const title = (
    <>
      {transfer.description || t("addTx.transfer")}
      {scheduled && (
        <Badge
          variant="weak"
          tone="neutral"
          size="medium"
          className="ml-x1_5 align-middle"
        >
          {tc("scheduled")}
        </Badge>
      )}
    </>
  );

  const detail = (
    <TagGroup size="t3" truncate>
      {/* 줄어드는 건 "A → B"(계좌 이름)뿐 — 수수료 · 날짜 · 시각은 줄지 않는다(tag-group.md 예 · 앱 transfer_row 와 같다) */}
      <TagGroupItem shrink={2}>
        {transfer.fromAssetName} → {transfer.toAssetName}
      </TagGroupItem>
      {fee > 0 && (
        <TagGroupItem shrink={0}>
          {t("transferFeePrefix")}{" "}
          {/* 수수료도 금액이다 — 위 이체 금액은 가려지는데 여기만 그대로 남아
              있었다(2026-09-17 설계 조사). 같은 카드·같은 종류로 판정한다. */}
          <MaskAmount card="ledger.txList" kind="transfer" mask="•••">
            {isForeignCurrency(fromCurrency)
              ? foreignText(fee, fromCurrency)
              : KRW(fee, { abs: true })}
          </MaskAmount>
        </TagGroupItem>
      )}
      {showDate ? (
        <TagGroupItem shrink={0}>
          {txDateFull(transfer.transferDate)}
        </TagGroupItem>
      ) : (
        time && <TagGroupItem shrink={0}>{time}</TagGroupItem>
      )}
    </TagGroup>
  );

  const amountEl = (
    <span
      className={cn(
        "whitespace-nowrap font-bold tabular-nums",
        scheduled ? "text-fg-neutral-subtle" : "text-fg-neutral",
      )}
    >
      {isForeignCurrency(shownCurrency) ? (
        <MaskAmount card="ledger.txList" kind="transfer">
          {signed == null ? "" : signed < 0 ? MINUS : "+"}
          {foreignText(signed ?? transfer.amount, shownCurrency)}
        </MaskAmount>
      ) : (
        <>
          <MaskAmount card="ledger.txList" kind="transfer">
            {signed == null ? "" : signed < 0 ? MINUS : "+"}
            {isEn() ? "₩" : ""}
            {KRW(signed ?? transfer.amount, { abs: true })}
          </MaskAmount>
          <HideUnit card="ledger.txList" kind="transfer">
            {isEn() ? "" : "원"}
          </HideUnit>
        </>
      )}
    </span>
  );

  // 통화가 다른 이체의 받는 금액 — 설명 줄(계좌 이름 · 시각)을 밀지 않게 금액 아래 작은 글로(AssetRow 의 외화 작은 글과 같은 자리)
  const receivedText =
    transfer.toAmount != null && !isIn
      ? t("transferReceivedTag", {
          amount: isForeignCurrency(toCurrency)
            ? foreignText(transfer.toAmount, toCurrency)
            : `${isEn() ? "₩" : ""}${KRW(transfer.toAmount, { abs: true })}${isEn() ? "" : "원"}`,
        })
      : null;
  const suffix =
    receivedText == null ? (
      amountEl
    ) : (
      <span className="flex flex-col items-end gap-x0_5">
        {amountEl}
        <span className="whitespace-nowrap text-t3 font-medium tabular-nums text-fg-neutral-subtle">
          <MaskAmount card="ledger.txList" kind="transfer" mask="•••">
            {receivedText}
          </MaskAmount>
        </span>
      </span>
    );

  // 이체는 회색 타일(list.md Prefix "이체 줄은 회색") — chart-gray-weak 바탕 + chart-gray 아이콘 20
  const prefix = (
    <ListTile
      style={{
        background: "var(--color-chart-gray-weak)",
        color: "var(--color-chart-gray)",
      }}
      aria-hidden
    >
      <Icon name="arrow-left-right" size={20} />
    </ListTile>
  );

  return (
    <List
      ref={tallRef}
      className={cn(
        // 임시 — 호스트가 바깥 24 를 쥔 동안 줄의 좌우 24 를 걷는다(gutter 인자 주석)
        !gutter && "[&_[data-slot=list-content]]:px-0",
        // 설명(Tag Group 한 줄 말줄임)이 본문 폭을 밀지 않게 — 줄 폭에 min-width 만 걸고 내용 폭은 0 으로 센다
        "[&_[data-slot=list-detail]]:w-0 [&_[data-slot=list-detail]]:min-w-full",
      )}
    >
      {selectSpace ? (
        <ListItem
          title={title}
          detail={detail}
          prefix={
            <span className="flex items-center gap-x3">
              <span aria-hidden className="size-x6 shrink-0" />
              {prefix}
            </span>
          }
          suffix={suffix}
        />
      ) : onClick ? (
        <ListButtonItem
          title={title}
          detail={detail}
          prefix={prefix}
          suffix={suffix}
          onClick={() => onClick(transfer)}
        />
      ) : (
        <ListItem
          title={title}
          detail={detail}
          prefix={prefix}
          suffix={suffix}
        />
      )}
    </List>
  );
}
