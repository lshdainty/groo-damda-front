import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CardAction, CardHeader, CardTitle } from "@/shared/ds/card";
import { List, ListHeader, ListItem } from "@/shared/ds/list";
import { Button } from "@/shared/ds/button";
import { ResultSection } from "@/shared/ds/result-section";
import { Skeleton } from "@/shared/ds/skeleton";
import { ProgressBar, type ProgressMeaning } from "@/shared/ds/progress";
import { useDsText, withCommaBreaks } from "@/shared/ds/i18n";
import { cn } from "@/shared/lib/cn";
import { formatPercent } from "@/shared/lib/groo/format";

/*
 * 폰 띠 · 흰 면 안 구역 부품 — 예산 · 예산 설정 · 저축 목표(I-08 공통 값)가 같이 쓴다. 홈(I-06)의 HomeHead 와 같은 값이다.
 * 값: 구역 머리 위 24 · 좌우 24 · 머리 ↔ 본문 8(목록 구역은 4), 본문 좌우 24 · 아래 24, 키-값 줄 위아래 8 · 좌우 24.
 * 금액은 글로 만들어 넘긴다(money-text — 원까지, 쉼표 뒤 줄바꿈 자리).
 */

/**
 * 구역 머리 = ds Card 머리 값. 제목 t5 700, 오른쪽은 글 버튼(`action`) 또는 배지 · 보조 글(`aside`).
 * 띠(폰)는 카드 문맥이 없어 머리 여백을 직접 준다(`band`). 데스크톱 카드 안에서는 `band` 없이 쓴다.
 */
export function BandHead({
  title,
  action,
  aside,
  band,
  list = false,
  as,
}: {
  title: ReactNode;
  action?: { label: string; onClick: () => void; ariaLabel?: string };
  /** 오른쪽 자리 — 배지(ds Badge) · 보조 글(t3 · fg-neutral-subtle) */
  aside?: ReactNode;
  band?: boolean;
  /** 목록 구역(머리 아래 4) · 글 · 숫자 · 차트 구역(머리 아래 8) */
  list?: boolean;
  as?: "h2" | "h3";
}) {
  return (
    <CardHeader
      className={band ? cn("px-x6 pt-x6", list ? "pb-x1" : "pb-x2") : undefined}
    >
      <CardTitle as={as}>{title}</CardTitle>
      {aside}
      {action && (
        <CardAction onClick={action.onClick} aria-label={action.ariaLabel}>
          {action.label}
        </CardAction>
      )}
    </CardHeader>
  );
}

/** 오른쪽 보조 글 — t3 · fg-neutral-subtle */
export function HeadNote({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 text-t3 text-fg-neutral-subtle">{children}</span>
  );
}

/** 구역 안 실패 — Result Section medium failure + "다시 시도". 서버 오류 원문은 그리지 않는다(I-08 17 · 23 · 28) */
export function BandFailure({
  title,
  description,
  onRetry,
  band,
  className,
  size = "medium",
  as = "h3",
  retrying,
}: {
  title: string;
  /** 다시 받는 중 — [다시 시도] 단추에 진행 원(B2a) */
  retrying?: boolean;
  /** 제목 태그 — 기본 h3. 화면 제목 바로 아래 구역이면 h2 */
  as?: "h2" | "h3";
  /** 설명 — 기본 "잠시 뒤 다시 시도해주세요." */
  description?: string;
  onRetry: () => void;
  band?: boolean;
  className?: string;
  /** 화면 전체를 차지하는 실패(폰 목록)는 large, 카드 · 구역 안은 medium(result-section.md) */
  size?: "large" | "medium";
}) {
  const dsT = useDsText();
  const { t } = useTranslation("common");
  return (
    <ResultSection
      kind="failure"
      size={size}
      as={as}
      title={title}
      description={description ?? t("loadFailedDesc")}
      primaryAction={{
        label: dsT("common.retry"),
        onClick: onRetry,
        loading: retrying,
      }}
      className={cn(band && "px-x6", "[[data-slot=card]_&]:px-0", className)}
    />
  );
}

/** 빈 글 — R9(t3 · fg-neutral-subtle) 가운데 한 줄, 위아래 12 */
export function BandEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 py-x3 text-center text-t3 text-fg-neutral-subtle">
      {children}
    </p>
  );
}

/** 눈썹 글 — t3 13/18 · 700 · fg-brand("{n}월 총 예산") */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="m-0 text-t3 font-bold text-fg-brand">{children}</p>;
}

/** 문장으로 된 보조 글 — t3 · fg-neutral-muted */
export function Desc({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("m-0 text-t3 text-fg-neutral-muted", className)}>
      {children}
    </p>
  );
}

/**
 * 큰 숫자 — 지표 숫자 t9 24/32 · 700 · 고정폭 · 원까지, 쉼표 뒤에서만 줄바꿈.
 * 뒤 "/ 한도" 는 t4 · fg-neutral-subtle, 같은 줄(좁으면 다음 줄).
 */
export function BigAmount({
  value,
  limit,
  className,
  tone,
}: {
  value: string;
  limit?: string;
  className?: string;
  tone?: "default" | "brand";
}) {
  return (
    <p
      className={cn(
        "m-0 flex flex-wrap items-baseline gap-x-x1_5 gap-y-x0_5",
        className,
      )}
    >
      <span
        className={cn(
          "min-w-0 text-t9 font-bold tabular-nums",
          tone === "brand" ? "text-fg-brand" : "text-fg-neutral",
        )}
      >
        {withCommaBreaks(value)}
      </span>
      {limit != null && (
        <span className="text-t4 text-fg-neutral-subtle tabular-nums">
          / {withCommaBreaks(limit)}
        </span>
      )}
    </p>
  );
}

/**
 * 키-값 줄 — ds List 보기만 하는 줄. 이름 R6(t5 · 400) · 값 t5 · 700 · 고정폭 · 원까지, 줄 위아래 8 · 좌우 24, 폰은 한 줄에 하나.
 * 값의 색은 `tone` — critical(넘침) · brand(여유 · 남음) · 기본 fg-neutral.
 */
export type KeyValue = {
  key: string;
  name: string;
  value: string;
  tone?: "default" | "brand" | "critical";
};

export function KeyValueRows({
  items,
  className,
}: {
  items: KeyValue[];
  className?: string;
}) {
  return (
    <List className={className}>
      {items.map((it) => (
        <ListItem
          key={it.key}
          title={it.name}
          suffix={
            <span
              data-slot="kv-value"
              className={cn(
                "text-end font-bold tabular-nums",
                it.tone === "critical"
                  ? "text-fg-critical"
                  : it.tone === "brand"
                    ? "text-fg-brand"
                    : "text-fg-neutral",
              )}
            >
              {withCommaBreaks(it.value)}
            </span>
          }
        />
      ))}
    </List>
  );
}

/**
 * 목록 제목 — List Header boldSolid(t4 14/19 · 700 · 좌우 24 · 위아래 8) + 오른쪽 글 버튼(+ 아이콘 16, 보이는 36 · 누르는 44).
 * 앞 구역 아래 24 에 위 8 을 더해(머리 위 8 과 합쳐 16) 보이는 40 이 되게 `first` 가 아니면 위 8 을 준다(공통 값).
 */
export function ListTitle({
  id,
  children,
  action,
  first = false,
}: {
  id: string;
  children: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    title?: string;
  };
  first?: boolean;
}) {
  return (
    <ListHeader as="div" variant="boldSolid" className={cn(!first && "mt-x2")}>
      <h2 id={id}>{children}</h2>
      {action && (
        <Button
          type="button"
          variant="ghost"
          ghostColor="neutralMuted"
          size="small"
          disabled={action.disabled}
          title={action.title}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </ListHeader>
  );
}

/** 막대 아래 한 줄 — 왼쪽 · 오른쪽 t3 · fg-neutral-subtle(위 8) */
export function BarCaption({
  left,
  right,
  critical,
}: {
  left: ReactNode;
  right: ReactNode;
  /** 오른쪽 글이 넘침 — 700 · fg-critical */
  critical?: boolean;
}) {
  return (
    <div className="mt-x2 flex items-baseline justify-between gap-x2 text-t3 text-fg-neutral-subtle">
      <span className="min-w-0">{left}</span>
      <span
        className={cn(
          "min-w-0 text-end tabular-nums",
          critical && "font-bold text-fg-critical",
        )}
      >
        {right}
      </span>
    </div>
  );
}

/** 스켈레톤 키-값 줄 — 실제 줄(38 = 8 + 22 + 8)과 같은 높이 */
export function KeyValueSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-x3 px-x6 py-x2">
          <Skeleton text="t5" className="w-1/3" />
          <Skeleton text="t5" className="ml-auto w-1/4" />
        </div>
      ))}
    </div>
  );
}

/**
 * 막대 — ds ProgressBar(8 · 채움 fg-brand · 넘치면 끝까지 fg-critical) + 이름 · 값 글(role="meter").
 * Progress 묶음의 이름 줄 · 금액 줄 없이 막대만 쓸 때(큰 숫자 · 줄 아래) 이름과 값 글을 여기서 만든다.
 * 값 글은 반올림한 정수 비율("88%"), 한도를 넘으면 "{금액} 초과".
 */
export function MeterBar({
  label,
  value,
  max,
  meaning = "limit",
  formatValue,
  valueText,
  className,
}: {
  label: string;
  value: number;
  max: number;
  meaning?: ProgressMeaning;
  formatValue: (n: number) => string;
  /** 값 글을 직접 준다(예: "88% 사용 · 이번 달 77% 지남") — 없으면 "88%" · "{금액} 초과" · "달성" */
  valueText?: string;
  className?: string;
}) {
  const dsT = useDsText();
  const current = Math.max(value, 0);
  const ratio = max > 0 ? current / max : current > 0 ? 1 : 0;
  const over = meaning === "limit" && current > max;
  const reached = meaning === "goal" && current >= max;
  const text = over
    ? dsT("progress.over", { value: formatValue(current - max) })
    : reached
      ? dsT("progress.reached")
      : formatPercent(Math.min(ratio, 1) * 100, "progress");
  return (
    <ProgressBar
      className={className}
      value={value}
      max={max}
      meaning={meaning}
      aria-label={dsT("progress.label", {
        label,
        max: formatValue(max),
        current: formatValue(current),
      })}
      aria-valuetext={valueText ?? text}
    />
  );
}

/**
 * 데스크톱 지표 칸 — 한 줄 세·두 칸 그대로(구조 유지, I-08 16). 칸은 minmax(0,1fr), 이름 R10 t3 · 500 · subtle,
 * 값 t5 · 700 · 고정폭 · 원까지(쉼표 뒤 줄바꿈).
 */
export function StatGrid({
  items,
  className,
}: {
  items: KeyValue[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "m-0 mt-x3 grid gap-x3",
        items.length === 3
          ? "grid-cols-[repeat(3,minmax(0,1fr))]"
          : "grid-cols-[repeat(2,minmax(0,1fr))]",
        className,
      )}
    >
      {items.map((it) => (
        <div key={it.key} className="min-w-0">
          <dt className="text-t3 font-medium text-fg-neutral-subtle">
            {it.name}
          </dt>
          <dd
            className={cn(
              "m-0 mt-x0_5 text-t5 font-bold tabular-nums",
              it.tone === "critical"
                ? "text-fg-critical"
                : it.tone === "brand"
                  ? "text-fg-brand"
                  : "text-fg-neutral",
            )}
          >
            {withCommaBreaks(it.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** 줄 뒤 두 줄 — 쓴 돈(t5 · 700 · 원까지) 위, "/ 한도"(t3 · 500 · subtle) 아래로 쌓는다. 한 요소라 좁은 줄에서 통째로 본문 아래로 내려간다 */
export function StackedAmount({
  main,
  sub,
  critical,
}: {
  main: string;
  sub: string;
  critical?: boolean;
}) {
  return (
    <span className="flex flex-col items-end">
      <span
        className={cn(
          "block text-end text-t5 font-bold tabular-nums",
          critical ? "text-fg-critical" : "text-fg-neutral",
        )}
      >
        {withCommaBreaks(main)}
      </span>
      <span className="block text-end text-t3 font-medium tabular-nums text-fg-neutral-subtle">
        / {withCommaBreaks(sub)}
      </span>
    </span>
  );
}

/**
 * 줄 + 줄 아래 막대를 li 하나에 담는다(ul 하나 · li 줄 수만큼). 줄은 `ListItem as="div"`, 막대 자리는 위 4(줄 아래 16) · 아래 12.
 * `topGap` 은 막대 자리 위 여백 — 기본 4.
 */
export function BarredItem({
  row,
  bar,
  wrap,
  className,
}: {
  row: ReactNode;
  bar: ReactNode;
  /** li 안쪽 감싸기 — 밀면 수정 · 삭제(SwipeActions) */
  wrap?: (inner: ReactNode) => ReactNode;
  className?: string;
}) {
  const inner = (
    <>
      {row}
      <div className={cn("px-x6 pb-x3 pt-x1", className)}>{bar}</div>
    </>
  );
  return (
    <li className="list-none">{wrap ? wrap(<div>{inner}</div>) : inner}</li>
  );
}
