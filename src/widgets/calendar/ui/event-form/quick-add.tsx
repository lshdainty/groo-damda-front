import { useSaveFailureText } from "@/shared/lib/save-failure-text";
import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { format, isSameDay } from "date-fns";

import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import { Button } from "@/shared/ds/button";
import { Callout } from "@/shared/ds/callout";
import {
  Dialog,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogFooter,
} from "@/shared/ds/dialog";
import { dayKey, formatDateValue, parseDayKey } from "@/shared/ds/date-picker";
import { Field } from "@/shared/ds/field";
import { Input } from "@/shared/ds/input";
import { InputButton } from "@/shared/ds/input-button";
import { Select, SelectItem } from "@/shared/ds/select";
import { Switch } from "@/shared/ds/switch";
import { useUserCalendars } from "@/features/user-calendar";
import { isCalendarShown } from "@/entities/user-calendar";
import { TITLE_MAX } from "@/widgets/calendar/model/use-event-form";
import { DayPickSurface } from "./pickers";

import type { CalendarEventFormValues } from "@/entities/calendar";

/** 빠른 추가가 "자세히" 로 넘기는 값 */
export interface QuickAddDraft {
  /** 빠른 추가에서 바꾼 값이 있다 — 일정 폼이 닫을 때 묻는다 */
  dirty: boolean;
  title: string;
  isAllDay: boolean;
  calendarRowId?: number;
  start: Date;
  end: Date;
}

/**
 * 빠른 추가 (I-09 33 · 34, 사용자 결정 Q1-B) — 1280 이상에서 날을 한 번 더 누르거나 패널 "추가" · 제목 줄 · 끌어 고른 기간으로 뜨는
 * 가운데 작은 ds Dialog 480. 칸 넷(제목 · 날짜 + 종일 · 캘린더) 뿐이고 "자세히" 는 쓴 값을 들고 일정 폼 대화상자로 간다.
 * 바깥 누르기로 닫히지 않고(입력 폼), 쓴 게 있으면 닫기 전에 묻는다. 팝오버가 아니라 대화상자라 날짜 팝오버가 그 위에 뜬다(L3).
 * 저장 본문은 일정 폼과 같은 모양 — 종일이 아니면 09:00 ~ 10:00.
 */
export function QuickAddDialog({
  start,
  end,
  isLoading,
  saveError = false,
  saveErrorDetail,
  onClose,
  onDetail,
  onSave,
}: {
  start: Date;
  end: Date;
  isLoading?: boolean;
  /** 저장 실패 — 맨 위 critical Callout, 값은 그대로 */
  saveError?: boolean;
  /** 저장 실패의 오류 — 결과를 확인하지 못한 쓰기면 글이 바뀐다 */
  saveErrorDetail?: unknown;
  onClose: () => void;
  onDetail: (draft: QuickAddDraft) => void;
  onSave: (values: CalendarEventFormValues) => void;
}) {
  const { t } = useTranslation("calendar");
  const { t: tc } = useTranslation("common");
  const sft = useSaveFailureText();
  const { data: userCalendars = [] } = useUserCalendars({ reference: true });
  const calendars = userCalendars.filter(isCalendarShown);
  const defaultCalendar = calendars.find((c) => c.isDefault) ?? calendars[0];

  const [title, setTitle] = useState("");
  const [day, setDay] = useState({ start, end });
  const [allDay, setAllDay] = useState(true);
  const [calendarId, setCalendarId] = useState<number | undefined>();
  const [showError, setShowError] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  // 저장 실패 알림이 화면 밖에 뜨지 않게 맨 위로(큰 글자에서 본문이 스크롤될 때)
  useEffect(() => {
    if (saveError) errorRef.current?.scrollIntoView({ block: "nearest" });
  }, [saveError]);
  const [today] = useState(() => new Date());

  const calendar =
    calendars.find((c) => c.rowId === calendarId) ?? defaultCalendar;
  const range = !isSameDay(day.start, day.end);
  const dateText = range
    ? `${formatDateValue(day.start, today)} ~ ${formatDateValue(day.end, today)}`
    : formatDateValue(day.start, today);
  const dirty =
    title !== "" ||
    !allDay ||
    calendarId !== undefined ||
    !isSameDay(day.start, start) ||
    !isSameDay(day.end, end);

  const detail = () =>
    onDetail({
      dirty,
      title,
      isAllDay: allDay,
      calendarRowId: calendar?.rowId,
      start: day.start,
      end: day.end,
    });

  const save = () => {
    if (isLoading) return;
    if (!title) {
      setShowError(true);
      return;
    }
    const s = format(day.start, "yyyy-MM-dd");
    const e = format(day.end, "yyyy-MM-dd");
    onSave({
      title,
      description: null,
      eventType: "PERSONAL",
      color: calendar?.color ?? "",
      startDate: allDay ? s : `${s}T09:00`,
      endDate: allDay ? e : `${e}T10:00`,
      isAllDay: allDay,
      labelRowId: null,
      location: null,
      rrule: null,
      reminderMinutes: [],
      calendarRowId: calendar?.rowId,
    });
  };

  return (
    <Dialog
      open
      form
      dirty={dirty}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      busy={isLoading ?? false}
    >
      <DialogContent
        title={t("addEvent")}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          document
            .querySelector<HTMLInputElement>("[data-slot=quick-add-title]")
            ?.focus();
        }}
      >
        <DialogBody>
          <div className="flex flex-col gap-x6 pb-x2">
            {saveError && (
              <div ref={errorRef}>
                <Callout tone="critical" role="alert">
                  {sft(saveErrorDetail, t("form.saveFailed"))}
                </Callout>
              </div>
            )}
            <Field
              label={t("form.title")}
              showRequiredIndicator
              invalid={showError && !title}
              errorMessage={t("form.titleRequired")}
            >
              <Input
                data-slot="quick-add-title"
                value={title}
                placeholder={t("form.titlePlaceholder")}
                maxLength={TITLE_MAX}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setShowError(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    save();
                  }
                }}
              />
            </Field>
            <div className="flex items-end gap-x3">
              <Field
                label={t("form.startDay")}
                showRequiredIndicator
                className="min-w-0 flex-1"
              >
                <DayPickSurface
                  title={t("form.startDay")}
                  value={dayKey(day.start)}
                  onConfirm={(d) => {
                    const date = parseDayKey(d);
                    if (date) setDay({ start: date, end: date });
                  }}
                  trigger={({ open, onClick }) => (
                    <InputButton
                      value={dateText}
                      suffixIcon={<CalendarDays />}
                      aria-haspopup="dialog"
                      aria-expanded={open}
                      onClick={onClick}
                    />
                  )}
                />
              </Field>
              <div className="flex h-[40px] shrink-0 items-center">
                <Switch
                  label={t("form.allDay")}
                  checked={allDay}
                  onCheckedChange={setAllDay}
                />
              </div>
            </div>
            <Field label={t("form.calendar")} showRequiredIndicator>
              <Select
                value={calendar ? String(calendar.rowId) : undefined}
                onValueChange={(v) => setCalendarId(Number(v))}
              >
                {calendars.map((c) => (
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
            </Field>
          </div>
        </DialogBody>
        <DialogFooter>
          {/* [자세히] 는 모달 바닥의 왼쪽 자리(수정 폼의 [삭제] 가 서는 곳)에 ghost — 오른쪽은 입력 폼 바닥 그대로 [취소][저장] */}
          <Button
            variant="ghost"
            ghostColor="neutral"
            className="mr-auto"
            onClick={detail}
          >
            {t("quickAdd.detail")}
          </Button>
          <DialogCancel>{tc("cancel")}</DialogCancel>
          <Button loading={isLoading} onClick={save}>
            {tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
