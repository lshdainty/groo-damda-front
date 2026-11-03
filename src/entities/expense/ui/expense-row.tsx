import type { ReactNode } from "react";
import { Split } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/ds/badge";
import {
  List,
  ListButtonItem,
  ListCheckItem,
  ListItem,
  ListTile,
} from "@/shared/ds/list";
import { TagGroup, TagGroupItem } from "@/shared/ds/tag-group";
import { cn } from "@/shared/lib/cn";
import { useTallTitle } from "@/shared/lib/groo/use-tall-title";
import { KRW, MINUS, isEn } from "@/shared/lib/groo/format";
import { HideUnit, MaskAmount } from "@/shared/lib/groo/hide-amounts";
import {
  kindOfExpense,
  type HideCardKey,
} from "@/shared/lib/groo/hide-amounts-cards";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import {
  isScheduledDate,
  txDateFull,
  txTimeLabel,
} from "@/shared/lib/groo/ledger-format";
import { Icon } from "@/shared/ui/groo/primitives";
import type { Expense } from "../model/types";
import { isRefundedTx } from "../lib/expense-aggregate";

/**
 * 거래 한 건 — 지출/수입. 목록 어디서든 같은 모양이어야 해서 entity 가 소유한다.
 *
 * ds List 줄이다(I-06 28 — list.md:124 · :128 · :156): 제목 t5 · 400 줄바꿈, 설명 t3 한 줄 말줄임(Tag Group),
 * 앞 타일 40 · 모서리 12, 뒤 금액 t5 · 700 · 원까지 한 줄(수입만 fg-brand + "+"). 예정 · 환불 줄은 흐리게 하지 않고
 * 금액만 fg-neutral-subtle — 배지가 말한다.
 */
export function ExpenseRow({
  expense,
  onClick,
  right,
  showDate,
  maskCard = "ledger.txList",
  gutter = false,
  highlighted = false,
  select,
}: {
  expense: Expense;
  onClick?: (e: Expense) => void;
  right?: ReactNode;
  /** true 면 day-head 가 없는 컨텍스트(홈 최근거래 등)에서 시각 대신 "M월 D일 (요일)" 표시 */
  showDate?: boolean;
  /** 금액을 가리는 카드 — 기본 가계부 거래 목록, 홈은 `home.todaySpend`(I-06 29) */
  maskCard?: HideCardKey;
  /**
   * **임시 인자 — 호스트가 옛 부품을 걷을 때까지만 둔다.** 줄이 제 좌우 24 를 갖는가(ds List 기본). 기본 false 는 날짜 머리 ·
   * 이체 줄 · 다이얼로그가 아직 옛 부품이라 바깥 24 를 쥐고 있어서다(줄만 24 로 옮기면 한 목록 안에서 글자 자리가 갈린다).
   * 걷는 몫: 가계부는 끝남(I-07 4 — gutter 를 준다) · 검색 = I-08 08-3 · 자산 상세 · 거래 상세 = 아직 지시서 없음. 다 옮겨지면 기본 true 로 바꾸고
   * 이 인자를 지운다. 띠 · 카드 안 목록(홈)은 true.
   */
  gutter?: boolean;
  /** 알림 · 검색에서 들어온 줄 — ds List 강조(brand-weak 바탕 · 누름 brand-weak-pressed · 설명 글 보정). 줄을 누를 수 있을 때만 의미가 있다 */
  highlighted?: boolean;
  /**
   * 고르기 모드(I-07 33) — 앞에 체크 24(체크 ↔ 타일 12), 줄 어디를 눌러도 바뀌고 상세는 열리지 않는다.
   * `"space"` 는 고를 수 없는 줄(시스템이 만든 거래)이 체크 자리만 비워 글자 자리를 다른 줄과 맞춘다. 고른 줄은 바탕을 칠하지 않는다.
   */
  select?: RowSelect;
}) {
  const { t } = useTranslation("common");
  const tallRef = useTallTitle();
  const isIncome = expense.expenseType === "INCOME";
  // 환불된 거래 — 합계에서 빠져 있다. 흐리게 두지 않고 배지로 갈라 준다. 금액은 원래 부호 그대로
  // 두고 취소선으로 "없는 것으로 셌다" 를 말한다.
  const refunded = isRefundedTx(expense);
  // 기록만 — 결제가 끝난 회차에 뒤늦게 적은 카드 지출. 합계에는 들어가므로 흐리지 않고
  // 배지로만 "계좌에서는 안 빠졌다" 를 알린다(닫힌 회차 규칙 R2).
  //
  // **통째로 기록용인 거래에만** 단다(D10). 할부가 닫힌 회차와 열린 회차에 걸치면 지난
  // 회차분만 기록용이라 행 배지는 거짓이 된다 — 그 몫은 상세가 "이 중 N원" 으로 말한다.
  // 옛 서버는 금액을 안 주는데, 그때는 표식이 곧 통째로 기록용이었다.
  const recordOnly =
    !refunded &&
    expense.cardSettledThrough != null &&
    (expense.recordOnlyAmount ?? Math.abs(expense.amount)) ===
      Math.abs(expense.amount);
  const scheduled = isScheduledDate(expense.expenseDate);
  // 합계에 안 드는 줄(예정 · 환불) — 금액만 옅게
  const outOfSum = scheduled || refunded;
  const palette = getPaletteByColor(expense.categoryColor ?? null);
  const splitCount = expense.splitCategoryRowIds?.length ?? 0;
  const time = expense.expenseDate ? txTimeLabel(expense.expenseDate) : "";

  const title = (
    <>
      {expense.merchant ??
        expense.description ??
        expense.categoryName ??
        t("transaction")}
      {/* 제목 뒤 배지 — 제목 글 뒤에 이어 붙어 함께 줄을 바꾼다 */}
      {scheduled && <TitleBadge label={t("scheduled")} />}
      {refunded && <TitleBadge label={t("refunded")} />}
      {recordOnly && <TitleBadge label={t("recordOnly")} />}
      {/* 고정 수입·지출 — 환불된 거래는 합계에서 빠져 있어 표시할 이유가 없다. */}
      {expense.isFixed && !refunded && (
        <TitleBadge label={t("fixed.badge", { ns: "expense" })} tone="brand" />
      )}
      {splitCount > 0 && (
        <span className="ml-x1_5 inline-flex items-center gap-x0_5 align-middle text-t3 font-bold text-fg-brand">
          <Split aria-hidden size={16} />
          {splitCount}
        </span>
      )}
    </>
  );

  // 줄어드는 건 이름 항목(카테고리 1 · 계좌 2)이고 시각 · 날짜는 줄지 않는다(0) — tag-group.md "줄어드는 정도"(꼭 보여야 할 항목은 shrink 0). 카테고리를 0 으로 두면 긴 카테고리가 칸을 먼저 채워 시각이 금액 칸으로 밀렸다.
  // `shrink` 는 차례가 아니라 넘친 폭을 글 폭 × shrink 비율로 나누는 값이다. 모두 최소 폭이어도 넘치면 줄 끝이 잘린다(스펙이 받아들인 동작).
  // 값은 늘 오른쪽이고, 줄 안 폭이 16em 미만이면 ds 가 값을 본문 아래로 내린다(CHANGELOG 03-D 결정 1 B) — 값 길이로 가르지 않는다.
  const detail = (
    <TagGroup size="t3" truncate>
      <TagGroupItem shrink={1}>
        {expense.categoryName ?? t("others")}
      </TagGroupItem>
      {expense.assetName && (
        <TagGroupItem shrink={2}>{expense.assetName}</TagGroupItem>
      )}
      {expense.expenseDate &&
        (showDate ? (
          <TagGroupItem shrink={0}>
            {txDateFull(expense.expenseDate)}
          </TagGroupItem>
        ) : (
          time && <TagGroupItem shrink={0}>{time}</TagGroupItem>
        ))}
    </TagGroup>
  );

  const amountEl = (
    <span
      className={cn(
        "whitespace-nowrap font-bold tabular-nums",
        outOfSum
          ? "text-fg-neutral-subtle"
          : isIncome
            ? "text-fg-brand"
            : "text-fg-neutral",
      )}
    >
      <MaskAmount card={maskCard} kind={kindOfExpense(expense.expenseType)}>
        <span className={refunded ? "line-through" : undefined}>
          {isIncome ? "+" : MINUS}
          {isEn() ? "₩" : ""}
          {KRW(expense.amount, { abs: true })}
        </span>
      </MaskAmount>
      <HideUnit card={maskCard} kind={kindOfExpense(expense.expenseType)}>
        {isEn() ? "" : "원"}
      </HideUnit>
    </span>
  );
  // 뒤 붙이개 — 금액(호출자가 `right` 를 주면 그대로 오른쪽). 가계부는 줄 끝 ⋮ 를 두지 않는다(10-24 사용자 결정) — 수정 · 삭제는 밀기 · 상세에서
  const suffix = right ?? amountEl;

  const prefix = (
    <ListTile
      style={{ background: palette.bg, color: palette.color }}
      aria-hidden
    >
      <Icon name={expense.categoryIcon || "tag"} size={20} />
    </ListTile>
  );

  return (
    <List
      ref={tallRef}
      className={cn(
        // 임시 — 호스트가 바깥 24 를 쥔 동안 줄의 좌우 24 를 걷는다(gutter 인자 주석)
        !gutter && "[&_[data-slot=list-content]]:px-0",
      )}
    >
      {select != null && select !== "space" ? (
        <ListCheckItem
          markPosition="prefix"
          prefix={prefix}
          title={title}
          detail={detail}
          suffix={suffix}
          checked={select.checked}
          onCheckedChange={(on) => select.onCheckedChange(on === true)}
        />
      ) : select === "space" ? (
        <ListItem
          title={title}
          detail={detail}
          prefix={<SelectSpace>{prefix}</SelectSpace>}
          suffix={suffix}
        />
      ) : onClick ? (
        <ListButtonItem
          title={title}
          detail={detail}
          prefix={prefix}
          suffix={suffix}
          highlighted={highlighted}
          onClick={() => onClick(expense)}
        />
      ) : (
        <ListItem
          title={title}
          detail={detail}
          prefix={prefix}
          suffix={suffix}
          highlighted={highlighted}
        />
      )}
    </List>
  );
}

/** 고르기 모드의 줄 선택 — 체크 상태, 또는 고를 수 없는 줄의 자리 비움 */
export type RowSelect =
  { checked: boolean; onCheckedChange: (on: boolean) => void } | "space";

/** 체크 자리(24)만큼 비운 앞 붙이개 — 체크가 없는 줄이 글자 자리를 맞춘다 */
export function SelectSpace({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-x3">
      <span aria-hidden className="size-x6 shrink-0" />
      {children}
    </span>
  );
}

// 제목 뒤 배지 — ds Badge weak medium(badge.md "작은 손 배지 → medium"). 예정 · 기록만 · 환불은 중립, 고정은 브랜드
function TitleBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "brand";
}) {
  return (
    <Badge
      variant="weak"
      tone={tone}
      size="medium"
      className="ml-x1_5 align-middle"
    >
      {label}
    </Badge>
  );
}
