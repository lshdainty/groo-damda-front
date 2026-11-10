import * as React from "react";
import { cn } from "@/shared/lib/index";

/*
 * Groo Detail — 상세 다이얼로그/드로어 공통 레이아웃 (shadcn 서브컴포넌트 패턴).
 * design dialogs.jsx TxDetailDialog 신판(토스 톤 플랫) 기반 — 값은 전부
 * groo 토큰으로 스냅(31/29→h1, 14.5→body-sm, 15→14, 12.5→caption, 46→44).
 *
 *   <DetailHero icon={…} title="가맹점" meta="2026-07-18 · 12:30">
 *     <span>−12,600원</span>                 — 금액 슬롯(색은 사용처)
 *   </DetailHero>
 *   <DetailFieldGroup>
 *     <DetailField label="카테고리">…</DetailField>
 *   </DetailFieldGroup>
 *   <DetailSection title="…" trailing={…}>…</DetailSection>
 *
 * - 카드 박스 없는 플랫 구성 — 구획은 border-top(subtle)로만.
 * - 편집은 별도 시트(detail→edit 분리, 기존 사용자 결정) — 인라인 편집 없음.
 */

/** 플랫 좌측 정렬 히어로 — [아이콘+제목] → 금액(children) → 메타. */
export function DetailHero({
  icon,
  title,
  meta,
  className,
  children,
}: {
  /** 좌측 카테고리/종류 아이콘 노드 (CategoryChip 등). */
  icon?: React.ReactNode;
  title: React.ReactNode;
  /** 하단 보조 줄 (날짜·시간 등). */
  meta?: React.ReactNode;
  className?: string;
  /** 큰 금액 슬롯 — 색·마스킹은 사용처가 지정. */
  children: React.ReactNode;
}) {
  return (
    <div className={cn("pb-4", className)}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[length:var(--text-body-sm)] font-medium text-[var(--fg-secondary)]">
          {title}
        </span>
      </div>
      <div className="num mt-3 text-[length:var(--text-display-md)] font-extrabold">
        {children}
      </div>
      {meta && (
        <div className="mt-1 text-[length:var(--text-label-sm)] text-[var(--fg-tertiary)]">
          {meta}
        </div>
      )}
    </div>
  );
}

/** 필드 묶음 — 히어로와 border-top 으로 구분되는 플랫 영역. */
export function DetailFieldGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("border-t border-[var(--border-subtle)] pt-1", className)}
      {...props}
    />
  );
}

/** 플랫 label·값 행 — label 좌(고정폭) / 값 우측 정렬. */
export function DetailField({
  label,
  className,
  children,
}: {
  label: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 py-3.5 text-[length:var(--text-body-sm)]",
        className,
      )}
    >
      <span className="min-w-[76px] shrink-0 text-[var(--fg-tertiary)]">
        {label}
      </span>
      <div className="ml-auto min-w-0 text-right">{children}</div>
    </div>
  );
}

/** border-top 구분 섹션 — 선택적 제목 행(title 좌 / trailing 우). */
export function DetailSection({
  title,
  trailing,
  className,
  children,
}: {
  title?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mt-4 border-t border-[var(--border-subtle)] pt-4",
        className,
      )}
    >
      {(title || trailing) && (
        <div className="mb-2 flex items-baseline gap-2">
          {title && (
            <h4 className="m-0 text-[length:var(--text-body-sm)] font-bold tracking-[-0.01em] text-[var(--fg-primary)]">
              {title}
            </h4>
          )}
          {trailing && <div className="ml-auto">{trailing}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
