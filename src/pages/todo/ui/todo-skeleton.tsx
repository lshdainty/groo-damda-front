import { Skeleton } from "@/shared/ds/skeleton";

/** 불러오는 동안의 날짜 묶음 — 머리 + 줄(체크 24 · 제목 · 설명 · 배지) 자리. 틀 값은 실제 줄과 같다 */
export function TodoDayGroupSkeleton({
  rows,
  className,
}: {
  rows: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between px-global-gutter py-x2">
        <Skeleton text="t4" className="w-[128px]" />
        <Skeleton text="t4" className="w-[48px]" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-start gap-x3 px-global-gutter py-x3">
          <Skeleton className="size-[24px] shrink-0" radius="4" />
          <div className="flex min-w-0 flex-1 flex-col gap-x0_5">
            <Skeleton text="t5" className="w-3/4" />
            <Skeleton text="t3" className="w-1/3" />
          </div>
          <Skeleton text="t1" className="w-x8 shrink-0" />
        </div>
      ))}
    </div>
  );
}
