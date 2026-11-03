import { useId, useMemo, useState } from "react";
import {
  MAX_AMOUNT,
  blockNonDigitKey,
  parseAmount,
  sanitizeAmountInput,
} from "@/shared/lib/groo/amount";
import { nameIssue } from "@/shared/lib/groo/name-policy";
import { NameCounter } from "@/shared/ui/groo/name-counter";
import { useTranslation } from "react-i18next";
import { ModalShell } from "@/shared/ui/groo/dialogs";
import { ModalFooter } from "@/shared/ui/groo/modal-footer";
import { CategoryGrid, CategoryTile } from "@/shared/ui/category-tile";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
  TransferAccountFields,
  isLoanTarget,
  transferPartiesReady,
} from "@/features/asset-transfer";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Checkbox } from "@/shared/ui/checkbox";
import { Field, FieldLabel } from "@/shared/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  useCreateExpenseTemplate,
  useExpenseCategories,
  useExpenseTemplates,
  useUpdateExpenseTemplate,
} from "@/features/expense";
import { useAssets } from "@/features/asset";
import { Skeleton as SkeletonBase } from "@/shared/ui/skeleton";
import type {
  ExpenseTemplate,
  ExpenseTemplateFormValues,
} from "@/entities/expense-template";
import type { TxKind } from "@/entities/expense";

/** 프리셋 이름 상한 — 카테고리·라벨·태그와 같은 12자. 목록 행에 한 줄로 들어간다. */
const PRESET_NAME_MAX = 12;
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

export function PresetEditDialog({
  preset,
  mobile,
  onClose,
}: {
  preset: ExpenseTemplate | null;
  mobile: boolean;
  onClose: () => void;
}) {
  const uid = useId(); // 선택 칸 이름 잇기
  const { t } = useTranslation("expense");
  const { t: tCommon } = useTranslation("common");
  const isNew = !preset;
  const categoriesQ = useExpenseCategories();
  const assetsQ = useAssets();
  // 목록 화면에서만 열리는 다이얼로그라 캐시가 이미 차 있다(추가 요청 없음).
  const templatesQ = useExpenseTemplates();
  const createMut = useCreateExpenseTemplate();
  const updateMut = useUpdateExpenseTemplate();

  const categories = useMemo(() => categoriesQ.data ?? [], [categoriesQ.data]);
  const assets = useMemo(() => assetsQ.data?.assets ?? [], [assetsQ.data]);

  const [type, setType] = useState<TxKind>(preset?.expenseType ?? "EXPENSE");
  const [name, setName] = useState(preset?.templateName ?? "");
  const [categoryRowId, setCategoryRowId] = useState<number | null>(
    preset?.categoryRowId ?? null,
  );
  const [merchant, setMerchant] = useState(preset?.merchant ?? "");
  const [description, setDescription] = useState(preset?.description ?? "");
  const [paymentMethod, setPaymentMethod] = useState(
    preset?.paymentMethod ?? "",
  );
  const [assetRowId, setAssetRowId] = useState<number | null>(
    preset?.assetRowId ?? null,
  );
  // 이체 전용 — 보내는 계좌는 위 assetRowId 를 그대로 쓴다(서버도 같은 컬럼이다).
  const [toAssetRowId, setToAssetRowId] = useState<number | null>(
    preset?.toAssetRowId ?? null,
  );
  const [fee, setFee] = useState(preset?.fee ? String(preset.fee) : "");
  const [interest, setInterest] = useState(
    preset?.interestAmount ? String(preset.interestAmount) : "",
  );
  const [lockAmount, setLockAmount] = useState(preset?.lockAmount === "Y");
  // 고정 수입·지출 기본값 — "고정 금액"(금액을 저장해 둘지)과는 별개다. 통계의 분류 표식이다.
  const [isFixed, setIsFixed] = useState(preset?.isFixed ?? false);
  const [amount, setAmount] = useState(
    preset?.amount != null ? String(preset.amount) : "",
  );

  const isTransfer = type === "TRANSFER";
  // 이자는 **금액을 고정했을 때만** 받는다(사용자 결정 2026-09-15). 금액이 매달
  // 다르면 이자도 매달 다르니, 박아 둔 이자는 불러올 때마다 틀린 값이 된다.
  // 수수료는 그대로 둔다 — 계좌 짝의 성질이라 매번 같을 수 있다.
  const showInterest =
    isTransfer && lockAmount && isLoanTarget(assets, toAssetRowId);

  // 타입이 바뀌면 해당 타입의 카테고리가 아닌 경우 초기화.
  // 이체에는 카테고리가 없다 — 남겨 두면 저장할 때 서버가 거절한다.
  // (한 번 비우면 조건이 닫히므로 렌더 중에 맞춰도 반복되지 않는다)
  if (categoryRowId != null) {
    const cat = categories.find((c) => c.rowId === categoryRowId);
    // 받기 전에는 읽어 온 값을 유지하고, 받았는데 목록에 없으면(지운 카테고리) 비운다 — 안 비우면 지운 id 가 저장된다
    if (
      isTransfer ||
      (categoriesQ.data !== undefined && (!cat || cat.expenseType !== type))
    )
      setCategoryRowId(null);
  }
  // 이체가 아니게 되면 남아 있던 이체 칸을 지운다 — 실려 나가면 서버가 거절한다.
  if (!isTransfer && (toAssetRowId != null || fee || interest)) {
    setToAssetRowId(null);
    setFee("");
    setInterest("");
  }
  // 자산을 아직 못 받았으면(대출인지 모른다) 읽어 온 이자를 지우지 않는다 — 먼저 지우면 받은 뒤에도 비어 저장하면 이자가 사라진다
  if (assetsQ.data !== undefined && !showInterest && interest) setInterest("");

  const topCategories = useMemo(
    () =>
      categories
        .filter((c) => c.expenseType === type && c.parentRowId == null)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [categories, type],
  );

  const childrenByParent = useMemo(() => {
    const map = new Map<number, typeof categories>();
    for (const c of categories) {
      if (c.parentRowId == null || c.expenseType !== type) continue;
      const arr = map.get(c.parentRowId) ?? [];
      arr.push(c);
      map.set(c.parentRowId, arr);
    }
    for (const arr of map.values())
      arr.sort((a, b) => a.sortOrder - b.sortOrder);
    return map;
  }, [categories, type]);

  // 선택된 카테고리의 부모(자신이 최상위면 자신) — 타일 active 판정 + 세부 Select 노출 조건
  const selectedCategory =
    categoryRowId != null
      ? categories.find((c) => c.rowId === categoryRowId)
      : null;
  const selectedParentId = selectedCategory
    ? (selectedCategory.parentRowId ?? selectedCategory.rowId)
    : null;

  // 같은 이름 프리셋이 소리 없이 두 개 생기던 자리(QA #54). 서버에 중복 에러 코드가
  // 없어 클라이언트가 볼 수밖에 없다.
  const takenNames = (templatesQ.data ?? [])
    .filter((p) => p.rowId !== preset?.rowId)
    .map((p) => p.templateName);
  const issue = nameIssue(name, PRESET_NAME_MAX, takenNames);
  const nameErr =
    issue === "tooLong"
      ? t("preset.nameTooLong")
      : issue === "duplicate"
        ? t("preset.nameDuplicate")
        : null;

  const amountNumber = parseAmount(amount);
  const amountTooLarge = lockAmount && amountNumber > MAX_AMOUNT;

  // 금액은 선택이다 — 프리셋은 금액을 모르는 채로 양식만 저장하려고 만든 것이다.
  // 고정 금액을 켰을 때만 값이 있어야 한다(불러오는 거래가 그 값을 그대로 받는다).
  const canSave =
    issue == null &&
    // 이체는 카테고리가 없는 대신 양쪽 계좌가 있어야 성립한다.
    (isTransfer
      ? transferPartiesReady(assetRowId, toAssetRowId)
      : categoryRowId != null) &&
    !amountTooLarge &&
    (!lockAmount || amountNumber > 0);
  const submitting = createMut.isPending || updateMut.isPending;

  const submit = () => {
    if (!canSave) return;
    // 본문은 규칙 하나로 만든다 — **이 다이얼로그가 가진 칸만 싣는다.** PUT 은 세 갈래다
    // (`Patch`: 키 없음=유지 · null=지움 · 값=교체, QA #96 · 프리셋은 #325 가 옮겼다).
    // 칸이 있으면 지금 상태를 그대로 싣고(비었으면 `null` — 사용자가 지운 것이다),
    // 칸이 없으면 키를 뺀다(서버가 지금 값을 지킨다). 자산·거래와 같은 판단이다.
    const payload: ExpenseTemplateFormValues = {
      templateName: name.trim(),
      // 폼이 필수로 강제한다 — 비면 저장 버튼이 안 눌린다(`canSave`). 그래서 여기로
      // null 이 내려올 일이 없고, 서버도 안 보낸 요청의 카테고리를 지키게 됐다(#325).
      categoryRowId,
      // 이체 칸도 이 화면의 칸이다 — 지출·수입으로 바꿔 저장하면 `null` 로 지워진다.
      toAssetRowId: isTransfer ? toAssetRowId : null,
      fee: isTransfer && fee ? Number(fee) : null,
      // 자산을 받기 전이면 대출인지 모르니 읽어 온 값을 그대로 보낸다(받은 뒤에는 지금 규칙) — 안 그러면 조용히 null 로 저장된다
      interestAmount:
        (assetsQ.data === undefined
          ? isTransfer && lockAmount
          : showInterest) && interest
          ? Number(interest)
          : null,
      // 아래 넷은 이 다이얼로그가 그리는 칸이다 — 비운 채 저장하면 지워져야 한다.
      // `undefined` 로 키를 빼면 새 서버가 "안 고침" 으로 읽어, 화면만 지워진 척 닫히고
      // 옛 계좌·거래처·메모·결제수단이 서버에 그대로 남았다.
      assetRowId: assetRowId ?? null,
      expenseType: type,
      // 금액만 계약이 다르다 — `lockAmount` 와 한 쌍이라 서버가 둘을 함께 본다.
      // 고정을 끄면 서버가 실린 금액을 버리므로(`resolveAmount`) 키를 빼도 옛 금액이
      // 남지 않는다. 금액칸 자체가 고정을 켰을 때만 그려지니 규칙과도 어긋나지 않는다.
      amount: lockAmount ? amountNumber : undefined,
      merchant: isTransfer ? null : merchant.trim() || null,
      // 메모도 이제 이 화면의 칸이다(D2). 종전엔 칸이 없고 읽어 온 값도 안 들고 있어서
      // 무엇을 실어도 지어낸 값이라 **키를 뺐다** — 서버를 `Optional` 로 옮긴(#325)
      // 계기가 이 칸이다. 칸이 생겼으니 지운 메모는 실제로 지워져야 하고, 그러려면
      // 키를 빼는 게 아니라 `null` 을 실어야 한다. 앱도 같다(desk-app #330).
      description: description.trim() || null,
      paymentMethod: isTransfer ? null : paymentMethod || null,
      lockAmount: lockAmount ? "Y" : "N",
      // 이체는 고정이 없다 — 켜 둔 채 이체로 바꿔도 싣지 않는다(서버도 꺼 버린다).
      isFixed: isTransfer ? undefined : isFixed,
    };
    if (preset) {
      updateMut.mutate(
        { id: preset.rowId, data: payload },
        { onSuccess: onClose },
      );
    } else {
      createMut.mutate(payload, { onSuccess: onClose });
    }
  };

  const Footer = (
    <ModalFooter
      onSave={submit}
      saveLabel={isNew ? tCommon("add") : tCommon("save")}
      saving={submitting}
      saveDisabled={!canSave}
      onCancel={onClose}
    />
  );

  return (
    <ModalShell
      title={isNew ? t("preset.add") : t("preset.edit")}
      onClose={onClose}
      mobile={mobile}
      size="md"
      footer={Footer}
    >
      {/* 타입 segment */}
      <Tabs
        value={type}
        onValueChange={(v) => v && setType(v as TxKind)}
        className="mb-4"
      >
        <TabsList variant="pill" size="sm" className="w-full">
          <TabsTrigger value="EXPENSE" className="flex-1">
            {t("expense")}
          </TabsTrigger>
          <TabsTrigger value="INCOME" className="flex-1">
            {t("income")}
          </TabsTrigger>
          <TabsTrigger value="TRANSFER" className="flex-1">
            {t("addTx.transfer")}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Field style={{ marginBottom: 14 }}>
        <FieldLabel>{t("savePreset.name")}</FieldLabel>
        <Input
          aria-invalid={!!nameErr}
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, PRESET_NAME_MAX))}
          placeholder={t("preset.namePlaceholder")}
          maxLength={PRESET_NAME_MAX}
          autoFocus
        />
        <NameCounter
          len={name.trim().length}
          max={PRESET_NAME_MAX}
          err={nameErr}
        />
      </Field>

      {isTransfer ? (
        <TransferAccountFields
          assets={assets}
          fromAssetRowId={assetRowId}
          toAssetRowId={toAssetRowId}
          fee={fee}
          interest={interest}
          amountNumber={amountNumber}
          onFromChange={setAssetRowId}
          onToChange={setToAssetRowId}
          onFeeChange={setFee}
          onInterestChange={setInterest}
          interestEnabled={lockAmount}
        />
      ) : (
        <>
          <Field style={{ marginBottom: 14 }}>
            <FieldLabel id={`${uid}cat-label`}>{t("category")}</FieldLabel>
            {categoriesQ.isLoading ? (
              <CategoryGrid>
                {Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonBase key={i} className="h-16 w-full rounded-md" />
                ))}
              </CategoryGrid>
            ) : (
              <CategoryGrid>
                {topCategories.map((c) => (
                  <CategoryTile
                    key={c.rowId}
                    name={c.categoryName}
                    color={c.color ?? undefined}
                    icon={c.icon}
                    active={selectedParentId === c.rowId}
                    onClick={() => {
                      const firstChild = childrenByParent.get(c.rowId)?.[0];
                      setCategoryRowId(firstChild ? firstChild.rowId : c.rowId);
                    }}
                  />
                ))}
              </CategoryGrid>
            )}
            {/* 세부 카테고리 — 반복거래 추가와 동일 패턴: 자식이 있으면 상위/세부 Select 로 변경 가능 */}
            {!categoriesQ.isLoading &&
              selectedParentId != null &&
              (childrenByParent.get(selectedParentId)?.length ?? 0) > 0 && (
                <div style={{ marginTop: 10 }}>
                  <Select
                    value={categoryRowId != null ? String(categoryRowId) : ""}
                    onValueChange={(v) => setCategoryRowId(Number(v))}
                  >
                    <SelectTrigger
                      id={`${uid}cat`}
                      aria-labelledby={`${uid}cat-label ${uid}cat`}
                    >
                      <SelectValue
                        placeholder={t("addTx.subCategoryPlaceholder")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {/* 상위 자신은 고를 수 없다 — 하위가 있는 상위는 프리셋도 거래도 안 받는다
                          (EXPENSE_CATEGORY_NOT_LEAF). 거래 추가와 같은 자리(QA 30 13). */}
                      <SelectGroup>
                        <SelectLabel>{t("addTx.detail")}</SelectLabel>
                        {(childrenByParent.get(selectedParentId) ?? []).map(
                          (child) => (
                            <SelectItem
                              key={child.rowId}
                              value={String(child.rowId)}
                            >
                              {child.categoryName}
                            </SelectItem>
                          ),
                        )}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              )}
          </Field>

          <Field style={{ marginBottom: 14 }}>
            <FieldLabel>{t("preset.defaultMerchant")}</FieldLabel>
            <Input
              value={merchant}
              onChange={(e) =>
                setMerchant(e.target.value.slice(0, MERCHANT_MAX))
              }
              placeholder={t("preset.merchantPlaceholder")}
              maxLength={MERCHANT_MAX}
            />
          </Field>

          <Field style={{ marginBottom: 14 }}>
            <FieldLabel id={`${uid}pm-label`}>
              {t("paymentMethodLabel")}
            </FieldLabel>
            <Select
              value={paymentMethod || "__none__"}
              onValueChange={(v) => setPaymentMethod(v === "__none__" ? "" : v)}
            >
              <SelectTrigger
                id={`${uid}pm`}
                aria-labelledby={`${uid}pm-label ${uid}pm`}
              >
                <SelectValue placeholder={t("selectNone")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("selectNone")}</SelectItem>
                {PAYMENT_METHODS.map((pm) => (
                  <SelectItem key={pm.v} value={pm.v}>
                    {t(pm.lKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field style={{ marginBottom: 14 }}>
            <FieldLabel id={`${uid}asset-label`}>{t("accountCard")}</FieldLabel>
            {assetsQ.isLoading ? (
              <SkeletonBase className="h-9 w-full rounded-md" />
            ) : (
              <Select
                value={assetRowId != null ? String(assetRowId) : "__none__"}
                onValueChange={(v) =>
                  setAssetRowId(v === "__none__" ? null : Number(v))
                }
              >
                <SelectTrigger
                  id={`${uid}asset`}
                  aria-labelledby={`${uid}asset-label ${uid}asset`}
                >
                  <SelectValue placeholder={t("selectNone")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("selectNone")}</SelectItem>
                  {assets.map((a) => (
                    <SelectItem key={a.rowId} value={String(a.rowId)}>
                      {a.institution
                        ? `${a.institution} · ${a.assetName}`
                        : a.assetName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        </>
      )}

      {/* 메모 — 불러오면 거래의 메모로 들어간다. 자리는 앱과 같다(기본 내역 ↔ 결제 수단
          사이, desk-app #330). 컨트롤·상한은 그 값이 흘러 들어가는 거래 시트의 메모 칸과
          맞춘다(Textarea · 500자). */}
      <Field style={{ marginBottom: 14 }}>
        <FieldLabel>{t("memo")}</FieldLabel>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={DESCRIPTION_MAX}
          placeholder={t("addTx.optional")}
          style={{ minHeight: 64 }}
        />
      </Field>

      <div
        style={{
          padding: 12,
          background: "var(--bg-sunken)",
          borderRadius: "var(--radius-tile)",
          marginBottom: 4,
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
          }}
        >
          <Checkbox
            size="sm"
            checked={lockAmount}
            onCheckedChange={(c) => setLockAmount(c === true)}
          />
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "var(--text-label-sm)",
                fontWeight: "700",
                color: "var(--fg-primary)",
              }}
            >
              {t("preset.lockAmountTitle")}
            </div>
            <div
              style={{
                fontSize: "var(--text-caption)",
                color: "var(--fg-tertiary)",
                marginTop: 2,
              }}
            >
              {t("preset.lockAmountDesc")}
            </div>
          </div>
        </label>

        {lockAmount && (
          <div
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            <FieldLabel style={{ marginBottom: 4 }}>
              {t("preset.lockAmountLabel")}
            </FieldLabel>
            <div style={{ position: "relative" }}>
              <Input
                className="num"
                value={amount}
                onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
                onKeyDown={blockNonDigitKey}
                placeholder="0"
                style={{
                  paddingRight: 36,
                  textAlign: "right",
                  fontSize: "var(--text-body-lg)",
                  fontWeight: "700",
                }}
                inputMode="numeric"
              />
              <span
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "var(--text-label-sm)",
                  color: "var(--fg-tertiary)",
                  fontWeight: "700",
                  pointerEvents: "none",
                }}
              >
                원
              </span>
            </div>
            {amountTooLarge && (
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: "var(--text-caption)",
                  color: "var(--color-fg-critical)",
                }}
              >
                {tCommon("amountTooLarge")}
              </p>
            )}
          </div>
        )}
      </div>

      {!isTransfer && (
        <div
          style={{
            padding: 12,
            background: "var(--bg-sunken)",
            borderRadius: "var(--radius-tile)",
            marginTop: 10,
            marginBottom: 4,
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
            }}
          >
            <Checkbox
              size="sm"
              checked={isFixed}
              onCheckedChange={(c) => setIsFixed(c === true)}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "var(--text-label-sm)",
                  fontWeight: "700",
                  color: "var(--fg-primary)",
                }}
              >
                {t(
                  type === "INCOME"
                    ? "preset.fixedTitle.income"
                    : "preset.fixedTitle.expense",
                )}
              </div>
              <div
                style={{
                  fontSize: "var(--text-caption)",
                  color: "var(--fg-tertiary)",
                  marginTop: 2,
                }}
              >
                {t("preset.fixedDesc")}
              </div>
            </div>
          </label>
        </div>
      )}
    </ModalShell>
  );
}
