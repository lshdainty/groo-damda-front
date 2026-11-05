import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ds/button";
import { Callout } from "@/shared/ds/callout";
import { useScrollToError } from "@/shared/hooks/useScrollToError";
import { ChipRadio, ChipRadioGroup } from "@/shared/ds/chip";
import {
  DatePicker,
  dayKey,
  formatDateValue,
  parseDayKey,
} from "@/shared/ds/date-picker";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetFooter,
} from "@/shared/ds/bottom-sheet";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogCancel,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "@/shared/ds/dialog";
import { Field } from "@/shared/ds/field";
import { Input } from "@/shared/ds/input";
import { InputButton, useInputButtonSurface } from "@/shared/ds/input-button";
import {
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverFooter,
  PopoverTrigger,
} from "@/shared/ds/popover";
import { Select, SelectItem } from "@/shared/ds/select";
import { Textarea } from "@/shared/ds/textarea";
import { dueKey } from "@/pages/todo/model/todo-ledger";
import {
  NO_TAG_KEY,
  tagValueToPayload,
  todoTagInitialValue,
} from "@/pages/todo/lib/todo-tags";
import { PRIO_KEYS } from "@/pages/todo/model/todo-ledger";
import type { Todo, TodoFormValues, TodoPriority } from "@/entities/todo";

/**
 * 제목·본문 입력 상한 — 서버 `FieldLimits`(TITLE_MAX 200 · CONTENT_MAX 10,000)와 같은 값.
 *
 * 종전엔 제한이 없어 500자 제목이 그대로 나갔고 서버가 컬럼 초과를 500 으로 냈다(QA #24).
 * 서버는 이제 400 으로 거절하지만, 다이얼로그가 열린 채 아무 말도 안 하는 건 그대로라
 * 애초에 못 넘게 막는다. `maxLength` 는 타이핑·붙여넣기를 브라우저가 자르고,
 * `slice` 는 프로그램 입력(자동완성·확장)까지 자른다.
 */
const TITLE_MAX = 200;
const CONTENT_MAX = 10_000;

/** 마감일 칸 — Input Button 하나가 Date Picker 를 연다(1280 이상 팝오버 · 미만 시트). 지울 수 있다(비우면 마감일 없음 — QA #111) */
function DueDateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { t } = useTranslation("todo");
  const surface = useInputButtonSurface();
  const [open, setOpen] = useState(false);
  const current = value ? parseDayKey(value) : undefined;
  const [draft, setDraft] = useState<Date | undefined>(current);
  const label = t("form.dueDate");
  const trigger = (
    <InputButton
      placeholder={t("form.dueDatePlaceholder")}
      value={current ? formatDateValue(current, new Date()) : ""}
      suffixIcon={<CalendarDays />}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClear={value ? () => onChange("") : undefined}
      onClick={() => {
        setDraft(current);
        setOpen(true);
      }}
    />
  );
  const sheet = surface === "sheet";
  const picker = (
    <DatePicker
      selection="single"
      // 폼의 날짜 칸 = 한 달(date-picker.md:61 · :110) — 이어지는 달은 기간 시트 모양이다
      visibleRange="month"
      aria-label={label}
      value={draft}
      onValueChange={setDraft}
      autoFocus
    />
  );
  const done = (
    <Button
      disabled={!draft}
      onClick={() => {
        if (draft) onChange(dayKey(draft));
        setOpen(false);
      }}
    >
      {t("tdm.apply")}
    </Button>
  );
  return (
    <Field label={label}>
      {sheet ? (
        <BottomSheet open={open} onOpenChange={setOpen}>
          {trigger}
          <BottomSheetContent title={label}>
            <BottomSheetBody>{picker}</BottomSheetBody>
            <BottomSheetFooter>{done}</BottomSheetFooter>
          </BottomSheetContent>
        </BottomSheet>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent aria-label={label} align="start">
            <PopoverBody>{picker}</PopoverBody>
            <PopoverFooter>{done}</PopoverFooter>
          </PopoverContent>
        </Popover>
      )}
    </Field>
  );
}

/**
 * 할 일 추가 · 수정 폼 — ds Responsive Dialog(1280 이상 대화상자 · 미만 Bottom Sheet) 입력 폼(I-10 20).
 * 칸은 한 줄에 하나씩 세로로: 제목(필수 점) · 마감일(Input Button + Date Picker, 새 할 일은 오늘) · 태그(Select, "태그 없음" 맨 앞) ·
 * 우선순위(Chip 하나 고르기) · 메모. 값이 바뀐 채 닫으면 "작성한 내용이 사라져요" 를 묻고, 바깥 누름 · 끌어내림으로는 닫히지 않는다.
 * 주 버튼은 켜 두고 누를 때 검증한다(제목이 비면 칸 아래 오류 + 초점).
 */
export function TodoFormDialog({
  todo,
  today,
  tags,
  onClose,
  onSave,
  submitting,
  saveFailed,
  saveError,
}: {
  todo: Todo | null;
  today: string;
  tags: string[];
  onClose: () => void;
  onSave: (values: TodoFormValues, id?: number) => void;
  submitting?: boolean;
  /** 저장 요청이 실패했다 — 폼 맨 위 critical Callout(고정 글), 폼은 열린 채 · 쓴 값 그대로 */
  saveFailed?: boolean;
  /** 실패마다 새 값 — 같은 실패가 이어져도 Callout 을 다시 보이게 올린다 */
  saveError?: unknown;
}) {
  const { t } = useTranslation("todo");
  const { t: tc } = useTranslation("common");
  const isNew = !todo;
  const initial = {
    title: todo?.title ?? "",
    due: dueKey(todo?.dueDate) ?? (todo ? "" : today),
    tag: todoTagInitialValue(todo),
    priority: (todo?.priority ?? "MEDIUM") as TodoPriority,
    note: todo?.content ?? "",
  };
  const [title, setTitle] = useState(initial.title);
  const [due, setDue] = useState(initial.due);
  const [tag, setTag] = useState(initial.tag);
  const [priority, setPriority] = useState<TodoPriority>(initial.priority);
  const [note, setNote] = useState(initial.note);
  const [showError, setShowError] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const dirty =
    title !== initial.title ||
    due !== initial.due ||
    tag !== initial.tag ||
    priority !== initial.priority ||
    note !== initial.note;
  const titleEmpty = !title.trim();

  const errorRef = useScrollToError<HTMLDivElement>(!!saveFailed, saveError);
  const submit = () => {
    if (submitting) return;
    if (titleEmpty) {
      setShowError(true);
      titleRef.current?.focus();
      return;
    }
    onSave(
      {
        title: title.trim(),
        content: note,
        priority,
        // sentinel 은 서버로 안 나간다 — 태그를 떼는 건 null 이다(키를 빼면 옛 값이 남는다).
        category: tagValueToPayload(tag),
        // 마감일도 같다 — 이 편집기가 그리는 칸이라 비운 채 저장하면 지워져야 한다.
        // `undefined` 로 키를 빼면 화면은 지워진 척 닫히고 옛 마감일이 남았다(QA #111).
        dueDate: due || null,
      },
      todo?.rowId,
    );
  };

  // 목록에 없는 지금 값은 지킨다(백필 전 · 다른 기기가 만든 태그)
  const options =
    tags.includes(tag) || tag === NO_TAG_KEY ? tags : [tag, ...tags];

  return (
    <ResponsiveDialog
      open
      form
      dirty={dirty}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <ResponsiveDialogContent
        title={isNew ? t("newTodo") : t("editTodoTitle")}
        // 새 할 일만 제목 칸에 초점 — 수정은 표면이 받는다(폰에서 키보드가 가리지 않게)
        onOpenAutoFocus={(e) => {
          if (!isNew) return;
          e.preventDefault();
          titleRef.current?.focus({ preventScroll: true });
        }}
      >
        <ResponsiveDialogBody>
          {saveFailed && (
            <div ref={errorRef}>
              <Callout tone="critical" role="alert" className="mb-x4">
                {t("saveFailed")}
              </Callout>
            </div>
          )}
          <div className="flex flex-col gap-x4 pb-x2">
            <Field
              label={t("form.title")}
              showRequiredIndicator
              invalid={showError && titleEmpty}
              errorMessage={t("form.titleRequired")}
            >
              <Input
                ref={titleRef}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value.slice(0, TITLE_MAX));
                  if (showError) setShowError(false);
                }}
                placeholder={t("editTitlePlaceholder")}
                maxLength={TITLE_MAX}
              />
            </Field>
            <DueDateField value={due} onChange={setDue} />
            <Field
              label={t("tag")}
              description={tags.length === 0 ? t("tagEmptyHint") : undefined}
            >
              <Select value={tag} onValueChange={setTag}>
                <SelectItem value={NO_TAG_KEY} label={t("noTag")} />
                {options.map((opt) => (
                  <SelectItem key={opt} value={opt} label={opt} />
                ))}
              </Select>
            </Field>
            <Field label={t("form.priority")}>
              <ChipRadioGroup
                aria-label={t("form.priority")}
                value={priority}
                onValueChange={(v) => setPriority(v as TodoPriority)}
              >
                {PRIO_KEYS.map((k) => (
                  <ChipRadio
                    key={k}
                    value={k}
                    variant="outlineWeak"
                    size="medium"
                  >
                    {t(`prio.${k}`)}
                  </ChipRadio>
                ))}
              </ChipRadioGroup>
            </Field>
            <Field label={t("form.memo")}>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, CONTENT_MAX))}
                placeholder={t("form.memoPlaceholder")}
                maxLength={CONTENT_MAX}
              />
            </Field>
          </div>
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <ResponsiveDialogCancel>{tc("cancel")}</ResponsiveDialogCancel>
          <Button loading={submitting} onClick={submit}>
            {isNew ? tc("add") : tc("save")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
