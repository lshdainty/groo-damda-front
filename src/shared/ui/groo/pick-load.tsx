import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { ResultSection } from "@/shared/ds/result-section";
import { Skeleton } from "@/shared/ds/skeleton";

/** 고르기 시트 · 팝오버 안의 받는 중 줄 — Skeleton 넷(타일 40 + 글줄) */
export function PickSkeleton() {
  return (
    <div
      aria-hidden
      data-slot="pick-skeleton"
      className="flex flex-col gap-x4 px-global-gutter py-x2"
    >
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-x3">
          <Skeleton radius="12" className="size-10 shrink-0" />
          <Skeleton text="t5" className="w-2/3" />
        </div>
      ))}
    </div>
  );
}

/** 고르기 안 실패 — Result Section medium failure + [다시 시도]. 서버 원문을 그리지 않는다(28-5) */
export function PickFailure({
  title,
  onRetry,
  retrying = false,
}: {
  title: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  const { t: tc } = useTranslation("common");
  return (
    <ResultSection
      kind="failure"
      size="medium"
      title={title}
      description={tc("loadFailedDesc")}
      primaryAction={{
        label: tc("retry"),
        onClick: onRetry,
        loading: retrying,
      }}
    />
  );
}

/**
 * 목록을 받아야 고를 수 있는 고르기 몸 — 받는 중 · 못 받음 · 받음을 가른다.
 * 받는 중을 빈 목록("…이 없어요")으로, 못 받음을 빈 글로 보이지 않게 한다. 받은 뒤에만 `children` 을 그린다.
 * 조건은 호출처가 정한다(이미 받은 목록이 있는 채 다시 받기 실패는 보통 `ready`).
 */
export function PickLoadGate({
  pending,
  failed,
  failedTitle,
  onRetry,
  retrying,
  children,
}: {
  /** 아직 받은 목록이 없다 — Skeleton */
  pending: boolean;
  /** 받지 못했다 — 실패 + [다시 시도] */
  failed: boolean;
  failedTitle: string;
  onRetry: () => void;
  retrying?: boolean;
  children: () => ReactNode;
}) {
  if (failed)
    return (
      <PickFailure title={failedTitle} onRetry={onRetry} retrying={retrying} />
    );
  if (pending) return <PickSkeleton />;
  return <>{children()}</>;
}
