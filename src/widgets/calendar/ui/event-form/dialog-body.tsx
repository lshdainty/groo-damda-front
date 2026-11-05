import { useState } from "react";
import { CalendarDays, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import { Field } from "@/shared/ds/field";
import { Input } from "@/shared/ds/input";
import { InputButton } from "@/shared/ds/input-button";
import { Select, SelectItem } from "@/shared/ds/select";
import { Switch } from "@/shared/ds/switch";
import { Textarea } from "@/shared/ds/textarea";
import { formatDateValue, parseDayKey } from "@/shared/ds/date-picker";
import { formatTimeValue } from "@/shared/ds/time-picker";
import {
  CONTENT_MAX,
  LOCATION_MAX,
  RECURRENCE_OPTIONS,
  REMINDER_OPTIONS,
  TITLE_MAX,
} from "@/widgets/calendar/model/use-event-form";
import { DayPickSurface, TimePickSurface } from "./pickers";
import { NO_LABEL, reminderKey, type EventFormView } from "./types";

/**
 * "자세히" 대화상자 본문 (I-09 32) — ds Field 칸을 24 간격으로. 칸 차례는 시트와 같다
 * (제목 → 캘린더 · 라벨 → 종일 · 시작 · 종료 → 반복 · 알림 → 장소 · 설명). 필수 점은 제목 · 캘린더 · 시작 · 종료 넷.
 * 날짜 · 시각 Input Button 은 칸 아래 팝오버(336)에서 고르고 "완료" 에 들어간다.
 */
export function EventFormDialogBody({ view }: { view: EventFormView }) {
  const { t } = useTranslation("calendar");
  const {
    ctrl,
    labels,
    labelsFailed,
    onRetryLabels,
    showErrors,
    titleEmpty,
    rangeError,
    endRef,
  } = view;
  const {
    form,
    selectableCalendars,
    calendarsLoading,
    refetchCalendars,
    recurrence,
    selectedReminders,
    startDate,
    endDate,
    isAllDay,
    selectedLabelRowId,
    selectedCalendarRowId,
  } = ctrl;
  const [today] = useState(() => new Date());
  const dayText = (day: string) => formatDateValue(parseDayKey(day), today);
  const timeText = (hhmm: string) =>
    formatTimeValue({
      hour: Number(hhmm.slice(0, 2)),
      minute: Number(hhmm.slice(3, 5)),
    });

  const dateField = (
    kind: "start" | "end",
    value: string,
    setDay: (d: string) => void,
    setTime: (h: string) => void,
  ) => {
    const day = value.slice(0, 10);
    const time = value.slice(11, 16);
    const invalid = kind === "end" && rangeError;
    return (
      <Field
        label={t(`form.${kind}`)}
        showRequiredIndicator
        invalid={invalid}
        errorMessage={t("form.endBeforeStart")}
      >
        <div className="flex flex-wrap gap-x2">
          <DayPickSurface
            title={t(`form.${kind}Day`)}
            value={day}
            onConfirm={setDay}
            trigger={({ open, onClick }) => (
              <InputButton
                ref={kind === "end" ? endRef : undefined}
                rootClassName="min-w-0 flex-1 basis-[160px]"
                aria-label={`${t(`form.${kind}Day`)}, ${dayText(day)}`}
                value={dayText(day)}
                suffixIcon={<CalendarDays />}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={onClick}
              />
            )}
          />
          {!isAllDay && time && (
            <TimePickSurface
              title={t(`form.${kind}Time`)}
              value={time}
              onConfirm={setTime}
              trigger={({ open, onClick }) => (
                <InputButton
                  rootClassName="w-[9rem] max-w-full"
                  aria-label={`${t(`form.${kind}Time`)}, ${timeText(time)}`}
                  value={timeText(time)}
                  suffixIcon={<Clock />}
                  aria-haspopup="dialog"
                  aria-expanded={open}
                  onClick={onClick}
                />
              )}
            />
          )}
        </div>
      </Field>
    );
  };

  return (
    <div className="flex flex-col gap-x6 pb-x2">
      <Field
        label={t("form.title")}
        showRequiredIndicator
        invalid={showErrors && titleEmpty}
        errorMessage={t("form.titleRequired")}
      >
        <Input
          {...form.register("title", { maxLength: TITLE_MAX })}
          placeholder={t("form.titlePlaceholder")}
          maxLength={TITLE_MAX}
        />
      </Field>

      <Field label={t("form.calendar")} showRequiredIndicator>
        {selectableCalendars.length > 0 ? (
          <Select
            value={
              selectedCalendarRowId ? String(selectedCalendarRowId) : undefined
            }
            onValueChange={(v) => ctrl.handleCalendarChange(Number(v))}
          >
            {selectableCalendars.map((c) => (
              <SelectItem
                key={c.rowId}
                value={String(c.rowId)}
                label={c.calendarName}
                prefixIcon={
                  <span
                    aria-hidden
                    className="size-[10px] rounded-full"
                    style={{ background: getPaletteByColor(c.color).color }}
                  />
                }
              />
            ))}
          </Select>
        ) : (
          <InputButton
            value=""
            placeholder={calendarsLoading ? "" : t("form.calendarLoadFailed")}
            onClick={() => void refetchCalendars()}
          />
        )}
      </Field>

      <Field
        label={t("form.label")}
        description={
          labels.length === 0 && !labelsFailed ? t("form.labelHint") : undefined
        }
      >
        {labelsFailed ? (
          <InputButton
            value=""
            placeholder={t("form.labelLoadFailed")}
            onClick={onRetryLabels}
          />
        ) : (
          <Select
            value={selectedLabelRowId ? String(selectedLabelRowId) : NO_LABEL}
            onValueChange={(v) =>
              ctrl.handleLabelChange(v === NO_LABEL ? undefined : Number(v))
            }
          >
            <SelectItem value={NO_LABEL} label={t("form.noLabel")} />
            {labels.map((l) => (
              <SelectItem
                key={l.rowId}
                value={String(l.rowId)}
                label={l.labelName}
                prefixIcon={
                  <span
                    aria-hidden
                    className="size-[10px] rounded-full"
                    style={{ background: getPaletteByColor(l.color).color }}
                  />
                }
              />
            ))}
          </Select>
        )}
      </Field>

      <Switch
        label={t("form.allDay")}
        checked={isAllDay}
        onCheckedChange={ctrl.handleAllDayChange}
      />

      {dateField("start", startDate, ctrl.setStartDay, ctrl.setStartTime)}
      {dateField("end", endDate, ctrl.setEndDay, ctrl.setEndTime)}

      <Field label={t("form.recurrence")}>
        <Select
          value={recurrence}
          onValueChange={(v) =>
            ctrl.handleRecurrenceChange(
              v as (typeof RECURRENCE_OPTIONS)[number],
            )
          }
        >
          {RECURRENCE_OPTIONS.map((o) => (
            <SelectItem key={o} value={o} label={t(`recurrence.${o}`)} />
          ))}
        </Select>
      </Field>

      <Field label={t("form.reminder")}>
        <Select
          multiple
          placeholder={t("form.noReminder")}
          value={selectedReminders.map(String)}
          onValueChange={(v) => ctrl.handleRemindersChange(v.map(Number))}
        >
          {REMINDER_OPTIONS.map((m) => (
            <SelectItem key={m} value={String(m)} label={t(reminderKey(m))} />
          ))}
        </Select>
      </Field>

      <Field label={t("form.location")}>
        <Input
          {...form.register("location")}
          placeholder={t("form.locationPlaceholder")}
          maxLength={LOCATION_MAX}
        />
      </Field>

      <Field label={t("form.description")} maxGraphemeCount={CONTENT_MAX}>
        <Textarea
          {...form.register("description", { maxLength: CONTENT_MAX })}
          rows={3}
          placeholder={t("form.descriptionPlaceholder")}
        />
      </Field>
    </div>
  );
}
