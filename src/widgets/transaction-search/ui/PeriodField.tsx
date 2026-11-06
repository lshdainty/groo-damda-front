import { useState } from "react";
import { CalendarDays } from "lucide-react";
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
import { Field } from "@/shared/ds/field";
import { InputButton, useInputButtonSurface } from "@/shared/ds/input-button";
import {
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverFooter,
  PopoverTrigger,
} from "@/shared/ds/popover";

// 빠른 기간 — 가계부 거르기(FilterPeriodBody)와 같은 필터라 같은 벌 셋: 이번 주 · 이번 달 · 최근 3개월.
// 앱 검색 · 가계부 거르기도 셋이다(I-wrap-b1 ε — 앱 α 검수). 범위는 ds 날짜 선택의 달력 단위
const PRESETS = DATE_PRESETS.filter((n) =>
  ["thisWeek", "thisMonth", "last3Months"].includes(n),
);

/**
 * 고급 필터의 기간 칸 — 칸 하나(Input Button)를 누르면 Date Picker 기간 고르기가 열린다(top-navigation.md 거래 검색
 * "기간 — Input Button 으로 여는 Date Picker 기간 고르기, 브라우저 날짜 칸을 쓰지 않는다", I-01 결과 확인 고치기 W2).
 * 1280 미만은 시트 위 시트(이어지는 달 + 빠른 기간), 이상은 팝오버 두 달. 고르는 동안 칸 값은 그대로, "완료" 에서 넣는다.
 * 값은 "YYYY-MM-DD" 두 개(from · to — 검색 조건과 같은 꼴)다.
 */
export function PeriodField({
  from,
  to,
  onChange,
  label: fieldLabel,
  invalid,
  errorMessage,
}: {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
  /** 칸 이름 — 기본 "기간" (검색). 다른 화면이 쓸 때만 */
  label?: string;
  /** 오류 — 기간이 비었을 때 같은 칸 아래 글(R19) */
  invalid?: boolean;
  errorMessage?: string;
}) {
  const { t } = useTranslation("common");
  const surface = useInputButtonSurface();
  const [open, setOpen] = useState(false);
  const start = parseDayKey(from);
  const current: DateRange | undefined = start
    ? { start, end: parseDayKey(to) }
    : undefined;
  const [draft, setDraft] = useState<DateRange | undefined>(current);
  const label = t("searchPeriodPick");
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
        {t("searchReset")}
      </Button>
      <Button
        disabled={!!draft?.start && !draft.end}
        onClick={() => {
          onChange({
            from: draft?.start ? dayKey(draft.start) : "",
            to: draft?.end ? dayKey(draft.end) : "",
          });
          setOpen(false);
        }}
      >
        {t("searchDone")}
      </Button>
    </>
  );
  return (
    <Field
      label={fieldLabel ?? t("searchPeriod")}
      invalid={invalid}
      errorMessage={errorMessage}
    >
      {sheet ? (
        <BottomSheet open={open} onOpenChange={setOpen}>
          {trigger}
          <BottomSheetContent title={label} className="h-[90dvh]">
            <BottomSheetBody className="overflow-hidden">
              {picker}
            </BottomSheetBody>
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
      )}
    </Field>
  );
}
