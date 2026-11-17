import * as React from "react";

import { cn } from "@/shared/lib/cn";

/*
 * Groo Wheel Picker — 구조는 SEED Wheel Picker(2026-10-03). 수치 원본은 groo-design
 * specs/components/wheel-picker.yaml(값은 src/shared/ds/spec/wheel-picker.json).
 * groo-design recipes/shadcn/components/ui/wheel-picker.tsx 를 첫 판으로 가져왔다(앱 적용 1A).
 *
 *   WheelPicker         휠 — role="group" + 이름(aria-label · aria-labelledby 중 하나는 꼭). size(small 36 · medium 44, 기본 medium) ·
 *                       visibleItems(5 · 7, 기본 5) · disabled. 칼럼 묶음을 가운데에 모으고 가운데 띠 · 위아래 안개를 그린다
 *   WheelPickerColumn   칼럼 — role="spinbutton". options({ value, label, ariaLabel? }) · value(제어) · defaultValue ·
 *                       onValueChange(value, { stepDelta }) — 멈춘 뒤 한 번 · onIndexChange(index, value) — 굴리는 동안 지나는 항목마다 ·
 *                       loop · align(left · center · right) · valueChangeBehavior(바깥에서 값이 바뀔 때 auto · smooth) · aria-label(필수)
 *
 * 값은 휠이 멈춘 뒤에 정한다 — 굴리는 동안에는 띠를 지나는 항목만 짙게 칠하고, 가장 가까운 칸에 멈춘 뒤 onValueChange 를 한 번 부른다.
 * stepDelta 는 지난번 멈춘 자리에서 몇 칸 움직였는지다(아래로 +). 반복 칼럼에서 끝 → 처음을 넘었는지 알 수 있다(Time Picker 의 시 11 ↔ 12).
 *
 * 움직임(wheel-picker.md Behavior · SEED 와 같은 수치)
 *   - 손가락: 브라우저 스크롤 + CSS 스냅(scroll-snap y mandatory · 항목 가운데) — 관성은 OS 것이다. 손을 떼고 스크롤이 멈추면
 *     (scrollend 또는 120ms 동안 변화 없음) 값을 정한다.
 *   - 마우스 끌기: 3px 넘게 움직이면 끈다(포인터 캡처 · 스냅 끔 · grabbing). 놓을 때 속도 × 180ms 만큼 더 가되 ±3칸까지(속도는 마지막
 *     움직임이 80ms 넘게 묵었으면 0), 가장 가까운 칸으로 220 + 칸당 40ms(최대 360ms) ease-out cubic 으로 맞춘다. 끈 직후의 누름은 삼킨다.
 *   - 마우스 휠 · 트랙패드: 브라우저 스크롤(스냅 끔). 마지막 입력 120ms 뒤 가까운 칸으로 160ms ease-out cubic.
 *   - 보이는 항목 누르기: 그 항목을 가운데로 부드럽게 옮기고, 멈춘 뒤 값을 정한다.
 *   - 키보드: ↑ ↓ 이전 · 다음(누르고 있으면 바로바로), Home · End 처음 · 끝. 칼럼마다 Tab 자리 하나.
 *   - 모션 줄이기면 프로그램이 하는 이동(누르기 · 키 · 맞추기)을 모두 바로 한다.
 *   - 반복(loop): 항목을 앞뒤로 12화면치 이어 그리고, 멈출 때 끝에서 2화면 안이면 같은 값의 가운데 자리로 몰래 옮긴다.
 *   - 막힘: 값은 그대로 · 굴릴 수도 초점이 갈 수도 없다(tabIndex -1 · aria-disabled). 고른 항목도 흐리게, 띠는 남는다.
 *   - 쓰는 쪽이 값을 바꾸면 그 자리로 옮긴다(valueChangeBehavior — 기본 바로). 사용자가 만지는 동안에는 덮어쓰지 않는다.
 *
 * 모양: 휠 높이 = 항목 높이 × 보이는 수(medium 5개 220 · 7개 308, small 5개 180), 바탕 bg-layer-floating.
 * 항목은 medium 44 · 글자 t10-static 26 / 35, small 36 · t7-static 20 / 27 — 글자 크기 설정을 따르지 않는 px 이다(휠 칸이 넘치지 않게).
 * 500 · 숫자 폭 같게(tabular-nums) · 좌우 16, 칼럼은 항목 글 폭만큼(w-max — 폭을 정할 칼럼은 className 으로). 칼럼 묶음은 휠 가운데.
 * 띠 — bg-neutral-weak · 모서리 r2 8 · 휠 좌우 끝에서 16 들임 · 항목 높이, 칼럼 뒤에 깔린다.
 * 글자 — 띠 밖은 fg-disabled, 띠에 걸친 부분만 fg-neutral 로 칠한다(굴리는 동안에도). 띠와 겹치는 항목(많아야 둘)에 겹친 위치를
 *   --wheel-overlap-start · --wheel-overlap-end 로 넣고, 글자를 투명하게 해 세로 그라데이션 바탕을 글자 모양으로 자른다(background-clip: text).
 *   겹친 자리는 scrollTop 으로 셈한다(항목 p 의 위치 = p × 항목 높이) — 굴리는 동안 요소를 재지 않는다. 겹친 항목을 따로 한 벌 더 그리는
 *   방법(덧그린 사본)은 반복 칼럼의 항목 수만큼 DOM 이 두 배가 되고 스크롤을 맞춰야 해서 쓰지 않았다.
 * 안개 — 위아래 min(휠 높이 × 40%, 항목 3칸)(medium 5개 88 · 7개 123 · small 5개 72). 휠 바탕색(bg-layer-floating) 판을 gradient-fade-mask
 *   로 가려 끝에서 바탕색으로 흐려지게 한다(위 판은 뒤집어 아래로 투명). 바탕이 같은 색이라 내용을 마스크로 가린 것과 같은 모습이고,
 *   토큰(방향 없는 위 → 아래 그라데이션)을 그대로 쓴다. 안개는 띠와 겹치지 않는다(5 · 7칸에서 안개 끝 ≤ 띠 위).
 * 키보드 초점 — 키로 칼럼에 들어오면 가운데 항목 둘레 안쪽 2px 링(stroke-focus-ring · 모서리 8). 터치 · 마우스로 만지면 숨긴다
 *   (전역 초점 링과 같은 조건 — 직전 입력이 포인터면 그리지 않는다. <html data-input>, shared/lib/input-modality.ts).
 *
 * 이름: 휠 role="group"(이름 필수 — 없으면 개발 중에 경고), 칼럼 role="spinbutton" · aria-label · aria-valuemin 0 · aria-valuemax 개수 − 1 ·
 * aria-valuenow 번호 · aria-valuetext 항목 글(getAriaValueText · ariaLabel 로 바꾼다). 항목은 보조 기술에 숨긴다.
 */

// ── 수치(SEED useWheelPickerColumn 과 같다) ────────────────────
const ITEM_SIZE = { small: 36, medium: 44 } as const;
const SETTLE_DELAY = 120; // 마지막 스크롤 · 휠 입력 뒤 멈췄다고 보는 시간
const WHEEL_ALIGN_DURATION = 160; // 휠 · 트랙패드가 멈춘 뒤 가까운 칸으로
const DRAG_THRESHOLD = 3; // 이만큼 넘게 움직여야 끌기
const MOMENTUM_DURATION = 180; // 놓을 때 속도 × 이 시간만큼 더 간다
const MAX_MOMENTUM_ITEMS = 3; // 관성은 ±3칸까지
const VELOCITY_MAX_AGE = 80; // 마지막 움직임이 이보다 오래되면 속도 0
const RELEASE_MIN_DURATION = 220; // 놓은 뒤 맞추기 — 220 + 칸당 40, 최대 360
const RELEASE_PER_ITEM = 40;
const RELEASE_MAX_DURATION = 360;
const MOVE_DURATION = 200; // 누르기 · 키로 칸을 옮길 때 — motion-duration-d4 · ease-out cubic(Q-005 A)
const LOOP_BUFFER_VIEWPORTS = 12; // 반복 칼럼은 앞뒤로 12화면치 이어 그린다
const LOOP_RECENTER_VIEWPORTS = 2; // 끝에서 2화면 안에 멈추면 가운데로 옮긴다

export type WheelPickerSize = keyof typeof ITEM_SIZE;

export interface WheelPickerOption {
  /** 칼럼 안에서 고유한 값 */
  value: string;
  /** 항목 글 — 짧은 한 줄(숫자 · 짧은 낱말) */
  label: React.ReactNode;
  /** 읽는 글 — label 이 글이 아니면(아이콘 등) 준다 */
  ariaLabel?: string;
}

export interface WheelPickerValueChangeDetails {
  /** 지난번 멈춘 자리에서 움직인 칸 수 — 아래로 +, 위로 − */
  stepDelta: number;
  /** Home · End 로 처음 · 끝 항목에 뛴 것 — 지나간 칸을 세지 않는다(Time Picker 의 시 칼럼은 오전 · 오후를 그대로 둔다, 03-C 3A) */
  jump?: boolean;
}

// ── 휠 문맥 ──────────────────────────────────────────────────
type WheelContextValue = {
  size: WheelPickerSize;
  itemSize: number;
  visibleItems: number;
  disabled: boolean;
};
const WheelContext = React.createContext<WheelContextValue | null>(null);

function useWheel(name: string) {
  const ctx = React.useContext(WheelContext);
  if (!ctx) throw new Error(`${name} 는 WheelPicker 안에 둔다.`);
  return ctx;
}

// ── 모양 ─────────────────────────────────────────────────────
// 휠 — 항목 높이 × 보이는 수, 바탕 bg-layer-floating. 글자 색 둘(띠 밖 · 띠 위)을 변수로 두고 막히면 띠 위도 흐리게
const ROOT = [
  "relative w-full select-none overflow-hidden bg-bg-layer-floating font-sans",
  "h-[calc(var(--wheel-item)*var(--wheel-count))]",
  "[--wheel-item-color:var(--color-fg-disabled)] [--wheel-selected-color:var(--color-fg-neutral)]",
  "data-[disabled]:[--wheel-selected-color:var(--color-fg-disabled)]",
].join(" ");
const ROOT_SIZE: Record<WheelPickerSize, string> = {
  small: "[--wheel-item:36px]",
  medium: "[--wheel-item:44px]",
};
const ROOT_COUNT: Record<5 | 7, string> = {
  5: "[--wheel-count:5]",
  7: "[--wheel-count:7]",
};

// 띠 — 휠 좌우 끝에서 16 들인 가운데 줄(항목 높이 · 모서리 8 · bg-neutral-weak). 칼럼 뒤에 깔린다
const INDICATOR =
  "pointer-events-none absolute inset-x-x4 top-1/2 h-[var(--wheel-item)] -translate-y-1/2 rounded-r2 bg-bg-neutral-weak";

// 칼럼 묶음 — 휠 가운데
const COLUMNS = "relative flex h-full w-full justify-center";

// 안개 — min(휠 높이 × 40%, 항목 3칸). 휠 바탕색 판을 gradient-fade-mask(위 → 아래로 불투명)로 가린다 — 위 판은 뒤집는다
const FOG =
  "pointer-events-none absolute inset-x-0 h-[min(40%,calc(var(--wheel-item)*3))] bg-bg-layer-floating [mask-image:var(--gradient-fade-mask)]";
const FOG_TOP = `${FOG} top-0 -scale-y-100`;
const FOG_BOTTOM = `${FOG} bottom-0`;

// 칼럼 — 스크롤 칸. 위아래 (보이는 수 − 1) ÷ 2 칸을 비워 첫 · 끝 항목도 가운데에 온다. 스크롤바는 숨긴다.
// 끄는 동안 · 맞추는 동안(휠 · 놓기)은 스냅을 끈다. 키보드 링은 가운데 항목(data-selected)에 — 직전 입력이 포인터면 숨긴다(index.css focus-visible 과 같은 조건)
const COLUMN = [
  "h-full w-max shrink-0 cursor-grab touch-pan-y snap-y snap-mandatory overflow-y-auto overflow-x-hidden overscroll-contain outline-none",
  "py-[calc(var(--wheel-item)*(var(--wheel-count)-1)/2)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
  "data-[dragging]:cursor-grabbing data-[dragging]:snap-none data-[free]:snap-none",
  "data-[disabled]:cursor-default data-[disabled]:overflow-hidden",
  "[&:focus-visible:not(:where(:root[data-input=pointer]_*))_[data-selected]]:outline-2 [&:focus-visible:not(:where(:root[data-input=pointer]_*))_[data-selected]]:-outline-offset-2 [&:focus-visible:not(:where(:root[data-input=pointer]_*))_[data-selected]]:outline-stroke-focus-ring",
].join(" ");

// 항목 — 항목 높이 · 스냅은 가운데. 띠와 겹치면 글자를 투명하게 하고 세로 그라데이션(띠 밖 색 → 띠 위 색 → 띠 밖 색)을 글자로 자른다
const ITEM = [
  "flex h-[var(--wheel-item)] shrink-0 snap-center items-center rounded-r2 text-[color:var(--wheel-item-color)]",
  "data-[overlap]:bg-clip-text data-[overlap]:text-transparent",
  "data-[overlap]:[background-image:linear-gradient(to_bottom,var(--wheel-item-color)_0,var(--wheel-item-color)_var(--wheel-overlap-start),var(--wheel-selected-color)_var(--wheel-overlap-start),var(--wheel-selected-color)_var(--wheel-overlap-end),var(--wheel-item-color)_var(--wheel-overlap-end),var(--wheel-item-color)_100%)]",
].join(" ");
const ITEM_ALIGN = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
} as const;

// 항목 글 — 좌우 16 · 500 · 숫자 폭 같게 · 한 줄. 글자 크기 설정을 따르지 않는 px(t10-static · t7-static)
const ITEM_LABEL =
  "flex h-full items-center whitespace-nowrap px-x4 font-medium tabular-nums";
const ITEM_LABEL_SIZE: Record<WheelPickerSize, string> = {
  small: "text-t7-static",
  medium: "text-t10-static",
};

// ── 작은 도구 ─────────────────────────────────────────────────
function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<T | null>).current = node;
    }
  };
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);
const toLogical = (physical: number, count: number) =>
  count === 0 ? -1 : ((physical % count) + count) % count;
// 반복 칼럼이 한쪽에 더 그리는 벌 수 — 앞뒤로 12화면치
const loopCycles = (count: number, visible: number) =>
  count <= 1 ? 0 : Math.ceil((LOOP_BUFFER_VIEWPORTS * visible) / count);

// ── 휠 ───────────────────────────────────────────────────────
type WheelPickerName =
  | { "aria-label": string; "aria-labelledby"?: string }
  | { "aria-label"?: string; "aria-labelledby": string };

export type WheelPickerProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "aria-label" | "aria-labelledby"
> &
  WheelPickerName & {
    /** small 36(좁은 팝오버) · medium 44(기본 — 시각 · 월 · 달력의 연 · 월) */
    size?: WheelPickerSize;
    /** 보이는 칸 수 — 5(기본) · 7(달력 머리의 연 · 월 휠). 가운데 줄이 있어야 해서 홀수만 */
    visibleItems?: 5 | 7;
    /** 막힌 휠 — 값은 그대로, 굴릴 수도 초점이 갈 수도 없다 */
    disabled?: boolean;
  };

const WheelPicker = React.forwardRef<HTMLDivElement, WheelPickerProps>(
  (
    {
      size = "medium",
      visibleItems = 5,
      disabled = false,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const own = React.useRef<HTMLDivElement>(null);
    // 이름이 없으면 개발 중에 알린다(그려진 휠을 본다 — 타입을 우회한 경우)
    React.useEffect(() => {
      const el = own.current;
      if (
        import.meta.env.DEV &&
        el &&
        !el.getAttribute("aria-label")?.trim() &&
        !el.getAttribute("aria-labelledby")?.trim()
      ) {
        console.warn(
          '[WheelPicker] 휠에 이름이 없다 — aria-label 을 준다(예: "월 선택").',
          el,
        );
      }
    });
    const ctx: WheelContextValue = {
      size,
      itemSize: ITEM_SIZE[size],
      visibleItems,
      disabled,
    };
    return (
      <WheelContext.Provider value={ctx}>
        <div
          ref={mergeRefs(ref, own)}
          role="group"
          data-slot="wheel-picker"
          data-size={size}
          data-disabled={disabled ? "" : undefined}
          className={cn(
            ROOT,
            ROOT_SIZE[size],
            ROOT_COUNT[visibleItems],
            className,
          )}
          {...props}
        >
          <div
            aria-hidden
            data-slot="wheel-picker-indicator"
            className={INDICATOR}
          />
          <div data-slot="wheel-picker-columns" className={COLUMNS}>
            {children}
          </div>
          <div
            aria-hidden
            data-slot="wheel-picker-fog"
            data-side="top"
            className={FOG_TOP}
          />
          <div
            aria-hidden
            data-slot="wheel-picker-fog"
            data-side="bottom"
            className={FOG_BOTTOM}
          />
        </div>
      </WheelContext.Provider>
    );
  },
);
WheelPicker.displayName = "WheelPicker";

// ── 칼럼 ─────────────────────────────────────────────────────
export interface WheelPickerColumnProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "defaultValue" | "onChange" | "aria-label" | "children"
> {
  /** 항목 — 하나 이상, 값은 칼럼 안에서 고유 */
  options: readonly WheelPickerOption[];
  /** 고른 값(제어) — options 안의 값 */
  value?: string;
  /** 처음 값(제어하지 않을 때) — 없으면 첫 항목 */
  defaultValue?: string;
  /** 휠이 멈춰 값이 정해졌을 때 한 번 */
  onValueChange?: (
    value: string,
    details: WheelPickerValueChangeDetails,
  ) => void;
  /** 굴리는 동안 띠를 지나는 항목마다(햅틱 등) — 값은 아직 정해지지 않았다 */
  onIndexChange?: (index: number, value: string) => void;
  /** 끝 다음에 처음을 잇는다(월 · 시 · 분). 끄면 처음 · 끝에서 멈춘다 */
  loop?: boolean;
  /** 항목 글 정렬 — 시는 오른쪽(한 자리 · 두 자리 수의 끝을 맞춘다) */
  align?: "left" | "center" | "right";
  /** 쓰는 쪽이 값을 바꿨을 때 옮기는 방식 — auto(바로, 기본) · smooth */
  valueChangeBehavior?: "auto" | "smooth";
  /** 읽는 글 — 기본은 항목의 ariaLabel · label 글 */
  getAriaValueText?: (value: string) => string;
  /** 칼럼 이름(필수) — "연도" · "월" · "시" · "분" */
  "aria-label": string;
}

type DragState = {
  pointerId: number;
  startY: number;
  startTop: number;
  lastTop: number;
  lastTime: number;
  velocity: number;
  dragged: boolean;
};

const WheelPickerColumn = React.forwardRef<
  HTMLDivElement,
  WheelPickerColumnProps
>(
  (
    {
      options,
      value: valueProp,
      defaultValue,
      onValueChange,
      onIndexChange,
      loop = false,
      align = "center",
      valueChangeBehavior = "auto",
      getAriaValueText,
      className,
      ...props
    },
    ref,
  ) => {
    const { size, itemSize, visibleItems, disabled } =
      useWheel("WheelPickerColumn");
    const count = options.length;
    const [inner, setInner] = React.useState<string | undefined>(
      () => defaultValue ?? options[0]?.value,
    );
    const controlled = valueProp !== undefined;
    const current = controlled ? valueProp : inner;
    const logical = Math.max(
      options.findIndex((o) => o.value === current),
      0,
    );
    const looping = loop && count > 1;
    const cycles = looping ? loopCycles(count, visibleItems) : 0;
    const total = looping ? count * (cycles * 2 + 1) : count;
    const central = looping ? cycles * count + logical : logical;

    // 쓰는 쪽의 실수 — 개발 중에만 알린다
    React.useEffect(() => {
      if (!import.meta.env.DEV) return;
      if (count === 0)
        console.warn(
          "[WheelPicker] 칼럼에 항목이 없다 — options 에 하나 이상 넣는다.",
        );
      else if (new Set(options.map((o) => o.value)).size !== count)
        console.warn(
          "[WheelPicker] 칼럼의 값이 겹친다 — value 는 고유해야 한다.",
        );
      if (
        controlled &&
        count > 0 &&
        !options.some((o) => o.value === valueProp)
      )
        console.warn(`[WheelPicker] value "${valueProp}" 가 options 에 없다.`);
    }, [controlled, count, options, valueProp]);

    // 이벤트 · 타이머가 읽는 지금 값 — 커밋마다 갈아 끼운다(오래된 클로저를 피한다). 아래 자리 맞추기보다 먼저 돈다
    const snapshot = {
      options,
      count,
      total,
      central,
      cycles,
      looping,
      current,
      controlled,
      disabled,
      itemSize,
      visibleItems,
      onValueChange,
      onIndexChange,
    };
    const latest = React.useRef(snapshot);
    React.useLayoutEffect(() => {
      latest.current = snapshot;
    });

    const columnRef = React.useRef<HTMLDivElement>(null);
    const settleTimerRef = React.useRef<number | null>(null);
    const scrollFrameRef = React.useRef<number | null>(null);
    const alignFrameRef = React.useRef<number | null>(null);
    const selectedRef = React.useRef<HTMLElement | null>(null);
    const overlapRef = React.useRef<HTMLElement[]>([]);
    const lastVisualRef = React.useRef(central);
    const lastSettledRef = React.useRef(central);
    const keyboardTargetRef = React.useRef<number | null>(null);
    // Home · End 로 뛰었는지 — 멈춘 뒤 onValueChange 에 한 번 싣고 지운다
    const jumpRef = React.useRef(false);
    const initializedRef = React.useRef(false);
    const touchingRef = React.useRef(false);
    const dragRef = React.useRef<DragState | null>(null);
    const wheelingRef = React.useRef(false);
    const aligningRef = React.useRef(false);
    const notifyRef = React.useRef(false); // 사용자가 움직이는 중 — 지나는 항목을 알리고, 멈추면 값을 정한다
    const suppressClickRef = React.useRef(false);

    // 도구는 한 벌만 만든다(처음 그릴 때 한 번) — 지금 값은 latest 에서 읽는다. 아래 효과들(자리 맞추기 · scrollend · 치우기)이
    // 이것에 기대므로 그릴 때마다 새로 만들면 안 된다 — 치우기가 그때마다 돌아 기다리던 정하기 · 맞추기를 지운다.
    // 레시피는 useMemo(…, []) 였다 — 손 메모이제이션 대신 상태의 처음 값으로 한 번 만든다(컴파일하지 않은 테스트에서도 한 벌)
    const [api] = React.useState(() => {
      const col = () => columnRef.current;
      const nearest = () => {
        const el = col();
        const L = latest.current;
        if (!el || L.total === 0) return 0;
        return clamp(Math.round(el.scrollTop / L.itemSize), 0, L.total - 1);
      };
      const clearSettle = () => {
        if (settleTimerRef.current !== null)
          window.clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      };
      const cancelAlign = () => {
        if (alignFrameRef.current !== null)
          cancelAnimationFrame(alignFrameRef.current);
        alignFrameRef.current = null;
        aligningRef.current = false;
      };

      // 띠와 겹친 항목(많아야 둘)에 겹친 위치를 넣는다 — scrollTop 으로 셈한다
      const updateOverlap = () => {
        const el = col();
        if (!el) return;
        const { itemSize: size, total: n } = latest.current;
        const top = el.scrollTop;
        const first = clamp(Math.floor(top / size), 0, Math.max(n - 1, 0));
        const next: HTMLElement[] = [];
        for (let p = first; p <= Math.min(first + 1, n - 1); p++) {
          const item = el.children.item(p) as HTMLElement | null;
          if (!item) continue;
          const itemTop = p * size;
          const start = Math.max(top - itemTop, 0);
          const end = Math.min(top + size - itemTop, size);
          if (end - start <= 0.01) continue;
          item.setAttribute("data-overlap", "");
          item.style.setProperty(
            "--wheel-overlap-start",
            `${(start / size) * 100}%`,
          );
          item.style.setProperty(
            "--wheel-overlap-end",
            `${(end / size) * 100}%`,
          );
          next.push(item);
        }
        for (const item of overlapRef.current) {
          if (next.includes(item)) continue;
          item.removeAttribute("data-overlap");
          item.style.removeProperty("--wheel-overlap-start");
          item.style.removeProperty("--wheel-overlap-end");
        }
        overlapRef.current = next;
      };

      // 가운데 항목(키보드 링) · 띠 위 글자. notify 면 지나간 항목마다 onIndexChange
      const updateVisual = (physical: number, notify = false) => {
        const el = col();
        if (!el) return;
        const item = el.children.item(physical) as HTMLElement | null;
        if (selectedRef.current !== item) {
          selectedRef.current?.removeAttribute("data-selected");
          item?.setAttribute("data-selected", "");
          selectedRef.current = item;
        }
        const previous = lastVisualRef.current;
        lastVisualRef.current = physical;
        updateOverlap();
        const L = latest.current;
        if (!notify || physical === previous || L.count === 0) return;
        const dir = physical > previous ? 1 : -1;
        for (
          let p = previous + dir;
          dir > 0 ? p <= physical : p >= physical;
          p += dir
        ) {
          const index = toLogical(p, L.count);
          const option = L.options[index];
          if (option) L.onIndexChange?.(index, option.value);
        }
      };

      const scrollToPhysical = (physical: number, behavior: ScrollBehavior) => {
        const el = col();
        const L = latest.current;
        if (!el) return;
        el.scrollTo({
          top: clamp(physical, 0, Math.max(L.total - 1, 0)) * L.itemSize,
          behavior,
        });
      };

      // 멈췄다 — 가장 가까운 칸의 값을 정하고(바뀌었을 때만 한 번), 반복 칼럼이 끝 가까이면 같은 값의 가운데로 옮긴다
      const settle = () => {
        clearSettle();
        if (touchingRef.current || dragRef.current) return;
        const el = col();
        const L = latest.current;
        if (!el || L.count === 0) {
          notifyRef.current = false;
          return;
        }
        const p = nearest();
        updateVisual(p, notifyRef.current);
        if (L.disabled) {
          if (p !== L.central) {
            el.scrollTop = L.central * L.itemSize;
            updateVisual(L.central);
          }
          keyboardTargetRef.current = L.central;
          notifyRef.current = false;
          return;
        }
        const index = toLogical(p, L.count);
        const nextValue = L.options[index]?.value;
        const stepDelta = p - lastSettledRef.current;
        let settled = p;
        if (L.looping) {
          const buffer = L.visibleItems * LOOP_RECENTER_VIEWPORTS;
          if (p <= buffer || p >= L.total - 1 - buffer) {
            settled = L.cycles * L.count + index;
            if (settled !== p) {
              el.scrollTop = settled * L.itemSize;
              updateVisual(settled);
            }
          }
        }
        lastSettledRef.current = settled;
        keyboardTargetRef.current = settled;
        notifyRef.current = false;
        const jumped = jumpRef.current;
        jumpRef.current = false;
        if (nextValue !== undefined && nextValue !== L.current) {
          if (!L.controlled) setInner(nextValue);
          L.onValueChange?.(nextValue, { stepDelta, jump: jumped });
        }
      };

      const finishAlign = () => {
        cancelAlign();
        wheelingRef.current = false;
        col()?.removeAttribute("data-free");
        settle();
      };

      // 가까운 칸으로 맞춘다 — ease-out cubic. 맞추는 동안은 스냅을 끄고, 다 맞추면 값을 정한다
      const align = (physical: number, duration: number) => {
        const el = col();
        if (!el) return;
        const L = latest.current;
        cancelAlign();
        aligningRef.current = true;
        el.setAttribute("data-free", "");
        const from = el.scrollTop;
        const to = clamp(physical, 0, Math.max(L.total - 1, 0)) * L.itemSize;
        let start: number | undefined;
        const step = (time: number) => {
          if (!aligningRef.current) return;
          // ??= 를 쓰지 않는다 — React Compiler 가 그 문법을 못 읽어 칼럼 전체를 건너뛴다(레시피는 start ??= time)
          if (start === undefined) start = time;
          const progress = Math.min((time - start) / duration, 1);
          el.scrollTop = from + (to - from) * (1 - (1 - progress) ** 3);
          updateVisual(nearest(), notifyRef.current);
          if (progress < 1) {
            alignFrameRef.current = requestAnimationFrame(step);
            return;
          }
          alignFrameRef.current = null;
          finishAlign();
        };
        alignFrameRef.current = requestAnimationFrame(step);
      };

      // 마지막 스크롤 · 휠 입력 뒤 120ms 쉬면 — 휠이었으면 가까운 칸으로 맞추고, 아니면(손가락 · 누르기 · 키) 바로 값을 정한다
      const scheduleSettle = () => {
        clearSettle();
        if (touchingRef.current || dragRef.current) return;
        settleTimerRef.current = window.setTimeout(() => {
          settleTimerRef.current = null;
          const el = col();
          if (wheelingRef.current && el) {
            const p = nearest();
            if (
              !prefersReducedMotion() &&
              Math.abs(el.scrollTop - p * latest.current.itemSize) > 0.5
            ) {
              align(p, WHEEL_ALIGN_DURATION);
              return;
            }
            if (Math.abs(el.scrollTop - p * latest.current.itemSize) > 0.5)
              el.scrollTop = p * latest.current.itemSize;
            finishAlign();
            return;
          }
          settle();
        }, SETTLE_DELAY);
      };

      return {
        col,
        nearest,
        clearSettle,
        cancelAlign,
        updateVisual,
        scrollToPhysical,
        settle,
        finishAlign,
        align,
        scheduleSettle,
      };
    });

    // ── 스크롤 · 휠 · 손가락 · 마우스 ──
    const onScroll = () => {
      if (scrollFrameRef.current === null) {
        scrollFrameRef.current = requestAnimationFrame(() => {
          scrollFrameRef.current = null;
          api.updateVisual(api.nearest(), notifyRef.current);
        });
      }
      if (!aligningRef.current) api.scheduleSettle();
    };

    const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
      const el = columnRef.current;
      if (!el || disabled || e.deltaY === 0) return;
      keyboardTargetRef.current = null;
      api.cancelAlign();
      if (!wheelingRef.current) {
        wheelingRef.current = true;
        notifyRef.current = true;
        el.setAttribute("data-free", "");
      }
      api.scheduleSettle();
      // 반복 칼럼이 끝 가까이 가면 같은 자리의 다른 벌로 몰래 옮긴다(휠은 멈출 때까지 기다리지 않는다)
      const L = latest.current;
      if (!L.looping) return;
      const viewport = L.visibleItems * L.itemSize;
      const delta =
        e.deltaMode === 1
          ? e.deltaY * L.itemSize
          : e.deltaMode === 2
            ? e.deltaY * viewport
            : e.deltaY;
      const maxTop = (L.total - 1) * L.itemSize;
      const buffer = viewport * LOOP_RECENTER_VIEWPORTS;
      const projected = el.scrollTop + delta;
      const nearStart = delta < 0 && projected <= buffer;
      const nearEnd = delta > 0 && projected >= maxTop - buffer;
      if (!nearStart && !nearEnd) return;
      const cycle = L.count * L.itemSize;
      const cycleCount = L.total / L.count;
      const bufferCycles = Math.max(1, Math.ceil(buffer / cycle));
      const targetCycle = nearStart
        ? cycleCount - 1 - bufferCycles
        : bufferCycles;
      const offset = ((el.scrollTop % cycle) + cycle) % cycle;
      const before = el.scrollTop;
      el.scrollTop = targetCycle * cycle + offset;
      lastSettledRef.current += Math.round(
        (el.scrollTop - before) / L.itemSize,
      );
      lastVisualRef.current += Math.round((el.scrollTop - before) / L.itemSize);
      api.updateVisual(api.nearest());
    };

    const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
      if (disabled) return;
      keyboardTargetRef.current = null;
      api.cancelAlign();
      wheelingRef.current = false;
      e.currentTarget.removeAttribute("data-free");
      touchingRef.current = true;
      notifyRef.current = true;
      api.clearSettle();
    };
    const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length > 0) return;
      touchingRef.current = false;
      api.scheduleSettle();
    };
    const onTouchCancel = () => {
      touchingRef.current = false;
      api.scheduleSettle();
    };

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "mouse" || e.button !== 0 || disabled) return;
      const el = e.currentTarget;
      // 글자 고르기 · 브라우저의 끌기를 막고 초점은 직접 준다(직전 입력이 포인터라 링은 없다)
      e.preventDefault();
      el.focus({ preventScroll: true });
      keyboardTargetRef.current = null;
      api.clearSettle();
      api.cancelAlign();
      wheelingRef.current = false;
      el.removeAttribute("data-free");
      el.setAttribute("data-dragging", "");
      notifyRef.current = true;
      dragRef.current = {
        pointerId: e.pointerId,
        startY: e.clientY,
        startTop: el.scrollTop,
        lastTop: el.scrollTop,
        lastTime: performance.now(),
        velocity: 0,
        dragged: false,
      };
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      const el = e.currentTarget;
      if (!drag || drag.pointerId !== e.pointerId) return;
      e.preventDefault();
      const distance = drag.startY - e.clientY;
      if (!drag.dragged && Math.abs(distance) <= DRAG_THRESHOLD) return;
      if (!drag.dragged) {
        drag.dragged = true;
        el.setPointerCapture(e.pointerId);
      }
      el.scrollTop = drag.startTop + distance;
      const now = performance.now();
      const elapsed = now - drag.lastTime;
      if (elapsed > 0) {
        const instant = (el.scrollTop - drag.lastTop) / elapsed;
        drag.velocity = drag.velocity * 0.25 + instant * 0.75;
      }
      drag.lastTop = el.scrollTop;
      drag.lastTime = now;
      api.updateVisual(api.nearest(), notifyRef.current);
    };

    // 놓았다 — 속도로 최대 3칸 더 가서 가까운 칸으로 220 + 칸당 40ms(최대 360). 끈 직후의 누름은 삼킨다
    const finishDrag = (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      const el = e.currentTarget;
      if (!drag || drag.pointerId !== e.pointerId) return;
      dragRef.current = null;
      if (!drag.dragged) {
        el.removeAttribute("data-dragging");
        notifyRef.current = false;
        return;
      }
      if (el.hasPointerCapture(e.pointerId))
        el.releasePointerCapture(e.pointerId);
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
      const L = latest.current;
      const velocity =
        performance.now() - drag.lastTime <= VELOCITY_MAX_AGE
          ? drag.velocity
          : 0;
      const momentum = clamp(
        velocity * MOMENTUM_DURATION,
        -L.itemSize * MAX_MOMENTUM_ITEMS,
        L.itemSize * MAX_MOMENTUM_ITEMS,
      );
      const target = clamp(
        Math.round((el.scrollTop + momentum) / L.itemSize),
        0,
        Math.max(L.total - 1, 0),
      );
      const distance = Math.abs(target * L.itemSize - el.scrollTop);
      el.removeAttribute("data-dragging");
      if (!prefersReducedMotion() && distance > 0.5) {
        api.align(
          target,
          Math.min(
            RELEASE_MAX_DURATION,
            RELEASE_MIN_DURATION + (distance / L.itemSize) * RELEASE_PER_ITEM,
          ),
        );
        return;
      }
      el.scrollTop = target * L.itemSize;
      api.updateVisual(target, notifyRef.current);
      api.settle();
    };

    const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!suppressClickRef.current) return;
      suppressClickRef.current = false;
      e.preventDefault();
      e.stopPropagation();
    };

    // 칸 옮기기 — 200ms ease-out cubic(스냅을 끄고 맞춘 뒤 값을 정한다) 또는 바로(모션 줄이기 · 누르고 있는 키 · 반복 칼럼의 몰래 옮기기).
    // 브라우저 smooth 는 칸 수마다 120 ~ 230ms 로 갈려 직접 그린다(Q-005)
    const glide = (physical: number, smooth: boolean) => {
      if (smooth) {
        api.align(physical, MOVE_DURATION);
        return;
      }
      api.cancelAlign();
      api.col()?.removeAttribute("data-free");
      api.scrollToPhysical(physical, "auto");
      api.scheduleSettle();
    };

    // 키 — ↑ ↓ Home End. 누르고 있으면(repeat) 바로바로, 아니면 200ms. 빠르게 거듭 누르면 가던 자리에서 이어 간다
    const moveTo = (targetLogical: number, behavior: ScrollBehavior) => {
      const L = latest.current;
      if (L.disabled || L.count === 0) return;
      notifyRef.current = true;
      const index = L.looping
        ? toLogical(targetLogical, L.count)
        : clamp(targetLogical, 0, L.count - 1);
      const from = keyboardTargetRef.current ?? api.nearest();
      const fromIndex = toLogical(from, L.count);
      let next = from + (index - fromIndex);
      let how = behavior;
      if (L.looping) {
        if (
          index === 0 &&
          fromIndex === L.count - 1 &&
          targetLogical > fromIndex
        )
          next = from + 1;
        else if (
          index === L.count - 1 &&
          fromIndex === 0 &&
          targetLogical < fromIndex
        )
          next = from - 1;
        const buffer = L.visibleItems * LOOP_RECENTER_VIEWPORTS;
        if (next <= buffer || next >= L.total - 1 - buffer) {
          next = L.cycles * L.count + index;
          how = "auto";
        }
      }
      keyboardTargetRef.current = clamp(next, 0, L.total - 1);
      glide(next, how === "smooth");
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled || e.altKey || e.ctrlKey || e.metaKey) return;
      const L = latest.current;
      const from = keyboardTargetRef.current ?? api.nearest();
      const index = toLogical(from, L.count);
      const behavior: ScrollBehavior =
        prefersReducedMotion() || e.repeat ? "auto" : "smooth";
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          jumpRef.current = false;
          moveTo(index - 1, behavior);
          break;
        case "ArrowDown":
          e.preventDefault();
          jumpRef.current = false;
          moveTo(index + 1, behavior);
          break;
        case "Home":
          e.preventDefault();
          jumpRef.current = true;
          moveTo(0, behavior);
          break;
        case "End":
          e.preventDefault();
          jumpRef.current = true;
          moveTo(L.count - 1, behavior);
          break;
      }
    };

    // 보이는 항목 누르기 — 그 항목을 가운데로(모션 줄이기면 바로), 멈춘 뒤 값을 정한다
    const onItemClick = (physical: number) => {
      if (disabled) return;
      notifyRef.current = true;
      keyboardTargetRef.current = null;
      glide(physical, !prefersReducedMotion());
    };

    // 처음 자리 · 쓰는 쪽이 값을 바꿨을 때 — 사용자가 만지는 동안은 덮어쓰지 않는다
    React.useLayoutEffect(() => {
      const el = columnRef.current;
      if (!el || count === 0) return;
      const busy =
        touchingRef.current ||
        dragRef.current !== null ||
        wheelingRef.current ||
        aligningRef.current ||
        settleTimerRef.current !== null ||
        notifyRef.current;
      if (initializedRef.current && busy) return;
      const p = api.nearest();
      if (initializedRef.current && toLogical(p, count) === logical) {
        api.updateVisual(p);
        lastSettledRef.current = p;
        keyboardTargetRef.current = p;
        return;
      }
      const first = !initializedRef.current;
      initializedRef.current = true;
      if (first) {
        el.scrollTop = central * itemSize;
        lastVisualRef.current = central;
        api.updateVisual(central);
      } else {
        const behavior: ScrollBehavior = prefersReducedMotion()
          ? "auto"
          : valueChangeBehavior;
        api.scrollToPhysical(central, behavior);
        if (behavior === "smooth") api.scheduleSettle();
        else api.updateVisual(central);
      }
      lastSettledRef.current = central;
      keyboardTargetRef.current = central;
    }, [api, central, count, itemSize, logical, valueChangeBehavior]);

    // 스크롤이 끝났다(손가락 관성 · 부드러운 스크롤) — 맞추는 중 · 휠이면 그쪽이 정한다
    React.useEffect(() => {
      const el = columnRef.current;
      if (!el) return;
      const onScrollEnd = () => {
        if (
          aligningRef.current ||
          wheelingRef.current ||
          dragRef.current ||
          touchingRef.current
        )
          return;
        api.settle();
      };
      el.addEventListener("scrollend", onScrollEnd);
      return () => el.removeEventListener("scrollend", onScrollEnd);
    }, [api]);

    React.useEffect(
      () => () => {
        api.clearSettle();
        api.cancelAlign();
        if (scrollFrameRef.current !== null)
          cancelAnimationFrame(scrollFrameRef.current);
      },
      [api],
    );

    const rendered = Array.from({ length: total }, (_, physical) => {
      const index = toLogical(physical, count);
      return { physical, index, option: options[index] };
    });

    const option = options[logical];
    const valueText =
      option === undefined
        ? undefined
        : (getAriaValueText?.(option.value) ??
          option.ariaLabel ??
          (typeof option.label === "string" || typeof option.label === "number"
            ? String(option.label)
            : option.value));
    const inert = disabled || count === 0;

    return (
      <div
        ref={mergeRefs(ref, columnRef)}
        role="spinbutton"
        tabIndex={inert ? -1 : 0}
        aria-valuemin={count > 0 ? 0 : undefined}
        aria-valuemax={count > 0 ? count - 1 : undefined}
        aria-valuenow={count > 0 ? logical : undefined}
        aria-valuetext={valueText}
        aria-disabled={inert || undefined}
        data-slot="wheel-picker-column"
        data-align={align}
        data-disabled={inert ? "" : undefined}
        className={cn(COLUMN, className)}
        onScroll={onScroll}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onClickCapture={onClickCapture}
        onKeyDown={onKeyDown}
        {...props}
      >
        {rendered.map(({ physical, option: o }) => (
          <div
            key={physical}
            aria-hidden
            data-slot="wheel-picker-item"
            data-value={o?.value}
            className={cn(ITEM, ITEM_ALIGN[align])}
            onClick={() => onItemClick(physical)}
          >
            <span
              data-slot="wheel-picker-item-label"
              className={cn(ITEM_LABEL, ITEM_LABEL_SIZE[size])}
            >
              {o?.label}
            </span>
          </div>
        ))}
      </div>
    );
  },
);
WheelPickerColumn.displayName = "WheelPickerColumn";

export { WheelPicker, WheelPickerColumn };
