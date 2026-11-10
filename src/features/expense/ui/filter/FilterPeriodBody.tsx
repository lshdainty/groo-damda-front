import { useState } from "react";
import { CalendarDays, CircleAlert, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetFooter,
} from "@/shared/ds/bottom-sheet";
import { Button } from "@/shared/ds/button";
import {
  DATE_PICKER_TWO_MONTHS_POPOVER,
  DATE_PRESETS,
  DatePicker,
  dayKey,
  formatRangeValue,
  parseDayKey,
  type DateRange,
} from "@/shared/ds/date-picker";
import { InputButton, useInputButtonSurface } from "@/shared/ds/input-button";
import {
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverFooter,
  PopoverTrigger,
} from "@/shared/ds/popover";
import {
  MAX_PERIODS,
  resolvePeriod,
  type FilterPeriodRange,
} from "../../model/filter";

// 빠른 기간 — 이름은 옛 필터의 이번 주 · 이번 달 · 3개월 셋 그대로이고, **범위는 ds 날짜 선택의 달력 단위**를 따른다(date-picker.md · 날짜 결정 10-03):
//   이번 주   월요일 ~ 오늘          → 일요일 ~ 토요일
//   이번 달   1일 ~ 오늘             → 1일 ~ 말일
//   3개월     오늘 − 3달 ~ 오늘      → 최근 3개월 = 두 달 전 1일 ~ 이번 달 말일
// 새로 넓힌 지난 달 · 올해는 두지 않는다.
const PRESETS = DATE_PRESETS.filter((n) =>
  ["thisWeek", "thisMonth", "last3Months"].includes(n),
);

const toRange = (p: FilterPeriodRange | null): DateRange | undefined => {
  const start = p ? parseDayKey(p.start) : undefined;
  return start ? { start, end: parseDayKey(p!.end) } : undefined;
};

/**
 * 기간 한 칸 — Input Button 하나를 누르면 Date Picker 기간 고르기가 열린다(date-picker.md "기간 — 칸 하나, 달력 하나").
 * 1280 미만은 시트 위 시트(이어지는 달), 이상은 팝오버 두 달. 빠른 기간은 옛 필터 그대로(폰 · 데스크톱 같다). 고르는 동안 칸 값은 그대로, "완료" 에서 넣는다.
 * "초기화" 로 비우고 완료하면 이 칸이 사라진다(`onChange(null)`).
 */
function PeriodPicker({
  value,
  onChange,
  label,
}: {
  value: FilterPeriodRange | null;
  onChange: (next: FilterPeriodRange | null) => void;
  label: string;
}) {
  const { t } = useTranslation("expense");
  const surface = useInputButtonSurface();
  const [open, setOpen] = useState(false);
  const current = toRange(value);
  const [draft, setDraft] = useState<DateRange | undefined>(current);
  const trigger = (
    <InputButton
      placeholder={label}
      value={formatRangeValue(current, new Date())}
      suffixIcon={<CalendarDays />}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => {
        setDraft(current);
        setOpen(true);
      }}
    />
  );
  const sheet = surface === "sheet";
  const picker = (
    <DatePicker
      selection="range"
      visibleRange={sheet ? "continuous" : "twoMonths"}
      presets={PRESETS}
      aria-label={label}
      value={draft}
      onValueChange={setDraft}
      autoFocus
    />
  );
  const footer = (
    <>
      <Button variant="neutralWeak" onClick={() => setDraft(undefined)}>
        {t("filter.reset")}
      </Button>
      <Button
        disabled={!!draft?.start && !draft.end}
        onClick={() => {
          onChange(
            draft?.start && draft.end
              ? {
                  preset: "custom",
                  start: dayKey(draft.start),
                  end: dayKey(draft.end),
                }
              : null,
          );
          setOpen(false);
        }}
      >
        {t("filter.done")}
      </Button>
    </>
  );
  return sheet ? (
    <BottomSheet open={open} dismissible={false} onOpenChange={setOpen}>
      {trigger}
      <BottomSheetContent title={label} className="h-[90dvh]">
        <BottomSheetBody className="overflow-hidden">{picker}</BottomSheetBody>
        <BottomSheetFooter>{footer}</BottomSheetFooter>
      </BottomSheetContent>
    </BottomSheet>
  ) : (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        aria-label={label}
        align="start"
        className={DATE_PICKER_TWO_MONTHS_POPOVER}
      >
        <PopoverBody>{picker}</PopoverBody>
        <PopoverFooter>{footer}</PopoverFooter>
      </PopoverContent>
    </Popover>
  );
}

/**
 * 기간 본문 — 칸마다 Date Picker 기간(빠른 기간 칩 포함). 칸은 최대 셋이고 칸 사이는 OR 이다(기간은 다른 조건과 항상 AND).
 * 기간을 아직 고르지 않았으면 빈 칸 하나만 보인다 — **고르지 않은 기간은 조건이 아니다**(보던 달을 미리 넣어 두지 않는다).
 * "기간 추가" 는 첫 기간을 고른 뒤부터 보인다. 칸이 둘 이상이면 줄마다 지우기가 있다.
 */
export function FilterPeriodBody({
  value,
  onChange,
}: {
  value: FilterPeriodRange[];
  onChange: (next: FilterPeriodRange[]) => void;
}) {
  const { t } = useTranslation("expense");
  const rows: (FilterPeriodRange | null)[] = value.length > 0 ? value : [null];
  const badPeriod = value.some((p) => p.start && p.end && p.start > p.end);
  return (
    <div className="flex flex-col gap-x2">
      {rows.map((p, i) => (
        <div key={i} className="flex items-center gap-x2">
          <div className="min-w-0 flex-1">
            <PeriodPicker
              value={p}
              label={t("filter.periodPick")}
              onChange={(next) =>
                onChange(
                  next
                    ? p
                      ? value.map((x, k) => (k === i ? next : x))
                      : [next]
                    : value.filter((_, k) => k !== i),
                )
              }
            />
          </div>
          {value.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="small"
              layout="iconOnly"
              aria-label={t("filter.removeRow")}
              onClick={() => onChange(value.filter((_, k) => k !== i))}
            >
              <X />
            </Button>
          )}
        </div>
      ))}
      {badPeriod && (
        <p className="m-0 flex items-start gap-x1_5 text-t4 font-normal text-fg-critical">
          <CircleAlert aria-hidden className="mt-x0_5 size-4 shrink-0" />
          {t("filter.dateError")}
        </p>
      )}
      {value.length > 0 && value.length < MAX_PERIODS && (
        <Button
          type="button"
          variant="ghost"
          size="small"
          className="self-start"
          onClick={() => onChange([...value, resolvePeriod("month")])}
        >
          <Plus />
          {t("filter.addPeriod")}
        </Button>
      )}
    </div>
  );
}
