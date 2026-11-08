import * as React from "react";

import { cn } from "@/shared/lib/cn";
import { progressPercentText } from "@/shared/lib/percent";
import { useDsText } from "@/shared/ds/i18n";

/*
 * Groo Progress Circle — 구조는 SEED Progress Circle(2026-10-03). 수치 원본은 groo-design
 * specs/components/progress-circle.yaml(값은 src/shared/ds/spec/progress-circle.json).
 * groo-design recipes/shadcn/components/ui/progress-circle.tsx 를 첫 판으로 가져왔다(앱 적용 1A).
 * 옛 Spinner(spinner.tsx — 16 · 24 · 32 · 48, 브랜드 4분의 1 호 · 1.5초 일정 속도)를 대신한다.
 *
 *   ProgressCircle   작업이 진행 중임을 알리는 원(SVG) — 트랙 · 호
 *     size        "24"(요소 안 — 섹션 제목 옆 · 목록 끝 · 올리는 항목 위, 두께 3) · "40"(기본 — 콘텐츠 영역 가운데, 두께 5) ·
 *                 "inherit"(놓인 부품이 정한다 — --progress-size · --progress-thickness. Button 14 · 14 · 16 · 18, 두께 2)
 *     tone        neutral(기본 — 원 stroke-neutral-solid · 트랙 stroke-neutral-subtle) · brand(원 stroke-brand-solid · 트랙
 *                 bg-brand-weak-pressed — 앱 첫 화면처럼 큰 전환점 하나) · staticWhite(흰 원 + 흰 30% 트랙 — 사진 위 딤 · 짙은 채움) ·
 *                 inherit(부품이 정한 --progress-range · --progress-track, 없으면 글자색과 그 30%)
 *     value       없으면 값 없는 원 — 돈다. 있으면 값 있는 원 — 12시부터 (value − min) ÷ (max − min) 만큼 시계 방향으로 채운다
 *     min · max   기본 0 · 100. 범위를 벗어난 값은 끝에서 멈춘다(0 ~ 5 중 3 이면 60%)
 *     aria-label  기다리는 일 — 기본 "불러오는 중"(올리기는 "영수증 사진 올리는 중"처럼). 영어 · 세 점을 쓰지 않는다
 *     valueText   값 있는 원의 값 글 — 기본 반올림한 "40%"
 *
 * 모양 — 크기 · 두께 · 색은 CSS 변수(--pc-size · --pc-thickness · --pc-track · --pc-range)로 정하고 원의 cx · cy · r 을 그 값으로
 *   계산한다(선 가운데 반지름 = (크기 − 두께) ÷ 2 — 24 는 10.5, 40 은 17.5). 원의 길이는 pathLength 100 으로 재므로 호 길이가 곧
 *   백분율이다. 호는 끝이 둥글고 12시(−90°)에서 시계 방향으로 간다. 값 있는 원은 값이 0 이면 호를 지운다(둥근 점이 남지 않게).
 *   상자 크기는 style 로 준다 — Button 의 [&_svg]:size-* 처럼 놓인 자리의 아이콘 규칙이 원의 크기를 덮지 않게.
 * 움직임 — 값 없는 원은 원 전체가 1.2초에 한 바퀴(cubic-bezier(0.35, 0.25, 0.65, 0.75)) 돌고, 같은 박자로 호 머리가 원둘레만큼
 *   늘고(0 ~ 75%, cubic-bezier(0.35, 0, 0.65, 1)) 꼬리가 따라와 줄인다(33.33 ~ 100%, cubic-bezier(0.35, 0, 0.65, 0.6)). 세 키프레임
 *   (회전 · 머리 · 꼬리)은 토큰에 없어 이 파일이 <style>(React 19 — href · precedence 로 문서 머리에 한 번)로 싣는다 — 토큰 키프레임
 *   spin 은 일정한 속도로 도는 아이콘의 것이다(DESIGN.md Animation library).
 *   값 있는 원은 값이 바뀔 때 채움이 motion-duration-d6(300ms) · motion-ease-enter 로 따라 찬다 — 처음 그릴 때는 움직이지 않고,
 *   값 없는 원에서 값 있는 원으로 바뀔 때도 그 자리에서 시작한다(호를 새로 그린다).
 * 모션 줄이기 — 돌지 않는다. 값 없는 원은 12시부터 시계 방향 3/4 의 고정 호, 값 있는 원은 채움이 바로 바뀐다(v104).
 * 접근성 — 늘 role="progressbar" + 이름(aria-label). 값 있는 원은 aria-valuenow · aria-valuemin · aria-valuemax + aria-valuetext,
 *   값 없는 원은 값 속성을 두지 않는다. 장식으로 쓸 때(버튼 안 — 버튼이 aria-busy 로 알린다)만 aria-hidden 을 준다.
 *   언제 보이고 언제 실패로 바꾸는지(1초 · 5초 · 10초)는 skeleton.tsx 의 LoadingRegion(fallback="circle")이 맡는다.
 */

export type ProgressCircleSize = "24" | "40" | "inherit";
export type ProgressCircleTone =
  "neutral" | "brand" | "staticWhite" | "inherit";

// 크기 · 두께(progress-circle.yaml size). inherit 는 부품이 정한 값 — 없으면 글자 크기 · 2px
const SIZE: Record<ProgressCircleSize, string> = {
  "24": "[--pc-size:24px] [--pc-thickness:3px]",
  "40": "[--pc-size:40px] [--pc-thickness:5px]",
  inherit:
    "[--pc-size:var(--progress-size,1em)] [--pc-thickness:var(--progress-thickness,2px)]",
};

// 원 · 트랙 색(progress-circle.yaml tone). 다크는 역할 색의 -dark 짝(brand 원은 밝은 짝)
const TONE: Record<ProgressCircleTone, string> = {
  neutral:
    "[--pc-track:var(--color-stroke-neutral-subtle)] [--pc-range:var(--color-stroke-neutral-solid)]",
  brand:
    "[--pc-track:var(--color-bg-brand-weak-pressed)] [--pc-range:var(--color-stroke-brand-solid)]",
  staticWhite:
    "[--pc-track:color-mix(in_srgb,var(--color-static-white)_30%,transparent)] [--pc-range:var(--color-static-white)]",
  inherit:
    "[--pc-track:var(--progress-track,color-mix(in_srgb,currentColor_30%,transparent))] [--pc-range:var(--progress-range,currentColor)]",
};

// 상자 — 값 없는 원은 1.2초에 한 바퀴(모션 줄이기면 멈춘다)
const ROOT = "inline-block shrink-0 overflow-visible align-middle";
const SPIN =
  "animate-[groo-progress-circle-rotate_1200ms_cubic-bezier(0.35,0.25,0.65,0.75)_infinite] motion-reduce:animate-none";

// 원 — 상자 가운데, 선 가운데 반지름 (크기 − 두께) ÷ 2
const CIRCLE =
  "fill-none [cx:calc(var(--pc-size)/2)] [cy:calc(var(--pc-size)/2)] [r:calc(var(--pc-size)/2_-_var(--pc-thickness)/2)] [stroke-width:var(--pc-thickness)]";
const TRACK = `${CIRCLE} [stroke:var(--pc-track)]`;
// 호 — 끝이 둥글고 12시에서 시작한다(제 중심으로 −90°)
const RANGE = `${CIRCLE} [stroke:var(--pc-range)] [stroke-linecap:round] [transform-box:fill-box] [transform-origin:center] [transform:rotate(-90deg)]`;
// 값 없는 원 — 머리(0 ~ 75%) · 꼬리(33.33 ~ 100%)가 1.2초 박자로. 모션 줄이기면 3/4 고정 호
const RANGE_INDETERMINATE = [
  "animate-[groo-progress-circle-head_1200ms_cubic-bezier(0.35,0,0.65,1)_infinite,groo-progress-circle-tail_1200ms_cubic-bezier(0.35,0,0.65,0.6)_infinite]",
  "motion-reduce:animate-none motion-reduce:[stroke-dasharray:75_200]",
].join(" ");
// 값 있는 원 — 호 길이 100(원 전체) 을 dashoffset 으로 밀어 값만큼 보인다. 값이 바뀌면 300ms 로 따라 찬다
const RANGE_DETERMINATE =
  "[stroke-dasharray:100_200] [transition:stroke-dashoffset_var(--motion-duration-d6)_var(--motion-ease-enter)] motion-reduce:transition-none";

// 회전 · 머리 · 꼬리 키프레임 — 머리 · 꼬리는 pathLength 100 기준(원둘레 = 100). 간격 200 은 원둘레보다 길어 대시가 하나만
// 보이게 한다. 시간 곡선은 CSS 처럼 키프레임 구간마다 걸린다(머리는 0 ~ 75%, 꼬리는 33.33 ~ 100% 에서만 움직인다)
const KEYFRAMES = [
  "@keyframes groo-progress-circle-rotate { 0% { transform: rotate(0deg) } 100% { transform: rotate(360deg) } }",
  "@keyframes groo-progress-circle-head { 0% { stroke-dasharray: 0 200 } 75%, 100% { stroke-dasharray: 100 200 } }",
  "@keyframes groo-progress-circle-tail { 0%, 33.33% { stroke-dashoffset: 0 } 100% { stroke-dashoffset: -100 } }",
].join("\n");

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(Math.max(n, lo), hi);

function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<T | null>).current = node;
    }
  };
}

const useIsoLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

export interface ProgressCircleProps extends Omit<
  React.SVGAttributes<SVGSVGElement>,
  "children" | "min" | "max" | "values"
> {
  /** "24"(요소 안) · "40"(기본 — 콘텐츠 영역 가운데) · "inherit"(부품의 --progress-size · --progress-thickness) */
  size?: ProgressCircleSize;
  /** neutral(기본) · brand · staticWhite · inherit(부품의 --progress-range · --progress-track, 없으면 글자색) */
  tone?: ProgressCircleTone;
  /** 없으면 값 없는 원(돈다), 있으면 12시부터 값만큼 채운다 */
  value?: number;
  /** 기본 0 */
  min?: number;
  /** 기본 100 */
  max?: number;
  /** 값 글 — 기본 반올림한 "40%" */
  valueText?: string;
}

const ProgressCircle = React.forwardRef<SVGSVGElement, ProgressCircleProps>(
  (
    {
      size = "40",
      tone = "neutral",
      value,
      min = 0,
      max = 100,
      valueText,
      className,
      style,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
      ...props
    },
    ref,
  ) => {
    const dsT = useDsText();
    const own = React.useRef<SVGSVGElement>(null);
    const determinate = typeof value === "number" && Number.isFinite(value);
    const percent =
      determinate && max > min
        ? clamp(((value - min) / (max - min)) * 100, 0, 100)
        : 0;

    // inherit 크기는 부품이 정한다 — 정하지 않았으면 개발 중에 알린다(글자 크기 · 2px 로 그린다)
    useIsoLayoutEffect(() => {
      if (!import.meta.env.DEV || size !== "inherit" || !own.current) return;
      if (
        !getComputedStyle(own.current)
          .getPropertyValue("--progress-size")
          .trim()
      ) {
        console.warn(
          '[ProgressCircle] size="inherit" 는 놓인 부품이 --progress-size · --progress-thickness 를 정한다.',
          own.current,
        );
      }
    }, [size]);

    return (
      <>
        {!determinate && (
          <style href="groo-progress-circle" precedence="groo">
            {KEYFRAMES}
          </style>
        )}
        <svg
          ref={mergeRefs(ref, own)}
          role="progressbar"
          aria-label={
            ariaLabelledBy ? ariaLabel : (ariaLabel ?? dsT("common.loading"))
          }
          aria-labelledby={ariaLabelledBy}
          aria-valuemin={determinate ? min : undefined}
          aria-valuemax={determinate ? max : undefined}
          aria-valuenow={determinate ? clamp(value, min, max) : undefined}
          aria-valuetext={
            determinate
              ? (valueText ?? progressPercentText(percent))
              : undefined
          }
          data-slot="progress-circle"
          data-size={size}
          data-tone={tone}
          data-mode={determinate ? "determinate" : "indeterminate"}
          className={cn(
            ROOT,
            SIZE[size],
            TONE[tone],
            !determinate && SPIN,
            className,
          )}
          // 상자 크기는 style 로 — 놓인 자리의 svg 크기 규칙(Button 의 [&_svg]:size-*)보다 앞선다
          style={{
            width: "var(--pc-size)",
            height: "var(--pc-size)",
            ...style,
          }}
          {...props}
        >
          <circle data-slot="progress-circle-track" className={TRACK} />
          {determinate ? (
            <circle
              // 값 없는 원에서 바뀌면 새로 그린다 — 채움이 0 에서 미끄러지지 않고 그 자리에서 시작한다
              key="determinate"
              data-slot="progress-circle-range"
              pathLength={100}
              className={cn(RANGE, RANGE_DETERMINATE)}
              style={{
                strokeDashoffset: 100 - percent,
                opacity: percent > 0 ? undefined : 0,
              }}
            />
          ) : (
            <circle
              key="indeterminate"
              data-slot="progress-circle-range"
              pathLength={100}
              className={cn(RANGE, RANGE_INDETERMINATE)}
            />
          )}
        </svg>
      </>
    );
  },
);
ProgressCircle.displayName = "ProgressCircle";

export { ProgressCircle };
