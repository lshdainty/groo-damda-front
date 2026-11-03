import { useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Banknote,
  Bell,
  Calendar,
  CalendarCheck,
  CreditCard,
  Percent,
  Pin,
  Repeat,
  StickyNote,
  Store,
  Tags,
  Wallet,
  Zap,
} from "lucide-react";
import { MAX_AMOUNT, parseAmount } from "@/shared/lib/groo/amount";
import { Button } from "@/shared/ds/button";
import { Callout } from "@/shared/ds/callout";
import { ChipRadio, ChipRadioGroup } from "@/shared/ds/chip";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogCancel,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "@/shared/ds/dialog";
import { Field } from "@/shared/ds/field";
import { List, ListSwitchItem } from "@/shared/ds/list";
import { useLeaveConfirm } from "@/shared/ds/alert-dialog";
import { useBackClose, useWideSurface } from "@/shared/ds/overlay";
import { AmountInput } from "@/shared/ui/groo/amount-input";
import {
  isLoanTarget,
  transferEligible,
  transferPartiesReady,
} from "@/features/asset-transfer";
import {
  formatDateLong,
  parseLocalDate,
  todayLocalKey,
} from "@/shared/lib/date";
import { KRW } from "@/shared/lib/groo/format";
import { useExpenseCategories } from "@/features/expense";
import { useAssets } from "@/features/asset";
import {
  useCreateRecurringTransaction,
  useUpdateRecurringTransaction,
} from "@/features/recurring-transaction";
import type { Asset, AssetType } from "@/entities/asset";
import type {
  RecurringFrequency,
  RecurringTransaction,
  RecurringTransactionFormValues,
} from "@/entities/recurring-transaction";
import { addYears } from "../lib/recurring-date";
import {
  clockText,
  cycleSentence,
  nextDateText,
} from "../lib/recurring-format";
import { previewNextDates } from "../lib/recurring-schedule";
import {
  AssetPickRow,
  CategoryPickRow,
  ChoicePickRow,
  DateRow,
  StepRow,
} from "./recurring-pickers";
import { AmountStep, EndStep, RepeatStep, TextStep } from "./recurring-steps";
import {
  END_COUNT_MAX,
  endRowValue,
  type EndDraft,
  type EndMode,
  type RepeatDraft,
} from "../lib/recurring-steps-model";

const PAYMENT_METHODS: { v: string; lKey: string }[] = [
  { v: "CASH", lKey: "form.paymentMethod.CASH" },
  { v: "CARD", lKey: "form.paymentMethod.CARD" },
  { v: "TRANSFER", lKey: "paymentTransferFull" },
  { v: "OTHER", lKey: "form.paymentMethod.OTHER" },
];

/** 결제 수단 → 허용 자산 타입. null이면 전체 허용. (AddTxSheet와 동일) */
const PAYMENT_ASSET_TYPES: Record<string, AssetType[] | null> = {
  CASH: ["CASH"],
  CARD: ["CREDIT_CARD", "CHECK_CARD"],
  TRANSFER: ["BANK_ACCOUNT", "SAVINGS"],
  OTHER: null,
};

type TxType = "EXPENSE" | "INCOME" | "TRANSFER";
type Step =
  "list" | "repeat" | "end" | "merchant" | "memo" | "fee" | "interest";

const ROW_ICON = "size-[22px]";

type Props = {
  onClose: () => void;
  onCreated?: (recurringRowId: number) => void;
  /**
   * 주면 **수정 모드** — 이 값으로 폼을 채우고 저장 시 update 를 보낸다.
   * 생성과 수정은 같은 입력을 받는다(사용자 결정 2026-09-03). 바뀐 값은 다음 실행분부터 적용되고 이미 만들어진 거래는 그대로다.
   */
  recurring?: RecurringTransaction;
  /**
   * **새로 만들되 값만 물려받는다** — 이체 상세의 "반복 설정" 이 쓴다.
   * 이미 일어난 이체와 앞으로 실행될 규칙은 별개라, 여기서 금액을 고쳐도 그 이체는 그대로여야 한다. 거래와 규칙을 잇는
   * `sourceExpenseRowId` 같은 연결도 두지 않는다.
   */
  transferSeed?: {
    fromAssetRowId: number | null;
    toAssetRowId: number | null;
    amount: number;
    fee: number | null;
    interestAmount: number | null;
    description: string | null;
    startDate: string;
  };
  onSaved?: () => void;
  /** 예전 껍데기가 폰 · 데스크톱을 가르던 값 — 이제 표면이 1280 에서 스스로 가른다(받기만 한다) */
  mobile?: boolean;
};

type FormState = {
  type: TxType;
  amount: string;
  merchant: string;
  paymentMethod: string;
  categoryRowId: number | null;
  assetRowId: number | null;
  description: string;
  toAssetRowId: number | null;
  fee: string;
  interest: string;
  startDate: string;
  frequency: RecurringFrequency;
  dayOfWeek: number;
  dayOfMonth: number;
  endMode: EndMode;
  endCount: string;
  endDate: string;
  executionTime: string;
  autoLog: boolean;
  isFixed: boolean;
  notifyDayBefore: boolean;
};

function initialState(
  recurring: RecurringTransaction | undefined,
  seed: Props["transferSeed"],
): FormState {
  const startDate = recurring?.startDate
    ? recurring.startDate.slice(0, 10)
    : (seed?.startDate ?? todayLocalKey());
  const startBase = parseLocalDate(startDate);
  return {
    type: recurring?.expenseType ?? (seed ? "TRANSFER" : "EXPENSE"),
    amount: recurring
      ? String(Math.abs(recurring.amount))
      : seed
        ? String(Math.abs(seed.amount))
        : "",
    merchant: recurring?.merchant ?? "",
    paymentMethod: recurring?.paymentMethod ?? "",
    categoryRowId: recurring?.categoryRowId ?? null,
    assetRowId: recurring?.assetRowId ?? seed?.fromAssetRowId ?? null,
    description: recurring?.description ?? seed?.description ?? "",
    toAssetRowId: recurring?.toAssetRowId ?? seed?.toAssetRowId ?? null,
    fee:
      (recurring?.fee ?? seed?.fee) ? String(recurring?.fee ?? seed?.fee) : "",
    interest:
      (recurring?.interestAmount ?? seed?.interestAmount)
        ? String(recurring?.interestAmount ?? seed?.interestAmount)
        : "",
    startDate,
    frequency: recurring?.frequency ?? "MONTHLY",
    // 백엔드는 ISO 1=월~7=일, UI 는 0=일~6=토
    dayOfWeek:
      recurring?.dayOfWeek != null
        ? recurring.dayOfWeek % 7
        : startBase
          ? startBase.getDay()
          : 1,
    dayOfMonth:
      recurring?.dayOfMonth ??
      (startBase ? Math.min(31, startBase.getDate()) : 1),
    endMode: !recurring
      ? "NONE"
      : recurring.maxOccurrences
        ? "COUNT"
        : recurring.endDate
          ? "DATE"
          : "NONE",
    endCount: recurring?.maxOccurrences
      ? String(recurring.maxOccurrences)
      : "12",
    endDate: recurring?.endDate
      ? recurring.endDate.slice(0, 10)
      : addYears(todayLocalKey(), 1),
    // 실행 시각 — 서버 컬럼 기본값도 09:00 이라 안 고르면 종전과 같다.
    executionTime: (recurring?.executionTime ?? "09:00:00").slice(0, 5),
    autoLog: recurring?.autoLog ?? true,
    isFixed: recurring?.isFixed ?? false,
    notifyDayBefore: recurring?.notifyDayBefore ?? true,
  };
}

/**
 * 반복 거래 추가 · 수정 폼(I-20 D 26 ~ 28) — 입력 폼 표면(1280 미만 시트 · 이상 대화상자 480), 맨 위 종류 칩 → 금액 칸 → 줄 칸 → 스위치 줄.
 * 반복 · 끝 · 거래처 · 메모 · 수수료 · 이자는 같은 표면 안에서 한 단계 들어간다(머리 ← 와 "완료").
 * 주 버튼은 켜 두고 누를 때 칸 아래에서 검증한다. 실패는 서버 원문이 아니라 고정 글로 알린다.
 */
export function RecurringAddDialog({
  onClose,
  onCreated,
  recurring,
  transferSeed,
  onSaved,
}: Props) {
  const uid = useId();
  const { t } = useTranslation("recurring");
  const { t: te } = useTranslation("expense");
  const { t: tc } = useTranslation("common");
  const createMut = useCreateRecurringTransaction({ silent: true });
  const updateMut = useUpdateRecurringTransaction({ silent: true });
  const isEdit = recurring != null;
  const categoriesQ = useExpenseCategories();
  const assetsQ = useAssets();
  const categories = useMemo(() => categoriesQ.data ?? [], [categoriesQ.data]);
  const assets: Asset[] = useMemo(
    () => assetsQ.data?.assets ?? [],
    [assetsQ.data],
  );

  const [initial] = useState(() => initialState(recurring, transferSeed));
  const [f, setF] = useState<FormState>(initial);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setF((s) => ({ ...s, [k]: v }));

  const [step, setStep] = useState<Step>("list");
  const [draftText, setDraftText] = useState("");
  const [stepOrigin, setStepOrigin] = useState("");
  const [repeatDraft, setRepeatDraft] = useState<RepeatDraft>({
    frequency: f.frequency,
    dayOfMonth: f.dayOfMonth,
    dayOfWeek: f.dayOfWeek,
    time: f.executionTime,
  });
  const [endDraft, setEndDraft] = useState<EndDraft>({
    mode: f.endMode,
    date: f.endDate,
    count: f.endCount,
  });
  const [stepErrors, setStepErrors] = useState<{
    date?: string;
    count?: string;
  }>({});
  const [showErrors, setShowErrors] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [assetsFailed, setAssetsFailed] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const isTransfer = f.type === "TRANSFER";
  const kind = f.type === "INCOME" ? "INCOME" : "EXPENSE";

  // 결제 수단 + 거래 타입으로 계좌·카드 목록 필터.
  // 지출에선 예·적금(SAVINGS)을 뺀다 — 만기 전까지 묶인 돈이라 거기서 직접 결제·출금이 나가지 않는다(납입·해지는 이체로 처리).
  const allowAsset = (a: Asset) => {
    const allowed = f.paymentMethod
      ? PAYMENT_ASSET_TYPES[f.paymentMethod]
      : null;
    if (allowed && !allowed.includes(a.assetType)) return false;
    if (f.type === "EXPENSE" && a.assetType === "SAVINGS") return false;
    return true;
  };
  const filteredAssets = assets.filter(allowAsset);
  const eligible = transferEligible(assets);
  const showInterest = isTransfer && isLoanTarget(assets, f.toAssetRowId);

  // 종류에 안 맞는 값은 렌더 중에 비운다(한 번 비우면 조건이 닫혀 반복되지 않는다).
  // 계좌 · 이자처럼 **자산 목록이 있어야 판정되는 값**은 목록을 받은 뒤에만 비운다 — 수정으로 열 때 받기 전 값을 지우지 않게.
  // 계좌가 결제 수단과 안 맞게 되는 것은 사람이 결제 수단 · 종류를 바꿀 때(아래 핸들러)만 비운다 — 저장된 값은 그대로 연다.
  const fix: Partial<FormState> = {};
  if (f.categoryRowId != null) {
    const cat = categories.find((c) => c.rowId === f.categoryRowId);
    // 목록을 아직 받지 못했으면 비우지 않는다(수정으로 열 때 저장된 카테고리를 날리지 않게)
    // 규칙 밖 값(지운 카테고리 · 종류가 다른 것 · 하위가 생겨 상위가 된 것)은 목록이 온 뒤 비운다 — 저장 때 칸 오류("카테고리를 골라주세요.")
    if (
      categoriesQ.data &&
      (isTransfer ||
        !cat ||
        cat.expenseType !== f.type ||
        categories.some((c) => c.parentRowId === cat.rowId))
    )
      fix.categoryRowId = null;
  }
  // 지운 계좌 · 카드가 된 이체 계좌도 자산 목록이 온 뒤 비운다
  if (assetsQ.data) {
    if (
      f.assetRowId != null &&
      !(isTransfer ? eligible : assets).some((a) => a.rowId === f.assetRowId)
    )
      fix.assetRowId = null;
    if (
      f.toAssetRowId != null &&
      isTransfer &&
      !eligible.some((a) => a.rowId === f.toAssetRowId)
    )
      fix.toAssetRowId = null;
  }
  // 이체가 아니게 되면 남아 있던 이체 칸을 지운다 — 실려 나가면 서버가 거절한다.
  if (!isTransfer && (f.toAssetRowId != null || f.fee || f.interest)) {
    fix.toAssetRowId = null;
    fix.fee = "";
    fix.interest = "";
  }
  // 받는 계좌가 대출이 아니면 이자는 뜻이 없다.
  if (assetsQ.data && isTransfer && !showInterest && f.interest)
    fix.interest = "";
  if (Object.keys(fix).length > 0) setF((s) => ({ ...s, ...fix }));

  // 결제 수단 · 종류를 바꿀 때 그 조건에 안 맞는 계좌는 비운다(사람이 바꾼 때만)
  const dropMismatchedAsset = (
    next: Pick<FormState, "type" | "paymentMethod">,
  ) =>
    setF((s) => {
      const picked =
        s.assetRowId != null
          ? assets.find((a) => a.rowId === s.assetRowId)
          : undefined;
      if (!picked || next.type === "TRANSFER") return { ...s, ...next };
      const allowed = next.paymentMethod
        ? PAYMENT_ASSET_TYPES[next.paymentMethod]
        : null;
      const bad =
        (allowed != null && !allowed.includes(picked.assetType)) ||
        (next.type === "EXPENSE" && picked.assetType === "SAVINGS");
      return { ...s, ...next, assetRowId: bad ? null : s.assetRowId };
    });
  const changeType = (type: TxType) =>
    dropMismatchedAsset({ type, paymentMethod: f.paymentMethod });
  const changePayment = (paymentMethod: string) =>
    dropMismatchedAsset({ type: f.type, paymentMethod });

  const amountNumber = parseAmount(f.amount);
  const amountTooLarge = amountNumber > MAX_AMOUNT;
  const submitting = createMut.isPending || updateMut.isPending;

  const nextDates = previewNextDates(
    f.startDate,
    f.frequency,
    f.dayOfWeek,
    f.dayOfMonth,
    3,
    {
      endDate: f.endMode === "DATE" ? f.endDate : null,
      maxOccurrences: f.endMode === "COUNT" ? Number(f.endCount) : null,
      executedCount: recurring?.executedCount ?? 0,
      intervalValue: recurring?.intervalValue ?? 1,
      fromKey: todayLocalKey(),
    },
  );

  // ── 검증(누를 때 보인다) ──
  const errAmount =
    amountNumber <= 0
      ? t("errAmount")
      : amountTooLarge
        ? tc("amountTooLarge")
        : null;
  const errCategory =
    !isTransfer && f.categoryRowId == null ? t("errCategory") : null;
  const errFrom = isTransfer && f.assetRowId == null ? t("errFrom") : null;
  const errTo =
    isTransfer && (f.toAssetRowId == null || f.toAssetRowId === f.assetRowId)
      ? t("errTo")
      : null;
  const errEnd =
    f.endMode === "DATE" && f.endDate < f.startDate
      ? t("errEndBeforeStart")
      : f.endMode === "COUNT" && Number(f.endCount) > END_COUNT_MAX
        ? t("errCountMax", { max: END_COUNT_MAX })
        : f.endMode === "COUNT" && Number(f.endCount) < 1
          ? t("errCountMin")
          : null;
  const errInterest =
    isTransfer &&
    f.interest &&
    Number(f.interest) > 0 &&
    Number(f.interest) > amountNumber
      ? t("errInterestOver")
      : null;
  const ready =
    !errAmount &&
    !errInterest &&
    !errCategory &&
    !(isTransfer && !transferPartiesReady(f.assetRowId, f.toAssetRowId)) &&
    !errEnd;

  const dirty = JSON.stringify(f) !== JSON.stringify(initial);

  const save = async () => {
    if (submitting) return;
    if (!ready) {
      setShowErrors(true);
      if (errAmount) amountRef.current?.focus();
      return;
    }
    setSaveError(false);
    setAssetsFailed(false);
    // 이자 판정은 자산 목록이 있어야 한다 — 서버 PUT 은 빠진 키를 null 로 덮으므로 목록이 없으면 받아 온 뒤 정하고, 못 받으면 요청하지 않는다
    let assetList = assets;
    if (isTransfer && !assetsQ.data) {
      const r = await assetsQ.refetch();
      if (!r.data) {
        setAssetsFailed(true);
        return;
      }
      assetList = r.data.assets;
    }
    const interestOn = isTransfer && isLoanTarget(assetList, f.toAssetRowId);
    const data: RecurringTransactionFormValues = {
      categoryRowId: isTransfer ? undefined : (f.categoryRowId ?? undefined),
      assetRowId: f.assetRowId ?? undefined,
      // 이체 칸은 이체일 때만 싣는다 — 지출·수입에 실려 가면 서버가 거절한다.
      toAssetRowId: isTransfer ? (f.toAssetRowId ?? undefined) : undefined,
      // 0 은 없음(null) — 수수료 · 이자 칸에 0 을 쳐도 0 을 보내지 않는다
      fee: isTransfer && Number(f.fee) > 0 ? Number(f.fee) : undefined,
      interestAmount:
        interestOn && Number(f.interest) > 0 ? Number(f.interest) : undefined,
      sourceExpenseRowId: undefined, // 처음부터 추가 — 원본 거래 없음
      expenseType: f.type,
      amount: amountNumber,
      // 공백만이면 없음(본문은 다듬지 않고 빈지만 본다)
      description: f.description.trim() ? f.description : undefined,
      merchant: isTransfer ? undefined : f.merchant || undefined,
      paymentMethod: isTransfer ? undefined : f.paymentMethod || undefined,
      frequency: f.frequency,
      intervalValue: recurring?.intervalValue ?? 1,
      // 백엔드는 ISO 1=월~7=일. UI 0=일~6=토 → 변환.
      dayOfWeek:
        f.frequency === "WEEKLY"
          ? f.dayOfWeek === 0
            ? 7
            : f.dayOfWeek
          : undefined,
      dayOfMonth:
        f.frequency === "MONTHLY" || f.frequency === "YEARLY"
          ? f.dayOfMonth
          : undefined,
      startDate: f.startDate,
      executionTime: `${f.executionTime}:00`,
      endDate: f.endMode === "DATE" ? f.endDate : undefined,
      maxOccurrences: f.endMode === "COUNT" ? Number(f.endCount) : undefined,
      autoLog: f.autoLog,
      notifyDayBefore: f.notifyDayBefore,
      // 이체는 고정이 없다 — 켜 둔 채 이체로 바꿔도 싣지 않는다(서버도 꺼 버린다).
      isFixed: isTransfer ? undefined : f.isFixed,
    };
    const failed = () => {
      setSaveError(true);
      requestAnimationFrame(() =>
        errorRef.current?.scrollIntoView({ block: "nearest" }),
      );
    };
    if (recurring) {
      // 다음 실행분부터 이 값으로 만들어진다 — 이미 만들어진 거래는 그대로.
      updateMut.mutate(
        { id: recurring.rowId, data },
        {
          onSuccess: () => {
            onSaved?.();
            onClose();
          },
          onError: failed,
        },
      );
      return;
    }
    createMut.mutate(data, {
      onSuccess: (created) => {
        onCreated?.(created.rowId);
        onClose();
      },
      onError: failed,
    });
  };

  // ── 한 단계 들어가기 ──
  const inStep = step !== "list";
  const enterText = (next: "merchant" | "memo" | "fee" | "interest") => {
    const origin =
      next === "merchant"
        ? f.merchant
        : next === "memo"
          ? f.description
          : next === "fee"
            ? f.fee
            : f.interest;
    setDraftText(origin);
    setStepOrigin(origin);
    setStep(next);
  };
  const enterRepeat = () => {
    const d: RepeatDraft = {
      frequency: f.frequency,
      dayOfMonth: f.dayOfMonth,
      dayOfWeek: f.dayOfWeek,
      time: f.executionTime,
    };
    setRepeatDraft(d);
    setStepOrigin(JSON.stringify(d));
    setStep("repeat");
  };
  const enterEnd = () => {
    const d: EndDraft = { mode: f.endMode, date: f.endDate, count: f.endCount };
    setEndDraft(d);
    setStepOrigin(JSON.stringify(d));
    setStepErrors({});
    setStep("end");
  };
  const stepDirty =
    step === "repeat"
      ? JSON.stringify(repeatDraft) !== stepOrigin
      : step === "end"
        ? JSON.stringify(endDraft) !== stepOrigin
        : inStep && draftText !== stepOrigin;

  const confirmStep = () => {
    if (step === "merchant") set("merchant", draftText.trim());
    else if (step === "memo") set("description", draftText);
    else if (step === "fee") set("fee", draftText);
    else if (step === "interest") set("interest", draftText);
    else if (step === "repeat") {
      setF((s) => ({
        ...s,
        frequency: repeatDraft.frequency,
        dayOfMonth: repeatDraft.dayOfMonth,
        dayOfWeek: repeatDraft.dayOfWeek,
        executionTime: repeatDraft.time,
      }));
    } else if (step === "end") {
      const n = Number(endDraft.count);
      if (endDraft.mode === "COUNT" && (!(n >= 1) || n > END_COUNT_MAX)) {
        setStepErrors({
          count:
            n > END_COUNT_MAX
              ? t("errCountMax", { max: END_COUNT_MAX })
              : t("errCountMin"),
        });
        return;
      }
      setF((s) => ({
        ...s,
        endMode: endDraft.mode,
        endDate: endDraft.date,
        endCount: endDraft.count,
      }));
    }
    setStep("list");
  };
  const leave = useLeaveConfirm({
    dirty: stepDirty,
    leave: () => setStep("list"),
    contentRef,
  });
  // 기기 뒤로 가기 = 한 단계 뒤(시트 전체가 닫히지 않는다). 바뀐 글이 있어 물었으면 칸을 다시 쌓는다
  useBackClose(inStep, (keep) => {
    if (!leave.request()) keep();
  });

  // 열릴 때 금액 칸에 초점(처음 열 때만 — 수정은 표면이 받는다)
  const focusOnOpen = (e: Event) => {
    if (isEdit) return;
    e.preventDefault();
    amountRef.current?.focus({ preventScroll: true });
  };

  const cycleValue = `${cycleSentence(
    {
      frequency: f.frequency,
      dayOfWeek: f.dayOfWeek === 0 ? 7 : f.dayOfWeek,
      dayOfMonth: f.dayOfMonth,
      startDate: f.startDate,
    },
    t,
  )} · ${clockText(f.executionTime)}`;

  const stepTitle: Record<Exclude<Step, "list">, string> = {
    repeat: t("repeatRow"),
    end: t("endRow"),
    merchant:
      f.type === "INCOME" ? te("addTx.incomeSource") : te("form.merchant"),
    memo: te("memo"),
    fee: t("feeRow"),
    interest: t("interestRow"),
  };

  const wide = useWideSurface();
  const doneButton = (
    <Button
      variant="ghost"
      ghostColor="neutral"
      size="small"
      className="font-bold"
      onClick={confirmStep}
    >
      {tc("done")}
    </Button>
  );
  // 끝 흐림은 390 × 844 보통 값에서 본문이 시트 90%(759.6)에 닿을 때만 — 폼(1.20) · 매주 고르기(1.00)는 켜고,
  // 매월 · 매년 · 매일 고르기 · 끝 · 메모 · 거래처 · 수수료 · 이자 단계는 넘치지 않아 끈다(결과표 "자연 높이 / 759.6")
  const bodyFog =
    step === "list" ||
    (step === "repeat" && repeatDraft.frequency === "WEEKLY");
  const heading = isEdit ? t("editTitle") : t("addTitle");

  return (
    <ResponsiveDialog
      open
      form
      dirty={dirty && !inStep}
      onOpenChange={(next) => {
        if (next) return;
        if (inStep) void leave.request();
        else onClose();
      }}
    >
      <ResponsiveDialogContent
        ref={contentRef}
        title={inStep ? stepTitle[step] : heading}
        aria-describedby={undefined}
        showCloseButton={!inStep}
        onBack={inStep ? () => void leave.request() : undefined}
        headerAction={inStep && wide ? doneButton : undefined}
        onOpenAutoFocus={focusOnOpen}
      >
        {leave.node}
        {/* 시트는 닫기 원이 없는 머리 오른쪽 끝(화면 여백 24 안쪽 8)에 "완료" — 대화상자는 ds 머리 동작 자리 */}
        {inStep && !wide && (
          <div className="absolute right-[calc(var(--spacing-global-gutter)-8px)] top-[calc(var(--spacing-x6)+14px)] z-1 -translate-y-1/2">
            {doneButton}
          </div>
        )}
        <ResponsiveDialogBody scrollFog={bodyFog}>
          {step === "list" && assetsFailed && (
            <Callout tone="critical" role="alert" className="mb-x4">
              {t("assetsLoadFailed")}
            </Callout>
          )}
          {step === "list" && saveError && (
            <div ref={errorRef}>
              <Callout tone="critical" role="alert" className="mb-x4">
                {t("saveFailed")}
              </Callout>
            </div>
          )}

          {step === "list" && (
            <>
              <ChipRadioGroup
                aria-label={t("typeTitle")}
                value={f.type}
                onValueChange={(v) => changeType(v as TxType)}
                className="mb-x4"
              >
                <ChipRadio
                  value="EXPENSE"
                  variant="outlineStrong"
                  size="medium"
                >
                  {te("expense")}
                </ChipRadio>
                <ChipRadio value="INCOME" variant="outlineStrong" size="medium">
                  {te("income")}
                </ChipRadio>
                <ChipRadio
                  value="TRANSFER"
                  variant="outlineStrong"
                  size="medium"
                >
                  {te("addTx.transfer")}
                </ChipRadio>
              </ChipRadioGroup>

              <Field
                label={te("form.amount")}
                invalid={showErrors && !!errAmount}
                errorMessage={errAmount ?? undefined}
                className="mb-x2"
              >
                <AmountInput
                  ref={amountRef}
                  size="large"
                  value={f.amount}
                  onValueChange={(v) => set("amount", v)}
                />
              </Field>

              <div className="-mx-x6">
                {!isTransfer && (
                  <CategoryPickRow
                    prefix={<Tags className={ROW_ICON} />}
                    title={te("category")}
                    placeholder={t("pickValue", { name: te("category") })}
                    surfaceTitle={te("category")}
                    categories={categories}
                    type={kind}
                    value={f.categoryRowId}
                    onChange={(id) => set("categoryRowId", id)}
                    errorMessage={showErrors ? errCategory : null}
                    emptyText={te("expNoCategoryForType")}
                    failed={categoriesQ.isError && !categoriesQ.data}
                    onRetry={() => void categoriesQ.refetch()}
                  />
                )}
                {!isTransfer && (
                  <StepRow
                    prefix={<Store />}
                    title={
                      f.type === "INCOME"
                        ? te("addTx.incomeSource")
                        : te("form.merchant")
                    }
                    value={f.merchant}
                    placeholder={
                      f.type === "INCOME"
                        ? t("merchantPlaceholderIncome")
                        : t("merchantPlaceholderExpense")
                    }
                    onClick={() => enterText("merchant")}
                  />
                )}
                {!isTransfer && (
                  <AssetPickRow
                    prefix={<Wallet className={ROW_ICON} />}
                    title={
                      f.type === "INCOME"
                        ? te("addTx.depositAccount")
                        : te("accountCard")
                    }
                    placeholder={t("noValue", {
                      name:
                        f.type === "INCOME"
                          ? te("addTx.depositAccount")
                          : te("accountCard"),
                    })}
                    surfaceTitle={
                      f.type === "INCOME"
                        ? te("addTx.depositAccount")
                        : te("accountCard")
                    }
                    assets={filteredAssets}
                    valueAssets={assets}
                    value={f.assetRowId}
                    onChange={(id) => set("assetRowId", id)}
                    onClear={() => set("assetRowId", null)}
                    clearLabel={t("clearValue")}
                    emptyText={t("noAssets")}
                  />
                )}
                {!isTransfer && (
                  <ChoicePickRow
                    prefix={<CreditCard className={ROW_ICON} />}
                    title={
                      f.type === "INCOME"
                        ? te("addTx.incomeMethod")
                        : te("paymentMethodLabel")
                    }
                    placeholder={t("noValue", {
                      name:
                        f.type === "INCOME"
                          ? te("addTx.incomeMethod")
                          : te("paymentMethodLabel"),
                    })}
                    surfaceTitle={
                      f.type === "INCOME"
                        ? te("addTx.incomeMethod")
                        : te("paymentMethodLabel")
                    }
                    items={PAYMENT_METHODS.map((pm) => ({
                      value: pm.v,
                      label: te(pm.lKey),
                    }))}
                    value={f.paymentMethod}
                    onChange={(v) => changePayment(v)}
                    onClear={() => set("paymentMethod", "")}
                    clearLabel={t("clearValue")}
                  />
                )}

                {isTransfer && (
                  <>
                    <AssetPickRow
                      prefix={<Wallet className={ROW_ICON} />}
                      title={te("addTx.fromAccount")}
                      placeholder={t("pickValue", {
                        name: te("addTx.fromAccount"),
                      })}
                      surfaceTitle={te("addTx.fromAccount")}
                      assets={eligible}
                      value={f.assetRowId}
                      onChange={(id) =>
                        setF((s) => ({
                          ...s,
                          assetRowId: id,
                          // 보내는 계좌와 같은 받는 계좌는 비운다
                          toAssetRowId:
                            s.toAssetRowId === id ? null : s.toAssetRowId,
                        }))
                      }
                      errorMessage={showErrors ? errFrom : null}
                      emptyText={t("noAssets")}
                    />
                    <AssetPickRow
                      prefix={<Wallet className={ROW_ICON} />}
                      title={te("addTx.depositAccount")}
                      placeholder={t("pickValue", {
                        name: te("addTx.depositAccount"),
                      })}
                      surfaceTitle={te("addTx.depositAccount")}
                      assets={eligible.filter((a) => a.rowId !== f.assetRowId)}
                      value={f.toAssetRowId}
                      onChange={(id) => set("toAssetRowId", id)}
                      errorMessage={showErrors ? errTo : null}
                      emptyText={t("noAssets")}
                    />
                    <StepRow
                      prefix={<Banknote />}
                      title={t("feeRow")}
                      value={
                        Number(f.fee) > 0
                          ? `${KRW(Number(f.fee))}${tc("searchWon")}`
                          : ""
                      }
                      placeholder={t("noneValue")}
                      onClick={() => enterText("fee")}
                    />
                    {showInterest && (
                      <StepRow
                        prefix={<Percent />}
                        title={t("interestRow")}
                        value={
                          Number(f.interest) > 0
                            ? `${KRW(Number(f.interest))}${tc("searchWon")}`
                            : ""
                        }
                        placeholder={t("noneValue")}
                        onClick={() => enterText("interest")}
                        errorMessage={showErrors ? errInterest : null}
                      />
                    )}
                  </>
                )}

                <StepRow
                  prefix={<Repeat />}
                  title={t("repeatRow")}
                  value={cycleValue}
                  onClick={enterRepeat}
                />
                <DateRow
                  prefix={<Calendar className={ROW_ICON} />}
                  title={t("startDay")}
                  value={f.startDate}
                  onChange={(d) => set("startDate", d)}
                />
                <StepRow
                  prefix={<CalendarCheck />}
                  title={t("endRow")}
                  value={endRowValue(
                    f.endMode,
                    f.endDate,
                    f.endCount,
                    t,
                    formatDateLong,
                  )}
                  onClick={enterEnd}
                  errorMessage={showErrors ? errEnd : null}
                />
                <StepRow
                  prefix={<StickyNote />}
                  title={te("memo")}
                  value={f.description}
                  placeholder={t("noneValue")}
                  onClick={() => enterText("memo")}
                />

                <List aria-label={t("optionsTitle")}>
                  <ListSwitchItem
                    prefix={<Zap className={ROW_ICON} />}
                    title={t("autoLog")}
                    detail={t("autoLogSub")}
                    checked={f.autoLog}
                    onCheckedChange={(v) => set("autoLog", v)}
                  />
                  <ListSwitchItem
                    prefix={<Bell className={ROW_ICON} />}
                    title={t("notifyDayBefore")}
                    detail={t("notifyDayBeforeSub")}
                    checked={f.notifyDayBefore}
                    onCheckedChange={(v) => set("notifyDayBefore", v)}
                  />
                  {!isTransfer && (
                    <ListSwitchItem
                      prefix={<Pin className={ROW_ICON} />}
                      title={t(
                        f.type === "INCOME" ? "fixed.income" : "fixed.expense",
                      )}
                      detail={t("fixed.sub")}
                      checked={f.isFixed}
                      onCheckedChange={(v) => set("isFixed", v)}
                    />
                  )}
                </List>

                {nextDates.length > 0 && (
                  <p
                    id={`${uid}next`}
                    className="m-0 px-global-gutter pb-x3 pt-x2 font-sans text-t3 text-fg-neutral-subtle"
                  >
                    {t("nextDatesLine", {
                      dates: nextDates.map((d) => nextDateText(d)).join(" · "),
                    })}
                  </p>
                )}
              </div>
            </>
          )}

          {step === "merchant" && (
            <TextStep
              kind="merchant"
              value={draftText}
              onChange={setDraftText}
              onEnter={confirmStep}
              label={stepTitle.merchant}
              placeholder={
                f.type === "INCOME"
                  ? t("merchantPlaceholderIncome")
                  : t("merchantPlaceholderExpense")
              }
            />
          )}
          {step === "memo" && (
            <TextStep
              kind="memo"
              value={draftText}
              onChange={setDraftText}
              onEnter={confirmStep}
              label={te("memo")}
              placeholder={t("memoPlaceholder")}
            />
          )}
          {(step === "fee" || step === "interest") && (
            <>
              <AmountStep
                value={draftText}
                onChange={setDraftText}
                onEnter={confirmStep}
                label={stepTitle[step]}
              />
              {step === "interest" && (
                <p className="m-0 font-sans text-t3 text-fg-neutral-subtle">
                  {draftText && amountNumber > 0
                    ? te("addTx.interestSplit", {
                        principal: KRW(
                          Math.max(0, amountNumber - Number(draftText)),
                        ),
                        interest: KRW(Number(draftText)),
                      })
                    : te("addTx.interestHint")}
                </p>
              )}
            </>
          )}
          {step === "repeat" && (
            <RepeatStep draft={repeatDraft} onChange={setRepeatDraft} />
          )}
          {step === "end" && (
            <EndStep
              draft={endDraft}
              onChange={(d) => {
                setEndDraft(d);
                setStepErrors({});
              }}
              startDate={f.startDate}
              dateError={stepErrors.date}
              countError={stepErrors.count}
            />
          )}
        </ResponsiveDialogBody>
        {step === "list" && (
          <ResponsiveDialogFooter>
            <ResponsiveDialogCancel>{tc("cancel")}</ResponsiveDialogCancel>
            <Button loading={submitting} onClick={save}>
              {isEdit ? tc("save") : tc("add")}
            </Button>
          </ResponsiveDialogFooter>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
