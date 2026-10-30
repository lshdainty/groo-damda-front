import { useRef, useState, type ReactNode } from "react";
import {
  ChevronRight,
  Coins,
  CreditCard,
  FileText,
  Percent,
  StickyNote,
  Tags,
  Wallet,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useLeaveConfirm } from "@/shared/ds/alert-dialog";
import { Callout } from "@/shared/ds/callout";
import { ChipRadio, ChipRadioGroup } from "@/shared/ds/chip";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
} from "@/shared/ds/dialog";
import { Field } from "@/shared/ds/field";
import { dsMoney } from "@/shared/ds/i18n";
import { Input } from "@/shared/ds/input";
import { List, ListButtonItem, ListSwitchItem } from "@/shared/ds/list";
import { LogoTile } from "@/shared/ds/logo-tile";
import { useWideSurface } from "@/shared/ds/overlay";
import { Textarea } from "@/shared/ds/textarea";
import { MAX_AMOUNT, parseAmount } from "@/shared/lib/groo/amount";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import { nameIssue } from "@/shared/lib/groo/name-policy";
import { AmountInput } from "@/shared/ui/groo/amount-input";
import { FormFooter } from "@/shared/ui/groo/form-footer";
import { PickList } from "@/shared/ui/groo/pick-list";
import { PickerRow } from "@/shared/ui/groo/picker-row";
import { SheetStepDone, StepDoneButton } from "@/shared/ui/groo/step-parts";
import { useStepBack } from "@/shared/ui/groo/use-step-back";
import {
  isLoanTarget,
  transferEligible,
  transferPartiesReady,
} from "@/features/asset-transfer";
import {
  useCreateExpenseTemplate,
  useExpenseCategories,
  useExpenseTemplates,
  useUpdateExpenseTemplate,
} from "@/features/expense";
import { CategoryPickList } from "@/features/expense/ui/CategoryPickList";
import { PresetTile } from "@/features/expense/ui/preset-row";
import { useAssets } from "@/features/asset";
import type { Asset } from "@/entities/asset";
import type { TxKind } from "@/entities/expense";
import type {
  ExpenseTemplate,
  ExpenseTemplateFormValues,
} from "@/entities/expense-template";

/** 프리셋 이름 상한 — 카테고리·라벨·태그와 같은 12자. 목록 행에 한 줄로 들어간다. */
export const PRESET_NAME_MAX = 12;
/** 기본 내역(거래처) 상한 — 거래 시트(AddTxSheet)·서버 컬럼과 같은 100자. */
const MERCHANT_MAX = 100;
/** 기본 메모 상한 — 이 값이 그대로 거래 메모가 된다. 시트·서버 컬럼과 같은 500자. */
const DESCRIPTION_MAX = 500;

const PAYMENT_METHODS: { v: string; lKey: string }[] = [
  { v: "CASH", lKey: "form.paymentMethod.CASH" },
  { v: "CARD", lKey: "form.paymentMethod.CARD" },
  { v: "TRANSFER", lKey: "paymentTransferFull" },
  { v: "OTHER", lKey: "form.paymentMethod.OTHER" },
];
const NONE = "__none__";

/** 한 단계 들어가는 줄 — 치는 값(기본 내역 · 메모 · 금액 · 수수료 · 이자) */
type Step = "merchant" | "memo" | "amount" | "fee" | "interest";

const ROW_ICON = "text-fg-neutral [&>svg]:size-[22px]";

/** 치는 값 줄 — 값 글(비었으면 "없음") + 꺾쇠. 누르면 같은 표면 안에서 한 단계 들어간다 */
function StepRow({
  icon,
  title,
  value,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <List>
      <ListButtonItem
        prefix={
          <span aria-hidden className={ROW_ICON}>
            {icon}
          </span>
        }
        title={title}
        suffixText
        suffix={
          <>
            <span className="line-clamp-2 whitespace-pre-wrap">{value}</span>
            <ChevronRight aria-hidden className="size-[18px]" />
          </>
        }
        aria-label={`${title}, ${value}`}
        onClick={onClick}
      />
    </List>
  );
}

const assetLabel = (a: Asset) => a.assetName;

/**
 * 프리셋 추가 · 수정 폼(I-20 C 19) — 입력 폼 표면(1280 이상 대화상자 480 · 미만 시트).
 * 맨 위는 종류 Chip 하나 고르기 → 미리보기 타일 52 + 이름 칸 → 줄 칸(고르는 값은 고르기 시트 · 팝오버, 치는 값은 한 단계 들어감) →
 * 스위치 줄. 금액은 "고정 금액 사용" 스위치 없이 줄 하나다: 금액이 있으면 고정(`lockAmount: "Y"`), 비우면 불러올 때 직접 넣는다(`"N"`).
 * 주 버튼은 켜 두고 누를 때 칸 아래에 오류를 보인다.
 */
export function PresetEditDialog({
  preset,
  onClose,
}: {
  preset: ExpenseTemplate | null;
  onClose: () => void;
}) {
  const { t } = useTranslation("expense");
  const { t: tc } = useTranslation("common");
  const wide = useWideSurface();
  const isNew = !preset;
  const categoriesQ = useExpenseCategories();
  const assetsQ = useAssets();
  const templatesQ = useExpenseTemplates();
  // 저장 실패는 전역 서버 원문 토스트 대신 폼 맨 위 Callout(고정 글)이 알린다
  const createMut = useCreateExpenseTemplate({ silent: true });
  const updateMut = useUpdateExpenseTemplate({ silent: true });

  const categories = categoriesQ.data ?? [];
  const assets = assetsQ.data?.assets ?? [];

  const [initial] = useState(() => ({
    type: (preset?.expenseType ?? "EXPENSE") as TxKind,
    name: preset?.templateName ?? "",
    categoryRowId: preset?.categoryRowId ?? null,
    merchant: preset?.merchant ?? "",
    description: preset?.description ?? "",
    paymentMethod: preset?.paymentMethod ?? "",
    assetRowId: preset?.assetRowId ?? null,
    toAssetRowId: preset?.toAssetRowId ?? null,
    fee: preset?.fee ? String(preset.fee) : "",
    interest: preset?.interestAmount ? String(preset.interestAmount) : "",
    // 금액이 있으면 고정(서버 resolveAmount: 고정 켬 ⇔ 금액 > 0)
    amount:
      preset?.lockAmount === "Y" && preset.amount != null && preset.amount > 0
        ? String(preset.amount)
        : "",
    isFixed: preset?.isFixed ?? false,
  }));
  const [type, setType] = useState<TxKind>(initial.type);
  const [name, setName] = useState(initial.name);
  const [categoryRowId, setCategoryRowId] = useState<number | null>(
    initial.categoryRowId,
  );
  const [merchant, setMerchant] = useState(initial.merchant);
  const [description, setDescription] = useState(initial.description);
  const [paymentMethod, setPaymentMethod] = useState(initial.paymentMethod);
  const [assetRowId, setAssetRowId] = useState<number | null>(
    initial.assetRowId,
  );
  // 이체 전용 — 보내는 계좌는 위 assetRowId 를 그대로 쓴다(서버도 같은 컬럼이다).
  const [toAssetRowId, setToAssetRowId] = useState<number | null>(
    initial.toAssetRowId,
  );
  const [fee, setFee] = useState(initial.fee);
  const [interest, setInterest] = useState(initial.interest);
  const [amount, setAmount] = useState(initial.amount);
  // 고정 수입·지출 기본값 — 금액과는 별개다. 통계의 분류 표식이다.
  const [isFixed, setIsFixed] = useState(initial.isFixed);

  const [attempted, setAttempted] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [step, setStep] = useState<Step | null>(null);
  const [draft, setDraft] = useState("");
  const [stepOrigin, setStepOrigin] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const isTransfer = type === "TRANSFER";
  const amountNumber = parseAmount(amount);
  const lock = amountNumber > 0;
  // 이자는 **금액이 있을 때만** 받는다(금액이 매달 다르면 이자도 매달 다르다 — 2026-09-15). 금액을 비우면 이자도 비운다.
  const showInterest = isTransfer && lock && isLoanTarget(assets, toAssetRowId);

  // 타입이 바뀌면 해당 타입의 카테고리가 아닌 경우 초기화. 이체에는 카테고리가 없다 — 남겨 두면 서버가 거절한다.
  // (한 번 비우면 조건이 닫히므로 렌더 중에 맞춰도 반복되지 않는다)
  if (categoryRowId != null) {
    const cat = categories.find((c) => c.rowId === categoryRowId);
    if (isTransfer || (cat && cat.expenseType !== type)) setCategoryRowId(null);
  }
  // 이체가 아니게 되면 남아 있던 이체 칸을 지운다 — 실려 나가면 서버가 거절한다.
  if (!isTransfer && (toAssetRowId != null || fee || interest)) {
    setToAssetRowId(null);
    setFee("");
    setInterest("");
  }
  if (!showInterest && interest) setInterest("");

  const takenNames = (templatesQ.data ?? [])
    .filter((p) => p.rowId !== preset?.rowId)
    .map((p) => p.templateName);
  const issue = nameIssue(name, PRESET_NAME_MAX, takenNames);
  const nameErr = !attempted
    ? issue === "duplicate"
      ? t("preset.nameDuplicate")
      : null
    : issue === "required"
      ? t("preset.nameRequired")
      : issue === "tooLong"
        ? t("preset.nameTooLong")
        : issue === "duplicate"
          ? t("preset.nameDuplicate")
          : null;
  const categoryErr =
    attempted && !isTransfer && categoryRowId == null
      ? t("preset.categoryRequired")
      : null;
  const fromErr =
    attempted && isTransfer && assetRowId == null
      ? t("preset.fromRequired")
      : null;
  const toErr =
    attempted && isTransfer && toAssetRowId == null
      ? t("preset.toRequired")
      : null;
  const amountTooLarge = amountNumber > MAX_AMOUNT;

  const dirty =
    type !== initial.type ||
    name !== initial.name ||
    categoryRowId !== initial.categoryRowId ||
    merchant !== initial.merchant ||
    description !== initial.description ||
    paymentMethod !== initial.paymentMethod ||
    assetRowId !== initial.assetRowId ||
    toAssetRowId !== initial.toAssetRowId ||
    fee !== initial.fee ||
    interest !== initial.interest ||
    amount !== initial.amount ||
    isFixed !== initial.isFixed;

  const submitting = createMut.isPending || updateMut.isPending;

  const submit = () => {
    if (submitting) return;
    setAttempted(true);
    setSaveError(false);
    const bad =
      issue != null ||
      (isTransfer
        ? !transferPartiesReady(assetRowId, toAssetRowId)
        : categoryRowId == null) ||
      amountTooLarge;
    if (bad) {
      if (issue != null) nameRef.current?.focus();
      return;
    }
    // 본문은 규칙 하나로 만든다 — **이 폼이 가진 칸만 싣는다.** PUT 은 세 갈래다
    // (`Patch`: 키 없음=유지 · null=지움 · 값=교체, QA #96 · 프리셋은 #325 가 옮겼다).
    // 칸이 있으면 지금 상태를 그대로 싣고(비었으면 `null` — 사용자가 지운 것이다), 칸이 없으면 키를 뺀다.
    const payload: ExpenseTemplateFormValues = {
      templateName: name.trim(),
      categoryRowId,
      // 이체 칸도 이 화면의 칸이다 — 지출·수입으로 바꿔 저장하면 `null` 로 지워진다.
      toAssetRowId: isTransfer ? toAssetRowId : null,
      fee: isTransfer && fee ? Number(fee) : null,
      interestAmount: showInterest && interest ? Number(interest) : null,
      assetRowId: assetRowId ?? null,
      expenseType: type,
      // 금액만 계약이 다르다 — `lockAmount` 와 한 쌍이라 서버가 둘을 함께 본다.
      // 금액이 없으면 고정이 아니므로 서버가 실린 금액을 버린다(`resolveAmount`) — 키를 빼도 옛 금액이 남지 않는다.
      amount: lock ? amountNumber : undefined,
      merchant: isTransfer ? null : merchant.trim() || null,
      description: description.trim() || null,
      paymentMethod: isTransfer ? null : paymentMethod || null,
      lockAmount: lock ? "Y" : "N",
      // 이체는 고정이 없다 — 켜 둔 채 이체로 바꿔도 싣지 않는다(서버도 꺼 버린다).
      isFixed: isTransfer ? undefined : isFixed,
    };
    const opts = { onSuccess: onClose, onError: () => setSaveError(true) };
    if (preset) updateMut.mutate({ id: preset.rowId, data: payload }, opts);
    else createMut.mutate(payload, opts);
  };

  // ── 한 단계 들어가기 ─────────────────────────────────────────
  const valueOf = (s: Step): string =>
    s === "merchant"
      ? merchant
      : s === "memo"
        ? description
        : s === "amount"
          ? amount
          : s === "fee"
            ? fee
            : interest;
  const enterStep = (s: Step) => {
    const origin = valueOf(s);
    setDraft(origin);
    setStepOrigin(origin);
    setStep(s);
  };
  const confirmStep = () => {
    if (step === "merchant") setMerchant(draft);
    else if (step === "memo") setDescription(draft);
    else if (step === "amount") setAmount(draft);
    else if (step === "fee") setFee(draft);
    else if (step === "interest") setInterest(draft);
    setStep(null);
  };
  // ← · 기기 뒤로 가기 · Esc — 친 글이 들어올 때와 다르면 "작성한 내용이 사라져요" 를 묻고, 같으면 묻지 않는다. "완료" 는 묻지 않는다
  const leave = useLeaveConfirm({
    dirty: step != null && draft !== stepOrigin,
    leave: () => setStep(null),
    contentRef,
  });
  useStepBack(step != null, () => leave.request());

  const stepTitle = (s: Step) =>
    s === "merchant"
      ? t("preset.defaultMerchant")
      : s === "memo"
        ? t("memo")
        : s === "amount"
          ? t("preset.amountLabel")
          : s === "fee"
            ? t("preset.feeLabel")
            : t("addTx.interest");

  const none = t("preset.noneValue");
  const payLabel = (v: string) =>
    PAYMENT_METHODS.find((p) => p.v === v)
      ? t(PAYMENT_METHODS.find((p) => p.v === v)!.lKey)
      : null;
  const eligible = transferEligible(assets);
  const assetItem = (a: Asset) => ({
    value: String(a.rowId),
    title: assetLabel(a),
    detail: a.institution ?? undefined,
    prefix: (
      <LogoTile
        name={a.institution || a.assetName}
        face={a.institution ? "institution" : "name"}
        size={40}
      />
    ),
  });
  const assetById = (id: number | null) =>
    id != null ? assets.find((a) => a.rowId === id) : undefined;
  const assetPick = (
    label: string,
    pool: Asset[],
    selected: number | null,
    onPick: (id: number | null) => void,
    close: () => void,
    withNone: boolean,
  ) => (
    <PickList
      label={label}
      selected={selected == null ? NONE : String(selected)}
      items={[
        ...(withNone ? [{ value: NONE, title: t("preset.noAccount") }] : []),
        ...pool.map(assetItem),
      ]}
      onPick={(v) => {
        onPick(v === NONE ? null : Number(v));
        close();
      }}
    />
  );

  const selectedCategory = categories.find((c) => c.rowId === categoryRowId);
  const draftTile = (
    <PresetTile
      preset={
        {
          expenseType: type,
        } as ExpenseTemplate
      }
      category={selectedCategory}
      className="size-x13 rounded-r4 [&>svg]:size-x6"
      size={24}
    />
  );

  const amountValue =
    amountNumber > 0 ? dsMoney(amountNumber) : t("preset.amountBlank");
  const feeValue = fee ? dsMoney(Number(fee)) : none;
  const interestValue = interest ? dsMoney(Number(interest)) : none;

  const title = isNew ? t("preset.add") : t("preset.edit");

  const stepBody =
    step == null ? null : step === "merchant" ? (
      <div className="pb-x2 pt-x3">
        <Input
          size="large"
          autoFocus
          aria-label={stepTitle(step)}
          value={draft}
          placeholder={t("preset.merchantPlaceholder")}
          maxLength={MERCHANT_MAX}
          autoComplete="off"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              confirmStep();
            }
          }}
        />
      </div>
    ) : step === "memo" ? (
      <Field
        label={stepTitle(step)}
        maxGraphemeCount={DESCRIPTION_MAX}
        className="pb-x2 pt-x1 [&_label]:sr-only"
      >
        <Textarea
          autoFocus
          rows={3}
          value={draft}
          placeholder={t("addTx.optional")}
          onChange={(e) => setDraft(e.target.value)}
        />
      </Field>
    ) : (
      <Field
        label={stepTitle(step)}
        description={
          step === "amount"
            ? t("preset.amountHint")
            : step === "interest"
              ? t("addTx.interestHint")
              : undefined
        }
        className="pb-x2 pt-x3 [&_label]:sr-only"
      >
        <AmountInput
          variant="underline"
          size="large"
          autoFocus
          value={draft}
          onValueChange={setDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              confirmStep();
            }
          }}
        />
      </Field>
    );

  return (
    <>
      <ResponsiveDialog
        open
        form
        dirty={dirty && step == null}
        onOpenChange={(next) => {
          if (next) return;
          if (step != null) leave.request();
          else onClose();
        }}
      >
        <ResponsiveDialogContent
          ref={contentRef}
          title={step != null ? stepTitle(step) : title}
          onBack={step != null ? () => void leave.request() : undefined}
          showCloseButton={step == null}
          headerAction={
            step != null && wide ? (
              <StepDoneButton onClick={confirmStep} />
            ) : undefined
          }
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            nameRef.current?.focus({ preventScroll: true });
          }}
        >
          {leave.node}
          {step != null && !wide && <SheetStepDone onClick={confirmStep} />}
          <ResponsiveDialogBody scrollFog>
            {step != null ? (
              stepBody
            ) : (
              <>
                {saveError && (
                  <Callout tone="critical" role="alert" className="mb-x4">
                    {t("preset.saveFailed")}
                  </Callout>
                )}
                <div className="pb-x2">
                  <ChipRadioGroup
                    aria-label={t("preset.typeLabel")}
                    value={type}
                    onValueChange={(v) => setType(v as TxKind)}
                  >
                    <ChipRadio value="EXPENSE" variant="outlineStrong">
                      {t("expense")}
                    </ChipRadio>
                    <ChipRadio value="INCOME" variant="outlineStrong">
                      {t("income")}
                    </ChipRadio>
                    <ChipRadio value="TRANSFER" variant="outlineStrong">
                      {t("addTx.transfer")}
                    </ChipRadio>
                  </ChipRadioGroup>
                </div>
                <div className="mb-x2 flex items-start gap-x3">
                  <span aria-hidden className="shrink-0">
                    {draftTile}
                  </span>
                  <Field
                    className="min-w-0 flex-1"
                    maxGraphemeCount={PRESET_NAME_MAX}
                    invalid={nameErr != null}
                    errorMessage={nameErr}
                  >
                    <Input
                      ref={nameRef}
                      size="large"
                      aria-label={t("savePreset.name")}
                      value={name}
                      placeholder={t("preset.namePlaceholder")}
                      autoComplete="off"
                      onChange={(e) => setName(e.target.value)}
                    />
                  </Field>
                </div>
                <div className="-mx-x6">
                  {isTransfer ? (
                    <>
                      <PickerRow
                        title={t("preset.fromAccount")}
                        prefix={<Wallet />}
                        value={
                          assetById(assetRowId)
                            ? assetLabel(assetById(assetRowId)!)
                            : null
                        }
                        placeholder={t("addTx.selectPlaceholder")}
                        surfaceTitle={t("preset.fromAccount")}
                        errorMessage={fromErr}
                      >
                        {({ close }) =>
                          assetPick(
                            t("preset.fromAccount"),
                            eligible,
                            assetRowId,
                            setAssetRowId,
                            close,
                            false,
                          )
                        }
                      </PickerRow>
                      <PickerRow
                        title={t("preset.toAccount")}
                        prefix={<Wallet />}
                        value={
                          assetById(toAssetRowId)
                            ? assetLabel(assetById(toAssetRowId)!)
                            : null
                        }
                        placeholder={t("addTx.selectPlaceholder")}
                        surfaceTitle={t("preset.toAccount")}
                        errorMessage={toErr}
                      >
                        {({ close }) =>
                          assetPick(
                            t("preset.toAccount"),
                            eligible.filter((a) => a.rowId !== assetRowId),
                            toAssetRowId,
                            setToAssetRowId,
                            close,
                            false,
                          )
                        }
                      </PickerRow>
                      <StepRow
                        icon={<Coins />}
                        title={t("preset.amountLabel")}
                        value={amountValue}
                        onClick={() => enterStep("amount")}
                      />
                      <StepRow
                        icon={<Percent />}
                        title={t("preset.feeLabel")}
                        value={feeValue}
                        onClick={() => enterStep("fee")}
                      />
                      {showInterest && (
                        <StepRow
                          icon={<Percent />}
                          title={t("addTx.interest")}
                          value={interestValue}
                          onClick={() => enterStep("interest")}
                        />
                      )}
                    </>
                  ) : (
                    <>
                      <PickerRow
                        title={t("category")}
                        prefix={<Tags />}
                        value={selectedCategory?.categoryName ?? null}
                        dot={
                          selectedCategory
                            ? getPaletteByColor(selectedCategory.color).color
                            : undefined
                        }
                        placeholder={t("preset.noneValue")}
                        surfaceTitle={t("category")}
                        errorMessage={categoryErr}
                      >
                        {({ close }) => (
                          <CategoryPickList
                            categories={categories}
                            kind={type === "INCOME" ? "INCOME" : "EXPENSE"}
                            selectedRowId={categoryRowId}
                            onPick={(id) => {
                              setCategoryRowId(id);
                              close();
                            }}
                          />
                        )}
                      </PickerRow>
                      <StepRow
                        icon={<FileText />}
                        title={t("preset.defaultMerchant")}
                        value={merchant || none}
                        onClick={() => enterStep("merchant")}
                      />
                      <PickerRow
                        title={t("accountCard")}
                        prefix={<Wallet />}
                        value={
                          assetById(assetRowId)
                            ? assetLabel(assetById(assetRowId)!)
                            : t("preset.noAccount")
                        }
                        surfaceTitle={t("accountCard")}
                      >
                        {({ close }) =>
                          assetPick(
                            t("accountCard"),
                            assets,
                            assetRowId,
                            setAssetRowId,
                            close,
                            true,
                          )
                        }
                      </PickerRow>
                      <PickerRow
                        title={t("paymentMethodLabel")}
                        prefix={<CreditCard />}
                        value={payLabel(paymentMethod) ?? t("preset.noPayment")}
                        surfaceTitle={t("paymentMethodLabel")}
                      >
                        {({ close }) => (
                          <PickList
                            label={t("paymentMethodLabel")}
                            selected={paymentMethod || NONE}
                            items={[
                              { value: NONE, title: t("preset.noPayment") },
                              ...PAYMENT_METHODS.map((p) => ({
                                value: p.v,
                                title: t(p.lKey),
                              })),
                            ]}
                            onPick={(v) => {
                              setPaymentMethod(v === NONE ? "" : v);
                              close();
                            }}
                          />
                        )}
                      </PickerRow>
                      <StepRow
                        icon={<Coins />}
                        title={t("preset.amountLabel")}
                        value={amountValue}
                        onClick={() => enterStep("amount")}
                      />
                    </>
                  )}
                  <StepRow
                    icon={<StickyNote />}
                    title={t("memo")}
                    value={description || t("preset.memoNone")}
                    onClick={() => enterStep("memo")}
                  />
                  {!isTransfer && (
                    <List>
                      <ListSwitchItem
                        title={t(
                          type === "INCOME"
                            ? "preset.fixedTitle.income"
                            : "preset.fixedTitle.expense",
                        )}
                        detail={t("preset.fixedDesc")}
                        checked={isFixed}
                        onCheckedChange={(c) => setIsFixed(c === true)}
                      />
                    </List>
                  )}
                </div>
              </>
            )}
          </ResponsiveDialogBody>
          {step == null && (
            <FormFooter
              cancelLabel={tc("cancel")}
              submitLabel={isNew ? tc("add") : tc("save")}
              loading={submitting}
              onSubmit={submit}
            />
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
