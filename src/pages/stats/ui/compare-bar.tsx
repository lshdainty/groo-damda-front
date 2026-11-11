import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/cn";

/**
 * 비교 막대 줄(이름 + 막대 + 금액) — progress.md:33 "이름과 오른쪽 글은 양 끝에 두고 사이는 적어도 8,
 * 이름이 길면 줄을 바꿔 오른쪽 글에 붙지 않는다". 앱 `_CompareBar` 와 같은 구조다.
 * - 넓을 때(이름 한 줄 + 10 + 막대 최소 4rem + 10 + 금액이 줄에 들어가면) 한 줄: [이름][막대][금액]
 * - 아니면 위 줄 + 막대 한 줄. 위 줄 = [이름(flex 1 · 낱말 단위 줄바꿈)] 8 [금액(제 폭 · 자르지 않음)] —
 *   이름이 먼저 줄을 바꾸고 금액은 그 줄에 남는다. 금액 폭 + 8 + 이름의 가장 긴 낱말이 줄 폭을 넘을 때만
 *   flex-wrap 이 금액을 아래 오른쪽 끝으로 내린다(이름 칸의 min-width 가 min-content = 가장 긴 낱말).
 */
const NAME = "text-t2 font-bold";
const AMOUNT = "text-t3 font-bold tabular-nums";

export function CompareBar({
  label,
  amount,
  max,
  current,
}: {
  label: string;
  amount: string;
  /** 막대 길이 비율 0 ~ 1 */
  max: number;
  current: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const nameProbe = useRef<HTMLSpanElement>(null);
  const amountProbe = useRef<HTMLSpanElement>(null);
  const [wide, setWide] = useState(true);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => {
      const rem =
        parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const nameW = Math.max(44, nameProbe.current?.offsetWidth ?? 0);
      const amountW = amountProbe.current?.offsetWidth ?? 0;
      setWide(nameW + 10 + 4 * rem + 10 + amountW <= el.clientWidth);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [label, amount]);

  const bar = (
    <div
      aria-hidden
      className={cn(
        "h-2 overflow-hidden rounded-full",
        wide ? "min-w-[4rem] flex-1" : "w-full",
      )}
    >
      <div
        className={cn(
          "h-full rounded-full",
          // 두 값 견주기는 Chart(chart.md "비교 막대 줄", 결정 10B) — 이번 chart-blue · 지난 chart-blue-weak, 트랙도 테두리도 없다.
          // 11-11 DA-10(사용자) — 지난 기간 막대를 바탕 대비 3:1 로 진하게: 라이트 blue-200→blue-600(흰 바탕 3.67) · 다크 blue-300→blue-700(카드 2.92, 팔레트 단계 가운데 3:1 에 가장 가깝다)
          current ? "bg-chart-blue" : "bg-blue-600 dark:bg-blue-700",
        )}
        style={{ width: `${max * 100}%` }}
      />
    </div>
  );
  const nameCls = cn(NAME, "text-fg-neutral-subtle");
  const amountCls = cn(
    AMOUNT,
    "whitespace-nowrap text-end",
    current ? "text-fg-neutral" : "text-fg-neutral-muted",
  );
  return (
    <div ref={root} className="relative" data-layout={wide ? "row" : "column"}>
      {/* 폭만 재는 숨은 글 — 이름 · 금액이 한 줄일 때의 폭 */}
      <span
        ref={nameProbe}
        aria-hidden
        className={cn(
          NAME,
          "pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap",
        )}
      >
        {label}
      </span>
      <span
        ref={amountProbe}
        aria-hidden
        className={cn(
          AMOUNT,
          "pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap",
        )}
      >
        {amount}
      </span>
      {wide ? (
        <div className="flex items-center gap-x2_5">
          <span
            className={cn(nameCls, "min-w-[44px] shrink-0 whitespace-nowrap")}
          >
            {label}
          </span>
          {bar}
          <span className={cn(amountCls, "shrink-0")}>{amount}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-x1">
          <div className="flex flex-wrap items-start justify-between gap-x-x2">
            <span
              data-slot="compare-bar-name"
              className={cn(nameCls, "min-w-min flex-1 break-keep")}
            >
              {label}
            </span>
            <span
              data-slot="compare-bar-amount"
              className={cn(amountCls, "ms-auto flex-none")}
            >
              {amount}
            </span>
          </div>
          {bar}
        </div>
      )}
    </div>
  );
}
