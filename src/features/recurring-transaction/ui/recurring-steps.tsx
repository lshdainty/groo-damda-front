import { useRef, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/cn";
import { ChipRadio, ChipRadioGroup } from "@/shared/ds/chip";
import { Field } from "@/shared/ds/field";
import { Input } from "@/shared/ds/input";
import { ListRadioGroup, ListRadioItem } from "@/shared/ds/list";
import { Textarea } from "@/shared/ds/textarea";
import {
  TimePicker,
  type TimeValue,
} from "@/shared/ds/time-picker";
import { AmountInput } from "@/shared/ui/groo/amount-input";
import type { RecurringFrequency } from "@/entities/recurring-transaction";
import {
  END_COUNT_MAX,
  MEMO_MAX,
  MERCHANT_MAX,
  type EndDraft,
  type EndMode,
  type RepeatDraft,
} from "../lib/recurring-steps-model";
import { DateRow } from "./recurring-pickers";

/*
 * 반복 폼 안에서 한 단계 들어가는 화면들(I-20 D 26 ~ 28) — 거래처 · 메모 · 수수료 · 이자 글 단계, 반복 고르기, 끝 고르기.
 * 값은 부르는 쪽이 draft 로 들고 있다가 머리 "완료" 에 폼으로 넣는다. ← 는 draft 를 버린다.
 */

/** 묶음 이름 — t4 500 fg-neutral-subtle, 위 16 · 아래 8 */
function SectionName({ id, children }: { id?: string; children: string }) {
  return (
    <h3
      id={id}
      className="m-0 pb-x2 pt-x4 font-sans text-t4 font-medium text-fg-neutral-subtle"
    >
      {children}
    </h3>
  );
}

export function TextStep({
  kind,
  value,
  onChange,
  onEnter,
  placeholder,
  label,
}: {
  kind: "merchant" | "memo";
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  placeholder: string;
  label: string;
}) {
  if (kind === "memo") {
    return (
      <Field
        label={label}
        maxGraphemeCount={MEMO_MAX}
        className="pb-x2 pt-x1 [&_label]:sr-only"
      >
        <Textarea
          autoFocus
          rows={3}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value.slice(0, MEMO_MAX))}
        />
      </Field>
    );
  }
  return (
    <div className="pb-x2 pt-x3">
      <Input
        size="large"
        autoFocus
        aria-label={label}
        value={value}
        placeholder={placeholder}
        maxLength={MERCHANT_MAX}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter();
          }
        }}
      />
    </div>
  );
}

export function AmountStep({
  value,
  onChange,
  onEnter,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  label: string;
}) {
  return (
    <div className="pb-x2 pt-x3">
      <AmountInput
        variant="underline"
        autoFocus
        aria-label={label}
        value={value}
        onValueChange={onChange}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter();
          }
        }}
      />
    </div>
  );
}

// ── 반복 고르기 ────────────────────────────────────────────────

const FREQS: RecurringFrequency[] = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];
const DOW_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/** 1 ~ 31 날 격자 — 하나 고르기 묶음. 화살표로 옮기고(좌우 ±1 · 위아래 ±7) 옮기면 고른다 */
function DayGrid({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (d: number) => void;
  label: string;
}) {
  const { t } = useTranslation("recurring");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (e: KeyboardEvent, d: number) => {
    const step =
      e.key === "ArrowRight"
        ? 1
        : e.key === "ArrowLeft"
          ? -1
          : e.key === "ArrowDown"
            ? 7
            : e.key === "ArrowUp"
              ? -7
              : 0;
    if (!step) return;
    const next = d + step;
    if (next < 1 || next > 31) return;
    e.preventDefault();
    onChange(next);
    refs.current[next - 1]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid grid-cols-7 gap-x1"
    >
      {DAYS.map((d) => {
        const on = d === value;
        return (
          <button
            key={d}
            ref={(el) => {
              refs.current[d - 1] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={t("dayN", { day: d })}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(d)}
            onKeyDown={(e) => move(e, d)}
            className={cn(
              "h-x10 min-w-0 cursor-pointer rounded-full border-0 p-0 font-sans text-t5 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring",
              on
                ? "bg-bg-neutral-inverted font-bold text-fg-neutral-inverted"
                : "bg-transparent text-fg-neutral hover:bg-bg-neutral-weak-pressed",
            )}
          >
            {d}
          </button>
        );
      })}
    </div>
  );
}

export function RepeatStep({
  draft,
  onChange,
}: {
  draft: RepeatDraft;
  onChange: (d: RepeatDraft) => void;
}) {
  const { t } = useTranslation("recurring");
  const time: TimeValue = {
    hour: Number(draft.time.slice(0, 2)),
    minute: Number(draft.time.slice(3, 5)),
  };
  return (
    <div>
      <ChipRadioGroup
        aria-label={t("frequencyTitle")}
        value={draft.frequency}
        onValueChange={(v) =>
          onChange({ ...draft, frequency: v as RecurringFrequency })
        }
        className="pb-x1 pt-x3"
      >
        {FREQS.map((f) => (
          <ChipRadio key={f} value={f} variant="outlineStrong" size="medium">
            {t(`freq.${f}`)}
          </ChipRadio>
        ))}
      </ChipRadioGroup>

      {draft.frequency === "MONTHLY" && (
        <>
          <SectionName>{t("onWhichDay")}</SectionName>
          <DayGrid
            label={t("onWhichDay")}
            value={draft.dayOfMonth}
            onChange={(d) => onChange({ ...draft, dayOfMonth: d })}
          />
          {draft.dayOfMonth >= 29 && (
            <p className="m-0 pt-x3 font-sans text-t3 text-fg-neutral-subtle">
              {t("monthDayNote", { day: draft.dayOfMonth })}
            </p>
          )}
        </>
      )}

      {draft.frequency === "WEEKLY" && (
        <>
          <SectionName>{t("onWhichWeekday")}</SectionName>
          <div className="-mx-x6">
            <ListRadioGroup
              aria-label={t("onWhichWeekday")}
              value={String(draft.dayOfWeek)}
              onValueChange={(v) =>
                onChange({ ...draft, dayOfWeek: Number(v) })
              }
            >
              {DOW_KEYS.map((k, i) => (
                <ListRadioItem
                  key={k}
                  value={String(i)}
                  title={t(`dowLong.${k}`)}
                />
              ))}
            </ListRadioGroup>
          </div>
        </>
      )}

      {draft.frequency === "YEARLY" && (
        <p className="m-0 pt-x3 font-sans text-t3 text-fg-neutral-subtle">
          {t("yearlyHint")}
        </p>
      )}

      <SectionName>{t("atWhatTime")}</SectionName>
      <div className="flex justify-center">
        <TimePicker
          aria-label={t("atWhatTime")}
          value={time}
          onValueChange={(v) => {
            const pad = (n: number) => String(n).padStart(2, "0");
            onChange({ ...draft, time: `${pad(v.hour)}:${pad(v.minute)}` });
          }}
        />
      </div>
    </div>
  );
}

// ── 끝 고르기 ──────────────────────────────────────────────────

export function EndStep({
  draft,
  onChange,
  startDate,
  dateError,
  countError,
}: {
  draft: EndDraft;
  onChange: (d: EndDraft) => void;
  startDate: string;
  dateError?: string | null;
  countError?: string | null;
}) {
  const { t } = useTranslation("recurring");
  return (
    <div className="-mx-x6">
      <ListRadioGroup
        aria-label={t("endRow")}
        value={draft.mode}
        onValueChange={(v) => onChange({ ...draft, mode: v as EndMode })}
      >
        <ListRadioItem value="NONE" title={t("endNoneRadio")} />
        <ListRadioItem value="DATE" title={t("endUntilDate")} />
        {draft.mode === "DATE" && (
          <DateRow
            title={t("endDay")}
            surfaceTitle={t("endDay")}
            value={draft.date}
            min={startDate}
            onChange={(d) => onChange({ ...draft, date: d })}
            errorMessage={dateError}
          />
        )}
        <ListRadioItem value="COUNT" title={t("endCountTimes")} />
        {draft.mode === "COUNT" && (
          <Field
            label={t("endCountLabel")}
            invalid={!!countError}
            errorMessage={countError ?? undefined}
            className="px-x6 pb-x2 pt-x2"
          >
            <AmountInput
              size="large"
              unit={t("timesUnit")}
              max={END_COUNT_MAX}
              value={draft.count}
              onValueChange={(v) => onChange({ ...draft, count: v })}
            />
          </Field>
        )}
      </ListRadioGroup>
    </div>
  );
}
