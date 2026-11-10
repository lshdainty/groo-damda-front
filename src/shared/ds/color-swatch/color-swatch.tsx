import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import {
  submitImplicitly,
  useFieldGroup,
  useFieldGroupState,
} from "@/shared/ds/field";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ds/tooltip";

import {
  CHECK,
  CHECK_COLOR,
  colorName,
  COLOR_SWATCH_ORDER,
  COLUMNS,
  contrastOf,
  DIVIDER_SIDE,
  DIVIDER_STACKED,
  parseRgb,
  STACK_CONTAINER,
  SWATCH,
  SWATCH_BG,
  type ChartColor,
  type CheckTone,
} from "./color-swatch-variants";
import { useDsText } from "@/shared/ds/i18n";
import { ignoreRadioJumpKeys } from "@/shared/ds/radio-group";

// 칸 · 고름 · 지금 색 · 키보드의 규칙은 color-swatch-variants.ts 머리 주석과 groo-design specs/components/color-swatch.md 가 정한다.

// 지금 색 칸의 체크 — fg-neutral · fg-neutral-inverted 가운데 그 색 위 대비가 큰 쪽(두 모드 모두 하나는 짙고 하나는 밝다 —
// 라이트 4.06 · 다크 3.67 이상). 저장 색은 모드를 따르지 않으므로 모드 · 브랜드가 바뀌면(문서의 class · data-theme · 색 모드) 다시 정한다
function useCheckTone(
  rootRef: React.RefObject<HTMLElement | null>,
  color: string | undefined,
): CheckTone {
  const [tone, setTone] = React.useState<CheckTone>("inverted");
  React.useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !color) return;
    const compute = () => {
      const probe = root.ownerDocument.createElement("span");
      probe.style.display = "none";
      root.appendChild(probe);
      const read = (value: string) => {
        probe.style.color = "";
        probe.style.color = value;
        return parseRgb(getComputedStyle(probe).color);
      };
      const bg = read(color);
      const fg = read("var(--color-fg-neutral)");
      const inverted = read("var(--color-fg-neutral-inverted)");
      probe.remove();
      if (!bg || !fg || !inverted) return;
      const next: CheckTone =
        contrastOf(inverted, bg) >= contrastOf(fg, bg) ? "inverted" : "neutral";
      setTone((prev) => (prev === next ? prev : next));
    };
    compute();
    const observer = new MutationObserver(compute);
    observer.observe(root.ownerDocument.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", compute);
    return () => {
      observer.disconnect();
      scheme.removeEventListener("change", compute);
    };
  }, [rootRef, color]);
  return tone;
}

export type ColorSwatchValue = ChartColor | "current";

export interface ColorSwatchGroupProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "defaultValue" | "onChange"
> {
  /** 고른 색(제어) — 색 이름 또는 "current"(지금 색 칸). null 이면 고른 칸 없음 */
  value?: ColorSwatchValue | null;
  /** 처음 고른 색(비제어) */
  defaultValue?: ColorSwatchValue | null;
  /** 고르면 — 같은 칸을 다시 고르면 부르지 않는다(라디오) */
  onValueChange?: (value: ColorSwatchValue) => void;
  /** 팔레트 밖 저장 색(hex — 가져오기의 #9E9E9E) — 주면 격자 앞에 "지금 색" 칸 */
  currentColor?: string;
  /** 색 없는 항목에 차트가 줄 색 — 주면 격자 앞에 "자동" 칸(점선 원). currentColor 가 있으면 그쪽 */
  autoColor?: ChartColor;
  /** 막힘 — 색은 그대로, 누르기만 막는다. Field 의 disabled 도 받는다 */
  disabled?: boolean;
}

function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<T | null>).current = node;
    }
  };
}

const ColorSwatchGroup = React.forwardRef<
  HTMLDivElement,
  ColorSwatchGroupProps
>(
  (
    {
      value: valueProp,
      defaultValue = null,
      onValueChange,
      currentColor,
      autoColor,
      disabled: disabledProp,
      className,
      onKeyDown,
      onKeyDownCapture,
      ...props
    },
    ref,
  ) => {
    const dsT = useDsText();
    const field = useFieldGroupState();
    const labelling = useFieldGroup(props);
    const disabled = disabledProp ?? field.disabled;
    const rootRef = React.useRef<HTMLDivElement>(null);
    const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
    const [inner, setInner] = React.useState<ColorSwatchValue | null>(
      defaultValue,
    );
    const controlled = valueProp !== undefined;
    const value = controlled ? valueProp : inner;
    const current = currentColor ? "custom" : autoColor ? "auto" : null;
    // 지금 색 칸의 위 · 옆 판정 — 고정 321 이 아니라 실제 폭으로: 묶음이 놓인 자리 폭이 (지금 색 칸의 실제 폭 + 16 + 선 1 + 16 + 격자 248)
    // 보다 좁으면 위 줄로 올린다. 칸 폭은 글(지금 색 · 자동)의 크기를 따라 커지므로 글자 200% 에서도 가로로 넘치지 않는다
    const currentColRef = React.useRef<HTMLDivElement>(null);
    const [stack, setStack] = React.useState<{
      stacked: boolean;
      needed: number;
    }>({ stacked: false, needed: 321 });
    React.useLayoutEffect(() => {
      const root = rootRef.current;
      const col = currentColRef.current;
      if (!current || !root || !col) return;
      const measure = () => {
        const needed = Math.ceil(col.offsetWidth) + 16 + 1 + 16 + 248;
        const width = root.clientWidth;
        // 폭을 못 잰 곳(0 — 숨김 · jsdom)은 옆으로 둔다
        const stacked = width > 0 && width < needed;
        setStack((prev) =>
          prev.stacked === stacked && prev.needed === needed
            ? prev
            : { stacked, needed },
        );
      };
      measure();
      if (typeof ResizeObserver === "undefined") return;
      const ro = new ResizeObserver(measure);
      ro.observe(root);
      ro.observe(col);
      return () => ro.disconnect();
    }, [current, rootRef]);
    const checkTone = useCheckTone(
      rootRef,
      current === "custom" ? currentColor : undefined,
    );

    // 차례 — 지금 색 칸이 맨 앞, 그 뒤 색상환 10
    const order: ColorSwatchValue[] = current
      ? ["current", ...COLOR_SWATCH_ORDER]
      : [...COLOR_SWATCH_ORDER];
    const offset = current ? 1 : 0;
    const selectedIndex = value == null ? -1 : order.indexOf(value);
    const tabbable = selectedIndex >= 0 ? selectedIndex : 0;

    const select = (next: ColorSwatchValue) => {
      if (next === value) return;
      if (!controlled) setInner(next);
      onValueChange?.(next);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(e);
      if (e.defaultPrevented || disabled) return;
      const i = itemRefs.current.findIndex((el) => el === e.target);
      if (i < 0) return;
      const n = order.length;
      const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
      let j: number | null = null;
      switch (e.key) {
        case "ArrowRight":
          j = (i + (rtl ? n - 1 : 1)) % n;
          break;
        case "ArrowLeft":
          j = (i + (rtl ? 1 : n - 1)) % n;
          break;
        case "ArrowDown":
        case "ArrowUp": {
          // 위아래 줄의 같은 칸 — 지금 색 칸은 줄 밖이라 그대로
          if (i < offset) return;
          const g = i - offset;
          const rows = Math.ceil(COLOR_SWATCH_ORDER.length / COLUMNS);
          const row =
            (Math.floor(g / COLUMNS) + (e.key === "ArrowDown" ? 1 : rows - 1)) %
            rows;
          j =
            offset +
            Math.min(
              row * COLUMNS + (g % COLUMNS),
              COLOR_SWATCH_ORDER.length - 1,
            );
          break;
        }
        case "Enter":
          // 진짜 radio 처럼 폼을 제출한다 — 고르지 않는다(button 의 Enter 누르기를 막는다)
          e.preventDefault();
          submitImplicitly(e.target as HTMLButtonElement);
          return;
        default:
          return;
      }
      e.preventDefault();
      const next = order[j];
      if (next === undefined) return;
      itemRefs.current[j]?.focus();
      select(next);
    };

    const item = (v: ColorSwatchValue, i: number) => {
      const checked = value === v;
      const isCurrent = v === "current";
      const name = isCurrent
        ? current === "custom"
          ? dsT("colorSwatch.currentCustom")
          : dsT("colorSwatch.auto")
        : colorName(v);
      const look = isCurrent
        ? current === "custom"
          ? ""
          : cn(
              autoColor && SWATCH_BG[autoColor],
              "border-2 border-dashed border-stroke-neutral-solid",
            )
        : SWATCH_BG[v];
      const checkColor =
        isCurrent && current === "custom"
          ? CHECK_COLOR[checkTone]
          : "text-fg-neutral-inverted";
      const swatch = (
        <button
          key={v}
          ref={(node) => {
            itemRefs.current[i] = node;
          }}
          type="button"
          role="radio"
          aria-checked={checked}
          aria-label={name}
          tabIndex={i === tabbable ? 0 : -1}
          disabled={disabled}
          data-slot={isCurrent ? "color-swatch-current" : "color-swatch"}
          data-color={
            isCurrent ? (current === "custom" ? currentColor : autoColor) : v
          }
          className={cn(SWATCH, look)}
          style={
            isCurrent && current === "custom"
              ? { background: currentColor }
              : undefined
          }
          onClick={() => select(v)}
        >
          {checked && (
            <span
              aria-hidden
              data-slot="color-swatch-check"
              className={cn(CHECK, checkColor)}
            >
              <Check strokeWidth={2.5} />
            </span>
          )}
        </button>
      );
      // 지금 색 칸은 이름이 아래 글로 보인다 — 툴팁 없이
      if (isCurrent) return swatch;
      return (
        <Tooltip key={v}>
          <TooltipTrigger asChild>{swatch}</TooltipTrigger>
          <TooltipContent>{name}</TooltipContent>
        </Tooltip>
      );
    };

    return (
      <div
        ref={mergeRefs(ref, rootRef)}
        role="radiogroup"
        data-slot="color-swatch-group"
        data-disabled={disabled || undefined}
        className={cn(current && STACK_CONTAINER, className)}
        style={
          current
            ? { containIntrinsicInlineSize: `${stack.needed}px` }
            : undefined
        }
        {...(disabled ? { "aria-disabled": true } : {})}
        {...(field.invalid ? { "aria-invalid": true } : {})}
        {...(field.required ? { "aria-required": true } : {})}
        {...labelling}
        onKeyDown={handleKeyDown}
        onKeyDownCapture={ignoreRadioJumpKeys(onKeyDownCapture)}
      >
        <div
          data-slot="color-swatch-layout"
          className={cn(
            "flex w-fit items-start gap-x4",
            current && (stack.stacked ? "flex-col" : "flex-row"),
          )}
        >
          {current && (
            <>
              <div
                ref={currentColRef}
                data-slot="color-swatch-current-column"
                className="flex shrink-0 flex-col items-center"
              >
                {item("current", 0)}
                <span
                  aria-hidden
                  data-slot="color-swatch-current-label"
                  className="mt-x1_5 whitespace-nowrap font-sans text-t2 text-fg-neutral-subtle"
                >
                  {current === "custom"
                    ? dsT("colorSwatch.currentCustom")
                    : dsT("colorSwatch.auto")}
                </span>
              </div>
              <span
                aria-hidden
                data-slot="color-swatch-divider"
                className={stack.stacked ? DIVIDER_STACKED : DIVIDER_SIDE}
              />
            </>
          )}
          <div
            data-slot="color-swatch-grid"
            className="grid w-[248px] shrink-0 grid-cols-[repeat(5,40px)] gap-[12px]"
          >
            {COLOR_SWATCH_ORDER.map((color, k) => item(color, k + offset))}
          </div>
        </div>
      </div>
    );
  },
);
ColorSwatchGroup.displayName = "ColorSwatchGroup";

export { ColorSwatchGroup };
