import { useState, type ReactNode } from "react";
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
  DatePicker,
  type DatePresetName,
  type DateRange,
} from "@/shared/ds/date-picker";
import { useInputButtonSurface } from "@/shared/ds/input-button";
import {
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverFooter,
  PopoverTrigger,
} from "@/shared/ds/popover";
import { rangeSegModeOf, type RangeState } from "./stats-range";

// ───────────────────────────────────────────────────────────
// RangePickerSheet — 통계 기간 고르기. ds Date Picker 기간(date-picker.md "기간 — 칸 하나, 달력 하나").
// - 트리거는 기간 버튼(I-08 31) 그대로 — 시작 · 종료 두 칸을 두지 않는다(:138)
// - 1280 미만 시트(이어지는 달), 이상 팝오버(두 달 나란히) — 어디에 놓나 표 :112
// - 빠른 기간 칩 한 줄 — 이번 주 · 이번 달 · 지난 달 · 최근 3개월 · 올해 다섯(앱 내보내기 기간과 같은 이름 · 같은 순서), 이름 · 범위는 스펙 한 벌(:150)
// - 바닥 "초기화" + "완료". 고르는 동안 기간 버튼 값은 그대로, "완료" 에서 넣는다
// ───────────────────────────────────────────────────────────
const PRESETS: readonly DatePresetName[] = [
  "thisWeek",
  "thisMonth",
  "lastMonth",
  "last3Months",
  "thisYear",
];

const toRange = (r: RangeState): DateRange => ({ start: r.from, end: r.to });

export function RangePickerSheet({
  trigger,
  open,
  onOpenChange,
  initial,
  onConfirm,
  draft: liftedDraft,
  onDraftChange,
}: {
  /** 여는 기간 버튼 — 시트일 땐 onClick 이 연다, 팝오버일 땐 이 버튼 아래에 붙는다(열기는 팝오버가 맡는다) */
  trigger: (opener: { onClick?: () => void }) => ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: RangeState;
  onConfirm: (range: RangeState) => void;
  /**
   * 고르던 기간을 바깥이 들 때(선택) — 시트가 다시 붙어도(폭이 768 을 넘나들어 구역이 옮겨 그려짐) 고르던 값이 남는다(I-wrap-b1 ε 9).
   * 둘 다 줘야 바깥 값을 쓴다. 안 주면 이 부품이 제 값을 든다.
   */
  draft?: DateRange | undefined;
  onDraftChange?: (next: DateRange | undefined) => void;
}) {
  const { t } = useTranslation("stats");
  const surface = useInputButtonSurface();
  const sheet = surface === "sheet";
  const [ownDraft, setOwnDraft] = useState<DateRange | undefined>(
    toRange(initial),
  );
  const controlled = onDraftChange != null;
  const draft = controlled ? liftedDraft : ownDraft;
  const setDraft = controlled ? onDraftChange : setOwnDraft;
  const label = t("picker.title");
  // 필수 값이라 비었거나(초기화 뒤) 끝을 아직 안 골랐으면 완료를 막는다
  const canApply = !!draft?.start && !!draft.end;
  const changeOpen = (next: boolean) => {
    // 열 때는 지금 기간에서 시작한다(date-picker.md "날짜는 고르게 한다")
    if (next) setDraft(toRange(initial));
    onOpenChange(next);
  };
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
        {t("picker.reset")}
      </Button>
      <Button
        disabled={!canApply}
        onClick={() => {
          if (!draft?.start || !draft.end) return;
          onConfirm({
            from: draft.start,
            to: draft.end,
            segMode: rangeSegModeOf(draft.start, draft.end, initial),
          });
          onOpenChange(false);
        }}
      >
        {t("picker.done")}
      </Button>
    </>
  );
  return sheet ? (
    <BottomSheet open={open} onOpenChange={changeOpen}>
      {trigger({ onClick: () => changeOpen(true) })}
      <BottomSheetContent title={label} className="h-[90dvh]">
        <BottomSheetBody className="overflow-hidden">{picker}</BottomSheetBody>
        <BottomSheetFooter>{footer}</BottomSheetFooter>
      </BottomSheetContent>
    </BottomSheet>
  ) : (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>{trigger({})}</PopoverTrigger>
      <PopoverContent
        aria-label={label}
        align="end"
        className={DATE_PICKER_TWO_MONTHS_POPOVER}
      >
        <PopoverBody>{picker}</PopoverBody>
        <PopoverFooter>{footer}</PopoverFooter>
      </PopoverContent>
    </Popover>
  );
}
