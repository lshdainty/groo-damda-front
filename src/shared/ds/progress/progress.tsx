import * as React from "react";

import { cn } from "@/shared/lib/cn";
import { progressPercentText } from "@/shared/lib/percent";
import { dsMoney, dsText, useDsText } from "@/shared/ds/i18n";

/*
 * Groo Progress — groo 만의 막대(SEED 에는 선형 막대가 없다 — 2026-10-03). 수치 원본은 groo-design
 * specs/components/progress.yaml(값은 src/shared/ds/spec/progress.json). groo-design recipes/shadcn/components/ui/progress.tsx 를
 * 첫 판으로 가져왔다(앱 적용 1A).
 * "얼마나 찼나" 를 보이는 미터다 — 예산 · 카드 한도(쓸수록 찬다), 저축 목표 · 카드 실적(모을수록 찬다). 불러오기 · 올리기 · 받기의
 * 진행에는 쓰지 않는다 — 그건 Progress Circle(progress-circle.tsx)이다. 옛 Progress(높이 2 · 4 · 8 · 흐르는 막대 · Radix)를 대신한다.
 *
 *   Progress      이름 줄 · 막대 · 금액 줄 한 묶음
 *     label         이름 — 무엇이 얼마나 찼나("식비 예산" · "여행 자금" · "현대카드 M 전월 실적")
 *     value · max   현재 · 목표(한도). 0 보다 작은 값은 0 으로 본다
 *     meaning       limit(기본 — 쓸수록 차는 막대. 넘으면 채움 끝까지 + 위험 색 + "N원 초과") ·
 *                   goal(모을수록 차는 막대. 닿으면 채움 끝까지 + 글 "달성" 만 — 색은 그대로)
 *     formatValue   값의 글 — 기본 "350,000원"(원 단위). 돈이 아니면 그 단위로(h => `${h}시간`)
 *   ProgressBar   막대만 — 이름 · 글을 직접 그릴 때. value · max · meaning 과 이름(aria-label) · 값 글(aria-valuetext)을 꼭 준다
 *
 * 모양 — 묶음은 세로, 사이 6(spacing-x1_5). 이름 줄은 이름(t4 · 500 · fg-neutral)과 오른쪽 글(t3 · fg-neutral-subtle · 숫자 폭 같게)을
 *   양 끝에 글자 바탕선으로 맞추고 사이는 적어도 8 이다(progress.yaml header.gap — 2026-10-08 YAML 에 적었다). 막대는 높이 8 · 모서리 full · 트랙 bg-neutral-weak,
 *   채움은 브랜드 글자색 fg-brand(다크는 밝은 짝 — 채움 색 bg-brand-solid 는 다크 트랙에 묻힌다). 채움 폭은 값 ÷ 목표(넘쳐도 끝까지)이고
 *   값이 0 보다 크면 적어도 높이만큼(8) — 둥근 끝이 찌그러지지 않게. 금액 줄은 "현재 / 목표"(t2 · fg-neutral-subtle · 숫자 폭 같게).
 *   높이 · 색은 하나다 — 주의 구간 색 · 달성 색 · 자리마다 다른 높이는 두지 않는다. 트랙이 페이지 바탕과 같은 색이라 흰 면 위에 둔다.
 * 상태 — 오른쪽 글은 반올림한 정수 비율("88%"). 한도를 넘으면(over) 채움 fg-critical + "20,000원 초과"(fg-critical · 700),
 *   목표에 닿으면(reached) "달성"(fg-neutral · 700). 마침표 없이.
 * 움직임 — 값이 바뀌면 채움 폭이 motion-duration-d6(300ms) · motion-ease-enter 로 따라 찬다. 처음 그릴 때는 움직이지 않는다.
 *   모션 줄이기면 바로 바뀐다.
 * 접근성 — 막대는 role="meter" · 이름 "{이름} {목표} 중 {현재}"("식비 예산 400,000원 중 350,000원") · aria-valuemin 0 ·
 *   aria-valuemax 목표 · aria-valuenow(목표를 넘으면 목표) · aria-valuetext(오른쪽 글과 같은 말 — "88%" · "20,000원 초과" · "달성").
 *   보이는 이름 · 오른쪽 글 · 금액 줄은 보조 기술에 숨긴다(같은 말을 두 번 읽지 않게). 막대는 누르지 않는다.
 */

export type ProgressMeaning = "limit" | "goal";
type ProgressState = "enabled" | "over" | "reached";

function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<T | null>).current = node;
    }
  };
}

const formatWon = (n: number) => dsMoney(n);

// 값 → 상태 · 채움 비율(0 ~ 1) · 오른쪽 글
function measure(
  value: number,
  max: number,
  meaning: ProgressMeaning,
  formatValue: (n: number) => string,
) {
  const current = Math.max(value, 0);
  const ratio = max > 0 ? current / max : current > 0 ? 1 : 0;
  const state: ProgressState =
    meaning === "limit"
      ? current > max
        ? "over"
        : "enabled"
      : current >= max
        ? "reached"
        : "enabled";
  const status =
    state === "over"
      ? dsText("progress.over", { value: formatValue(current - max) })
      : state === "reached"
        ? dsText("progress.reached")
        : progressPercentText(Math.min(ratio, 1) * 100);
  return { current, state, status, fill: Math.min(ratio, 1) };
}

// 트랙 — 높이 8 · 모서리 full · bg-neutral-weak
const TRACK =
  "relative h-[8px] w-full overflow-hidden rounded-full bg-bg-neutral-weak";
// 채움 — 브랜드 글자색, 넘친 한도는 위험 색. 폭이 바뀌면 300ms enter(모션 줄이기면 바로)
const FILL =
  "h-full rounded-full bg-fg-brand data-[state=over]:bg-fg-critical [transition:width_var(--motion-duration-d6)_var(--motion-ease-enter)] motion-reduce:transition-none";

export interface ProgressBarProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> {
  value: number;
  max: number;
  /** limit(기본 — 넘으면 위험 색) · goal(닿아도 색은 그대로) */
  meaning?: ProgressMeaning;
}

// 막대만 — role="meter". 이름(aria-label · aria-labelledby)과 값 글(aria-valuetext)은 부르는 쪽이 준다
const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  (
    {
      value,
      max,
      meaning = "limit",
      className,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
      "aria-valuetext": ariaValueText,
      ...props
    },
    ref,
  ) => {
    useDsText();
    const own = React.useRef<HTMLDivElement>(null);
    const { current, state, fill } = measure(value, max, meaning, formatWon);

    // 이름 · 값 글이 없으면 개발 중에 알린다
    React.useEffect(() => {
      const el = own.current;
      if (!import.meta.env.DEV || !el) return;
      if (!ariaLabel?.trim() && !ariaLabelledBy?.trim()) {
        console.warn(
          '[ProgressBar] 이름을 준다 — aria-label="식비 예산 400,000원 중 350,000원".',
          el,
        );
      }
      if (!ariaValueText?.trim()) {
        console.warn(
          '[ProgressBar] 값 글을 준다 — aria-valuetext 는 오른쪽 글과 같은 말("88%" · "20,000원 초과" · "달성").',
          el,
        );
      }
    }, [ariaLabel, ariaLabelledBy, ariaValueText]);

    return (
      <div
        ref={mergeRefs(ref, own)}
        role="meter"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-valuetext={ariaValueText}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(current, max)}
        data-slot="progress-track"
        data-meaning={meaning}
        data-state={state}
        className={cn(TRACK, className)}
        {...props}
      >
        <div
          data-slot="progress-fill"
          data-state={state}
          // 값이 0 보다 크면 적어도 높이만큼 — 둥근 끝이 찌그러지지 않게
          className={cn(FILL, current > 0 && "min-w-[8px]")}
          style={{ width: `${fill * 100}%` }}
        />
      </div>
    );
  },
);
ProgressBar.displayName = "ProgressBar";

export interface ProgressProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> {
  /** 이름 — 무엇이 얼마나 찼나("식비 예산" · "여행 자금") */
  label: string;
  value: number;
  /** 목표 · 한도 */
  max: number;
  /** limit(기본 — 예산 · 카드 한도) · goal(저축 목표 · 카드 실적) */
  meaning?: ProgressMeaning;
  /** 값의 글 — 기본 "350,000원" */
  formatValue?: (value: number) => string;
}

// 오른쪽 글 — 비율은 fg-neutral-subtle, 넘침은 fg-critical 700, 달성은 fg-neutral 700
const STATUS =
  "shrink-0 text-t3 font-normal tabular-nums text-fg-neutral-subtle data-[state=over]:font-bold data-[state=over]:text-fg-critical data-[state=reached]:font-bold data-[state=reached]:text-fg-neutral";

// 이름 줄 · 막대 · 금액 줄 한 묶음
const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      label,
      value,
      max,
      meaning = "limit",
      formatValue = formatWon,
      className,
      ...props
    },
    ref,
  ) => {
    const dsT = useDsText();
    const { current, state, status } = measure(
      value,
      max,
      meaning,
      formatValue,
    );
    return (
      <div
        ref={ref}
        data-slot="progress"
        data-meaning={meaning}
        data-state={state}
        className={cn(
          "@container/progress flex flex-col gap-x1_5 font-sans",
          className,
        )}
        {...props}
      >
        {/* 이름 줄 — 막대의 이름 · 값 글이 같은 말을 하므로 보조 기술에는 숨긴다 */}
        <div
          aria-hidden="true"
          data-slot="progress-header"
          // 줄 안 폭이 16rem 보다 좁으면(큰 글자) 오른쪽 글을 이름 아래 왼쪽으로(list.md:142-148 — List 와 같은 문턱)
          className="flex items-baseline justify-between gap-x2 @max-[16rem]/progress:flex-col @max-[16rem]/progress:items-start @max-[16rem]/progress:gap-x0_5"
        >
          <span
            data-slot="progress-label"
            className="min-w-0 text-t4 font-medium text-fg-neutral break-keep [overflow-wrap:break-word]"
          >
            {label}
          </span>
          <span
            data-slot="progress-status"
            data-state={state}
            className={STATUS}
          >
            {status}
          </span>
        </div>
        <ProgressBar
          value={value}
          max={max}
          meaning={meaning}
          aria-label={dsT("progress.label", {
            label,
            max: formatValue(max),
            current: formatValue(current),
          })}
          aria-valuetext={status}
        />
        <span
          aria-hidden="true"
          data-slot="progress-amount"
          className="text-t2 font-normal tabular-nums text-fg-neutral-subtle"
        >
          {formatValue(current)} / {formatValue(max)}
        </span>
      </div>
    );
  },
);
Progress.displayName = "Progress";

export { Progress, ProgressBar };
