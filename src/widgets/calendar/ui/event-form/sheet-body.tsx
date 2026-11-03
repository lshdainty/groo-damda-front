import { useState, type ReactNode } from "react";
import {
  Bell,
  Calendar,
  ChevronRight,
  Clock,
  MapPin,
  Repeat,
  Sun,
  Tag,
  Text,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import { Field } from "@/shared/ds/field";
import { Input } from "@/shared/ds/input";
import {
  List,
  ListButtonItem,
  ListItem,
  ListSwitchItem,
} from "@/shared/ds/list";
import { formatDateValue, parseDayKey } from "@/shared/ds/date-picker";
import { formatTimeValue } from "@/shared/ds/time-picker";
import {
  RECURRENCE_OPTIONS,
  REMINDER_OPTIONS,
  TITLE_MAX,
} from "@/widgets/calendar/model/use-event-form";
import {
  ChoiceSheet,
  DayPickSurface,
  MultiChoiceSheet,
  TimePickSurface,
} from "./pickers";
import { DotValue } from "@/widgets/calendar/ui/dot-value";
import { NO_LABEL, reminderKey, type EventFormView } from "./types";

const ROW_ICON = "size-[22px]";

/** 날짜 · 시각 조각 — 누르는 자리 44 이상, 글은 자르지 않고 줄을 바꾼다(time-picker.md:71). 줄 높이는 다른 줄과 같게 위아래로 블리드한다(44 − 22 의 절반 11, list.md "위아래로 블리드해 줄 높이를 바꾸지 않는다") */
function Piece({
  label,
  onClick,
  expanded,
  buttonRef,
  children,
}: {
  label: string;
  onClick: () => void;
  expanded: boolean;
  buttonRef?: React.Ref<HTMLButtonElement>;
  children: ReactNode;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      onClick={onClick}
      className="-my-[11px] min-h-[44px] cursor-pointer rounded-r2 border-0 bg-transparent px-x1 text-t5 text-fg-neutral-subtle hover:bg-bg-neutral-weak-pressed focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-stroke-focus-ring"
    >
      {children}
    </button>
  );
}

/**
 * 일정 폼 시트 본문 (I-09 22 ~ 28) — 제목 입력칸 + List 줄 칸 아홉(캘린더 · 라벨 · 종일 · 시작 · 종료 · 반복 · 알림 · 장소 · 설명).
 * 고르는 칸은 그 위에 고르기 시트가 뜨고, 장소 · 설명은 같은 시트 안에서 한 단계 들어간다(`onStep`).
 */
export function EventFormSheetBody({
  view,
  onStep,
}: {
  view: EventFormView;
  onStep: (step: "location" | "description") => void;
}) {
  const { t } = useTranslation("calendar");
  const { ctrl, labels, showErrors, titleEmpty, rangeError, endRef } = view;
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
    location,
    description,
  } = ctrl;
  const [today] = useState(() => new Date());

  const cal = selectableCalendars.find(
    (c) => c.rowId === selectedCalendarRowId,
  );
  const label = labels.find((l) => l.rowId === selectedLabelRowId);
  const none = t("form.none");

  const dayText = (day: string) => formatDateValue(parseDayKey(day), today);
  const timeText = (hhmm: string) =>
    formatTimeValue({
      hour: Number(hhmm.slice(0, 2)),
      minute: Number(hhmm.slice(3, 5)),
    });
  const reminderText =
    selectedReminders.length === 0
      ? t("form.noReminder")
      : selectedReminders.map((m) => t(reminderKey(m))).join(", ");

  const dateRow = (
    kind: "start" | "end",
    value: string,
    setDay: (d: string) => void,
    setTime: (h: string) => void,
  ) => {
    const day = value.slice(0, 10);
    const time = value.slice(11, 16);
    const dayName = t(`form.${kind}Day`);
    const timeName = t(`form.${kind}Time`);
    return (
      <ListItem
        prefix={<Clock className={ROW_ICON} />}
        title={t(`form.${kind}`)}
        suffixText
        suffix={
          <span className="-mr-x1 flex flex-wrap items-center justify-end gap-y-[22px] @max-[calc(16rem+48px)]/list-item:mr-0 @max-[calc(16rem+48px)]/list-item:-ml-x1">
            <DayPickSurface
              title={dayName}
              value={day}
              onConfirm={setDay}
              trigger={({ open, onClick }) => (
                <Piece
                  buttonRef={kind === "end" ? endRef : undefined}
                  label={`${dayName}, ${dayText(day)}`}
                  expanded={open}
                  onClick={onClick}
                >
                  {dayText(day)}
                </Piece>
              )}
            />
            {!isAllDay && time && (
              <TimePickSurface
                title={timeName}
                value={time}
                onConfirm={setTime}
                trigger={({ open, onClick }) => (
                  <Piece
                    label={`${timeName}, ${timeText(time)}`}
                    expanded={open}
                    onClick={onClick}
                  >
                    {timeText(time)}
                  </Piece>
                )}
              />
            )}
          </span>
        }
      />
    );
  };

  return (
    <>
      <Field
        label={t("form.title")}
        invalid={showErrors && titleEmpty}
        errorMessage={t("form.titleRequired")}
        labelHidden
        className="pb-x2 pt-x1"
      >
        <Input
          size="large"
          {...form.register("title", { maxLength: TITLE_MAX })}
          placeholder={t("form.titlePlaceholder")}
          maxLength={TITLE_MAX}
        />
      </Field>

      <div className="-mx-x6">
        <List aria-label={t("form.rows")}>
          {selectableCalendars.length > 0 ? (
            <ChoiceSheet
              title={t("form.calendar")}
              selected={selectedCalendarRowId as number | undefined}
              items={selectableCalendars.map((c) => ({
                value: c.rowId as number | undefined,
                label: c.calendarName,
                dot: getPaletteByColor(c.color).color,
              }))}
              onPick={(v) => v != null && ctrl.handleCalendarChange(v)}
              trigger={({ onClick }) => (
                <ListButtonItem
                  prefix={<Calendar className={ROW_ICON} />}
                  title={t("form.calendar")}
                  suffixText
                  suffix={
                    cal ? (
                      <DotValue color={getPaletteByColor(cal.color).color}>
                        {cal.calendarName}
                      </DotValue>
                    ) : (
                      none
                    )
                  }
                  onClick={onClick}
                />
              )}
            />
          ) : (
            <ListButtonItem
              prefix={<Calendar className={ROW_ICON} />}
              title={t("form.calendar")}
              suffix={calendarsLoading ? "" : t("form.calendarLoadFailed")}
              onClick={() => void refetchCalendars()}
            />
          )}

          <ChoiceSheet
            title={t("form.label")}
            selected={(selectedLabelRowId ?? NO_LABEL) as string | number}
            items={[
              { value: NO_LABEL as string | number, label: t("form.noLabel") },
              ...labels.map((l) => ({
                value: l.rowId as string | number,
                label: l.labelName,
                dot: getPaletteByColor(l.color).color,
              })),
            ]}
            footnote={labels.length === 0 ? t("form.labelHint") : undefined}
            onPick={(v) =>
              ctrl.handleLabelChange(v === NO_LABEL ? undefined : Number(v))
            }
            trigger={({ onClick }) => (
              <ListButtonItem
                prefix={<Tag className={ROW_ICON} />}
                title={t("form.label")}
                suffixText
                suffix={
                  label ? (
                    <DotValue color={getPaletteByColor(label.color).color}>
                      {label.labelName}
                    </DotValue>
                  ) : (
                    t("form.noLabel")
                  )
                }
                onClick={onClick}
              />
            )}
          />

          <ListSwitchItem
            prefix={<Sun className={ROW_ICON} />}
            title={t("form.allDay")}
            checked={isAllDay}
            onCheckedChange={ctrl.handleAllDayChange}
          />

          {dateRow("start", startDate, ctrl.setStartDay, ctrl.setStartTime)}
          {dateRow("end", endDate, ctrl.setEndDay, ctrl.setEndTime)}
        </List>

        {rangeError && (
          <p role="alert" className="m-0 px-x6 pb-x2 text-t3 text-fg-critical">
            {t("form.endBeforeStart")}
          </p>
        )}

        <List aria-label={t("form.rowsMore")}>
          <ChoiceSheet
            title={t("form.recurrence")}
            selected={recurrence as string}
            items={RECURRENCE_OPTIONS.map((o) => ({
              value: o as string,
              label: t(`recurrence.${o}`),
            }))}
            onPick={(v) =>
              ctrl.handleRecurrenceChange(
                v as (typeof RECURRENCE_OPTIONS)[number],
              )
            }
            trigger={({ onClick }) => (
              <ListButtonItem
                prefix={<Repeat className={ROW_ICON} />}
                title={t("form.recurrence")}
                suffix={t(`recurrence.${recurrence}`)}
                onClick={onClick}
              />
            )}
          />

          <MultiChoiceSheet
            title={t("form.reminder")}
            selected={selectedReminders}
            items={REMINDER_OPTIONS.map((m) => ({
              value: m,
              label: t(reminderKey(m)),
            }))}
            onConfirm={ctrl.handleRemindersChange}
            trigger={({ onClick }) => (
              <ListButtonItem
                prefix={<Bell className={ROW_ICON} />}
                title={t("form.reminder")}
                suffix={reminderText}
                onClick={onClick}
              />
            )}
          />

          <ListButtonItem
            prefix={<MapPin className={ROW_ICON} />}
            title={t("form.location")}
            suffixText
            suffix={
              <>
                <span className="whitespace-pre-wrap">{location || none}</span>
                <ChevronRight aria-hidden className="size-[18px]" />
              </>
            }
            onClick={() => onStep("location")}
          />
          <ListButtonItem
            prefix={<Text className={ROW_ICON} />}
            title={t("form.description")}
            suffixText
            suffix={
              <>
                <span className="line-clamp-2 whitespace-pre-wrap">
                  {description || none}
                </span>
                <ChevronRight aria-hidden className="size-[18px]" />
              </>
            }
            onClick={() => onStep("description")}
          />
        </List>
      </div>
    </>
  );
}
