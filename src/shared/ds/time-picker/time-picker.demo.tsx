import { useState } from "react";
import { Clock } from "lucide-react";

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

import { TimePicker } from "./time-picker";
import {
  MINUTE_STEPS,
  formatTimeValue,
  roundToStep,
  type MinuteStep,
  type TimeValue,
} from "./time-picker-variants";

// 견본의 지금 — 고정한다(빈 값을 짚는 자리가 날마다 바뀌면 견본이 흔들린다). 9시 13분 → 분 간격마다 가까운 칸
const NOW = new Date(2026, 9, 15, 9, 13);
const VALUE: TimeValue = { hour: 15, minute: 0 };

function Sample({
  step,
  state = "enabled",
  value = VALUE,
}: {
  step: MinuteStep;
  state?: "enabled" | "disabled";
  value?: TimeValue;
}) {
  return (
    <div className="w-[280px]">
      <Specimen
        spec="time-picker"
        combo={{ minuteStep: String(step) }}
        state={state}
      >
        <TimePicker
          aria-label={`시작 시각 · 간격 ${step}${state === "disabled" ? " · 막힘" : ""}`}
          minuteStep={step}
          value={value}
          now={NOW}
          disabled={state === "disabled"}
        />
      </Specimen>
    </div>
  );
}

/**
 * 시각 칸 — 1280 미만은 아래 시트, 이상은 칸 아래 팝오버. 휠을 굴리는 동안 칸 값은 그대로이고 "완료" 로 넣는다.
 * 칸이 비었으면 지금을 분 간격에 맞춰 반올림한 자리를 짚어 열기만 한다(고른 것처럼 넣지 않는다).
 */
function TimeField({
  label,
  step = 1,
  initial,
}: {
  label: string;
  step?: MinuteStep;
  initial?: TimeValue;
}) {
  const surface = useInputButtonSurface();
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState<TimeValue | undefined>(initial);
  const [draft, setDraft] = useState<TimeValue | undefined>(initial);
  const [place, setPlace] = useState<HTMLDivElement | null>(null);
  const trigger = (
    <InputButton
      placeholder="시간 선택"
      value={formatTimeValue(time)}
      suffixIcon={<Clock />}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => {
        setDraft(time);
        setOpen(true);
      }}
    />
  );
  const wheel = (
    <TimePicker
      aria-label={label}
      minuteStep={step}
      value={draft}
      onValueChange={setDraft}
      autoFocus
    />
  );
  const done = (
    <Button
      onClick={() => {
        const now = roundToStep(new Date(), step);
        setTime(draft ?? { hour: now.getHours(), minute: now.getMinutes() });
        setOpen(false);
      }}
    >
      완료
    </Button>
  );
  return (
    <div className="flex w-[300px] flex-col gap-x2">
      <Field label={label}>
        {surface === "sheet" ? (
          <BottomSheet open={open} onOpenChange={setOpen} container={place}>
            {trigger}
            <BottomSheetContent title="시간 선택">
              <BottomSheetBody>{wheel}</BottomSheetBody>
              <BottomSheetFooter>{done}</BottomSheetFooter>
            </BottomSheetContent>
          </BottomSheet>
        ) : (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            {place && (
              <PopoverContent
                container={place}
                aria-label="시간 선택"
                align="start"
              >
                <PopoverBody>{wheel}</PopoverBody>
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

/** 카탈로그(/dev/ds) — 분 간격 × 상태, 비었을 때 짚는 자리(9시 13분 → 간격마다 반올림), 칸 + 시트 · 팝오버 */
export const TimePickerDemo = () => (
  <div className="flex flex-col gap-x8">
    <DemoBlock title="분 간격 — 칼럼에는 그 간격의 분만 있다(1 은 60칸 · 5 는 12칸 · 10 은 6칸 · 15 는 4칸 · 30 은 2칸). 값은 오후 3:00">
      <DemoRow label="enabled">
        {MINUTE_STEPS.map((step) => (
          <Sample key={step} step={step} />
        ))}
      </DemoRow>
      <DemoRow label="disabled">
        <Sample step={5} state="disabled" />
      </DemoRow>
    </DemoBlock>

    <DemoBlock title="가장 나쁜 값 — 자정 · 정오 · 하루 끝에서 간격에 안 맞는 값(오후 11:58 은 간격 5 에서 다음 날 0시, 오전 12:00 으로 돈다)">
      <DemoRow label="오전 12:00">
        <Sample step={5} value={{ hour: 0, minute: 0 }} />
      </DemoRow>
      <DemoRow label="오후 12:00">
        <Sample step={5} value={{ hour: 12, minute: 0 }} />
      </DemoRow>
      <DemoRow label="오후 11:58">
        <Sample step={5} value={{ hour: 23, minute: 58 }} />
      </DemoRow>
    </DemoBlock>

    <DemoBlock title="값이 없을 때 — 지금(오전 9:13)을 짚는다. 기본 간격 1 은 반올림 없이 오전 9:13 그대로이고, 더 큰 간격이면 그 간격에 맞춘다(5 → 오전 9:15 · 15 → 오전 9:15 · 30 → 오전 9:00). 고른 것처럼 넣지 않는다">
      <DemoRow label="비어 있음">
        {([1, 5, 15, 30] as const).map((step) => (
          <div key={step} className="w-[280px]">
            <TimePicker
              aria-label={`빈 값 · 간격 ${step}`}
              minuteStep={step}
              now={NOW}
            />
          </div>
        ))}
      </DemoRow>
    </DemoBlock>

    <DemoBlock title="직접 눌러 본다 — 1280 미만은 시트, 이상은 팝오버. 굴리는 동안 칸은 그대로이고 “완료” 로 넣는다 · 바깥 · Esc 로 닫으면 버린다">
      <div className="flex flex-wrap items-start gap-x6">
        <TimeField label="시작 시각" />
        <TimeField
          label="방해 금지 시작 (1분)"
          step={1}
          initial={{ hour: 22, minute: 30 }}
        />
      </div>
    </DemoBlock>
  </div>
);
