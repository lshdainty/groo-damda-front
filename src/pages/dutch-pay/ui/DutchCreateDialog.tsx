import { useRef, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/shared/ds/avatar";
import { Button } from "@/shared/ds/button";
import { Callout } from "@/shared/ds/callout";
import { Chip, ChipGroup, InputChip } from "@/shared/ds/chip";
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
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "@/shared/ds/dialog";
import { Field } from "@/shared/ds/field";
import { Input } from "@/shared/ds/input";
import { InputButton, useInputButtonSurface } from "@/shared/ds/input-button";
import { useWideSurface } from "@/shared/ds/overlay";
import {
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverFooter,
  PopoverTrigger,
} from "@/shared/ds/popover";
import { Select, SelectItem } from "@/shared/ds/select";
import { useScrollToError } from "@/shared/hooks/useScrollToError";
import { AmountInput } from "@/shared/ui/groo/amount-input";
import { parseAmount } from "@/shared/lib/groo/amount";
import { KRW } from "@/shared/lib/groo/format";
import {
  PARTICIPANT_NAME_MAX,
  computeShares,
  type DutchPayFormValues,
} from "@/entities/dutch-pay";
import { resolveAddParticipant } from "../lib/participants";

const MY_NAME = "나";

/** 날짜 칸 — Input Button 하나가 Date Picker 를 연다(1280 이상 팝오버 · 미만 시트). 기본은 오늘 */
function DateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { t } = useTranslation("dutchPay");
  const { t: tc } = useTranslation("common");
  const surface = useInputButtonSurface();
  const [open, setOpen] = useState(false);
  const current = parseDayKey(value);
  const [draft, setDraft] = useState<Date | undefined>(current);
  const label = t("dateLabel");
  const trigger = (
    <InputButton
      value={formatDateValue(current, new Date())}
      suffixIcon={<CalendarDays />}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => {
        setDraft(current);
        setOpen(true);
      }}
    />
  );
  const picker = (
    <DatePicker
      selection="single"
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
      {tc("done")}
    </Button>
  );
  return (
    <Field label={label}>
      {surface === "sheet" ? (
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
 * 정산 만들기(I-15 35 ~ 37, 7-1A) — 두 단계. 1280 미만 Bottom Sheet · 이상 Dialog 480(입력 폼 — 바깥 누름으로 안 닫히고 바뀐 값이 있으면 묻는다).
 * 머리 = 위 작은 글 "1 / 2단계" + 제목("정산 정보" · "참여자"). 1단계: 이름 · 총 금액 · 날짜 · 장소(선택), 한 줄에 하나.
 * 2단계: "{n}명 · 1인당 …" · 참여자 입력값 칩(나는 × 없음) + 이름 칸 + [추가] · 함께 정산했던 사람 제안 칩 · 결제한 사람 Select.
 * 몫은 `computeShares`(남는 원은 결제자) — 저장 본문은 그대로다. 저장 실패는 폼 맨 위 Callout(`saveError`).
 */
export function DutchCreateDialog({
  today,
  friendNames,
  saveError,
  saveErrorSeq,
  onClose,
  onCreate,
}: {
  today: string;
  friendNames: string[];
  saveError: boolean;
  saveErrorSeq: number;
  onClose: () => void;
  /** 만든다 — 성공이면 호출처가 닫는다. 실패하면 saveError 를 켠다 */
  onCreate: (values: DutchPayFormValues) => Promise<void>;
}) {
  const { t } = useTranslation("dutchPay");
  const wide = useWideSurface();
  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState("");
  const [totalStr, setTotalStr] = useState("");
  const [date, setDate] = useState(today);
  const [place, setPlace] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [extras, setExtras] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [addHint, setAddHint] = useState<string | null>(null);
  const [payerName, setPayerName] = useState(MY_NAME);
  const [peopleError, setPeopleError] = useState(false);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const errorRef = useScrollToError<HTMLDivElement>(saveError, saveErrorSeq);

  const total = parseAmount(totalStr);
  const names = [MY_NAME, ...picked];
  const candidates = [...friendNames, ...extras];
  const suggestions = friendNames.filter(
    (n, i) =>
      n !== MY_NAME && !picked.includes(n) && friendNames.indexOf(n) === i,
  );
  const dirty =
    title !== "" ||
    totalStr !== "" ||
    date !== today ||
    place !== "" ||
    picked.length > 0;

  const shares = computeShares(
    "EQUAL",
    total,
    names.map((n) => ({ isPayer: n === payerName, ratio: 1, custom: 0 })),
    true,
  );
  const per = shares.perPerson;
  const restIdx = shares.amounts.findIndex((a) => a !== per);
  const restName = restIdx >= 0 ? names[restIdx] : null;
  const summary =
    restName != null
      ? t("peopleSummaryRest", {
          count: names.length,
          amount: `${KRW(per)}원`,
          extra: KRW(Math.abs(shares.amounts[restIdx]! - per)),
          name: restName,
        })
      : t("peopleSummary", { count: names.length, amount: `${KRW(per)}원` });

  const goNext = () => {
    setShowErrors(true);
    if (!title.trim()) {
      titleRef.current?.focus();
      return;
    }
    if (total <= 0) return;
    setStep(2);
  };

  const pick = (name: string) => {
    setPicked((p) => (p.includes(name) ? p : [...p, name]));
    setPeopleError(false);
  };
  const unpick = (name: string) => {
    setPicked((p) => p.filter((n) => n !== name));
    // 빠진 사람이 결제자였으면 나로 되돌린다
    if (name === payerName) setPayerName(MY_NAME);
  };
  const addName = () => {
    const r = resolveAddParticipant(
      newName,
      candidates,
      new Set(names),
      MY_NAME,
    );
    if (r.kind === "empty") return;
    if (r.kind === "isMe") return setAddHint(t("addMeAlready"));
    if (r.kind === "already")
      return setAddHint(t("alreadyAdded", { name: r.name }));
    if (r.kind === "added") setExtras((e) => [...e, r.name]);
    pick(r.name);
    setNewName("");
    setAddHint(null);
  };

  const submit = async () => {
    // 이중 제출 막기 — await 앞에서 잠근다
    if (submitting.current) return;
    if (picked.length < 1) {
      setPeopleError(true);
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      await onCreate({
        title: title.trim(),
        description: place.trim() || undefined,
        totalAmount: total,
        splitMethod: "EQUAL",
        dutchPayDate: date,
        participants: names.map((name, i) => ({
          userRowId: null,
          participantName: name,
          amount: shares.amounts[i] ?? 0,
          isPayer: name === payerName,
        })),
      });
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const heading = (
    <span className="flex flex-col">
      <span className="text-t3 font-normal text-fg-neutral-subtle">
        {t("stepOf", { step, total: 2 })}
      </span>
      <span>{step === 1 ? t("step1Title") : t("step2Title")}</span>
    </span>
  );

  const size = wide ? undefined : "large";
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
        title={heading}
        aria-describedby={undefined}
        // 새 폼만 첫 칸에 초점(1단계 이름)
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          titleRef.current?.focus({ preventScroll: true });
        }}
      >
        <ResponsiveDialogBody scrollFog>
          {saveError && (
            <div ref={errorRef}>
              <Callout tone="critical" role="alert" className="mb-x4">
                {t("createFailed")}
              </Callout>
            </div>
          )}
          {step === 1 ? (
            <div className="flex flex-col gap-x5 pb-x2">
              <Field
                label={t("nameLabel")}
                showRequiredIndicator
                invalid={showErrors && !title.trim()}
                errorMessage={t("nameRequired")}
              >
                <Input
                  ref={titleRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("namePlaceholder")}
                  maxLength={200}
                />
              </Field>
              <Field
                label={t("form.totalAmount")}
                showRequiredIndicator
                invalid={showErrors && total <= 0}
                errorMessage={t("totalRequired")}
              >
                <AmountInput value={totalStr} onValueChange={setTotalStr} />
              </Field>
              <DateField value={date} onChange={setDate} />
              <Field label={t("placeLabel")} indicator={t("optional")}>
                <Input
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  placeholder={t("placePlaceholder")}
                  maxLength={200}
                />
              </Field>
            </div>
          ) : (
            <div className="flex flex-col gap-x5 pb-x2">
              <p className="m-0 text-t5 text-fg-neutral">{summary}</p>
              <Field
                label={t("participantsLabel")}
                invalid={peopleError}
                errorMessage={t("peopleNeeded")}
              >
                <ChipGroup aria-label={t("participantsLabel")} layout="wrap">
                  <Chip
                    size="small"
                    variant="outlineWeak"
                    selected
                    tabIndex={-1}
                    aria-label={MY_NAME}
                    prefixIcon={<Avatar name={MY_NAME} size={20} />}
                  >
                    {MY_NAME}
                  </Chip>
                  {picked.map((n) => (
                    <InputChip
                      key={n}
                      size="small"
                      prefixIcon={<Avatar name={n} size={20} />}
                      removeLabel={t("removeName", { name: n })}
                      onRemove={() => unpick(n)}
                    >
                      {n}
                    </InputChip>
                  ))}
                </ChipGroup>
                <div className="mt-x2 flex items-start gap-x2">
                  <div className="min-w-0 flex-1">
                    <Input
                      size="large"
                      value={newName}
                      maxLength={PARTICIPANT_NAME_MAX}
                      placeholder={t("fromTx.addNamePlaceholder")}
                      aria-label={t("participantsLabel")}
                      onChange={(e) => {
                        setNewName(e.target.value);
                        setAddHint(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          addName();
                        }
                      }}
                    />
                    {addHint && (
                      <p className="m-0 pt-x1 text-t4 text-fg-neutral-subtle">
                        {addHint}
                      </p>
                    )}
                  </div>
                  <Button variant="neutralWeak" size="large" onClick={addName}>
                    {t("addButton")}
                  </Button>
                </div>
              </Field>
              {suggestions.length > 0 && (
                <Field label={t("pastFriendsLabel")}>
                  <ChipGroup aria-label={t("pastFriendsLabel")} layout="wrap">
                    {suggestions.map((n) => (
                      <Chip
                        key={n}
                        size="small"
                        variant="outlineWeak"
                        prefixIcon={<Plus />}
                        onClick={() => pick(n)}
                      >
                        {n}
                      </Chip>
                    ))}
                  </ChipGroup>
                </Field>
              )}
              <Field label={t("payerLabel")}>
                <Select value={payerName} onValueChange={setPayerName}>
                  {names.map((n) => (
                    <SelectItem key={n} value={n} label={n} />
                  ))}
                </Select>
              </Field>
            </div>
          )}
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          {step === 1 ? (
            <Button
              size={size}
              className={wide ? undefined : "w-full"}
              variant="neutralSolid"
              onClick={goNext}
            >
              {t("next")}
            </Button>
          ) : (
            <div
              className={
                wide ? "flex w-full items-center" : "flex w-full gap-x2"
              }
            >
              <Button
                size={size}
                variant="neutralWeak"
                className={wide ? "mr-auto" : "flex-1"}
                onClick={() => setStep(1)}
              >
                {t("prev")}
              </Button>
              <Button
                size={size}
                variant="neutralSolid"
                className={wide ? undefined : "flex-1"}
                loading={busy}
                onClick={() => void submit()}
              >
                {t("createLabel")}
              </Button>
            </div>
          )}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
