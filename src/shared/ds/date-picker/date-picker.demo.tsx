import { useState, type FocusEvent } from "react";
import { CalendarDays, Clock } from "lucide-react";

import { Button } from "@/shared/ds/button";
import { DemoBlock, DemoRow, Specimen } from "@/shared/ds/catalog/DemoKit";
import { Field } from "@/shared/ds/field";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetFooter,
} from "@/shared/ds/bottom-sheet";
import { InputButton, useInputButtonSurface } from "@/shared/ds/input-button";
import {
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverFooter,
  PopoverTrigger,
} from "@/shared/ds/popover";
import {
  TimePicker,
  formatTimeValue,
  roundToStep,
  type TimeValue,
} from "@/shared/ds/time-picker";
import { cn } from "@/shared/lib/cn";

import { DatePicker, type DatePickerProps } from "./date-picker";
import { DayCell, OutsideCell, type DayState } from "./date-picker-day";
import {
  DATE_PRESETS,
  addDays,
  formatDateValue,
  formatRangeValue,
  type DatePresetName,
  type DateRange,
} from "./date-picker-dates";
import {
  DATE_PICKER_CONTINUOUS_SHEET_BODY,
  DATE_PICKER_TWO_MONTHS_POPOVER,
  GRID,
  WEEK,
} from "./date-picker-variants";

// 견본의 오늘 — 고정한다(날마다 달라지면 견본이 흔들린다). 2026년 10월 15일 목요일
const TODAY = new Date(2026, 9, 15);
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const PRESETS: DatePresetName[] = [
  "thisWeek",
  "thisMonth",
  "lastMonth",
  "last3Months",
  "thisYear",
];

// ── 날짜 칸 견본 — 일곱 칸짜리 한 주(2026-10-11 일 ~ 10-17 토), 가운데(수요일 14일)가 재는 칸 ─────────────────
const STATES = [
  "enabled",
  "hovered",
  "pressed",
  "focused",
  "today",
  "selected",
  "inRange",
  "outside",
  "disabled",
  "readOnly",
] as const;
type State = (typeof STATES)[number];

const WEEK_START = new Date(2026, 9, 11);
const PLAIN: DayState = {
  today: false,
  selected: false,
  rangeStart: false,
  rangeEnd: false,
  inRange: false,
  complete: false,
  singleDayRange: false,
  disabled: false,
  readOnly: false,
};

// 가운데 칸(i = 3)의 상태. 기간 사이 날은 이웃이 시작 · 끝이라 띠가 이어진다
function stateAt(state: State, i: number): DayState {
  if (state === "inRange") {
    if (i === 2)
      return { ...PLAIN, selected: true, rangeStart: true, complete: true };
    if (i === 3) return { ...PLAIN, inRange: true, complete: true };
    if (i === 4)
      return { ...PLAIN, selected: true, rangeEnd: true, complete: true };
  }
  if (i !== 3) return PLAIN;
  switch (state) {
    case "today":
      return { ...PLAIN, today: true };
    case "selected":
      return { ...PLAIN, selected: true };
    case "disabled":
      return { ...PLAIN, disabled: true };
    case "readOnly":
      return { ...PLAIN, selected: true, rangeStart: true, readOnly: true };
    default:
      return PLAIN;
  }
}

const nameOf = (day: Date) =>
  `${day.getFullYear()}년 ${day.getMonth() + 1}월 ${day.getDate()}일 ${"일월화수목금토"[day.getDay()]}요일`;

// 검사기가 한 주에 준 초점을 가운데 칸 버튼으로 넘긴다(칸은 초점이 서지 않는다)
function passFocus(e: FocusEvent<HTMLDivElement>) {
  if (e.target !== e.currentTarget) return;
  e.currentTarget
    .querySelector<HTMLElement>("[data-probe] button")
    ?.focus({ preventScroll: true });
}

function DayRow({ state }: { state: State }) {
  const focused = state === "focused";
  return (
    <div className="flex flex-col gap-x1">
      <Specimen spec="date-picker" combo={{}} state={state}>
        <div
          className={cn(GRID, "w-[336px] rounded-r2 bg-bg-layer-floating")}
          tabIndex={focused ? -1 : undefined}
          onFocus={focused ? passFocus : undefined}
        >
          <div className={WEEK}>
            {Array.from({ length: 7 }, (_, i) => {
              const day = addDays(WEEK_START, i);
              const probe = i === 3 ? { "data-probe": "" } : {};
              if (state === "outside" && i === 3)
                return <OutsideCell key={i} date={day} {...probe} />;
              return (
                <DayCell
                  key={i}
                  date={day}
                  state={stateAt(state, i)}
                  label={nameOf(day)}
                  tabStop={i === 3}
                  onSelect={() => {}}
                  onFocus={() => {}}
                  onKeyDown={() => {}}
                  {...probe}
                />
              );
            })}
          </div>
        </div>
      </Specimen>
      <span className="px-x0_5 text-t2 text-fg-neutral-subtle">{state}</span>
    </div>
  );
}

// 겹침 — 스펙 "상태가 겹칠 때". 견본이 아니다(스펙 상태 하나가 아니라 겹친 모양이라 검사기가 잴 상태가 없다)
const OVERLAPS: { caption: string; state: DayState }[] = [
  {
    caption: "오늘 + 고름 → 짙은 원 · 굵기 남음",
    state: { ...PLAIN, today: true, selected: true },
  },
  {
    caption: "오늘 + 기간 사이 → 원 없이 띠 위 굵은 숫자",
    state: { ...PLAIN, today: true, inRange: true, complete: true },
  },
  {
    caption: "오늘 + 막힘 → 원 없이 굵은 숫자 · 취소선",
    state: { ...PLAIN, today: true, disabled: true },
  },
  {
    caption: "고름 + 막힘 → 고른 모양 · 취소선",
    state: { ...PLAIN, selected: true, disabled: true },
  },
  {
    caption: "기간 사이 + 막힘 → 띠 그대로 · 흐린 취소선",
    state: { ...PLAIN, inRange: true, disabled: true, complete: true },
  },
  {
    caption: "미완성 기간의 막힌 시작 → 취소선 없음",
    state: { ...PLAIN, selected: true, rangeStart: true, disabled: true },
  },
  {
    caption: "하루짜리 기간 → 띠 없음",
    state: {
      ...PLAIN,
      selected: true,
      rangeStart: true,
      rangeEnd: true,
      complete: true,
      singleDayRange: true,
    },
  },
];

function OverlapRow({ caption, state }: { caption: string; state: DayState }) {
  const sideBand = state.inRange
    ? [
        { ...PLAIN, selected: true, rangeStart: true, complete: true },
        { ...PLAIN, selected: true, rangeEnd: true, complete: true },
      ]
    : null;
  return (
    <div className="flex flex-col gap-x1">
      <div className={cn(GRID, "w-[336px]")}>
        <div className={WEEK}>
          {Array.from({ length: 7 }, (_, i) => {
            const day = addDays(WEEK_START, i);
            const s =
              i === 3
                ? state
                : sideBand && i === 2
                  ? sideBand[0]!
                  : sideBand && i === 4
                    ? sideBand[1]!
                    : PLAIN;
            return (
              <DayCell
                key={i}
                date={day}
                state={s}
                label={nameOf(day)}
                tabStop={false}
                onSelect={() => {}}
                onFocus={() => {}}
                onKeyDown={() => {}}
              />
            );
          })}
        </div>
      </div>
      <span className="px-x0_5 text-t2 text-fg-neutral-subtle">{caption}</span>
    </div>
  );
}

// ── 달력 견본 — 한 달 · 두 달 · 이어지는 달 × 하루 · 기간 · 여러 날 ─────────────────────────────────────────
// 이달 1일이 평범한 날이어야 한다(검사기는 첫 날짜의 보통 모양을 잰다) — 고른 날 · 오늘을 1일에 두지 않는다
function Calendar({
  selection,
  visibleRange,
  caption,
  width = 336,
  height,
  today = TODAY,
  measured = true,
  ...props
}: {
  selection: "single" | "range" | "multiple";
  visibleRange: "month" | "twoMonths" | "continuous";
  caption: string;
  width?: number;
  height?: number;
  today?: Date;
  /** false 면 견본(검사 대상)이 아니다 — 스펙 폭 336 이 아닌 좁은 폭 */
  measured?: boolean;
} & Record<string, unknown>) {
  return (
    <div className="flex flex-col gap-x1" style={{ width }}>
      <div style={{ height }} className="flex min-h-0 flex-col">
        {measured ? (
          <Specimen spec="date-picker" combo={{ selection, visibleRange }}>
            <DatePicker
              {...({
                today,
                selection,
                visibleRange,
                "aria-label": `${caption} 달력`,
                ...props,
              } as DatePickerProps)}
            />
          </Specimen>
        ) : (
          <DatePicker
            {...({
              today,
              selection,
              visibleRange,
              "aria-label": `${caption} 달력`,
              ...props,
            } as DatePickerProps)}
          />
        )}
      </div>
      <span className="px-x0_5 text-t2 text-fg-neutral-subtle">{caption}</span>
    </div>
  );
}

// ── 고르는 자리 — 칸 + 시트 · 팝오버 + "완료" ──────────────────────────────────────────────────────────────
type FieldMode = "date" | "range" | "constrained";

function DateField({
  label,
  mode,
  initial,
}: {
  label: string;
  mode: FieldMode;
  initial?: Date | DateRange;
}) {
  const surface = useInputButtonSurface();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<Date | DateRange | undefined>(initial);
  const [draft, setDraft] = useState<Date | DateRange | undefined>(initial);
  const [place, setPlace] = useState<HTMLDivElement | null>(null);
  const isRange = mode === "range";
  const text = isRange
    ? formatRangeValue(value as DateRange | undefined, TODAY)
    : formatDateValue(value as Date | undefined, TODAY);
  const kind = isRange ? "기간" : "날짜";
  const ready = isRange ? !!(draft as DateRange | undefined)?.end : !!draft;
  const trigger = (
    <InputButton
      placeholder={`${kind} 선택`}
      value={text}
      suffixIcon={<CalendarDays />}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => {
        setDraft(value);
        setOpen(true);
      }}
    />
  );
  const sheet = surface === "sheet";
  const picker = isRange ? (
    <DatePicker
      selection="range"
      visibleRange={sheet ? "continuous" : "twoMonths"}
      presets={DATE_PRESETS.filter((n) =>
        [
          "thisWeek",
          "thisMonth",
          "lastMonth",
          "last3Months",
          "thisYear",
        ].includes(n),
      )}
      today={TODAY}
      aria-label={`${label} 선택`}
      value={draft as DateRange | undefined}
      onValueChange={setDraft}
      autoFocus
    />
  ) : (
    <DatePicker
      selection="single"
      today={TODAY}
      aria-label={`${label} 선택`}
      // 환불일 — 거래일(9월 20일)부터 오늘까지만
      min={mode === "constrained" ? d(2026, 9, 20) : undefined}
      max={mode === "constrained" ? TODAY : undefined}
      value={draft as Date | undefined}
      onValueChange={setDraft}
      autoFocus
    />
  );
  const done = (
    <>
      {isRange && (
        <Button variant="neutralWeak" onClick={() => setDraft(undefined)}>
          초기화
        </Button>
      )}
      <Button
        disabled={!ready}
        onClick={() => {
          setValue(draft);
          setOpen(false);
        }}
      >
        완료
      </Button>
    </>
  );
  return (
    <div className="flex w-[300px] flex-col gap-x2">
      <Field label={label}>
        {sheet ? (
          <BottomSheet open={open} onOpenChange={setOpen} container={place}>
            {trigger}
            <BottomSheetContent
              title={`${kind} 선택`}
              className={isRange ? "h-[90dvh]" : undefined}
            >
              <BottomSheetBody
                className={
                  isRange ? DATE_PICKER_CONTINUOUS_SHEET_BODY : undefined
                }
              >
                {picker}
              </BottomSheetBody>
              <BottomSheetFooter>{done}</BottomSheetFooter>
            </BottomSheetContent>
          </BottomSheet>
        ) : (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            {place && (
              <PopoverContent
                container={place}
                aria-label={`${kind} 선택`}
                align="start"
                className={isRange ? DATE_PICKER_TWO_MONTHS_POPOVER : undefined}
              >
                <PopoverBody>{picker}</PopoverBody>
                <PopoverFooter>{done}</PopoverFooter>
              </PopoverContent>
            )}
          </Popover>
        )}
      </Field>
      <div ref={setPlace} />
    </div>
  );
}

/** 날짜 칸 + 시각 칸 나란히 — 한 줄에 둘이 안 들어가면 시각 칸이 다음 줄로 내려간다(좁은 폭 · 다른 해 날짜). 종일이면 시각 칸을 걷는다 */
function DateTimeField({ width }: { width: number }) {
  const surface = useInputButtonSurface();
  const [date, setDate] = useState<Date | undefined>(d(2027, 1, 3));
  const [time, setTime] = useState<TimeValue | undefined>({
    hour: 12,
    minute: 30,
  });
  const [allDay, setAllDay] = useState(false);
  const [draftDate, setDraftDate] = useState(date);
  const [draftTime, setDraftTime] = useState(time);
  const [which, setWhich] = useState<"date" | "time" | null>(null);
  const [place, setPlace] = useState<HTMLDivElement | null>(null);
  const close = () => setWhich(null);
  const sheet = surface === "sheet";
  const open = which !== null;
  const content =
    which === "time" ? (
      <TimePicker
        aria-label="시작 시각"
        value={draftTime}
        onValueChange={setDraftTime}
        autoFocus
      />
    ) : (
      <DatePicker
        today={TODAY}
        aria-label="시작 날짜"
        value={draftDate}
        onValueChange={setDraftDate}
        autoFocus
      />
    );
  const done = (
    <Button
      onClick={() => {
        if (which === "time")
          setTime(
            draftTime ??
              (() => {
                const n = roundToStep(new Date(), 5);
                return { hour: n.getHours(), minute: n.getMinutes() };
              })(),
          );
        else setDate(draftDate);
        close();
      }}
    >
      완료
    </Button>
  );
  const dateButton = (
    <InputButton
      rootClassName="min-w-max flex-1"
      placeholder="날짜 선택"
      value={formatDateValue(date, TODAY)}
      suffixIcon={<CalendarDays />}
      onClick={() => {
        setDraftDate(date);
        setWhich("date");
      }}
    />
  );
  const timeButton = !allDay && (
    <InputButton
      rootClassName="w-[144px] shrink-0"
      placeholder="시간 선택"
      value={formatTimeValue(time)}
      suffixIcon={<Clock />}
      onClick={() => {
        setDraftTime(time);
        setWhich("time");
      }}
    />
  );
  const surfaceTitle = which === "time" ? "시간 선택" : "날짜 선택";
  return (
    <div className="flex flex-col gap-x2" style={{ width }}>
      <div className="flex flex-wrap gap-x-x2 gap-y-x2">
        {sheet ? (
          <>
            {dateButton}
            {timeButton}
            <BottomSheet
              open={open}
              onOpenChange={(next) => !next && close()}
              container={place}
            >
              <BottomSheetContent title={surfaceTitle}>
                <BottomSheetBody>{content}</BottomSheetBody>
                <BottomSheetFooter>{done}</BottomSheetFooter>
              </BottomSheetContent>
            </BottomSheet>
          </>
        ) : (
          <Popover open={open} onOpenChange={(next) => !next && close()}>
            <PopoverTrigger asChild>{dateButton}</PopoverTrigger>
            {timeButton}
            {place && open && (
              <PopoverContent
                container={place}
                aria-label={surfaceTitle}
                align="start"
              >
                <PopoverBody>{content}</PopoverBody>
                <PopoverFooter>{done}</PopoverFooter>
              </PopoverContent>
            )}
          </Popover>
        )}
      </div>
      <label className="flex items-center gap-x2 text-t4 text-fg-neutral-muted">
        <input
          type="checkbox"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
        />
        종일 — 시각 칸을 걷는다
      </label>
      <div ref={setPlace} />
    </div>
  );
}

/** 카탈로그(/dev/ds) — 날짜 칸 열 가지 상태, 겹침, 달력 여섯 가지 모양, 가장 나쁜 값, 칸 + 시트 · 팝오버 */
export const DatePickerDemo = () => (
  <div className="flex flex-col gap-x8">
    <DemoBlock title="날짜 칸 상태 — 한 주의 가운데 칸(14일). 호버 · 누름 · 키보드 초점은 검사기가 실제로 올리고 · 누르고 · 탭해서 잰다. 기간 사이 날은 이웃이 시작 · 끝이라 띠가 이어진다">
      <div className="flex flex-wrap items-start gap-x6">
        {STATES.map((state) => (
          <DayRow key={state} state={state} />
        ))}
      </div>
    </DemoBlock>

    <DemoBlock title="상태가 겹칠 때 — 고름이 이긴다 · 오늘의 굵기는 남는다 · 막힌 날이 기간 안이면 띠는 그대로 · 미완성 기간의 막힌 시작에는 취소선이 없다">
      <div className="flex flex-wrap items-start gap-x6">
        {OVERLAPS.map((o) => (
          <OverlapRow key={o.caption} {...o} />
        ))}
      </div>
    </DemoBlock>

    <DemoBlock title="달력 — 하루 · 기간 · 여러 날 × 한 달 · 두 달 · 이어지는 달. 늘 6주(앞뒤 달은 흐리게 · 누르지 못함), 오늘 15일은 옅은 원 + 굵게">
      <div className="flex flex-wrap items-start gap-x6">
        <Calendar
          selection="single"
          visibleRange="month"
          caption="하루 · 한 달 — 20일 고름"
          value={d(2026, 10, 20)}
        />
        <Calendar
          selection="range"
          visibleRange="month"
          caption="기간 · 한 달 + 빠른 기간 칩(팝오버는 줄바꿈)"
          presets={PRESETS}
          value={{ start: d(2026, 10, 12), end: d(2026, 10, 18) }}
        />
        <Calendar
          selection="multiple"
          visibleRange="month"
          caption="여러 날 — 띠로 잇지 않는다 · 최대 4개면 나머지는 막힘"
          maxSelectionCount={4}
          value={[
            d(2026, 10, 5),
            d(2026, 10, 14),
            d(2026, 10, 22),
            d(2026, 10, 29),
          ]}
        />
        <Calendar
          selection="single"
          visibleRange="month"
          caption="제목을 누르면 열리는 연 · 월 휠(이전 · 다음은 막힘)"
          defaultWheelOpen
          value={d(2026, 10, 20)}
        />
        <Calendar
          selection="range"
          visibleRange="twoMonths"
          width={696}
          caption="기간 · 두 달 나란히 696 — 달이 만나는 자리에서 띠가 이어진다"
          presets={PRESETS}
          value={{ start: d(2026, 10, 28), end: d(2026, 11, 3) }}
        />
        <Calendar
          selection="range"
          visibleRange="continuous"
          height={560}
          caption="기간 · 이어지는 달(시트) — 요일 줄이 위에 붙고 아래 안개 96, 칩 줄은 가로 스크롤"
          presets={PRESETS}
          value={{ start: d(2026, 10, 12), end: d(2026, 10, 18) }}
        />
      </div>
    </DemoBlock>

    <DemoBlock title="가장 나쁜 값 — 윤년 2월 29일 · 6주 달 · 막힌 날이 걸친 기간 · 연말에 걸친 기간 · 최소 / 최대 범위">
      <div className="flex flex-wrap items-start gap-x6">
        <Calendar
          selection="single"
          visibleRange="month"
          caption="2028년 2월(윤년) — 29일까지, 오늘 29일"
          today={d(2028, 2, 29)}
          value={d(2028, 2, 14)}
        />
        <Calendar
          selection="single"
          visibleRange="month"
          caption="2026년 8월 — 토요일에 시작하는 31일, 6주가 꽉 찬다"
          today={d(2026, 8, 31)}
          value={d(2026, 8, 3)}
        />
        <Calendar
          selection="single"
          visibleRange="month"
          caption="2026년 2월 — 4주짜리 달도 6주(앞뒤 달 흐리게)"
          today={d(2026, 2, 28)}
          value={d(2026, 2, 3)}
        />
        <Calendar
          selection="range"
          visibleRange="month"
          caption="12월 28일 ~ 1월 3일 — 해를 넘는 기간(12월 달력)"
          today={d(2026, 12, 20)}
          value={{ start: d(2026, 12, 28), end: d(2027, 1, 3) }}
        />
        <Calendar
          selection="range"
          visibleRange="month"
          caption="막힌 날(주말)이 걸친 기간 — 띠는 그대로, 숫자만 취소선"
          isDateDisabled={(day: Date) =>
            day.getDay() === 0 || day.getDay() === 6
          }
          value={{ start: d(2026, 10, 12), end: d(2026, 10, 22) }}
        />
        <Calendar
          selection="single"
          visibleRange="month"
          caption="환불일 — 거래일(9월 20일) ~ 오늘(10월 15일)만, 10월 달력"
          min={d(2026, 9, 20)}
          max={TODAY}
          value={d(2026, 10, 8)}
        />
        <Calendar
          selection="range"
          visibleRange="month"
          caption="진행 중인 기간 늘리기 — 확정된 시작일은 읽기 전용, 그 앞은 막힘"
          readOnlyStart
          value={{ start: d(2026, 10, 8), end: d(2026, 10, 14) }}
        />
        <Calendar
          selection="single"
          visibleRange="month"
          width={312}
          measured={false}
          caption="360 폰 — 시트 폭 − 48 = 312 (칸 44.6)"
          value={d(2026, 10, 20)}
        />
        <Calendar
          selection="range"
          visibleRange="month"
          width={272}
          measured={false}
          caption="320 폰 — 272 (칸 38.9 · 원 칸 폭 − 2 로 줄어든다)"
          value={{ start: d(2026, 10, 28), end: d(2026, 11, 3) }}
        />
      </div>
    </DemoBlock>

    <DemoBlock title="직접 눌러 본다 — 1280 미만은 시트, 이상은 팝오버. 고르는 동안 칸은 그대로이고 “완료” 로 넣는다 · 기간은 끝을 고르기 전까지 “완료” 가 막힌다 · 날짜를 치는 칸은 없다">
      <div className="flex flex-wrap items-start gap-x6">
        <DateField label="일정 날짜" mode="date" />
        <DateField label="환불일 (9월 20일 ~ 오늘)" mode="constrained" />
        <DateField label="통계 기간" mode="range" />
      </div>
    </DemoBlock>

    <DemoBlock title="날짜 + 시각 — 두 칸 나란히. 다른 해 날짜(2027년 1월 3일 (일))는 좁은 폭에서 시각 칸이 다음 줄로 내려간다 · 칸 글은 자르지 않는다">
      <div className="flex flex-wrap items-start gap-x6">
        <DateTimeField width={420} />
        <DateTimeField width={300} />
      </div>
    </DemoBlock>

    <DemoRow label="참고">
      <span className="text-t3 text-fg-neutral-subtle">
        오늘은 견본에서 2026년 10월 15일로 고정했다 — 윤년 · 월말 · 연말 견본은
        그 달의 날짜를 오늘로 준다.
      </span>
    </DemoRow>
  </div>
);
