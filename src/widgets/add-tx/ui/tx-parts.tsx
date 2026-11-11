import * as React from "react";
import { ChevronRight, CircleAlert } from "lucide-react";
import { withCommaBreaks } from "@/shared/ds/i18n";

import { cn } from "@/shared/lib/cn";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
} from "@/shared/ds/bottom-sheet";
import { useInputButtonSurface } from "@/shared/ds/input-button";
import { List, ListButtonItem, ListItem } from "@/shared/ds/list";
import {
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ds/popover";

/**
 * 거래 추가 · 수정 폼의 줄 칸 부품 (I-21 D 22).
 *
 * 값은 줄 수와 상관없이 줄 끝 오른쪽 맞춤이다 — 값에 `text-end` 를 달면 List 가 좁은 줄에서 값이 제목 아래로 내려갈 때만
 * 왼쪽으로 푼다(공용 List 를 고치지 않고 호출처가 맞춤 표식을 단다). 고르는 값은 꺾쇠 없음, 치는 값(한 단계)은 ›.
 */

export const ROW_ICON = "size-[22px]";

/** 줄 값 글 — 줄 끝 오른쪽 맞춤. 비면 자리 글(fg-placeholder) */
export function RowValue({
  children,
  empty = false,
  className,
}: {
  children: React.ReactNode;
  empty?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("text-end", empty && "text-fg-placeholder", className)}>
      {withCommaBreaks(children)}
    </span>
  );
}

/** 줄 제목은 줄을 바꾸지 않는다 — 긴 값이 와도 제목이 글자 하나 폭으로 눌리지 않게 값이 줄을 바꾼다 */
export function RowTitle({ children }: { children: React.ReactNode }) {
  return <span className="whitespace-nowrap">{children}</span>;
}

/** 칸 아래 오류 글 — t3 · fg-critical · 앞 아이콘 16 (field.md) */
export function RowError({
  id,
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      id={id}
      role="alert"
      data-slot="tx-row-error"
      className="m-0 flex px-global-gutter pb-x2 pt-x1 font-sans text-t3 text-fg-critical"
    >
      <CircleAlert
        aria-hidden
        className="mr-x1_5 mt-[calc((var(--text-t3--line-height)_-_1rem)/2)] size-4 shrink-0"
      />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/** 막힌 줄 — 값은 보이고 누르지 않는다(꺾쇠 없음). 자동 생성 · 결제 끝난 거래의 돈 칸 */
export function LockedRow({
  title,
  prefix,
  value,
}: {
  title: string;
  prefix?: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <List>
      <ListItem
        data-locked=""
        title={<RowTitle>{title}</RowTitle>}
        prefix={
          prefix ? (
            <span
              aria-hidden
              className="text-fg-neutral-muted [&>svg]:size-[22px]"
            >
              {prefix}
            </span>
          ) : undefined
        }
        suffix={<RowValue className="text-fg-neutral-muted">{value}</RowValue>}
        suffixText
        aria-label={title}
      />
    </List>
  );
}

/** 치는 값 줄 — 값 › , 누르면 같은 시트 안 한 단계(메모 · 수수료 · 이자 · 금액 · 원화 금액) */
export const StepRow = React.forwardRef<
  HTMLButtonElement,
  {
    title: string;
    prefix?: React.ReactNode;
    value: React.ReactNode;
    empty?: boolean;
    onClick: () => void;
    errorMessage?: string | null;
    /** 값이 길면 두 줄까지만(그다음 말줄임) */
    clamp?: boolean;
  }
>(({ title, prefix, value, empty, onClick, errorMessage, clamp }, ref) => {
  const errId = React.useId();
  return (
    <>
      <List>
        <ListButtonItem
          ref={ref}
          title={<RowTitle>{title}</RowTitle>}
          prefix={
            prefix ? (
              <span aria-hidden className="text-fg-neutral [&>svg]:size-[22px]">
                {prefix}
              </span>
            ) : undefined
          }
          suffix={
            <>
              <RowValue
                empty={empty}
                className={cn(clamp && "line-clamp-2 whitespace-pre-wrap")}
              >
                {value}
              </RowValue>
              <ChevronRight aria-hidden className="size-[18px]" />
            </>
          }
          suffixText
          aria-label={`${title}, ${typeof value === "string" ? value : ""}`}
          aria-invalid={errorMessage ? true : undefined}
          aria-describedby={errorMessage ? errId : undefined}
          onClick={onClick}
        />
      </List>
      {errorMessage && <RowError id={errId}>{errorMessage}</RowError>}
    </>
  );
});
StepRow.displayName = "StepRow";

/**
 * 고르는 값 줄 — 1280 미만은 폼 시트 위 고르기 시트, 이상은 그 자리 Popover(input-button.md).
 * 값 글 · 앞 점은 오른쪽 맞춤, 꺾쇠 없음. 고르기 안에서 `close()` 로 닫는다(누르면 바로 넣고 닫힘).
 */
export const PickRow = React.forwardRef<
  HTMLButtonElement,
  {
    title: string;
    prefix?: React.ReactNode;
    value?: string | null;
    placeholder?: string;
    dot?: string;
    surfaceTitle?: string;
    errorMessage?: string | null;
    children: (api: { close: () => void }) => React.ReactNode;
  }
>(
  (
    {
      title,
      prefix,
      value,
      placeholder,
      dot,
      surfaceTitle,
      errorMessage,
      children,
    },
    ref,
  ) => {
    const surface = useInputButtonSurface();
    const errId = React.useId();
    const [open, setOpen] = React.useState(false);
    const has = value != null && value !== "";
    const close = () => setOpen(false);
    const row = (
      <ListButtonItem
        ref={ref}
        title={<RowTitle>{title}</RowTitle>}
        prefix={
          prefix ? (
            <span aria-hidden className="text-fg-neutral [&>svg]:size-[22px]">
              {prefix}
            </span>
          ) : undefined
        }
        suffix={
          <RowValue empty={!has}>
            {has && dot && (
              <span
                aria-hidden
                className="mr-x2 inline-block size-x2 rounded-full align-middle"
                style={{ background: dot }}
              />
            )}
            {has ? value : placeholder}
          </RowValue>
        }
        suffixText
        aria-label={`${title}, ${has ? value : (placeholder ?? "")}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={errorMessage ? true : undefined}
        aria-describedby={errorMessage ? errId : undefined}
        onClick={() => setOpen(true)}
      />
    );
    const body = children({ close });
    const name = surfaceTitle ?? title;
    return (
      <>
        <List>
          {surface === "sheet" ? (
            <>
              {row}
              <BottomSheet open={open} onOpenChange={setOpen}>
                <BottomSheetContent title={name} aria-describedby={undefined}>
                  <BottomSheetBody scrollFog>{body}</BottomSheetBody>
                </BottomSheetContent>
              </BottomSheet>
            </>
          ) : (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>{row}</PopoverTrigger>
              <PopoverContent aria-label={name} align="start">
                <PopoverBody>{body}</PopoverBody>
              </PopoverContent>
            </Popover>
          )}
        </List>
        {errorMessage && <RowError id={errId}>{errorMessage}</RowError>}
      </>
    );
  },
);
PickRow.displayName = "PickRow";

/** 줄이 아닌 것(통화 칩)이 여는 고르기 표면 — 1280 미만 시트 · 이상 Popover */
export function PickSurface({
  trigger,
  title,
  children,
}: {
  trigger: (api: { open: boolean; onClick: () => void }) => React.ReactNode;
  title: string;
  children: (api: { close: () => void }) => React.ReactNode;
}) {
  const surface = useInputButtonSurface();
  const [open, setOpen] = React.useState(false);
  const node = trigger({ open, onClick: () => setOpen(true) });
  const body = children({ close: () => setOpen(false) });
  return surface === "sheet" ? (
    <BottomSheet open={open} onOpenChange={setOpen}>
      {node}
      <BottomSheetContent title={title} aria-describedby={undefined}>
        <BottomSheetBody scrollFog>{body}</BottomSheetBody>
      </BottomSheetContent>
    </BottomSheet>
  ) : (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{node}</PopoverTrigger>
      <PopoverContent aria-label={title} align="end">
        <PopoverBody>{body}</PopoverBody>
      </PopoverContent>
    </Popover>
  );
}
