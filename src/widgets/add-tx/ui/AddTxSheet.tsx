import { useCallback, useId, useMemo, useState, useRef } from "react";
import {
  MAX_AMOUNT,
  blockNonDigitKey,
  parseAmount,
  sanitizeAmountInput,
} from "@/shared/lib/groo/amount";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Bookmark,
  Info,
  MoreHorizontal,
  Plus,
  Scissors,
} from "lucide-react";
import { ModalShell } from "@/shared/ui/groo/dialogs";
import { ModalFooter } from "@/shared/ui/groo/modal-footer";
import { Button } from "@/shared/ui/button";
import { CategoryGrid, CategoryTile } from "@/shared/ui/category-tile";
import { Input } from "@/shared/ui/input";
import { Checkbox } from "@/shared/ui/checkbox";
import { Field, FieldLabel } from "@/shared/ui/field";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Textarea } from "@/shared/ui/textarea";
import { Switch } from "@/shared/ui/switch";
import { renderIcon } from "@/shared/lib";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import { ConfirmDialog } from "@/shared/ui/groo/dialogs";
import {
  KRW,
  money,
  formatChartAxis,
  formatDay,
} from "@/shared/lib/groo/format";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { InputDatePicker } from "@/shared/ui/input-date-picker";
import { InputTimePicker } from "@/shared/ui/input-time-picker";
import {
  useCreateExpense,
  useCreateExpenseTemplate,
  useExpenseCategories,
  useExpenseTemplates,
  useLedgerResultToast,
  useReplaceExpense,
  useTouchExpenseTemplate,
  useUpdateExpense,
} from "@/features/expense";
import { closedCycleNoteText } from "@/features/expense/lib/closed-cycle-note";
import {
  useAssets,
  useCreateTransfer,
  useUpdateTransfer,
} from "@/features/asset";
import { useDefaultCurrency } from "@/features/user";
import {
  SmsPasteField,
  useCommitSms,
  type SmsParseResult,
} from "@/features/sms";
import { useExpenseSplits } from "@/features/expense-split";
import type {
  Expense,
  ExpenseCategory,
  ExpenseFormValues,
} from "@/entities/expense";
import type { AssetTransfer } from "@/entities/asset";
import type { Asset, AssetType } from "@/entities/asset";
import type { ExpenseTemplate } from "@/entities/expense-template";
import type { TxKind } from "@/entities/expense";
import { closedCycleSpan, cyclePaymentDate } from "@/entities/expense";
import { isHttpStatus } from "@/shared/api";
import type { ExpenseSplitFormValue } from "@/entities/expense-split";
import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  formatOriginalAmount,
} from "@/shared/lib/groo/currency";
import { SplitTxDialog } from "@/features/expense-split/ui/SplitTxDialog";
import {
  TransferAccountFields,
  isLoanTarget,
  transferPartiesLabel,
  transferPartiesReady,
} from "@/features/asset-transfer";

/** 결제 수단 → 허용 자산 타입. null이면 전체 허용. */
const PAYMENT_ASSET_TYPES: Record<string, AssetType[] | null> = {
  CASH: ["CASH"],
  CARD: ["CREDIT_CARD", "CHECK_CARD"],
  TRANSFER: ["BANK_ACCOUNT", "SAVINGS"],
  OTHER: null,
};

/** 카드사 공통 할부 개월 — 2~12, 18, 24. */
const INSTALLMENT_MONTHS = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24,
] as const;

type TxType = "EXPENSE" | "INCOME" | "TRANSFER";

type Props = {
  onClose: () => void;
  /** Desktop=false / Mobile=true — ModalShell 패턴 전환용 */
  mobile: boolean;
  /** 편집 모드일 때 전달 — 전달되면 수정/삭제, 아니면 신규 생성 */
  expense?: Expense | null;
  /** 신규 생성 시 기본 날짜(yyyy-MM-dd). 미지정이면 오늘. expense가 있으면 무시. */
  defaultDate?: string;
  /**
   * 이체 편집 모드 — 전달되면 그 이체를 고친다.
   * 서버가 이자 지출·잔액 이력을 되돌렸다 다시 만들고 rowId 는 유지한다.
   */
  editTransfer?: AssetTransfer | null;
  /**
   * 고쳐 쓰기 시드(D13) — 결제가 끝나 돈 칸이 잠긴 거래를 **새 거래로 교체**한다.
   *
   * 주면 편집이 아니라 **새 거래 모드**로 열리고, 그 거래의 값이 전부 채워진다(문자 초안이
   * 새 거래 시트를 채워 여는 구조와 같다). 분할은 편집 시트가 이미 불러 둔 값을 받아
   * 본문에 싣는다. 저장은 `POST /expense/{id}/replace` 다.
   *
   * 보통은 잠긴 편집 시트의 [고쳐 쓰기]가 이 모드로 스스로를 갈아 끼운다 — 부모가 따로
   * 들 상태가 없다.
   */
  rewrite?: RewriteSeed | null;
  /**
   * 수정 저장이 끝났다 — 다시 받기가 끝난 뒤 응답 거래로 부른다(`onClose` 보다 먼저). 거래 상세가 [수정] 뒤 상세로 돌아와 새 값을
   * 그릴 때 쓴다(I-21 7a). 새로 만들기 · 고쳐 쓰기에는 부르지 않는다(고쳐 쓰기는 옛 거래가 지워져 돌아갈 상세가 없다).
   */
  onSaved?: (saved: Expense) => void;
  /** 이체 수정 저장이 끝났다 — `onSaved` 의 이체 짝 */
  onTransferSaved?: (saved: AssetTransfer) => void;
  /**
   * 고쳐 쓰기 저장이 끝났다(옛 거래가 지워지고 새 거래가 생겼다 — 404 로 이미 교체돼 있던 갈래 포함). 거래 상세가 돌아갈 거래가 없으니 상세까지
   * 닫는다(I-21 7a). `onClose` 보다 먼저 불린다.
   */
  onReplaced?: () => void;
};

/** 고쳐 쓸 거래와 그 거래의 분할 — 분할은 교체 본문에 함께 실린다. */
type RewriteSeed = {
  of: Expense;
  splits: ExpenseSplitFormValue[];
};

const todayLocal = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const nowTimeLocal = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// "YYYY-MM-DDTHH:mm[:ss]" 또는 "YYYY-MM-DD HH:mm[:ss]" 에서 HH:mm 추출
const extractTime = (s?: string | null) => {
  if (!s) return null;
  const m = /[T ](\d{2}:\d{2})/.exec(s);
  return m ? m[1] : null;
};

export function AddTxSheet({
  onClose,
  mobile,
  expense,
  defaultDate,
  editTransfer,
  rewrite,
  onSaved,
  onTransferSaved,
  onReplaced,
}: Props) {
  const { t, i18n } = useTranslation("expense");
  const { t: tc } = useTranslation("common");
  const isEditTransfer = !!editTransfer;
  const isEdit = !!expense || isEditTransfer;
  /** 고쳐 쓰기 — 편집이 아니라 새 거래 모드다. 편집·이체 편집과는 함께 오지 않는다. */
  const rewriteOf = !isEdit ? (rewrite?.of ?? null) : null;
  const isRewrite = rewriteOf != null;
  /** 칸을 채울 거래 — 편집이면 그 거래, 고쳐 쓰기면 교체될 거래. */
  const seed = expense ?? rewriteOf;
  /**
   * 시스템이 만든 거래 — 매도 실현손익·이체 이자·카드 이월. 금액·날짜·자산은 계산 결과라
   * 못 고친다. 카테고리·메모는 분류라서 열어 둔다. 서버도 같은 규칙으로 거른다.
   */
  const isAutoGenerated = !!expense?.autoSource;
  /**
   * 결제가 끝난 카드 거래 — 돈 칸을 못 고친다(D12). 서버가 판정해 내려 준다(할부는 첫
   * 결제일부터라 화면이 세면 갈린다). 카테고리·가맹점·메모는 그대로 고친다.
   */
  const isMoneyLocked = !!expense && expense.moneyLocked === true;
  /**
   * 돈 칸 잠금 — 자동 생성 거래와 결제 끝난 거래가 같은 칸을 잠근다. 금액·날짜·시간·자산에
   * 더해 **통화·환율·원 통화 금액·결제수단·할부**까지다: 환율을 바꾸면 금액이 다시
   * 계산되고(fxSeed), 결제수단을 바꾸면 자산이 풀려서(allowAsset) 금액·자산 칸을 잠가
   * 둬도 돈 칸이 옆길로 바뀐다.
   */
  const moneyFieldsLocked = isAutoGenerated || isMoneyLocked;
  /**
   * [고쳐 쓰기]를 쓸 수 있나 — 서버가 판정해 내려 준다(환불·자동 생성·중도 정리한 할부는
   * 교체를 거절한다). 잠겼는데 못 쓰는 경우는 사실상 중도 정리한 할부뿐이다 — 버튼을 띄워
   * 두면 저장에서야 EXP_047 로 막혔다(QA 26차 3). 옛 서버엔 값이 없어 잠금으로 본다.
   */
  const isReplaceable = expense?.replaceable ?? isMoneyLocked;
  // [고쳐 쓰기]를 누르면 이 시트를 새 거래 모드 시트로 갈아 끼운다.
  const [rewriting, setRewriting] = useState(false);
  const notifyResult = useLedgerResultToast();

  const PAYMENT_METHODS: { v: string; l: string }[] = [
    { v: "CASH", l: t("form.paymentMethod.CASH") },
    { v: "CARD", l: t("form.paymentMethod.CARD") },
    { v: "TRANSFER", l: t("paymentTransferFull") },
    { v: "OTHER", l: t("form.paymentMethod.OTHER") },
  ];

  const categoriesQ = useExpenseCategories();
  const assetsQ = useAssets();
  const createMut = useCreateExpense();
  const updateMut = useUpdateExpense();
  const replaceMut = useReplaceExpense();
  const createTransferMut = useCreateTransfer();
  const updateTransferMut = useUpdateTransfer();
  const touchPresetMut = useTouchExpenseTemplate();
  const commitSmsMut = useCommitSms();
  // 편집 모드: 기존 분할 내역 — 금액 변경 시 분할 합과 일치 여부 판정용
  const splitsQ = useExpenseSplits(expense?.rowId ?? null);

  const categories: ExpenseCategory[] = useMemo(
    () => categoriesQ.data ?? [],
    [categoriesQ.data],
  );
  const assets: Asset[] = useMemo(
    () => assetsQ.data?.assets ?? [],
    [assetsQ.data],
  );

  // 이름 없는 콤보박스를 없앤다 — 보이는 라벨(과 값)을 aria-labelledby 로 잇는다. 라벨 id · 트리거 id
  const uid = useId();
  const nameOf = (key: string) => ({
    label: { id: `${uid}${key}-label` },
    trigger: {
      id: `${uid}${key}`,
      "aria-labelledby": `${uid}${key}-label ${uid}${key}`,
    },
  });
  const [type, setType] = useState<TxType>(
    editTransfer ? "TRANSFER" : (seed?.expenseType ?? "EXPENSE"),
  );

  // 공통 필드
  const [amount, setAmount] = useState<string>(
    editTransfer
      ? String(editTransfer.amount)
      : seed?.amount
        ? String(seed.amount)
        : "",
  );
  const [description, setDescription] = useState(
    editTransfer?.description ?? seed?.description ?? "",
  );
  const [expenseDate, setExpenseDate] = useState<string>(
    editTransfer
      ? editTransfer.transferDate.slice(0, 10)
      : seed?.expenseDate
        ? seed.expenseDate.slice(0, 10)
        : (defaultDate ?? todayLocal()),
  );
  const [expenseTime, setExpenseTime] = useState<string>(
    // 이체 편집이면 그 이체의 시각 — 안 읽으면 금액만 고쳐도 시각이 지금으로 밀린다.
    () =>
      extractTime(editTransfer?.transferDate ?? seed?.expenseDate) ??
      nowTimeLocal(),
  );
  const [merchant, setMerchant] = useState(seed?.merchant ?? "");
  // 고정 수입·지출 — 월급·월세처럼 매달 정해진 거래. 통계가 따로 나눠 본다(돈에는 영향 없음).
  const [isFixed, setIsFixed] = useState(seed?.isFixed ?? false);
  const [paymentMethod, setPaymentMethod] = useState(seed?.paymentMethod ?? "");
  // 할부 개월 — 신용카드 결제에만 의미. '' = 일시불.
  const [installmentMonths, setInstallmentMonths] = useState<string>(
    seed?.installmentMonths ? String(seed.installmentMonths) : "",
  );
  // 해외 결제 — 원 통화 금액·환율을 남긴다. 셋이 함께여야 카드사 청구 환율과 대사할 수 있다.
  //
  // 우선순위는 **고른 값 > 이 거래의 값 > 설정의 기본 통화**다(D7 · QA #124).
  //
  // 기본 통화는 **새 거래에만** 쓴다. 편집은 그 거래의 값으로 연다 — 원화 거래는
  // `originalCurrency` 가 `null` 이라, 여기서 기본 통화로 흘리면 원화로 적어 둔 거래가
  // 해외 결제 입력으로 열린다. 자산 편집의 통화 칸과 같은 판단이다. 고쳐 쓰기도 새 거래
  // 모드지만 그 거래의 값으로 연다 — 옮겨 적는 것이지 새로 쓰는 게 아니다.
  //
  // `useState` 초기값으로 굳히지도 않는다 — `/me/preferences` 는 설정 화면을 안 들른
  // 세션에서 이 시트보다 늦게 도착해서, 초기값으로 받으면 첫 렌더의 `KRW` 에 잠긴다.
  const defaultCurrency = useDefaultCurrency();
  const [origCurrencyPick, setOrigCurrency] = useState<string | null>(null);
  const origCurrency =
    origCurrencyPick ??
    (seed ? (seed.originalCurrency ?? DEFAULT_CURRENCY) : defaultCurrency);
  const [origAmount, setOrigAmount] = useState<string>(
    seed?.originalAmount != null ? String(seed.originalAmount) : "",
  );
  const [fxRate, setFxRate] = useState<string>(
    seed?.exchangeRate != null ? String(seed.exchangeRate) : "",
  );

  // EXPENSE/INCOME 전용
  const [categoryRowId, setCategoryRowId] = useState<number | null>(
    seed?.categoryRowId ?? null,
  );
  const [assetRowId, setAssetRowId] = useState<number | null>(
    seed?.assetRowId ?? null,
  );

  // TRANSFER 전용
  const [fromAssetRowId, setFromAssetRowId] = useState<number | null>(
    editTransfer?.fromAssetRowId ?? null,
  );
  const [toAssetRowId, setToAssetRowId] = useState<number | null>(
    editTransfer?.toAssetRowId ?? null,
  );
  const [fee, setFee] = useState<string>(
    editTransfer?.fee ? String(editTransfer.fee) : "",
  );
  // 대출 상환의 이자 — 상환액 중 이 금액은 부채를 줄이지 않고 지출로 잡힌다.
  const [interest, setInterest] = useState<string>(
    editTransfer?.interestAmount ? String(editTransfer.interestAmount) : "",
  );

  // 결제 문자 초안 — 있으면 저장이 문자 전용 경로로 간다(취소 차단·카드 기억이 거기 있다).
  const [smsDraft, setSmsDraft] = useState<{
    text: string;
    parsed: SmsParseResult;
  } | null>(null);
  const [rememberCard, setRememberCard] = useState(false);

  // 분할 합 일치화: 금액을 바꿔 기존 분할 합과 어긋날 때 맞추기 플로우
  const [openReconcile, setOpenReconcile] = useState(false);
  /**
   * 저장 확인 대기 — 결제가 끝난 회차에 드는 카드 거래라 기록만 바뀌는 경우(D1), 또는
   * 고쳐 쓰기로 원래 거래가 지워지는 경우(D13) 한 번 묻는다. 무엇을 말할지는 날짜와 카드의
   * `cardClosedThrough` 로 정한다 — 서버에 미리 묻지 않는다(D4).
   */
  const [saveConfirm, setSaveConfirm] = useState<{
    title: string;
    notes: string[];
    onConfirm: () => void;
  } | null>(null);
  // 이번 편집 세션에서 맞춘 분할(있으면 저장 시 금액과 함께 원자적으로 전송)
  const [reconciledSplits, setReconciledSplits] = useState<
    ExpenseSplitFormValue[] | null
  >(null);

  // 프리셋: 적용 추적 + 저장 다이얼로그
  const templatesQ = useExpenseTemplates();
  const templates: ExpenseTemplate[] = useMemo(
    () => templatesQ.data ?? [],
    [templatesQ.data],
  );
  const [activePresetId, setActivePresetId] = useState<number | null>(null);
  const [savePresetOpen, setSavePresetOpen] = useState(false);

  // 사용 빈도 높은 순으로 8개. 편집 모드에선 프리셋 row 자체가 안 보이므로 무관.
  //
  // 칩에 찍는 금액은 **사용자가 저장한 임의의 값**이라 축약은 공용 `formatChartAxis`
  // 하나만 통과한다. 예전엔 `${Math.floor(v / 1000)}k` 로 직접 줄여 12,900 이
  // `12k`(−7%), 1,290,000 이 `1290k` 가 됐다 — `k` 는 한국어 화면에서 쓰기로 한
  // 단위(만·억·조)에도 없다.
  //
  // **지금 탭의 종류만** 보여 준다. 종전엔 종류와 무관하게 사용 많은 순 8개라, 지출
  // 탭에서 수입 프리셋을 누르면 탭이 통째로 바뀌었다 — 고르는 사람은 "지출 하나를
  // 빨리 넣으려고" 누른 것이다.
  const topPresets = useMemo(
    () =>
      templates
        .filter((p) => p.expenseType === type)
        .sort((a, b) => b.useCount - a.useCount)
        .slice(0, 8),
    [templates, type],
  );

  const clearPresetMark = () => {
    if (activePresetId != null) setActivePresetId(null);
  };

  const applyPreset = (p: ExpenseTemplate) => {
    setType(p.expenseType as TxType);
    setAmount(p.lockAmount === "Y" && p.amount != null ? String(p.amount) : "");
    setCategoryRowId(p.categoryRowId ?? null);
    setAssetRowId(p.assetRowId ?? null);
    setMerchant(p.merchant ?? "");
    // 프리셋의 고정 표식이 기본값이 된다 — 월세 프리셋을 불러오면 고정으로 켜져 있다. 이체는 해당 없음.
    setIsFixed(p.expenseType === "TRANSFER" ? false : (p.isFixed ?? false));
    setPaymentMethod(p.paymentMethod ?? "");
    setInstallmentMonths("");
    setDescription(p.description ?? "");
    // 이체 프리셋은 보내는·받는 계좌와 수수료·이자를 함께 들고 온다.
    // 보내는 계좌는 assetRowId 한 칸을 지출·수입과 같이 쓴다(서버도 같은 컬럼이다).
    setFromAssetRowId(p.expenseType === "TRANSFER" ? p.assetRowId : null);
    setToAssetRowId(p.toAssetRowId ?? null);
    setFee(p.fee != null ? String(p.fee) : "");
    setInterest(p.interestAmount != null ? String(p.interestAmount) : "");
    setActivePresetId(p.rowId);
  };

  // 같은 expenseType의 최상위 카테고리 그리드 (자식은 Select로)
  const topCategories = useMemo(
    () =>
      categories
        .filter((c) => c.expenseType === type && c.parentRowId == null)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [categories, type],
  );

  const childrenByParent = useMemo(() => {
    const map = new Map<number, ExpenseCategory[]>();
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

  // 선택된 카테고리 정보 (자식이면 부모 id 도 파악)
  const selectedCategory =
    categoryRowId != null
      ? categories.find((c) => c.rowId === categoryRowId)
      : null;
  const selectedParentId = selectedCategory
    ? (selectedCategory.parentRowId ?? selectedCategory.rowId)
    : null;

  // 결제 수단 + 거래 타입으로 계좌·카드 목록 필터.
  //
  // 지출에선 예·적금(SAVINGS: 청약·정기예금·정기적금)을 뺀다 — 만기 전까지 묶인 돈이라
  // 거기서 직접 결제나 출금이 나가지 않는다(쓰려면 해지해서 입출금으로 옮긴다).
  // 납입·해지는 이체로 처리하므로 이체 목록에는 그대로 남는다.
  // 수입은 이자가 그 계좌로 직접 들어오므로 남긴다.
  const allowAsset = useCallback(
    (a: Asset) => {
      const allowed = paymentMethod ? PAYMENT_ASSET_TYPES[paymentMethod] : null;
      if (allowed && !allowed.includes(a.assetType)) return false;
      if (type === "EXPENSE" && a.assetType === "SAVINGS") return false;
      return true;
    },
    [paymentMethod, type],
  );

  const filteredAssets = useMemo(
    () => assets.filter(allowAsset),
    [assets, allowAsset],
  );

  // 이자는 대출 상환에만 — 규칙은 이체를 그리는 세 화면이 한 벌을 쓴다.
  const isTransfer = type === "TRANSFER";
  const showInterest = isTransfer && isLoanTarget(assets, toAssetRowId);

  // 대출이 아니게 되면 남아 있던 이자를 지운다(저장 시 흘러들지 않도록).
  if (!showInterest && interest) setInterest("");

  // 할부는 신용카드 지출에만 존재한다 — 체크카드는 긁는 즉시 계좌에서 빠지고, 현금·이체는 나눌 수 없다.
  const showInstallment = useMemo(() => {
    if (type !== "EXPENSE") return false;
    const picked =
      assetRowId != null ? assets.find((a) => a.rowId === assetRowId) : null;
    return picked?.assetType === "CREDIT_CARD";
  }, [type, assetRowId, assets]);

  // 신용카드가 아니게 되면 남아 있던 할부 개월을 지운다(저장 시 흘러들지 않도록).
  if (!showInstallment && installmentMonths) setInstallmentMonths("");

  // 외화는 지출·수입에만 — 이체는 두 자산 사이의 이동이라 통화가 자산에 달려 있다.
  const isForeignTx = type !== "TRANSFER" && origCurrency !== DEFAULT_CURRENCY;

  // 원화로 돌아오면 남아 있던 외화 입력을 지운다(저장 시 흘러들지 않도록).
  if (!isForeignTx && (origAmount || fxRate)) {
    setOrigAmount("");
    setFxRate("");
  }

  // 해외 결제는 $5.50 을 보고 입력하지 원화 환산액을 모른다 — 원 통화 × 환율로 금액을 채운다.
  // 카드사 실제 청구액이 다르면 금액 칸을 직접 고치면 된다.
  //
  // **원통화·환율이 "바뀐 순간"에만 채운다.** 매 렌더 채우면 손으로 고친 금액을 곧바로
  // 덮어써서 금액 칸을 고칠 수 없게 된다. 그래서 직전 값을 들고 있다가 대조한다
  // (예전엔 이 조건을 effect 의 의존성 배열로 표현하고 `amount` 를 일부러 빼 뒀다 —
  //  린트에는 "빠뜨린 의존성" 으로 보여서 규칙을 꺼야 했다).
  //
  // 환불 편집은 여기로도 금액이 안 바뀐다 — 이 경로는 `setAmount` 를 직접 부르므로
  // 칸을 `disabled` 로 닫는 것만으로는 막히지 않는다(같은 구멍을 환불 모드는
  // `overRefundCap` 저장 게이트로 막고 있다).
  const [fxSeed, setFxSeed] = useState({ origAmount, fxRate });
  if (fxSeed.origAmount !== origAmount || fxSeed.fxRate !== fxRate) {
    setFxSeed({ origAmount, fxRate });
    if (isForeignTx) {
      const a = parseFloat(origAmount);
      const r = parseFloat(fxRate);
      if (Number.isFinite(a) && Number.isFinite(r) && a > 0 && r > 0) {
        setAmount(String(Math.round(a * r)));
      }
    }
  }

  // 결제 수단·거래 타입 변경 시 현재 선택한 자산이 허용 목록에 없으면 리셋
  if (assetRowId != null) {
    const picked = assets.find((a) => a.rowId === assetRowId);
    if (picked && !allowAsset(picked)) setAssetRowId(null);
  }

  // 타입 전환 시 해당 타입에 속하지 않는 카테고리는 리셋
  if (categoryRowId != null) {
    const cat = categories.find((c) => c.rowId === categoryRowId);
    if (!cat || cat.expenseType !== type) setCategoryRowId(null);
  }

  const amountNumber = parseAmount(amount);

  // 유효 분할 = 이번 세션에서 맞춘 분할 ?? 서버 분할. 금액이 분할 합과 어긋나면 일치화 필요.
  const serverSplitForms: ExpenseSplitFormValue[] = useMemo(
    () =>
      (splitsQ.data ?? []).map((s) => ({
        categoryRowId: s.categoryRowId,
        amount: s.amount,
        label: s.label,
        sortOrder: s.sortOrder,
      })),
    [splitsQ.data],
  );
  /**
   * 고쳐 쓰기의 분할 — 편집 시트가 이미 불러 둔 교체될 거래의 분할이다. 종류를 바꿨으면
   * 그 분할의 분류가 새 종류와 안 맞으므로 싣지 않는다(빈 목록 = 분할 없음).
   */
  const rewriteSplitsApply =
    isRewrite && type === (rewriteOf?.expenseType ?? type);
  const effectiveSplits = isRewrite
    ? rewriteSplitsApply
      ? (reconciledSplits ?? rewrite?.splits ?? [])
      : []
    : (reconciledSplits ?? serverSplitForms);
  const splitSum = effectiveSplits.reduce((s, p) => s + p.amount, 0);
  const hasSplits = effectiveSplits.length > 0;
  const splitMismatch =
    (isEdit || isRewrite) &&
    type !== "TRANSFER" &&
    hasSplits &&
    amountNumber > 0 &&
    amountNumber !== splitSum;

  const amountTooLarge = amountNumber > MAX_AMOUNT;
  /** 금액 칸에 걸리는 상한 — 환불 상한이 없어져 공통 상한만 남았다. */
  const amountCap = MAX_AMOUNT;
  const canSave = (() => {
    if (amountNumber <= 0 || amountTooLarge) return false;
    if (type === "TRANSFER") {
      return (
        !!fromAssetRowId && !!toAssetRowId && fromAssetRowId !== toAssetRowId
      );
    }
    if (!categoryRowId) return false;
    // 편집 모드: 분할 내역을 아직 모르면(로딩/에러) 저장 보류. 분할 합 정합 판정이 불가한 상태에서
    // 금액을 바꾼 분할 거래를 저장하면 백엔드 400(EXP_012)로 새고 정합 안내가 우회되므로 게이트.
    if (isEdit && (splitsQ.isPending || splitsQ.isError)) return false;
    return true;
  })();
  /**
   * 고쳐 쓰기를 열 수 있나 — 분할을 알아야 교체 본문에 실을 수 있다. 모르는 채 열면 분할이
   * 빠진 본문이 나가 서버가 옛 분할을 옮기고, 금액을 바꿨다면 합이 안 맞아 거절된다.
   */
  const canRewrite = !splitsQ.isPending && !splitsQ.isError;

  /** 저장될 할부 개월 — 신용카드 지출에만 있다(그 밖의 조합에선 칸이 사라진다). */
  const savedInstallment =
    showInstallment && installmentMonths ? Number(installmentMonths) : null;
  /** 고른 자산이 신용카드면 그 카드 — 회차·결제일은 신용카드에만 있다. */
  const pickedCard = (() => {
    const picked =
      assetRowId != null ? assets.find((a) => a.rowId === assetRowId) : null;
    return picked?.assetType === "CREDIT_CARD" ? picked : null;
  })();
  /**
   * 저장하려는 값이 결제가 끝난 회차의 카드 거래인가(D1) — 고른 카드의 `cardClosedThrough`
   * 와 날짜만 견준다. 새 거래·편집 저장·고쳐 쓰기가 같은 판정을 쓴다.
   */
  const saveClosedSpan =
    type === "TRANSFER" || !pickedCard
      ? null
      : closedCycleSpan(
          expenseDate,
          savedInstallment,
          pickedCard.cardClosedThrough,
        );

  /**
   * 저장 전에 한 번 묻는다 — 물을 말이 없으면 바로 저장한다.
   *
   * 서버에 묻지 않는다. 예전엔 미리보기를 불러 문장을 골랐고, 그 조회가 늦거나 실패하면
   * 묻지 않고 저장해 예고 없이 돈이 움직였다(QA 24차 1). 이제 결제가 끝난 회차에 대한
   * 저장은 통장을 움직이지 않으므로(D1·D2) 날짜만으로 말할 수 있다. 열린 회차에서 미리 낸
   * 돈이 돌아오는 경우는 예고하지 않고 저장 뒤 토스트로 알린다(D4).
   */
  const confirmThen = (title: string, notes: string[], run: () => void) => {
    if (notes.length === 0) {
      run();
      return;
    }
    // 확인 대기 — 잠금을 풀어 두지 않으면 확인창의 저장이 먹지 않는다.
    savingRef.current = false;
    setSaveConfirm({ title, notes, onConfirm: run });
  };

  /**
   * 고쳐 쓰기 확인창의 문장(D13). 원래 거래가 지워지고 새 거래로 바뀐다는 것은 늘 같고,
   * 새 거래가 드는 회차에 따라 뒤가 갈린다 — 결제가 끝난 회차면 기록만, 열린 회차면 그
   * 회차 결제일에 청구된다(원래 거래는 결제된 회차에서 기록만 빠진다). 카드가 아니면
   * 회차가 없으니 앞 문장만 말한다.
   */
  const rewriteNote = (): string => {
    const body = t("addTx.rewriteConfirmBody");
    if (!pickedCard) return body;
    if (saveClosedSpan === "closed") {
      return `${body} ${t("addTx.rewriteClosedNote")}`;
    }
    if (saveClosedSpan === "partial") {
      return `${body} ${closedCycleNoteText(t, "partial")}`;
    }
    if (pickedCard.paymentDay == null) return body;
    // 결제일 변경이 대기 중이면 그 회차는 옛 결제일에 나간다(D5) — 서버가 준 실제 결제일을
    // 쓰고, 그 뒤 회차만 지금 결제일로 센다(QA 26차 4).
    const date = cyclePaymentDate(
      expenseDate,
      pickedCard.paymentDay,
      pickedCard.nextPaymentDate,
    );
    return `${body} ${t("addTx.rewriteOpenNote", { date: formatDay(date).md })}`;
  };

  /** 편집 PUT — 미리 낸 돈이 돌아왔으면 저장 뒤 알린다(D4). */
  const saveEdit = (data: ExpenseFormValues) => {
    if (!expense) return;
    updateMut.mutate(
      { id: expense.rowId, data },
      {
        onSuccess: (updated) => {
          notifyResult(updated);
          setSaveConfirm(null);
          onSaved?.(updated);
          onClose();
        },
        onSettled: unlock,
      },
    );
  };

  /**
   * 고쳐 쓰기 저장 — 옛 거래를 지우고 새 거래로 교체한다(D13). 교체될 거래는 결제가 끝난
   * 거래라(잠금 조건) 통장이 어긋났으면 사용자가 맞춘다 — 토스트에 그 카드 결제계좌의
   * [잔액 고치기]를 단다(D9).
   */
  const saveRewrite = (data: ExpenseFormValues) => {
    if (!rewriteOf) return;
    const originalCard = assets.find((a) => a.rowId === rewriteOf.assetRowId);
    replaceMut.mutate(
      { id: rewriteOf.rowId, data },
      {
        onSuccess: (created) => {
          notifyResult(created, {
            closed: true,
            paymentAssetRowId:
              originalCard?.assetType === "CREDIT_CARD"
                ? (originalCard.paymentAssetRowId ?? null)
                : null,
          });
          setSaveConfirm(null);
          onReplaced?.();
          onClose();
        },
        // 404 = 옛 거래가 이미 없다 — 응답만 못 받은 채 다시 눌렀으면 교체는 앞선 요청에서
        // 끝났다(다른 기기에서 지웠어도 같다). 붙들고 있으면 사라진 거래를 또 고치려 들고
        // 목록엔 옛 행이 남아 보인다. 목록은 훅이 비우고(`useReplaceExpense`) 여기선 닫는다.
        // 그 밖의 실패는 시트를 둔다 — 고친 값을 잃지 않고 다시 시도할 수 있다(QA 26차 5).
        onError: (err) => {
          if (!isHttpStatus(err, 404)) return;
          setSaveConfirm(null);
          onReplaced?.();
          onClose();
        },
        onSettled: unlock,
      },
    );
  };

  // 더블클릭 방어 — isPending 은 다음 렌더에야 바뀌므로 동기 잠금을 따로 둔다.
  const savingRef = useRef(false);
  const unlock = () => {
    savingRef.current = false;
  };
  /** 저장 확인창의 저장 — 다시 잠그고 기다리던 저장을 보낸다. */
  const confirmSave = () => {
    if (!saveConfirm) return;
    savingRef.current = true;
    saveConfirm.onConfirm();
  };
  // 프리셋으로 저장할 수 있는 조건 — 종류마다 있어야 하는 칸이 다르다.
  // 지출·수입은 카테고리가, 이체는 양쪽 계좌가 프리셋의 뼈대다.
  const canSavePreset =
    amountNumber > 0 &&
    (type === "TRANSFER"
      ? transferPartiesReady(fromAssetRowId, toAssetRowId)
      : !!categoryRowId);

  const submitting =
    createMut.isPending ||
    updateMut.isPending ||
    replaceMut.isPending ||
    createTransferMut.isPending ||
    updateTransferMut.isPending;

  /**
   * 문자 해석 결과를 폼에 채운다.
   *
   * 채우기만 하고 저장하지는 않는다 — 파서가 틀렸을 때 사용자가 고칠 수 있어야 한다.
   * 결제수단은 카드 고정이다(카드 결제 문자다) — 자산 목록도 그에 맞춰 좁혀진다.
   */
  const applySms = (text: string, parsed: SmsParseResult) => {
    setSmsDraft({ text, parsed });
    setRememberCard(false);
    setType("EXPENSE");
    if (parsed.amount != null) setAmount(String(parsed.amount));
    if (parsed.merchant) setMerchant(parsed.merchant);
    if (parsed.expenseDate) {
      setExpenseDate(parsed.expenseDate.slice(0, 10));
      const m = /[T ](\d{2}):(\d{2})/.exec(parsed.expenseDate);
      if (m) setExpenseTime(`${m[1]}:${m[2]}`);
    }
    if (parsed.categoryRowId != null) setCategoryRowId(parsed.categoryRowId);
    if (parsed.assetRowId != null) setAssetRowId(parsed.assetRowId);
    setPaymentMethod("CARD");
    setInstallmentMonths(
      parsed.installmentMonths != null ? String(parsed.installmentMonths) : "",
    );
    if (parsed.originalCurrency && parsed.originalAmount != null) {
      setOrigCurrency(parsed.originalCurrency);
      setOrigAmount(String(parsed.originalAmount));
    } else {
      // 문자에 외화가 없으면 원화 결제다 — 설정의 기본 통화가 외화여도 여기선 문자가
      // 맞다. 안 되돌리면 원화 결제 문자가 해외 결제 입력으로 열린다.
      setOrigCurrency(DEFAULT_CURRENCY);
    }
  };

  const save = () => {
    // 저장이 나가 있는 동안 또 누르면 같은 거래가 두 번 생긴다(QA 2026-09-02) — 첫 요청이 끝날 때까지 막는다.
    if (!canSave || submitting || savingRef.current) return;
    if (type === "TRANSFER") {
      const payload = {
        fromAssetRowId: fromAssetRowId!,
        toAssetRowId: toAssetRowId!,
        amount: amountNumber,
        fee: fee ? Number(fee) : undefined,
        // 이자는 대출 상환에만 — 그 밖의 이체에선 값을 흘리지 않는다.
        interestAmount: showInterest && interest ? Number(interest) : undefined,
        description: description || undefined,
        transferDate: `${expenseDate}T${expenseTime}`,
      };
      savingRef.current = true;
      if (editTransfer) {
        updateTransferMut.mutate(
          { id: editTransfer.rowId, data: payload },
          {
            onSuccess: (updated) => {
              onTransferSaved?.(updated);
              onClose();
            },
            onSettled: unlock,
          },
        );
        return;
      }
      const transferPresetId = activePresetId;
      createTransferMut.mutate(payload, {
        onSuccess: () => {
          // 이체도 프리셋으로 채웠으면 사용 기록을 올린다 — 지출·수입(:710)과 같은 규칙.
          // 종전엔 이 분기에만 빠져 있어 "사용 많은 순" 에서 이체 프리셋만 영영 0 이었다.
          if (transferPresetId != null) {
            touchPresetMut.mutate(transferPresetId);
          }
          onClose();
        },
        onSettled: unlock,
      });
      return;
    }
    // 분할이 있는 거래의 금액을 바꿔 합과 어긋나면 → 저장 전에 분할을 먼저 맞춘다.
    if (splitMismatch) {
      setOpenReconcile(true);
      return;
    }
    savingRef.current = true;
    // 본문은 규칙 하나로 만든다 — **이 시트가 가진 칸만 싣는다.** PUT 은 세 갈래다
    // (`Patch`: 키 없음=유지 · null=지움 · 값=교체, QA #96).
    // 칸이 있으면 지금 상태를 그대로 싣고(비었으면 `null` — 사용자가 지운 것이다),
    // 칸이 없으면 키를 뺀다(서버가 지금 값을 지킨다).
    const data: ExpenseFormValues = {
      categoryRowId: categoryRowId!,
      expenseType: type,
      amount: amountNumber,
      // 아래 둘은 이 시트가 그리는 칸이다 — 비운 채 저장하면 지워져야 한다(QA #107).
      // `undefined` 로 키를 빼면 화면은 지워진 척 닫히고 옛 값이 서버에 남았다.
      description: description || null,
      expenseDate: `${expenseDate}T${expenseTime}`,
      merchant: merchant || null,
      // 고정 표식은 돈이 아니라 분류라서 잠긴 거래(D12)·자동 생성 거래도 고칠 수 있다 — 늘 싣는다.
      isFixed,
      // 돈 칸이 잠긴 편집(D12)은 잠긴 칸 가운데 **비울 수 있는 칸**을 안 싣는다 — 키를
      // 빼면 서버가 지금 값을 지킨다. 서버는 값이 "달라졌을 때만" 거절하지만, 환율(소수)
      // 처럼 표기가 갈릴 수 있는 칸까지 그 비교에 맡길 이유가 없다. 금액·날짜·종류는
      // 본문의 뼈대라 그대로 싣는다(잠긴 칸이라 값이 같다).
      ...(isMoneyLocked
        ? {}
        : {
            assetRowId: assetRowId ?? null,
            paymentMethod: paymentMethod || null,
            // 할부는 신용카드 지출에만 — 그 밖의 조합에선 값을 흘리지 않는다.
            installmentMonths: savedInstallment,
            // 셋이 함께여야 의미가 있다 — 서버도 반쪽이면 전부 비운다.
            originalAmount:
              isForeignTx && origAmount ? Number(origAmount) : null,
            originalCurrency: isForeignTx && origAmount ? origCurrency : null,
            exchangeRate:
              isForeignTx && origAmount ? parseFloat(fxRate) || null : null,
          }),
      // 일치화한 분할이 있으면 금액과 함께 원자적으로 교체(백엔드가 합==금액 검증).
      ...(isEdit && reconciledSplits ? { splits: reconciledSplits } : {}),
      // 고쳐 쓰기는 분할을 늘 싣는다 — 시트가 들고 있는 분할이 새 거래의 분할이다
      // (안 실으면 서버가 옛 분할을 옮긴다. 종류를 바꿨으면 빈 목록으로 비운다).
      ...(isRewrite ? { splits: effectiveSplits } : {}),
    };
    // 결제가 끝난 회차의 카드 거래면 저장 전에 한 줄 말한다(D1).
    const closedNotes = saveClosedSpan
      ? [closedCycleNoteText(t, saveClosedSpan)]
      : [];
    if (isRewrite) {
      // 고쳐 쓰기는 늘 묻는다 — 원래 거래가 지워진다.
      confirmThen(t("addTx.rewrite"), [rewriteNote()], () => saveRewrite(data));
    } else if (isEdit && expense) {
      // 편집은 **돈과 기록이 갈리는 저장만** 묻는다 — 열린 회차 거래를 닫힌 회차 날짜·카드로
      // 옮기면 청구에서 빠지고 기록만 남는다. 잠긴 거래(D12)는 카테고리·가맹점·메모만 바뀌어
      // 돈과 무관하므로 묻지 않고 바로 저장한다(사용자 확정 2026-09-21) — 묻게 두면 지난
      // 카드 거래의 분류를 고칠 때마다 확인창을 한 번 더 넘겨야 했다.
      confirmThen(t("addTx.editTitle"), isMoneyLocked ? [] : closedNotes, () =>
        saveEdit(data),
      );
    } else if (smsDraft) {
      // 문자에서 온 지출은 전용 경로로 — 서버가 원문을 다시 봐 취소 문자를 막고
      // 체크했다면 카드 연결을 기억한다. 만들어지는 지출 자체는 같다.
      const sms = smsDraft;
      confirmThen(t("addTx.saveConfirmTitle"), closedNotes, () =>
        commitSmsMut.mutate(
          {
            text: sms.text,
            assetRowId: assetRowId ?? null,
            categoryRowId: categoryRowId!,
            // 종류를 안 실으면 서버가 지출로 본다 — 결제 문자를 수입으로 고쳐 저장하면
            // 수입 전용 조합이 지출로 넘어가 400 이 났다(QA #123). 여기까지 오는 `type`
            // 은 이체를 위에서 걸러 EXPENSE·INCOME 뿐이다.
            expenseType: type,
            amount: amountNumber,
            merchant: merchant || null,
            description: description || null,
            expenseDate: `${expenseDate}T${expenseTime}`,
            paymentMethod: paymentMethod || null,
            installmentMonths: data.installmentMonths,
            originalAmount: data.originalAmount,
            originalCurrency: data.originalCurrency,
            exchangeRate: data.exchangeRate,
            rememberCard: assetRowId != null && rememberCard,
          },
          { onSuccess: onClose, onSettled: unlock },
        ),
      );
    } else {
      const presetIdAtSubmit = activePresetId;
      confirmThen(t("addTx.saveConfirmTitle"), closedNotes, () =>
        createMut.mutate(data, {
          onSettled: unlock,
          onSuccess: (created) => {
            // 카드 수입이 열린 회차에서 미리 낸 돈을 넘기면 그만큼 돌아온다(D3·D4).
            notifyResult(created);
            // 거래 저장 성공 후 적용된 프리셋이 있으면 useCount/lastUsedAt 갱신.
            // 실패해도 거래는 성공했으니 무시(Best-effort).
            if (presetIdAtSubmit != null) {
              touchPresetMut.mutate(presetIdAtSubmit);
            }
            onClose();
          },
        }),
      );
    }
  };

  // 타입별 강조 색
  const amountColor =
    type === "EXPENSE"
      ? "var(--fg-expense)"
      : type === "INCOME"
        ? "var(--fg-income)"
        : "var(--fg-primary)";

  // 자동 생성분은 여기서 못 지운다 — 원본 매매·이체를 지우면 함께 사라진다.
  const Footer = (
    <ModalFooter
      onSave={save}
      saveLabel={
        splitMismatch
          ? t("addTx.saveSplitAndSave")
          : isEdit || isRewrite
            ? tc("save")
            : t("addTx.add")
      }
      saving={submitting}
      saveDisabled={!canSave}
      onCancel={onClose}
    />
  );

  // [고쳐 쓰기] — 이 시트를 새 거래 모드 시트로 갈아 끼운다(D13). 값은 이 거래에서, 분할은
  // 이 시트가 이미 불러 둔 것에서 온다. 부모는 따로 들 상태가 없다 — 닫거나 저장하면 부모가
  // 연 자리(`onClose`)가 함께 닫힌다.
  if (rewriting && expense) {
    return (
      <AddTxSheet
        mobile={mobile}
        onClose={onClose}
        rewrite={{ of: expense, splits: serverSplitForms }}
      />
    );
  }

  return (
    <ModalShell
      // 무엇을 하는 중인지 제목이 말한다 — 새 거래 · 거래 수정 · 고쳐 쓰기(새 거래로 교체).
      // 한때 식이 빠져 값 없는 prop(`title`)만 남아 제목이 비어 그려졌다(a262255).
      title={
        isRewrite
          ? t("addTx.rewrite")
          : isEdit
            ? t("addTx.editTitle")
            : t("addTx.newTitle")
      }
      onClose={onClose}
      size="md"
      footer={Footer}
      mobile={mobile}
      // 금액·가맹점 칸에서 Enter 로 저장(QA #132). `save` 는 이미 저장이 나가 있으면
      // 그냥 돌아오므로 Enter 를 눌러 둔 채 반복 발화해도 거래가 겹쳐 생기지 않는다 —
      // 그 가드가 없어 할 일 빠른 추가가 여러 건을 만들었다(#122).
      onEnterSave={save}
    >
      {/* 타입 segment — spec tabs.md variant="pill" (container) */}
      <Tabs
        value={type}
        onValueChange={(v) => {
          if (!v) return;
          const lockedTo = isEdit ? (expense?.expenseType ?? type) : null;
          if (lockedTo != null && v !== lockedTo) return;
          // 고쳐 쓰기는 거래를 거래로 바꾼다 — 이체로는 못 바꾼다(교체 API 가 지출·수입만 받는다).
          if (isRewrite && v === "TRANSFER") return;
          setType(v as TxType);
          clearPresetMark();
        }}
        className="mb-[var(--spacing-md)]"
      >
        <TabsList variant="pill" size="sm" className="w-full">
          {(
            [
              { v: "EXPENSE", l: t("expense") },
              { v: "INCOME", l: t("income") },
              { v: "TRANSFER", l: t("addTx.transfer") },
            ] as { v: TxType; l: string }[]
          ).map((o) => {
            const disabled = isEdit
              ? o.v !== (expense?.expenseType ?? type)
              : isRewrite && o.v === "TRANSFER";
            return (
              <TabsTrigger
                key={o.v}
                value={o.v}
                disabled={disabled}
                aria-label={o.l}
                className="flex-1"
              >
                {o.l}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* 프리셋 불러오기 — 신규 추가일 때만 노출. 이체 탭에도 이체 프리셋이 뜬다.
          고쳐 쓰기는 옮겨 적는 중이라 프리셋이 채워 둔 값을 덮으면 안 된다. */}
      {!isEdit && !isRewrite && (
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Bookmark size={13} style={{ color: "var(--fg-tertiary)" }} />
              <span
                style={{
                  fontSize: "var(--text-badge)",
                  color: "var(--fg-tertiary)",
                  fontWeight: "600",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {t("addTx.presetLoad")}
              </span>
              {activePresetId != null && (
                <span
                  style={{
                    fontSize: "var(--text-badge)",
                    color: "var(--fg-brand-strong)",
                    fontWeight: "700",
                    padding: "2px 6px",
                    background: "var(--bg-brand-subtle)",
                    borderRadius: "var(--radius-xs)",
                  }}
                >
                  {t("addTx.presetApplied")}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSavePresetOpen(true)}
              disabled={!canSavePreset}
              style={{
                background: "transparent",
                border: 0,
                padding: 0,
                fontSize: "var(--text-caption)",
                color: canSavePreset
                  ? "var(--fg-brand-strong)"
                  : "var(--fg-tertiary)",
                fontWeight: "600",
                cursor: canSavePreset ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                gap: 3,
                fontFamily: "inherit",
              }}
            >
              <Plus size={12} /> {t("addTx.saveCurrentInput")}
            </button>
          </div>

          {topPresets.length > 0 ? (
            <div
              className="scrollbar-hide"
              style={{
                display: "flex",
                gap: 6,
                overflowX: "auto",
                paddingBottom: 4,
                marginLeft: -2,
                paddingLeft: 2,
                marginRight: -2,
                paddingRight: 2,
              }}
            >
              {topPresets.map((p) => {
                const active = activePresetId === p.rowId;
                const showAmount = p.lockAmount === "Y" && p.amount != null;
                const cat =
                  p.categoryRowId != null
                    ? categories.find((c) => c.rowId === p.categoryRowId)
                    : undefined;
                // 카테고리 아이콘색 — 다크모드 light variant 자동 swap(앱 resolveChartColor 정합)
                const catPal = getPaletteByColor(cat?.color);
                return (
                  <button
                    key={p.rowId}
                    type="button"
                    onClick={() => applyPreset(p)}
                    style={{
                      flex: "0 0 auto",
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "7px 11px",
                      // border 사각형 제거 — 아이콘+글씨만 노출. active 만 subtle 채움으로 강조.
                      background: active
                        ? "var(--bg-brand-subtle)"
                        : "transparent",
                      border: "none",
                      borderRadius: "var(--radius-pill)",
                      cursor: "pointer",
                      fontSize: "var(--text-label-sm)",
                      fontWeight: active ? 700 : 600,
                      color: active
                        ? "var(--fg-brand-strong)"
                        : "var(--fg-primary)",
                      whiteSpace: "nowrap",
                      transition: "all 0.12s",
                      fontFamily: "inherit",
                    }}
                  >
                    {cat && (
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: "var(--radius-sm)",
                          background: catPal.bg,
                          color: catPal.color,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {renderIcon(cat.icon, cat.categoryName.charAt(0), 11)}
                      </span>
                    )}
                    <span>{p.templateName}</span>
                    {showAmount && (
                      <span
                        className="num"
                        style={{
                          fontSize: "var(--text-badge)",
                          color: active
                            ? "var(--fg-brand-strong)"
                            : "var(--fg-tertiary)",
                          fontWeight: "600",
                        }}
                      >
                        {formatChartAxis(p.amount as number)}
                      </span>
                    )}
                  </button>
                );
              })}
              {templates.length > topPresets.length && (
                <span
                  style={{
                    flex: "0 0 auto",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "7px 11px",
                    background: "transparent",
                    border: "1px dashed var(--border-default)",
                    borderRadius: "var(--radius-pill)",
                    fontSize: "var(--text-caption)",
                    fontWeight: "600",
                    color: "var(--fg-tertiary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  <MoreHorizontal size={14} />
                  {t("addTx.presetManageHint")}
                </span>
              )}
            </div>
          ) : (
            <div
              style={{
                padding: "8px 10px",
                background: "var(--bg-sunken)",
                border: "1px dashed var(--border-default)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--text-caption)",
                color: "var(--fg-tertiary)",
              }}
            >
              {t("addTx.noPresets")}
            </div>
          )}

          {activePresetId != null && (
            <div
              style={{
                marginTop: 8,
                padding: "8px 10px",
                background: "var(--bg-brand-subtle)",
                border: "1px solid var(--border-brand)",
                borderRadius: "var(--radius-md)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Info size={13} style={{ color: "var(--fg-brand-strong)" }} />
              <span
                style={{
                  fontSize: "var(--text-caption)",
                  color: "var(--fg-brand-strong)",
                  fontWeight: "600",
                  flex: 1,
                }}
              >
                {t("addTx.presetFilledHint")}
              </span>
              <button
                type="button"
                onClick={clearPresetMark}
                style={{
                  background: "transparent",
                  border: 0,
                  padding: 0,
                  fontSize: "var(--text-badge)",
                  color: "var(--fg-brand-strong)",
                  fontWeight: "700",
                  cursor: "pointer",
                  textDecoration: "underline",
                  fontFamily: "inherit",
                }}
              >
                {t("addTx.clear")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 결제 문자 붙여넣기 — 새 지출에만. 편집·고쳐 쓰기·이체는 이미 값이 정해져 있고,
          문자로 저장하면 전용 경로로 나가 고쳐 쓰기(교체)가 안 된다. */}
      {!isEdit && !isRewrite && type === "EXPENSE" && (
        <SmsPasteField onParsed={applySms} />
      )}

      {/* 금액 — 다른 필드와 동일한 라벨+인풋 (모바일 처럼 깔끔하게) */}
      <Field style={{ marginBottom: 18 }}>
        <FieldLabel>{t("form.amount")}</FieldLabel>
        <Input
          className="num"
          value={amount}
          onChange={(e) =>
            setAmount(sanitizeAmountInput(e.target.value, amountCap))
          }
          onKeyDown={blockNonDigitKey}
          placeholder="0"
          inputMode="numeric"
          disabled={moneyFieldsLocked}
          style={{
            fontSize: "var(--text-title-md)",
            fontWeight: "700",
            color: amountColor,
          }}
        />
        {amountTooLarge && (
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "var(--text-caption)",
              color: "var(--color-fg-critical)",
            }}
          >
            {t("addTx.amountTooLarge")}
          </p>
        )}
        {/* 왜 못 고치는지 알려 준다 — 잠긴 칸만 보여 주면 고장으로 보인다. */}
        {isAutoGenerated && (
          <div className="mt-1.5 text-[11.5px] text-[var(--fg-tertiary)]">
            {t(`addTx.autoSource.${expense?.autoSource}`, {
              defaultValue: t("addTx.autoSource.default"),
            })}
          </div>
        )}
        {/* 결제가 끝난 거래 — 돈 칸 대신 [고쳐 쓰기](D12·D13). 잠긴 칸 바로 옆에 두어야
            어디서 바꾸는지 찾지 않는다. 자동 생성 거래는 원본을 고쳐야 해서 교체도 없다.
            고쳐 쓸 수 없는 잠긴 거래(중도 정리한 할부)는 버튼 없이 왜 못 바꾸는지만 말한다 —
            안내가 없는 버튼을 가리키면 안 된다. */}
        {isMoneyLocked && !isAutoGenerated && (
          <div
            data-testid="money-locked-note"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 6,
            }}
          >
            <span className="flex-1 text-[11.5px] text-[var(--fg-tertiary)]">
              {isReplaceable
                ? t("addTx.moneyLockedNote")
                : t("addTx.moneyLockedPaidOffNote")}
            </span>
            {isReplaceable && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canRewrite}
                onClick={() => setRewriting(true)}
              >
                {t("addTx.rewrite")}
              </Button>
            )}
          </div>
        )}
      </Field>

      {/* 해외 결제 — 원 통화·환율. 금액(원화)은 둘을 곱해 자동으로 채워진다. */}
      {type !== "TRANSFER" && (
        <Field style={{ marginBottom: 18 }}>
          <FieldLabel {...nameOf("cur").label}>
            {t("addTx.currency")}
          </FieldLabel>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ width: isForeignTx ? 110 : "100%" }}>
              <Select
                value={origCurrency}
                disabled={moneyFieldsLocked}
                onValueChange={(v) => {
                  setOrigCurrency(v);
                  clearPresetMark();
                }}
              >
                <SelectTrigger {...nameOf("cur").trigger}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.symbol} {c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isForeignTx && (
              <>
                <Input
                  className="num"
                  value={origAmount}
                  onChange={(e) => {
                    setOrigAmount(e.target.value.replace(/[^0-9.]/g, ""));
                    clearPresetMark();
                  }}
                  placeholder={t("addTx.originalAmountPlaceholder")}
                  inputMode="decimal"
                  disabled={moneyFieldsLocked}
                  style={{ flex: 1 }}
                />
                <Input
                  className="num"
                  value={fxRate}
                  onChange={(e) => {
                    setFxRate(e.target.value.replace(/[^0-9.]/g, ""));
                    clearPresetMark();
                  }}
                  placeholder={t("addTx.exchangeRatePlaceholder")}
                  inputMode="decimal"
                  disabled={moneyFieldsLocked}
                  style={{ flex: 1 }}
                />
              </>
            )}
          </div>
          {isForeignTx && Number(origAmount) > 0 && Number(fxRate) > 0 && (
            <div
              style={{
                fontSize: "var(--text-caption)",
                color: "var(--fg-tertiary)",
                marginTop: 4,
              }}
            >
              {t("addTx.fxHint", {
                original: formatOriginalAmount(
                  Number(origAmount),
                  origCurrency,
                  i18n.language,
                ),
                rate: Number(fxRate).toLocaleString(i18n.language),
                krw: KRW(Math.round(Number(origAmount) * Number(fxRate))),
              })}
            </div>
          )}
        </Field>
      )}

      {/* 분할 합 불일치 경고 — 금액을 바꿔 기존 분할 합과 어긋날 때 */}
      {splitMismatch && (
        <div
          style={{
            marginBottom: 18,
            padding: "13px 15px",
            borderRadius: "var(--radius-lg)",
            background: "var(--color-bg-warning-weak)",
            border: "1px solid var(--color-stroke-warning-solid)",
            display: "flex",
            alignItems: "flex-start",
            gap: 11,
          }}
        >
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: "var(--radius-md)",
              flexShrink: 0,
              marginTop: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--color-bg-warning-weak-pressed)",
              color: "var(--status-warning-fg)",
            }}
          >
            <AlertTriangle size={16} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: "var(--text-label-sm)",
                fontWeight: "700",
                color: "var(--fg-primary)",
              }}
            >
              {t("addTx.splitMismatchTitle")}
            </div>
            <div
              style={{
                fontSize: "var(--text-caption)",
                color: "var(--fg-secondary)",
                marginTop: 3,
                lineHeight: "1.5",
              }}
            >
              {t("addTx.newTotal")} <b className="num">{money(amountNumber)}</b>{" "}
              · {t("addTx.splitSum")} <b className="num">{money(splitSum)}</b> ·{" "}
              <b className="num" style={{ color: "var(--status-warning-fg)" }}>
                {amountNumber - splitSum > 0 ? "+" : "−"}
                {money(Math.abs(amountNumber - splitSum))}
              </b>{" "}
              {t("addTx.difference")}
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setOpenReconcile(true)}
              style={{ marginTop: 10 }}
            >
              <Scissors size={13} /> {t("addTx.matchSplits")}
            </Button>
          </div>
        </div>
      )}

      {type !== "TRANSFER" ? (
        <>
          {/* 카테고리 */}
          {topCategories.length > 0 && (
            <div style={{ marginBottom: "var(--spacing-md)" }}>
              <div
                {...nameOf("cat").label}
                style={{
                  fontSize: "var(--text-badge)",
                  color: "var(--fg-tertiary)",
                  fontWeight: "600",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  marginBottom: "var(--spacing-sm)",
                }}
              >
                {t("category")}
              </div>
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
                      clearPresetMark();
                    }}
                  />
                ))}
              </CategoryGrid>

              {/* 하위 카테고리 (선택된 부모에 자식이 있을 때) */}
              {selectedParentId != null &&
                (childrenByParent.get(selectedParentId)?.length ?? 0) > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <Select
                      value={categoryRowId != null ? String(categoryRowId) : ""}
                      onValueChange={(v) => setCategoryRowId(Number(v))}
                    >
                      <SelectTrigger {...nameOf("cat").trigger}>
                        <SelectValue
                          placeholder={t("addTx.subCategoryPlaceholder")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {/* 상위 자신은 고를 수 없다 — 이 칸은 하위가 있는 상위에서만 뜨고, 하위가
                            있는 상위에는 서버가 거래를 안 받는다(EXP_009). 종전엔 첫 칸에 상위가 있어
                            고르면 저장에서 "상위 카테고리에는 거래를 등록할 수 없어요" 였다(QA 30 13). */}
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
            </div>
          )}

          {/* 거래처 */}
          <Field style={{ marginBottom: 14 }}>
            <FieldLabel>
              {type === "INCOME" ? t("addTx.incomeSource") : t("form.merchant")}
            </FieldLabel>
            <Input
              value={merchant}
              maxLength={100}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder={
                type === "INCOME"
                  ? t("addTx.incomeSourcePlaceholder")
                  : t("addTx.merchantPlaceholder")
              }
            />
          </Field>

          {/* 결제 수단 — 먼저 선택, 계좌·카드 목록을 필터링 */}
          <Field style={{ marginBottom: 14 }}>
            <FieldLabel {...nameOf("pm").label}>
              {type === "INCOME"
                ? t("addTx.incomeMethod")
                : t("paymentMethodLabel")}
            </FieldLabel>
            <Select
              value={paymentMethod || "__none__"}
              // 결제수단을 바꾸면 허용 목록에서 빠진 자산이 풀린다(allowAsset) — 자산 칸을
              // 잠가도 이 길로 자산이 바뀌므로 함께 잠근다.
              disabled={moneyFieldsLocked}
              onValueChange={(v) => {
                setPaymentMethod(v === "__none__" ? "" : v);
                clearPresetMark();
              }}
            >
              <SelectTrigger {...nameOf("pm").trigger}>
                <SelectValue placeholder={t("selectNone")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("selectNone")}</SelectItem>
                {PAYMENT_METHODS.map((pm) => (
                  <SelectItem key={pm.v} value={pm.v}>
                    {pm.l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* 계좌·카드 — 결제 수단에 맞춰 필터 */}
          <Field style={{ marginBottom: 14 }}>
            <FieldLabel {...nameOf("asset").label}>
              {type === "INCOME" ? t("addTx.depositAccount") : t("accountCard")}
              {paymentMethod && filteredAssets.length !== assets.length && (
                <span
                  style={{
                    color: "var(--fg-tertiary)",
                    fontWeight: "400",
                    marginLeft: 4,
                  }}
                >
                  (
                  {t("addTx.basisOf", {
                    method:
                      PAYMENT_METHODS.find((p) => p.v === paymentMethod)?.l ??
                      "",
                  })}
                  )
                </span>
              )}
            </FieldLabel>
            <Select
              value={assetRowId != null ? String(assetRowId) : "__none__"}
              disabled={moneyFieldsLocked}
              onValueChange={(v) => {
                setAssetRowId(v === "__none__" ? null : Number(v));
                clearPresetMark();
              }}
            >
              <SelectTrigger {...nameOf("asset").trigger}>
                <SelectValue placeholder={t("selectNone")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("selectNone")}</SelectItem>
                {filteredAssets.map((a) => (
                  <SelectItem key={a.rowId} value={String(a.rowId)}>
                    {a.institution
                      ? `${a.institution} · ${a.assetName}`
                      : a.assetName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {paymentMethod && filteredAssets.length === 0 && (
              <div
                style={{
                  fontSize: "var(--text-caption)",
                  color: "var(--fg-tertiary)",
                  marginTop: 4,
                }}
              >
                {t("addTx.noAssetForMethod")}
              </div>
            )}
            {/* 문자로 들어온 카드를 아직 안 외운 경우에만 물어본다.
                한 번 켜 두면 다음 문자부터는 자산을 고르는 단계가 사라진다. */}
            {smsDraft?.parsed.cardHint && !smsDraft.parsed.assetRemembered && (
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 8,
                  fontSize: "var(--text-caption)",
                  color:
                    assetRowId == null
                      ? "var(--fg-tertiary)"
                      : "var(--fg-secondary)",
                  cursor: assetRowId == null ? "default" : "pointer",
                }}
              >
                <Checkbox
                  checked={assetRowId != null && rememberCard}
                  disabled={assetRowId == null}
                  onCheckedChange={(v) => setRememberCard(v === true)}
                />
                {t("sms.rememberCard")}
              </label>
            )}
          </Field>

          {/* 할부 — 신용카드 지출에만. 청구는 이 개월 수로 나뉘어 잡힌다. */}
          {showInstallment && (
            <Field style={{ marginBottom: 14 }}>
              <FieldLabel {...nameOf("inst").label}>
                {t("addTx.installment")}
              </FieldLabel>
              <Select
                value={installmentMonths || "__none__"}
                disabled={moneyFieldsLocked}
                onValueChange={(v) => {
                  setInstallmentMonths(v === "__none__" ? "" : v);
                  clearPresetMark();
                }}
              >
                <SelectTrigger {...nameOf("inst").trigger}>
                  <SelectValue placeholder={t("addTx.lumpSum")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("addTx.lumpSum")}</SelectItem>
                  {INSTALLMENT_MONTHS.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {t("addTx.installmentMonths", { months: m })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {installmentMonths && amountNumber > 0 && (
                <div
                  style={{
                    fontSize: "var(--text-caption)",
                    color: "var(--fg-tertiary)",
                    marginTop: 4,
                  }}
                >
                  {t("addTx.installmentHint", {
                    months: installmentMonths,
                    perMonth: KRW(
                      Math.floor(amountNumber / Number(installmentMonths)),
                    ),
                  })}
                </div>
              )}
            </Field>
          )}
        </>
      ) : (
        <TransferAccountFields
          assets={assets}
          fromAssetRowId={fromAssetRowId}
          toAssetRowId={toAssetRowId}
          fee={fee}
          interest={interest}
          amountNumber={amountNumber}
          onFromChange={setFromAssetRowId}
          onToChange={setToAssetRowId}
          onFeeChange={setFee}
          onInterestChange={setInterest}
        />
      )}

      {/* 날짜·시간 — 이체도 동일(백엔드 transferDate 가 DATETIME).
          시각이 있어야 같은 날 잔액수정보다 뒤에 일어난 이체가 앵커에 지워지지 않는다. */}
      <Field style={{ marginBottom: 14 }}>
        <FieldLabel>{t("dateTime")}</FieldLabel>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 116px", gap: 8 }}
        >
          <InputDatePicker
            value={expenseDate}
            onValueChange={setExpenseDate}
            disabled={moneyFieldsLocked}
          />
          <InputTimePicker
            value={expenseTime}
            onValueChange={setExpenseTime}
            minuteStep={5}
            disabled={moneyFieldsLocked}
          />
        </div>
      </Field>

      {/* 고정 수입·지출 — 이체에는 없다(내 통장끼리 옮기는 돈이라 합계가 안 달라진다).
          문자 초안도 없다: 저장이 전용 경로(`/import/sms/commit`)라 고정 표식을 못 싣는다 —
          스위치를 두면 켜도 조용히 무시된다. 저장한 뒤 거래를 열어 켜거나 통계의 정리 화면에서 바꾼다. */}
      {!isTransfer && !smsDraft && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              id="tx-fixed-label"
              style={{
                fontSize: "var(--text-body-sm)",
                fontWeight: 500,
                color: "var(--fg-primary)",
              }}
            >
              {type === "INCOME"
                ? t("fixed.switch.income")
                : t("fixed.switch.expense")}
            </div>
            <div
              style={{
                fontSize: "var(--text-caption)",
                color: "var(--fg-tertiary)",
                marginTop: 2,
              }}
            >
              {type === "INCOME"
                ? t("fixed.hint.income")
                : t("fixed.hint.expense")}
            </div>
          </div>
          <Switch
            checked={isFixed}
            onCheckedChange={setIsFixed}
            aria-labelledby="tx-fixed-label"
          />
        </div>
      )}

      {/* 메모 */}
      <Field style={{ marginBottom: 4 }}>
        <FieldLabel>{t("memo")}</FieldLabel>
        <Textarea
          value={description}
          maxLength={500}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("addTx.optional")}
          style={{ minHeight: 64 }}
        />
      </Field>

      {savePresetOpen && (
        <SavePresetDialog
          mobile={mobile}
          onClose={() => setSavePresetOpen(false)}
          seed={{
            expenseType: type,
            amount: amountNumber,
            // 이체는 카테고리·거래처·결제수단이 없다 — 지금 화면에 칸 자체가 없다.
            categoryRowId: isTransfer ? null : categoryRowId,
            categoryName: isTransfer
              ? null
              : (selectedCategory?.categoryName ?? null),
            assetRowId: isTransfer ? fromAssetRowId : assetRowId,
            assetName:
              assets.find(
                (a) => a.rowId === (isTransfer ? fromAssetRowId : assetRowId),
              )?.assetName ?? null,
            toAssetRowId: isTransfer ? toAssetRowId : null,
            toAssetName: isTransfer
              ? (assets.find((a) => a.rowId === toAssetRowId)?.assetName ??
                null)
              : null,
            fee: isTransfer && fee ? Number(fee) : null,
            interestAmount: showInterest && interest ? Number(interest) : null,
            merchant: isTransfer ? "" : merchant,
            paymentMethod: isTransfer ? "" : paymentMethod,
            description,
            isFixed: isTransfer ? false : isFixed,
          }}
        />
      )}

      {/* 저장 확인 — 돈이 어떻게 움직이는지(환급·결제일 당일 추가 결제) 또는 왜 안
          움직이는지(결제가 끝난 회차라 기록만)를 말하고 묻는다. 되돌릴 수 있는 일이라
          danger 가 아니다. */}
      {saveConfirm && (
        <ConfirmDialog
          title={saveConfirm.title}
          message={saveConfirm.notes.map((n, i) => (
            <span
              key={n}
              style={{ display: "block", marginTop: i === 0 ? 0 : 8 }}
            >
              {n}
            </span>
          ))}
          confirmLabel={tc("save")}
          loading={submitting || commitSmsMut.isPending}
          onCancel={() =>
            !submitting && !commitSmsMut.isPending && setSaveConfirm(null)
          }
          onConfirm={confirmSave}
        />
      )}

      {openReconcile && seed && (
        <SplitTxDialog
          expense={seed}
          mobile={mobile}
          overrideTotal={amountNumber}
          recordedTotal={Math.abs(seed.amount)}
          initialSplits={
            effectiveSplits.length > 0 ? effectiveSplits : undefined
          }
          onReconciled={(splits) => {
            setReconciledSplits(splits);
            setOpenReconcile(false);
          }}
          onClose={() => setOpenReconcile(false)}
        />
      )}
    </ModalShell>
  );
}

// =========================================================================
// SavePresetDialog — 현재 입력값을 프리셋으로 저장
// =========================================================================
type SavePresetSeed = {
  expenseType: TxKind;
  amount: number;
  categoryRowId: number | null;
  categoryName: string | null;
  /** 이체면 <b>보내는</b> 자산. */
  assetRowId: number | null;
  assetName: string | null;
  /** 이체일 때만 채워진다. */
  toAssetRowId: number | null;
  toAssetName: string | null;
  fee: number | null;
  interestAmount: number | null;
  merchant: string;
  paymentMethod: string;
  description: string;
  /** 고정 수입·지출 기본값 — 프리셋으로 거래를 만들 때 스위치의 초기값이 된다. */
  isFixed: boolean;
};

function SavePresetDialog({
  onClose,
  mobile,
  seed,
}: {
  onClose: () => void;
  mobile: boolean;
  seed: SavePresetSeed;
}) {
  const { t } = useTranslation("expense");
  const { t: tc } = useTranslation("common");
  const [name, setName] = useState(seed.merchant || "");
  const [lockAmount, setLockAmount] = useState(false);

  const createMut = useCreateExpenseTemplate();

  const isTransfer = seed.expenseType === "TRANSFER";
  // 이체 프리셋은 카테고리 대신 받는 계좌가 있어야 성립한다(서버도 같은 규칙).
  const canSave =
    name.trim().length > 0 &&
    (isTransfer ? seed.toAssetRowId != null : seed.categoryRowId != null);

  const submit = () => {
    if (!canSave) return;
    createMut.mutate(
      {
        templateName: name.trim(),
        categoryRowId: seed.categoryRowId,
        assetRowId: seed.assetRowId ?? undefined,
        toAssetRowId: seed.toAssetRowId ?? undefined,
        fee: seed.fee ?? undefined,
        // 이자는 금액을 따라간다 — 금액을 안 저장하면 이자도 안 저장한다
        // (사용자 결정 2026-09-15). 금액이 매달 다르면 이자도 매달 다르니, 박아 둔
        // 이자는 불러올 때마다 틀린 값이 된다. 수수료는 계좌 짝의 성질이라 그대로 둔다.
        interestAmount: lockAmount
          ? (seed.interestAmount ?? undefined)
          : undefined,
        expenseType: seed.expenseType,
        amount: lockAmount ? seed.amount : undefined,
        description: seed.description || undefined,
        merchant: seed.merchant || undefined,
        paymentMethod: seed.paymentMethod || undefined,
        lockAmount: lockAmount ? "Y" : "N",
        isFixed: seed.isFixed,
      },
      { onSuccess: onClose },
    );
  };

  const Footer = (
    <ModalFooter
      onSave={submit}
      saveLabel={tc("save")}
      saving={createMut.isPending}
      saveDisabled={!canSave}
      onCancel={onClose}
    />
  );

  return (
    <ModalShell
      title={t("savePreset.title")}
      onClose={onClose}
      mobile={mobile}
      size="md"
      footer={Footer}
    >
      {/* 시드 미리보기 */}
      <div
        style={{
          padding: 14,
          background: "var(--bg-sunken)",
          borderRadius: "var(--radius-tile)",
          marginBottom: 18,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "var(--text-body-sm)",
              fontWeight: "700",
              color: "var(--fg-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {isTransfer
              ? t("addTx.transfer")
              : seed.merchant || t("savePreset.noMerchant")}
          </div>
          <div
            style={{
              fontSize: "var(--text-caption)",
              color: "var(--fg-tertiary)",
              marginTop: 2,
            }}
          >
            {isTransfer
              ? transferPartiesLabel(seed.assetName, seed.toAssetName)
              : (seed.categoryName ?? t("savePreset.noCategory"))}
            {!isTransfer && seed.assetName ? ` · ${seed.assetName}` : ""}
          </div>
        </div>
        <div
          className="num"
          style={{
            fontSize: "var(--text-body-lg)",
            fontWeight: "800",
            // 이체는 지출도 수입도 아니다 — 프리셋 목록·상세·가계부 이체 행과 같이
            // 중립색·무부호. 여기만 "+수입색" 으로 남아 있었다.
            color: isTransfer
              ? "var(--fg-primary)"
              : seed.expenseType === "EXPENSE"
                ? "var(--fg-expense)"
                : "var(--fg-income)",
          }}
        >
          {isTransfer ? "" : seed.expenseType === "EXPENSE" ? "−" : "+"}
          {KRW(seed.amount)}
        </div>
      </div>

      <Field style={{ marginBottom: 16 }}>
        <FieldLabel>{t("savePreset.name")}</FieldLabel>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("savePreset.namePlaceholder")}
          autoFocus
        />
      </Field>

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: 12,
          background: "var(--bg-sunken)",
          borderRadius: "var(--radius-tile)",
          cursor: "pointer",
        }}
      >
        <Checkbox
          checked={lockAmount}
          onCheckedChange={(c) => setLockAmount(c === true)}
          onClick={(e) => e.stopPropagation()}
          style={{ marginTop: 2 }}
        />
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "var(--text-label-sm)",
              fontWeight: "600",
              color: "var(--fg-primary)",
            }}
          >
            {t("savePreset.lockAmount")}
          </div>
          <div
            style={{
              fontSize: "var(--text-caption)",
              color: "var(--fg-tertiary)",
              marginTop: 2,
              lineHeight: "1.3",
            }}
          >
            {lockAmount
              ? t("savePreset.lockOn", { amount: KRW(seed.amount) })
              : t("savePreset.lockOff")}
          </div>
        </div>
      </label>

      {/* 이체는 카테고리가 없는 게 정상이라 이 안내가 늘 떴다 — 저장 버튼은
          `canSave` 가 이체 분기를 봐서 살아 있으므로 안내와 버튼이 어긋났다. */}
      {!isTransfer && seed.categoryRowId == null && (
        <div
          style={{
            marginTop: 10,
            fontSize: "var(--text-caption)",
            color: "var(--fg-expense)",
          }}
        >
          {t("savePreset.needCategory")}
        </div>
      )}
    </ModalShell>
  );
}
