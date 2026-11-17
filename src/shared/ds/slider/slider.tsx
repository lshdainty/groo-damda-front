import * as React from "react";

import { cn } from "@/shared/lib/cn";
import {
  lastInputModality,
  trackInputModality,
} from "@/shared/lib/input-modality";
import { useFieldGroup, useFieldGroupState } from "@/shared/ds/field";

import {
  ARROW_PATH,
  at,
  clamp,
  decimalsOf,
  defaultFormat,
  HOLD_MS,
  INSET,
  MOVE_PX,
  tickMask,
  type Dir,
} from "./slider-variants";
import { useDsText } from "@/shared/ds/i18n";

// 구조 · 값 · 키보드 · 저장 시점은 slider-variants.ts 머리 주석과 groo-design specs/components/slider.md 가 정한다.

type Interaction = {
  pointerId: number;
  /** 움직이는 손잡이 — 두 손잡이가 같은 자리에서 눌렸으면 첫 움직임의 방향으로 정한다(-1) */
  index: number;
  /** 손잡이를 잡은 자리 ↔ 손잡이 가운데(손잡이 줄의 시작 쪽에서 잰 거리) — 잡은 자리가 손가락 밑에 그대로 남는다 */
  offset: number;
  downX: number;
  startValues: number[];
  dragging: boolean;
  timer: number | undefined;
};

type CoreProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "defaultValue" | "onChange" | "dir"
> & {
  values: number[];
  onValuesChange: (values: number[]) => void;
  onValuesCommit: (values: number[]) => void;
  min: number;
  max: number;
  step: number;
  formatValue: (value: number) => string;
  disabled?: boolean;
  name?: string;
  dir?: Dir;
  thumbLabels?: readonly string[];
};

const SliderCore = React.forwardRef<HTMLDivElement, CoreProps>(
  (
    {
      values,
      onValuesChange,
      onValuesCommit,
      min,
      max,
      step,
      formatValue,
      disabled: disabledProp,
      name,
      dir: dirProp,
      thumbLabels,
      className,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
      "aria-describedby": ariaDescribedBy,
      onPointerDown: onRootPointerDown,
      onPointerMove: onRootPointerMove,
      ...props
    },
    ref,
  ) => {
    const dsT = useDsText();
    const field = useFieldGroupState();
    const labelling = useFieldGroup({
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
      "aria-describedby": ariaDescribedBy,
    });
    const disabled = disabledProp ?? field.disabled;
    const auto = React.useId();
    const controlRef = React.useRef<HTMLDivElement>(null);
    const thumbRefs = React.useRef<(HTMLSpanElement | null)[]>([]);
    const boxRefs = React.useRef<(HTMLSpanElement | null)[]>([]);
    // 손을 대는 동안의 값 — 렌더한 값(제어 값)으로 맞춰 두고, 이벤트가 바꾼 값은 다음 렌더 전까지 여기에 둔다
    const latest = React.useRef(values);
    React.useLayoutEffect(() => {
      latest.current = values;
    });
    const interaction = React.useRef<Interaction | null>(null);
    const [dragging, setDragging] = React.useState<number | null>(null);
    const [hovered, setHovered] = React.useState<number | null>(null);
    const [keyboard, setKeyboard] = React.useState<number | null>(null);
    // 손잡이에 초점이 올 때 키보드로 왔는지 가른다 — 손잡이를 누르면 레시피가 초점을 직접 두는데, 브라우저의 :focus-visible 은
    // 그 앞의 키보드 초점을 이어받아 마우스 · 손가락으로 누른 손잡이에도 링이 뜬다(Chromium). 링 · 말풍선은 전역 초점 링과 같은
    // 마지막 입력(<html data-input>)과 손잡이의 키 누름으로만 건다
    React.useEffect(() => trackInputModality(), []);
    const [top, setTop] = React.useState(values.length - 1);

    const span = max - min;
    const precision = Math.max(decimalsOf(step), decimalsOf(min));
    const intervals = span / step;
    const discrete =
      Number.isInteger(Math.round(intervals * 1e9) / 1e9) &&
      intervals >= 2 &&
      intervals <= 5;
    const stepCount = Math.round(intervals);
    const ratio = (v: number) =>
      span > 0 ? (clamp(v, min, max) - min) / span : 0;
    const snap = (v: number) => {
      const k = Math.round((v - min) / step);
      return clamp(Number((min + k * step).toFixed(precision)), min, max);
    };

    const isRtl = () =>
      (dirProp ??
        (controlRef.current
          ? getComputedStyle(controlRef.current).direction
          : "ltr")) === "rtl";

    // 손잡이 줄의 시작 쪽(LTR 왼쪽 · RTL 오른쪽)에서 잰 포인터 자리
    const logicalX = (clientX: number) => {
      const el = controlRef.current;
      if (!el) return 0;
      const r = el.getBoundingClientRect();
      return isRtl() ? r.right - clientX : clientX - r.left;
    };
    const valueAt = (x: number) => {
      const w = controlRef.current?.getBoundingClientRect().width ?? 0;
      const p = w > INSET * 2 ? clamp((x - INSET) / (w - INSET * 2), 0, 1) : 0;
      return snap(min + p * span);
    };
    const centerOf = (v: number) => {
      const w = controlRef.current?.getBoundingClientRect().width ?? 0;
      return INSET + ratio(v) * Math.max(0, w - INSET * 2);
    };

    // 한 손잡이를 옮긴 값들 — 두 손잡이는 서로를 넘지 않는다
    const withValue = (index: number, v: number) => {
      const cur = latest.current;
      const lo = index > 0 ? (cur[index - 1] ?? min) : min;
      const hi = index < cur.length - 1 ? (cur[index + 1] ?? max) : max;
      const next = [...cur];
      next[index] = clamp(snap(v), lo, hi);
      return next;
    };
    const same = (a: readonly number[], b: readonly number[]) =>
      a.length === b.length && a.every((v, i) => v === b[i]);
    const emit = (next: number[]) => {
      if (same(next, latest.current)) return false;
      latest.current = next;
      onValuesChange(next);
      return true;
    };

    // 누른 자리에서 가장 가까운 손잡이(같은 거리면 앞 손잡이) — 두 손잡이가 겹쳐 있으면 정하지 않는다(-1, 첫 움직임의 방향으로)
    const closest = (v: number) => {
      const cur = latest.current;
      if (cur.length === 1) return 0;
      const [a = min, b = max] = cur;
      if (a === b) return v < a ? 0 : v > b ? 1 : -1;
      return Math.abs(v - a) <= Math.abs(v - b) ? 0 : 1;
    };

    const focusThumb = (index: number) =>
      thumbRefs.current[index]?.focus({ preventScroll: true });

    const startDrag = (it: Interaction) => {
      it.dragging = true;
      window.clearTimeout(it.timer);
      setDragging(it.index);
    };

    const end = (e: React.PointerEvent<HTMLDivElement>) => {
      const it = interaction.current;
      if (!it || e.pointerId !== it.pointerId) return;
      window.clearTimeout(it.timer);
      interaction.current = null;
      setDragging(null);
      if (e.currentTarget.hasPointerCapture(e.pointerId))
        e.currentTarget.releasePointerCapture(e.pointerId);
      // 손을 뗄 때 한 번 — 값이 바뀌었을 때만
      if (!same(latest.current, it.startValues)) onValuesCommit(latest.current);
    };

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      onRootPointerDown?.(e);
      if (
        disabled ||
        e.defaultPrevented ||
        e.button !== 0 ||
        interaction.current
      )
        return;
      // 손잡이 줄 밖으로 나가도 끌기가 이어지게 포인터를 잡는다(이미 끝난 포인터면 잡지 못한다 — 그대로 둔다)
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* 잡지 못해도 끌기는 손잡이 줄 안에서 이어진다 */
      }
      // 마우스 호환 이벤트를 막는다 — 글 고르기 · 초점 옮김 없이 손잡이에 초점을 직접 둔다
      e.preventDefault();
      const x = logicalX(e.clientX);
      const thumb = (e.target as Element).closest<HTMLElement>(
        '[data-slot="slider-thumb"]',
      );
      const startValues = latest.current;
      if (thumb && controlRef.current?.contains(thumb)) {
        // 손잡이를 누르면 바로 끈다 — 잡은 자리를 그대로 둔다. 두 손잡이가 겹쳐 있으면 어느 쪽인지 첫 움직임의 방향으로 정한다
        // (위에 그려진 손잡이가 움직일 수 없는 쪽이어도 끌린다)
        const pressed = Number(thumb.dataset.index);
        const coincide =
          startValues.length > 1 && startValues[0] === startValues[1];
        const it: Interaction = {
          pointerId: e.pointerId,
          index: coincide ? -1 : pressed,
          offset: x - centerOf(startValues[pressed] ?? min),
          downX: x,
          startValues,
          dragging: true,
          timer: undefined,
        };
        interaction.current = it;
        setTop(pressed);
        setDragging(pressed);
        focusThumb(pressed);
        return;
      }
      // 손잡이 밖 — 가장 가까운 손잡이가 그 자리로 건너뛴다(전환 150ms). 그대로 누르고 있거나 움직이면 끌기
      const v = valueAt(x);
      const index = closest(v);
      const it: Interaction = {
        pointerId: e.pointerId,
        index,
        offset: 0,
        downX: x,
        startValues,
        dragging: false,
        timer: undefined,
      };
      interaction.current = it;
      if (index >= 0) {
        setTop(index);
        emit(withValue(index, v));
        focusThumb(index);
        it.timer = window.setTimeout(() => {
          if (interaction.current === it && !it.dragging) startDrag(it);
        }, HOLD_MS);
      }
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      onRootPointerMove?.(e);
      const it = interaction.current;
      if (!it || e.pointerId !== it.pointerId) return;
      const x = logicalX(e.clientX);
      // 짧은 떨림은 끌기가 아니다 — 겹친 두 손잡이는 방향이 뚜렷해질 때까지 기다린다
      if ((!it.dragging || it.index < 0) && Math.abs(x - it.downX) < MOVE_PX)
        return;
      if (it.index < 0) {
        // 겹친 두 손잡이 — 시작 쪽으로 끌면 앞 손잡이, 끝 쪽이면 뒤 손잡이
        it.index = x < it.downX ? 0 : 1;
        setTop(it.index);
        setDragging(it.index);
        focusThumb(it.index);
      }
      if (!it.dragging) startDrag(it);
      emit(withValue(it.index, valueAt(x - it.offset)));
    };

    const onKeyDown =
      (index: number) => (e: React.KeyboardEvent<HTMLSpanElement>) => {
        if (disabled) return;
        const cur = latest.current;
        const v = cur[index] ?? min;
        const rtl = isRtl();
        const big = step * 10;
        let next: number | null = null;
        switch (e.key) {
          case "ArrowRight":
            next = v + (rtl ? -1 : 1) * (e.shiftKey ? big : step);
            break;
          case "ArrowLeft":
            next = v + (rtl ? 1 : -1) * (e.shiftKey ? big : step);
            break;
          case "ArrowUp":
            next = v + (e.shiftKey ? big : step);
            break;
          case "ArrowDown":
            next = v - (e.shiftKey ? big : step);
            break;
          case "PageUp":
            next = v + big;
            break;
          case "PageDown":
            next = v - big;
            break;
          case "Home":
            next = index > 0 ? (cur[index - 1] ?? min) : min;
            break;
          case "End":
            next = index < cur.length - 1 ? (cur[index + 1] ?? max) : max;
            break;
          default:
            return;
        }
        e.preventDefault();
        setKeyboard(index);
        setTop(index);
        const values2 = withValue(index, next);
        // 키마다 한 번 — 값이 바뀌었을 때만
        if (emit(values2)) onValuesCommit(values2);
      };

    // 말풍선 상자 — 손잡이가 트랙 끝에 가면 상자만 안으로 민다(화살표는 손잡이 가운데 그대로). 그릴 때마다, 손잡이 줄 폭이 바뀔 때마다
    const placeBoxes = React.useRef<() => void>(() => undefined);
    React.useLayoutEffect(() => {
      const place = () => {
        const control = controlRef.current;
        if (!control) return;
        const w = control.getBoundingClientRect().width;
        const rtl = (dirProp ?? getComputedStyle(control).direction) === "rtl";
        boxRefs.current.forEach((box, i) => {
          if (!box) return;
          const v = latest.current[i] ?? min;
          const c =
            INSET +
            (span > 0 ? (clamp(v, min, max) - min) / span : 0) *
              Math.max(0, w - INSET * 2);
          const center = rtl ? w - c : c;
          const bw = box.offsetWidth;
          const left = center - bw / 2;
          const shift = clamp(left, 0, Math.max(0, w - bw)) - left;
          box.style.translate = `calc(-50% + ${shift}px) 0`;
        });
      };
      placeBoxes.current = place;
      place();
    });
    React.useLayoutEffect(() => {
      const control = controlRef.current;
      if (!control || typeof ResizeObserver === "undefined") return;
      const ro = new ResizeObserver(() => placeBoxes.current());
      ro.observe(control);
      return () => ro.disconnect();
    }, []);

    React.useEffect(
      () => () => window.clearTimeout(interaction.current?.timer),
      [],
    );

    const range = values.length > 1;
    const p0 = ratio(values[0] ?? min);
    const p1 = range ? ratio(values[1] ?? max) : p0;
    const fillStyle: React.CSSProperties = range
      ? {
          insetInlineStart: at(p0),
          width: `calc((100% - ${INSET * 2}px) * ${p1 - p0})`,
        }
      : { insetInlineStart: 0, width: at(p0) };
    const mask = discrete ? tickMask(stepCount) : undefined;
    const markers = discrete
      ? Array.from({ length: stepCount + 1 }, (_, k) =>
          Number((min + k * step).toFixed(precision)),
        )
      : [min, max];
    const thumbLabelId = (i: number) => `${auto}thumb${i}`;
    const name0 = labelling["aria-labelledby"];

    return (
      <div
        ref={ref}
        data-slot="slider"
        data-disabled={disabled || undefined}
        data-dragging={dragging != null || undefined}
        data-ticks={discrete ? "discrete" : "none"}
        dir={dirProp}
        className={cn(
          "relative flex w-full min-w-0 select-none flex-col gap-x0_5 pt-x6 font-sans",
          className,
        )}
        {...props}
      >
        <div
          ref={controlRef}
          data-slot="slider-control"
          className={cn(
            "relative h-[44px] w-full touch-none",
            disabled
              ? "cursor-not-allowed"
              : dragging != null
                ? "cursor-grabbing"
                : "cursor-pointer",
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={end}
          onPointerCancel={end}
          onLostPointerCapture={end}
        >
          <div
            data-slot="slider-track"
            className={cn(
              "absolute inset-x-0 top-1/2 h-[4px] -translate-y-1/2 overflow-hidden rounded-full",
              disabled ? "bg-bg-disabled" : "bg-stroke-neutral-weak",
            )}
            style={
              mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined
            }
          >
            <div
              data-slot="slider-fill"
              className={cn(
                "absolute inset-y-0",
                disabled ? "bg-fg-disabled" : "bg-fg-neutral",
                dragging == null &&
                  "[transition:inset-inline-start_var(--motion-duration-d3)_var(--motion-ease-easing),width_var(--motion-duration-d3)_var(--motion-ease-easing)] motion-reduce:transition-none",
              )}
              style={fillStyle}
            />
          </div>
          {values.map((v, i) => {
            const shown =
              !disabled && (dragging === i || hovered === i || keyboard === i);
            const thumbName = range
              ? (thumbLabels?.[i] ??
                (i === 0 ? dsT("slider.min") : dsT("slider.max")))
              : null;
            const nameProps: React.AriaAttributes =
              thumbName == null
                ? name0 != null
                  ? { "aria-labelledby": name0 }
                  : { "aria-label": labelling["aria-label"] }
                : name0 != null
                  ? { "aria-labelledby": `${name0} ${thumbLabelId(i)}` }
                  : {
                      "aria-label": labelling["aria-label"]
                        ? `${labelling["aria-label"]} ${thumbName}`
                        : thumbName,
                    };
            return (
              <span
                key={i}
                data-slot="slider-thumb-anchor"
                className={cn(
                  "absolute inset-y-0 w-0",
                  top === i && "z-[1]",
                  dragging == null &&
                    "[transition:inset-inline-start_var(--motion-duration-d3)_var(--motion-ease-easing)] motion-reduce:transition-none",
                )}
                style={{ insetInlineStart: at(ratio(v)) }}
              >
                <span
                  ref={(node) => {
                    thumbRefs.current[i] = node;
                  }}
                  role="slider"
                  data-slot="slider-thumb"
                  data-index={i}
                  data-pressed={dragging === i || undefined}
                  data-focus-visible={keyboard === i || undefined}
                  tabIndex={disabled ? undefined : 0}
                  aria-orientation="horizontal"
                  aria-valuemin={min}
                  aria-valuemax={max}
                  aria-valuenow={v}
                  aria-valuetext={formatValue(v)}
                  aria-disabled={disabled || undefined}
                  aria-invalid={field.invalid || undefined}
                  aria-describedby={labelling["aria-describedby"]}
                  {...nameProps}
                  className={cn(
                    "absolute left-0 top-1/2 block size-[20px] -translate-x-1/2 -translate-y-1/2 rounded-full data-[pressed]:size-[24px]",
                    disabled
                      ? "cursor-not-allowed bg-fg-disabled"
                      : dragging === i
                        ? "cursor-grabbing bg-bg-neutral-inverted"
                        : "cursor-grab bg-bg-neutral-inverted",
                    "[transition:width_var(--motion-duration-d3)_var(--motion-ease-easing),height_var(--motion-duration-d3)_var(--motion-ease-easing)] motion-reduce:transition-none",
                    // 키보드 포커스에만 링 — :focus-visible 이 아니라 키보드로 왔을 때(위 trackInputModality)
                    "outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-solid data-[focus-visible]:outline-stroke-focus-ring",
                  )}
                  onKeyDown={onKeyDown(i)}
                  onFocus={() => {
                    if (lastInputModality() === "keyboard") setKeyboard(i);
                  }}
                  onBlur={() => setKeyboard((k) => (k === i ? null : k))}
                  onPointerEnter={(e) => {
                    if (e.pointerType === "mouse") setHovered(i);
                  }}
                  onPointerLeave={(e) => {
                    if (e.pointerType === "mouse")
                      setHovered((h) => (h === i ? null : h));
                  }}
                />
                {thumbName != null && name0 != null && (
                  <span id={thumbLabelId(i)} hidden>
                    {thumbName}
                  </span>
                )}
                {/* 말풍선 — 상자 아래 끝이 손잡이 위 12, 아래 8 × 6 화살표가 손잡이 가운데를 가리킨다 */}
                <span
                  aria-hidden
                  data-slot="slider-value-indicator"
                  data-state={shown ? "open" : "closed"}
                  className={cn(
                    "pointer-events-none absolute left-0 top-0 size-0",
                    shown
                      ? "opacity-100 [scale:1] [translate:0_0] [transition:opacity_var(--motion-duration-d4)_var(--motion-ease-enter),translate_var(--motion-duration-d4)_var(--motion-ease-enter),scale_var(--motion-duration-d4)_var(--motion-ease-enter)]"
                      : "opacity-0 [scale:0.9] [translate:0_5px] [transition:opacity_var(--motion-duration-d4)_var(--motion-ease-easing),translate_var(--motion-duration-d4)_var(--motion-ease-easing),scale_0s_linear_var(--motion-duration-d4)]",
                    "motion-reduce:[scale:1] motion-reduce:[translate:0_0] motion-reduce:[transition-property:opacity]",
                  )}
                >
                  <span
                    ref={(node) => {
                      boxRefs.current[i] = node;
                    }}
                    data-slot="slider-value-indicator-box"
                    className="absolute bottom-0 left-0 block min-w-[24px] whitespace-nowrap rounded-r1_5 bg-bg-neutral-inverted px-x2 py-x1 text-center text-t3 font-medium tabular-nums text-fg-neutral-inverted"
                  >
                    {formatValue(v)}
                  </span>
                  <svg
                    data-slot="slider-value-indicator-arrow"
                    width="8"
                    height="6"
                    viewBox="0 0 8 6"
                    className="absolute left-0 top-0 block -translate-x-1/2 fill-bg-neutral-inverted"
                  >
                    <path d={ARROW_PATH} />
                  </svg>
                </span>
              </span>
            );
          })}
        </div>
        {/* 표식 — 양 끝 값(구간 2 ~ 5 면 단계마다). 끝 둘은 트랙 끝에 맞추고 가운데는 단계 자리 가운데 */}
        <div
          aria-hidden
          data-slot="slider-markers"
          className={cn(
            "relative h-[var(--text-t3--line-height)] text-t3",
            disabled ? "text-fg-disabled" : "text-fg-neutral-muted",
          )}
        >
          {markers.map((m, k) => {
            const last = k === markers.length - 1;
            return (
              <span
                key={k}
                data-slot="slider-marker"
                className={cn(
                  "absolute top-0 whitespace-nowrap",
                  k > 0 && !last && "-translate-x-1/2 rtl:translate-x-1/2",
                )}
                style={
                  k === 0
                    ? { insetInlineStart: 0 }
                    : last
                      ? { insetInlineEnd: 0 }
                      : { insetInlineStart: at(k / stepCount) }
                }
              >
                {formatValue(m)}
              </span>
            );
          })}
        </div>
        {name != null &&
          values.map((v, i) => (
            <input
              key={i}
              type="hidden"
              name={name}
              value={String(v)}
              disabled={disabled}
            />
          ))}
      </div>
    );
  },
);
SliderCore.displayName = "SliderCore";

// 제어 · 비제어 — 값이 주어지면 그대로, 아니면 안에서 든다
function useValues<T>(value: T | undefined, defaultValue: T) {
  const [inner, setInner] = React.useState(defaultValue);
  const controlled = value !== undefined;
  return [
    controlled ? value : inner,
    (next: T) => !controlled && setInner(next),
  ] as const;
}

type SliderShared = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "defaultValue" | "onChange" | "dir"
> & {
  /** 최솟값(기본 0) */
  min?: number;
  /** 최댓값(기본 100) */
  max?: number;
  /** 단계(기본 1) — 구간((max − min) ÷ step)이 2 ~ 5개면 눈금 · 단계 표식 */
  step?: number;
  /** 단위를 붙인 글("80%") — aria-valuetext · 말풍선 · 표식. 기본은 숫자 그대로 */
  formatValue?: (value: number) => string;
  /** 막힘 — 전용 색, Tab 순서에서 빠진다. Field 의 disabled 도 받는다 */
  disabled?: boolean;
  /** 폼으로 보낼 이름 — 숨은 입력(범위는 같은 이름으로 둘) */
  name?: string;
  /** 쓰는 방향 — 주지 않으면 놓인 자리의 방향 */
  dir?: Dir;
};

export type SliderProps = SliderShared & {
  value?: number;
  defaultValue?: number;
  /** 움직일 때마다 — 화면만 바꾼다 */
  onValueChange?: (value: number) => void;
  /** 손을 뗄 때 · 키마다 한 번(값이 바뀌었을 때만) — 바로 적용하는 저장은 여기서 */
  onValueCommit?: (value: number) => void;
};

const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  (
    {
      value,
      defaultValue,
      onValueChange,
      onValueCommit,
      min = 0,
      max = 100,
      step = 1,
      formatValue = defaultFormat,
      ...props
    },
    ref,
  ) => {
    const [current, setCurrent] = useValues(value, defaultValue ?? min);
    return (
      <SliderCore
        ref={ref}
        values={[current]}
        onValuesChange={(next) => {
          const v = next[0] ?? min;
          setCurrent(v);
          onValueChange?.(v);
        }}
        onValuesCommit={(next) => onValueCommit?.(next[0] ?? min)}
        min={min}
        max={max}
        step={step}
        formatValue={formatValue}
        {...props}
      />
    );
  },
);
Slider.displayName = "Slider";

export type RangeSliderProps = SliderShared & {
  /** [최소, 최대] */
  value?: [number, number];
  defaultValue?: [number, number];
  onValueChange?: (value: [number, number]) => void;
  onValueCommit?: (value: [number, number]) => void;
  /** 손잡이마다 이름 — "{라벨} {이름}", 기본 ["최소", "최대"]("시작" · "끝" 처럼 바꿀 수 있다) */
  thumbLabels?: [string, string];
};

const RangeSlider = React.forwardRef<HTMLDivElement, RangeSliderProps>(
  (
    {
      value,
      defaultValue,
      onValueChange,
      onValueCommit,
      min = 0,
      max = 100,
      step = 1,
      formatValue = defaultFormat,
      thumbLabels,
      ...props
    },
    ref,
  ) => {
    const [current, setCurrent] = useValues<[number, number]>(
      value,
      defaultValue ?? [min, max],
    );
    const pair = (next: number[]): [number, number] => [
      next[0] ?? min,
      next[1] ?? max,
    ];
    return (
      <SliderCore
        ref={ref}
        values={current}
        onValuesChange={(next) => {
          const v = pair(next);
          setCurrent(v);
          onValueChange?.(v);
        }}
        onValuesCommit={(next) => onValueCommit?.(pair(next))}
        min={min}
        max={max}
        step={step}
        formatValue={formatValue}
        thumbLabels={thumbLabels}
        {...props}
      />
    );
  },
);
RangeSlider.displayName = "RangeSlider";

export interface SliderValueProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** 막힘 — Field 의 disabled 를 받는다. 슬라이더에만 disabled 를 줬으면 여기에도 준다 */
  disabled?: boolean;
}

// 머리 값 — Field 머리 오른쪽(headerAction). 16 / 22 · 700 · 고정폭 숫자, 보조 기술에는 숨긴다
const SliderValue = React.forwardRef<HTMLSpanElement, SliderValueProps>(
  ({ disabled, className, ...props }, ref) => {
    const field = useFieldGroupState();
    const off = disabled ?? field.disabled;
    return (
      <span
        ref={ref}
        aria-hidden
        data-slot="slider-value"
        data-disabled={off || undefined}
        className={cn(
          "whitespace-nowrap font-sans text-t5 font-bold tabular-nums",
          off ? "text-fg-disabled" : "text-fg-neutral",
          className,
        )}
        {...props}
      />
    );
  },
);
SliderValue.displayName = "SliderValue";

export { Slider, RangeSlider, SliderValue };
