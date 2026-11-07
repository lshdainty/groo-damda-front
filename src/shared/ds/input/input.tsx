import * as React from "react";
import { CircleX } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import {
  setNativeValue,
  useFieldControl,
  useTextControl,
} from "@/shared/ds/field";

import { AFFIX_EDGE, textInputVariants } from "./input-variants";
import { useDsText } from "@/shared/ds/i18n";

/*
 * Groo Input(Text Input) — 구조는 SEED Text Input(2026-10-01). 수치 원본은 groo-design
 * specs/components/input.yaml(값은 src/shared/ds/spec/input.json).
 * groo-design recipes/shadcn/components/ui/input.tsx 를 첫 판으로 가져왔다(앱 적용 1A) — 상자 변형(cva)은
 * input-variants.ts 다(컴포넌트 파일은 컴포넌트만 내보낸다 — 빠른 새로 고침).
 *
 * 한 줄 입력칸. 라벨 · 설명 · 오류 · 글자 수는 Field 가 둘레에서 그린다 — Field 안에 두면 id · aria 를 받는다.
 * 상자(div)가 테두리 · 바탕 · 모서리와 앞 · 뒤 붙이개 · 지우기 버튼을 담고, 입력(<input>)은 상자 높이를 채운다.
 * 맨 앞 · 맨 뒤의 입력은 상자의 좌우 여백까지 차지해 어디를 눌러도 쓸 수 있다(붙이개 · 여백을 눌러도 입력으로 간다).
 *
 * 테두리는 상자 안쪽 1px(inset shadow), 포커스 · 오류의 2px 는 ::after 로 안쪽에 덧그린다 — 굵어져도 내용이
 * 밀리지 않고, 색만 100ms 로 나타난다(SEED). 포커스는 마우스 · 터치로 눌러도 보인다(입력 중). 읽기 전용이면
 * 포커스 테두리가 없고(포커스 표시를 두지 않는다 — SEED 와 같다, 사용자 결정 2026-10-08), 오류는 포커스해도 빨간 2px 그대로다.
 * 비활성 · 읽기 전용은 회색 바탕(bg-disabled)으로 가른다 — 흐리게 하지 않는다(v106). 밑줄형은 바탕이 없어
 * 읽기 전용을 글자 색(fg-neutral-muted)으로 가른다.
 *
 * 크기: large 52(밑줄 40) · medium 40(밑줄 34) · responsive(웹 기본 — 1280 미만 large · 이상 medium). 앱은 늘 large.
 * 지우기 버튼(clearable)은 값이 있고 막히지 않았을 때만 — 누르면 값을 비우고 입력에 포커스를 둔다. 누르는 영역은 보이는 원(22 · 18)
 * 둘레로 44(::before — 상자가 overflow-hidden 이라 상자 밖은 잘린다, medium 40 은 44 × 40).
 * 캐럿은 글자색(caret-fg-neutral), 고른 글은 기기 기본 하이라이트 — ::selection 을 두지 않는다(2026-10-08).
 * 붙이개 글(prefix · suffix)은 입력의 설명으로도 읽힌다(단위 "원" 이 화면 읽기 프로그램에도 들리게).
 */

function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<T | null>).current = node;
    }
  };
}

export interface InputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size" | "prefix"
> {
  /** outline 상자(기본) · underline 밑줄 — 화면에 입력이 하나뿐일 때 */
  variant?: "outline" | "underline";
  /** large 52 · medium 40(1280 이상 데스크톱 웹만) · responsive(웹 기본 — 1280 에서 바뀐다). 앱은 large */
  size?: "large" | "medium" | "responsive";
  /** 앞 글자 — https:// · 만 · − */
  prefix?: React.ReactNode;
  /** 앞 아이콘 — 검색 돋보기처럼 칸의 뜻을 돕는다 */
  prefixIcon?: React.ReactNode;
  /** 뒤 글자 — 단위(원 · % · 일 · 회) */
  suffix?: React.ReactNode;
  /** 뒤 아이콘 */
  suffixIcon?: React.ReactNode;
  /** 지우기 버튼 — 값이 있고 막히지 않았을 때만 보인다. 검색칸 · 선택 사항인 칸에 */
  clearable?: boolean;
  /**
   * 뒤 단추 슬롯 — 칸의 맨 뒤에 얹는 단추 하나(비밀번호 · 키 "보기" Toggle · 값 복사). 지우기 버튼과 같은 자리 규칙이다:
   * 맨 뒤면 상자의 오른쪽 여백을 바깥 여백으로 갖고, 입력 글의 오른쪽 끝은 이 슬롯만큼 비는다(글이 단추 밑으로 들어가지 않는다).
   * 단추의 보이는 크기 · 누르는 영역(44)은 단추가 가진다. 지우기 버튼 뒤에 놓인다. 슬롯 안 단추는 호버 · 누름 바탕을 그리지 않는다(칸 안에
   * 상자가 하나 더 생겨 보이지 않게 — 지우기 버튼과 같다). 상태는 아이콘으로만 나타낸다
   */
  suffixAction?: React.ReactNode;
  /** 상자(div)의 className — className 은 입력(<input>)에 간다 */
  rootClassName?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      variant = "outline",
      size = "responsive",
      prefix,
      prefixIcon,
      suffix,
      suffixIcon,
      clearable = false,
      suffixAction,
      rootClassName,
      className,
      type = "text",
      onChange,
      onCompositionEnd,
      ...props
    },
    ref,
  ) => {
    const dsT = useDsText();
    const inputRef = React.useRef<HTMLInputElement>(null);
    const control = useFieldControl(props);
    const text = useTextControl(inputRef, { onChange, onCompositionEnd });
    const auto = React.useId();
    const prefixId = prefix != null ? `${auto}prefix` : undefined;
    const suffixId = suffix != null ? `${auto}suffix` : undefined;
    const disabled = !!control.disabled;
    const readOnly = !!control.readOnly;
    const invalid =
      control["aria-invalid"] === true || control["aria-invalid"] === "true";
    const showClear = clearable && text.hasValue && !disabled && !readOnly;
    const affixColor = disabled ? "text-fg-disabled" : "text-fg-neutral-subtle";
    const iconColor = disabled ? "text-fg-disabled" : "text-fg-neutral-muted";
    const valueColor = disabled
      ? "text-fg-disabled placeholder:text-fg-disabled"
      : variant === "underline" && readOnly
        ? "text-fg-neutral-muted placeholder:text-fg-neutral-muted"
        : "text-fg-neutral placeholder:text-fg-placeholder";

    // 붙이개 · 여백을 눌러도 입력으로 — 입력 · 버튼을 누른 것이 아니면 포커스를 옮긴다
    const onRootMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (disabled || target.closest("input, button, a")) return;
      e.preventDefault();
      inputRef.current?.focus();
    };

    const clear = () => {
      const el = inputRef.current;
      if (!el) return;
      setNativeValue(el, "");
      el.focus();
    };

    return (
      <div
        data-slot="text-input"
        data-variant={variant}
        data-size={size}
        data-invalid={invalid || undefined}
        data-disabled={disabled || undefined}
        data-readonly={readOnly || undefined}
        className={cn(textInputVariants({ variant, size }), rootClassName)}
        onMouseDown={onRootMouseDown}
      >
        {prefixIcon != null && (
          <span
            data-slot="text-input-prefix-icon"
            aria-hidden
            className={cn(
              "flex shrink-0 [&>svg]:size-[var(--text-input-icon)]",
              AFFIX_EDGE,
              iconColor,
            )}
          >
            {prefixIcon}
          </span>
        )}
        {prefix != null && (
          <span
            id={prefixId}
            data-slot="text-input-prefix"
            className={cn("shrink-0", AFFIX_EDGE, affixColor)}
          >
            {prefix}
          </span>
        )}
        <input
          ref={mergeRefs(ref, inputRef)}
          type={type}
          data-slot="text-input-value"
          className={cn(
            "min-w-0 flex-1 self-stretch border-0 bg-transparent p-0 caret-fg-neutral outline-none [font:inherit]",
            "first:pl-[var(--text-input-px)] last:pr-[var(--text-input-px)] disabled:cursor-not-allowed",
            // 브라우저 자동 완성의 바탕색을 지운다 — 글자색은 칸 그대로(SEED)
            "[&:-webkit-autofill]:bg-clip-text [&:-webkit-autofill]:[-webkit-text-fill-color:var(--color-fg-neutral)] [&:-webkit-autofill]:[transition:background-color_9999s_9999s]",
            valueColor,
            className,
          )}
          {...props}
          {...control}
          aria-describedby={
            [prefixId, suffixId, control["aria-describedby"]]
              .filter(Boolean)
              .join(" ") || undefined
          }
          onChange={text.onChange}
          onCompositionEnd={text.onCompositionEnd}
        />
        {suffix != null && (
          <span
            id={suffixId}
            data-slot="text-input-suffix"
            className={cn("shrink-0", AFFIX_EDGE, affixColor)}
          >
            {suffix}
          </span>
        )}
        {suffixIcon != null && (
          <span
            data-slot="text-input-suffix-icon"
            aria-hidden
            className={cn(
              "flex shrink-0 [&>svg]:size-[var(--text-input-icon)]",
              AFFIX_EDGE,
              iconColor,
            )}
          >
            {suffixIcon}
          </span>
        )}
        {showClear && (
          <button
            type="button"
            aria-label={dsT("common.clear")}
            tabIndex={-1}
            data-slot="text-input-clear"
            onClick={clear}
            className={cn(
              "relative flex shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-fg-neutral-subtle",
              // 누르는 영역 44 — 보이는 원 둘레로(상자 밖은 상자가 자른다)
              "before:absolute before:left-1/2 before:top-1/2 before:size-[44px] before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
              "[&>svg]:size-[var(--text-input-clear)]",
              AFFIX_EDGE,
            )}
          >
            <CircleX aria-hidden />
          </button>
        )}
        {suffixAction != null && (
          <span
            data-slot="text-input-action"
            className={cn(
              "flex shrink-0 items-center",
              AFFIX_EDGE,
              // 지우기 버튼과 같은 모양 — 칸 안에 호버 · 누름 바탕 상자를 그리지 않는다(상태는 아이콘으로만)
              "[&_button]:hover:bg-transparent [&_button]:active:bg-transparent",
            )}
          >
            {suffixAction}
          </span>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
