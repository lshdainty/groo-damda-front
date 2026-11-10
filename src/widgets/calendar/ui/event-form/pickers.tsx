import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetFooter,
} from "@/shared/ds/bottom-sheet";
import { Button } from "@/shared/ds/button";
import { DatePicker, dayKey, parseDayKey } from "@/shared/ds/date-picker";
import { useInputButtonSurface } from "@/shared/ds/input-button";
import {
  List,
  ListButtonItem,
  ListCheckGroup,
  ListCheckItem,
} from "@/shared/ds/list";
import {
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverFooter,
  PopoverTrigger,
} from "@/shared/ds/popover";
import { TimePicker, type TimeValue } from "@/shared/ds/time-picker";

/**
 * 일정 폼의 고르는 표면 (I-09 24 · 26 · 27 · 28) — 누르는 것(trigger)이 1280 미만은 폼 시트 위 고르기 시트,
 * 이상은 그 자리 Popover 를 연다(input-button.md "1280 미만은 시트, 이상은 팝오버").
 * 고르는 동안 칸 값은 그대로이고 "완료" 에 들어간다(날짜 · 시각 · 알림). 목록 고르기는 누르면 바로 넣고 닫힌다.
 */

type TriggerApi = { open: boolean; onClick: () => void };

/** 날짜 yyyy-MM-dd 를 달력으로 고른다 */
export function DayPickSurface({
  trigger,
  title,
  value,
  onConfirm,
}: {
  trigger: (api: TriggerApi) => ReactNode;
  title: string;
  /** yyyy-MM-dd */
  value: string;
  onConfirm: (day: string) => void;
}) {
  const { t: tc } = useTranslation("common");
  const surface = useInputButtonSurface();
  const [open, setOpen] = useState(false);
  const current = value ? parseDayKey(value) : undefined;
  const [draft, setDraft] = useState<Date | undefined>(current);
  const sheet = surface === "sheet";
  const node = trigger({
    open,
    onClick: () => {
      setDraft(current);
      setOpen(true);
    },
  });
  const picker = (
    <DatePicker
      selection="single"
      // 폼의 날짜 칸 = 한 달 · 6주(date-picker.md:61 · :110, I-09 26) — 이어지는 달 · 90% 높이는 기간 시트 모양이다
      visibleRange="month"
      aria-label={title}
      value={draft}
      onValueChange={setDraft}
      autoFocus
    />
  );
  const done = (
    <Button
      disabled={!draft}
      onClick={() => {
        if (draft) onConfirm(dayKey(draft));
        setOpen(false);
      }}
    >
      {tc("done")}
    </Button>
  );
  return sheet ? (
    <BottomSheet open={open} dismissible={false} onOpenChange={setOpen}>
      {node}
      <BottomSheetContent title={title}>
        <BottomSheetBody>{picker}</BottomSheetBody>
        <BottomSheetFooter>{done}</BottomSheetFooter>
      </BottomSheetContent>
    </BottomSheet>
  ) : (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{node}</PopoverTrigger>
      <PopoverContent aria-label={title} align="start">
        <PopoverBody>{picker}</PopoverBody>
        <PopoverFooter>{done}</PopoverFooter>
      </PopoverContent>
    </Popover>
  );
}

/** 시각 HH:mm 을 휠로 고른다 — 1분 단위 */
export function TimePickSurface({
  trigger,
  title,
  value,
  onConfirm,
}: {
  trigger: (api: TriggerApi) => ReactNode;
  title: string;
  /** HH:mm */
  value: string;
  onConfirm: (hhmm: string) => void;
}) {
  const { t: tc } = useTranslation("common");
  const surface = useInputButtonSurface();
  const [open, setOpen] = useState(false);
  const current: TimeValue | undefined = /^\d{2}:\d{2}$/.test(value)
    ? { hour: Number(value.slice(0, 2)), minute: Number(value.slice(3, 5)) }
    : undefined;
  const [draft, setDraft] = useState<TimeValue | undefined>(current);
  const sheet = surface === "sheet";
  const node = trigger({
    open,
    onClick: () => {
      setDraft(current);
      setOpen(true);
    },
  });
  const picker = (
    <TimePicker
      aria-label={title}
      value={draft}
      onValueChange={setDraft}
      autoFocus
    />
  );
  const done = (
    <Button
      onClick={() => {
        // 휠을 안 굴렸으면 지금 시각 그대로 들어간다(반올림 없음) — 시간 칸이 빈 채로 열렸을 때
        const v = draft ?? {
          hour: new Date().getHours(),
          minute: new Date().getMinutes(),
        };
        const pad = (n: number) => String(n).padStart(2, "0");
        onConfirm(`${pad(v.hour)}:${pad(v.minute)}`);
        setOpen(false);
      }}
    >
      {tc("done")}
    </Button>
  );
  return sheet ? (
    <BottomSheet open={open} dismissible={false} onOpenChange={setOpen}>
      {node}
      <BottomSheetContent title={title}>
        <BottomSheetBody>
          <div className="flex justify-center">{picker}</div>
        </BottomSheetBody>
        <BottomSheetFooter>{done}</BottomSheetFooter>
      </BottomSheetContent>
    </BottomSheet>
  ) : (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{node}</PopoverTrigger>
      <PopoverContent aria-label={title} align="start">
        <PopoverBody>{picker}</PopoverBody>
        <PopoverFooter>{done}</PopoverFooter>
      </PopoverContent>
    </Popover>
  );
}

export interface ChoiceItem<V extends string | number | undefined> {
  value: V;
  label: string;
  /** 앞 색 점 10 — 캘린더 · 라벨 */
  dot?: string;
}

/**
 * 하나 고르기 시트 — 줄(앞 색 점 10 · 이름 · 고른 줄 뒤 체크 18). 누르면 바로 넣고 닫힌다, 바닥 버튼 없음(input-button.md:270).
 * 폼 시트 위에 뜬다(1280 미만에서만 쓴다 — 큰 화면은 대화상자의 Select).
 */
export function ChoiceSheet<V extends string | number | undefined>({
  trigger,
  title,
  items,
  selected,
  onPick,
  footnote,
}: {
  trigger: (api: TriggerApi) => ReactNode;
  title: string;
  items: ChoiceItem<V>[];
  selected: V;
  onPick: (value: V) => void;
  /** 목록 아래 R9 안내 */
  footnote?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <BottomSheet open={open} onOpenChange={setOpen}>
      {trigger({ open, onClick: () => setOpen(true) })}
      <BottomSheetContent title={title} aria-describedby={undefined}>
        <BottomSheetBody scrollFog>
          <div className="-mx-x6">
            <List role="radiogroup" aria-label={title}>
              {items.map((it) => {
                const on = it.value === selected;
                return (
                  <ListButtonItem
                    key={String(it.value ?? "none")}
                    role="radio"
                    aria-checked={on}
                    title={it.label}
                    prefix={
                      it.dot ? (
                        <span
                          aria-hidden
                          className="size-[10px] rounded-full"
                          style={{ background: it.dot }}
                        />
                      ) : undefined
                    }
                    suffix={
                      on ? (
                        <Check
                          aria-hidden
                          strokeWidth={2.5}
                          className="size-[18px] text-fg-neutral"
                        />
                      ) : undefined
                    }
                    onClick={() => {
                      // 고른 줄을 다시 누르면 아무것도 바꾸지 않고 닫는다(select.md:91) — 다시 넣으면 원래 RRULE(BYDAY 등)이 덮인다
                      if (!on) onPick(it.value);
                      setOpen(false);
                    }}
                  />
                );
              })}
            </List>
          </div>
          {footnote && (
            <p className="m-0 pb-x2 pt-x4 text-center text-t4 text-fg-neutral-subtle">
              {footnote}
            </p>
          )}
        </BottomSheetBody>
      </BottomSheetContent>
    </BottomSheet>
  );
}

/** 여럿 고르기 시트 — 체크 줄 · 바닥 "완료" 에 넣는다(여럿이라 바로 닫지 않는다) */
export function MultiChoiceSheet({
  trigger,
  title,
  items,
  selected,
  onConfirm,
}: {
  trigger: (api: TriggerApi) => ReactNode;
  title: string;
  items: ChoiceItem<number>[];
  selected: number[];
  onConfirm: (values: number[]) => void;
}) {
  const { t: tc } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<number[]>(selected);
  return (
    <BottomSheet open={open} onOpenChange={setOpen}>
      {trigger({
        open,
        onClick: () => {
          setDraft(selected);
          setOpen(true);
        },
      })}
      <BottomSheetContent title={title} aria-describedby={undefined}>
        <BottomSheetBody scrollFog>
          <div className="-mx-x6">
            <ListCheckGroup aria-label={title}>
              {items.map((it) => (
                <ListCheckItem
                  key={it.value}
                  title={it.label}
                  checked={draft.includes(it.value)}
                  onCheckedChange={(on) =>
                    setDraft((d) =>
                      on === true
                        ? [...d, it.value]
                        : d.filter((x) => x !== it.value),
                    )
                  }
                />
              ))}
            </ListCheckGroup>
          </div>
        </BottomSheetBody>
        <BottomSheetFooter>
          <Button
            onClick={() => {
              onConfirm(draft);
              setOpen(false);
            }}
          >
            {tc("done")}
          </Button>
        </BottomSheetFooter>
      </BottomSheetContent>
    </BottomSheet>
  );
}
