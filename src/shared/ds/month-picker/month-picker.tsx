import * as React from "react";

import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetFooter,
  BottomSheetTrigger,
} from "@/shared/ds/bottom-sheet";
import { Button } from "@/shared/ds/button";
import { datePickerLabels } from "@/shared/ds/date-picker";
import {
  WHEEL_MONTH,
  WHEEL_YEAR,
} from "@/shared/ds/date-picker/date-picker-variants";
import { useWideSurface } from "@/shared/ds/overlay";
import {
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverFooter,
  PopoverTrigger,
} from "@/shared/ds/popover";
import { WheelPicker, WheelPickerColumn } from "@/shared/ds/wheel-picker";

/*
 * 달 고르기 — 연 | 월 두 칼럼 Wheel Picker 를 시트(1280 미만) · 팝오버(이상)로 열고 "완료" 로 넣는다.
 * 스펙: wheel-picker.md "달만 고르기"(medium 44 · 보이는 칸 5 · 연 120 오른쪽 · 월 96 왼쪽 · 월은 돌아간다), date-picker.md "어디에 놓나".
 * 4 × 3 월 격자는 두지 않는다. 바깥 · 끌어내리기 · Esc 로 닫으면 굴린 값은 버린다 — 넣는 길은 "완료" 하나다. 열 때는 지금 달에서 시작한다.
 *
 *   trigger        여는 버튼 하나(<button>) — 달 글 + 아래 꺾쇠는 부르는 쪽이 그린다. 시트는 BottomSheetTrigger, 팝오버는 PopoverTrigger 가 감싼다
 *   value          지금 달 { year, month(1 ~ 12) }
 *   onValueChange  "완료" 를 눌렀을 때만 부른다
 *   title          시트 제목 · 팝오버 이름("달 선택")
 *   doneLabel      바닥 버튼 글("완료")
 *   yearRange      연 범위 — 기본 오늘 ± 100년(date-picker "연 · 월 옮기기"). 지금 값의 해가 밖이면 넓힌다
 *
 * 휠 칸 글자는 px 라 크기 설정을 따르지 않는다(wheel-picker.md). 제목 · "완료" 는 따른다.
 */

export interface MonthValue {
  year: number;
  /** 1 ~ 12 */
  month: number;
}

export interface MonthPickerProps {
  value: MonthValue;
  onValueChange: (value: MonthValue) => void;
  trigger: React.ReactElement;
  title: string;
  doneLabel: string;
  yearRange?: { start: number; end: number };
  /** 팝오버가 트리거의 어느 쪽 변에 맞는지 — 기본 start */
  align?: "start" | "center" | "end";
}

function MonthWheel({
  draft,
  onDraft,
  yearRange,
}: {
  draft: MonthValue;
  onDraft: React.Dispatch<React.SetStateAction<MonthValue>>;
  yearRange: { start: number; end: number };
}) {
  const labels = datePickerLabels();
  const years = Array.from(
    { length: yearRange.end - yearRange.start + 1 },
    (_, i) => ({
      value: String(yearRange.start + i),
      label: labels.yearOption(yearRange.start + i),
    }),
  );
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: labels.monthOption(i + 1),
  }));
  return (
    <WheelPicker
      size="medium"
      visibleItems={5}
      aria-label={labels.month(draft.year, draft.month)}
    >
      <WheelPickerColumn
        aria-label={labels.yearWheel}
        className={WHEEL_YEAR}
        align="right"
        options={years}
        value={String(draft.year)}
        onValueChange={(year) => onDraft((d) => ({ ...d, year: Number(year) }))}
      />
      <WheelPickerColumn
        aria-label={labels.monthWheel}
        className={WHEEL_MONTH}
        align="left"
        loop
        options={months}
        value={String(draft.month)}
        onValueChange={(month) =>
          onDraft((d) => ({ ...d, month: Number(month) }))
        }
      />
    </WheelPicker>
  );
}

function MonthPicker({
  value,
  onValueChange,
  trigger,
  title,
  doneLabel,
  yearRange,
  align = "start",
}: MonthPickerProps) {
  const wide = useWideSurface();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<MonthValue>(value);

  const thisYear = new Date().getFullYear();
  const range = {
    start: Math.min(yearRange?.start ?? thisYear - 100, value.year),
    end: Math.max(yearRange?.end ?? thisYear + 100, value.year),
  };

  // 열 때마다 지금 달에서 시작한다 — 굴리다 버린 값이 남지 않게
  const handleOpenChange = (next: boolean) => {
    if (next) setDraft(value);
    setOpen(next);
  };
  const done = (
    <Button
      onClick={() => {
        onValueChange(draft);
        setOpen(false);
      }}
    >
      {doneLabel}
    </Button>
  );
  const wheel = (
    <div data-slot="month-picker-wheel" className="flex justify-center">
      <MonthWheel draft={draft} onDraft={setDraft} yearRange={range} />
    </div>
  );

  if (!wide) {
    return (
      <BottomSheet
        open={open}
        dismissible={false}
        onOpenChange={handleOpenChange}
      >
        <BottomSheetTrigger asChild>{trigger}</BottomSheetTrigger>
        <BottomSheetContent title={title}>
          <BottomSheetBody>{wheel}</BottomSheetBody>
          <BottomSheetFooter>{done}</BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheet>
    );
  }
  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent aria-label={title} align={align}>
        <PopoverBody>{wheel}</PopoverBody>
        <PopoverFooter>{done}</PopoverFooter>
      </PopoverContent>
    </Popover>
  );
}

export { MonthPicker };
