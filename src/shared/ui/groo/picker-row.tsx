import * as React from "react";
import { CircleAlert, CircleX } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetFooter,
} from "@/shared/ds/bottom-sheet";
import { useInputButtonSurface } from "@/shared/ds/input-button";
import { List, ListButtonItem, ListItem } from "@/shared/ds/list";
import {
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverFooter,
  PopoverTrigger,
} from "@/shared/ds/popover";

/**
 * 고르기 줄 칸 — 폼 안에서 "고르는 값" 하나(카테고리 · 목표일 · 아이콘 · 색)를 List 줄로 보인다(I-19 A 2 · 9).
 * 제목 t5 · 값 t5 fg-neutral-subtle(줄 안 폭이 16em 보다 좁으면 값이 제목 아래로) · 꺾쇠 없음. 누르면 1280 미만은 폼 시트 위
 * 고르기 시트, 이상은 그 자리 Popover 가 열린다. `readOnly` 면 보기만 하는 줄(누름 · 호버 없음).
 * 값 앞 점(`dot`)은 8 의 색 점, 값 앞 아이콘(`glyph`)은 20. 값이 있을 때만 `onClear` 로 줄 끝 지우기 버튼을 단다(누르는 44).
 * 오류(`errorMessage`)는 줄 아래 한 줄(좌우 24).
 */

export interface PickerRowProps {
  title: string;
  /** 줄 앞 아이콘 22(`fg-neutral`) — 폼 줄 칸이 값의 종류를 아이콘으로 돕는다(I-20 B 12) */
  prefix?: React.ReactNode;
  /** 고른 값의 글 — 비면 placeholder */
  value?: string | null;
  placeholder?: string;
  /** 값 앞 색 점(CSS 색) */
  dot?: string;
  /** 점 크기 — 8(기본, 카테고리 줄) · 12(공용 색 줄) */
  dotSize?: 8 | 12;
  /** 값 앞 아이콘 */
  glyph?: React.ReactNode;
  /** 읽는 이름 — 기본 "{title}, {value}" */
  ariaLabel?: string;
  readOnly?: boolean;
  onClear?: () => void;
  clearLabel?: string;
  errorMessage?: string | null;
  /** 시트 제목 · 팝오버 이름 */
  surfaceTitle: string;
  /** 열릴 때 부른다 — 시안(draft)을 지금 값으로 맞추는 자리 */
  onOpen?: () => void;
  /** 고르기 안 — close() 로 닫는다 */
  children?:
    React.ReactNode | ((api: { close: () => void }) => React.ReactNode);
  /** 고르기 표면 바닥 버튼(날짜의 "완료"), 없으면 바닥 없음. 이름이 footer 가 아닌 까닭: tests/dialog-footers 는 footer prop 안의 Button 을 막는다 */
  pickerActions?:
    React.ReactNode | ((api: { close: () => void }) => React.ReactNode);
  /** 시트 높이 같은 모양 */
  sheetClassName?: string;
  popoverClassName?: string;
  /** 본문 스크롤 대신 안쪽이 스스로 스크롤하는 고르기(아이콘 격자) */
  bodyless?: boolean;
  /** 끝 흐림 — 길이가 사용자 값에 달린 목록형 고르기에만(카테고리 · 계좌 …). 달력 · 고정 선택지는 걸지 않는다 */
  scrollFog?: boolean;
  onOpenAutoFocus?: (e: Event) => void;
}

export const PickerRow = React.forwardRef<HTMLButtonElement, PickerRowProps>(
  (
    {
      title,
      prefix,
      value,
      placeholder,
      dot,
      dotSize = 8,
      glyph,
      ariaLabel,
      readOnly,
      onClear,
      clearLabel,
      errorMessage,
      surfaceTitle,
      onOpen,
      children,
      pickerActions,
      sheetClassName,
      popoverClassName,
      bodyless,
      scrollFog,
      onOpenAutoFocus,
    },
    ref,
  ) => {
    const surface = useInputButtonSurface();
    const errorId = React.useId();
    const [open, setOpen] = React.useState(false);
    const has = value != null && value !== "";
    const close = () => setOpen(false);
    const text = has ? value : placeholder;

    const valueNode = (
      <span className={cn(!has && "text-fg-placeholder")}>
        {has && dot && (
          <span
            aria-hidden
            data-slot="picker-row-dot"
            className={cn(
              "mr-x2 inline-block rounded-full align-middle",
              dotSize === 12 ? "size-x3" : "size-x2",
            )}
            style={{ background: dot }}
          />
        )}
        {has && glyph && (
          <span
            aria-hidden
            data-slot="picker-row-glyph"
            className="mr-x2 inline-block align-middle text-fg-neutral-muted [&>svg]:size-5"
          >
            {glyph}
          </span>
        )}
        {text}
      </span>
    );
    const suffix =
      has && onClear ? (
        <>
          {valueNode}
          <button
            type="button"
            aria-label={clearLabel}
            data-slot="picker-row-clear"
            onClick={onClear}
            className="relative flex size-[22px] shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-fg-neutral-subtle before:absolute before:left-1/2 before:top-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring [&>svg]:size-[22px]"
          >
            <CircleX aria-hidden />
          </button>
        </>
      ) : (
        valueNode
      );

    const prefixNode = prefix ? (
      <span aria-hidden className="text-fg-neutral [&>svg]:size-[22px]">
        {prefix}
      </span>
    ) : undefined;
    const label = ariaLabel ?? `${title}, ${has ? value : (placeholder ?? "")}`;
    const rowError = errorMessage ? (
      <p
        id={errorId}
        data-slot="picker-row-error"
        className="m-0 flex px-global-gutter pb-x2 font-sans text-t4 text-fg-critical"
      >
        <CircleAlert
          aria-hidden
          className="mr-x1_5 mt-[calc((var(--text-t4--line-height)_-_1rem)/2)] size-4 shrink-0"
        />
        <span className="min-w-0">{errorMessage}</span>
      </p>
    ) : null;

    if (readOnly) {
      return (
        <>
          <List>
            <ListItem
              title={title}
              prefix={prefixNode}
              suffix={valueNode}
              suffixText
              aria-label={label}
            />
          </List>
          {rowError}
        </>
      );
    }

    const body =
      typeof children === "function" ? children({ close }) : children;
    const foot =
      typeof pickerActions === "function"
        ? pickerActions({ close })
        : pickerActions;

    const row = (
      <ListButtonItem
        ref={ref}
        title={title}
        prefix={prefixNode}
        suffix={suffix}
        suffixText
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={errorMessage ? true : undefined}
        aria-describedby={errorMessage ? errorId : undefined}
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
      />
    );

    return (
      <>
        <List>
          {surface === "sheet" ? (
            <>
              {row}
              <BottomSheet open={open} onOpenChange={setOpen}>
                <BottomSheetContent
                  title={surfaceTitle}
                  className={sheetClassName}
                  onOpenAutoFocus={onOpenAutoFocus}
                >
                  {bodyless ? (
                    body
                  ) : (
                    <BottomSheetBody scrollFog={scrollFog}>
                      {body}
                    </BottomSheetBody>
                  )}
                  {foot != null && (
                    <BottomSheetFooter>{foot}</BottomSheetFooter>
                  )}
                </BottomSheetContent>
              </BottomSheet>
            </>
          ) : (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>{row}</PopoverTrigger>
              <PopoverContent
                aria-label={surfaceTitle}
                align="start"
                className={popoverClassName}
                onOpenAutoFocus={onOpenAutoFocus}
              >
                {bodyless ? (
                  body
                ) : (
                  <PopoverBody scrollFog={scrollFog}>{body}</PopoverBody>
                )}
                {foot != null && <PopoverFooter>{foot}</PopoverFooter>}
              </PopoverContent>
            </Popover>
          )}
        </List>
        {rowError}
      </>
    );
  },
);
PickerRow.displayName = "PickerRow";
