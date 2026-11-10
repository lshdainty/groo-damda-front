import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MAX_AMOUNT, parseAmount } from "@/shared/lib/groo/amount";
import { useTranslation } from "react-i18next";
import { formatDay } from "@/shared/lib/groo/format";
import {
  useCreateExpense,
  useExpenseCategories,
  useCreateExpenseTemplate,
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
import { useDefaultCurrencyState } from "@/features/user";
import { useCommitSms, type SmsParseResult } from "@/features/sms";
import { useExpenseSplits } from "@/features/expense-split";
import type {
  Expense,
  ExpenseCategory,
  ExpenseFormValues,
} from "@/entities/expense";
import type { AssetTransfer } from "@/entities/asset";
import {
  allowAssetFor,
  toKrw,
  transferReceiveAmount,
  type Asset,
} from "@/entities/asset";
import type { ExpenseTemplate } from "@/entities/expense-template";
import { closedCycleSpan, cyclePaymentDate } from "@/entities/expense";
import { isHttpStatus, isWriteUnconfirmed } from "@/shared/api";
import type { ExpenseSplitFormValue } from "@/entities/expense-split";
import {
  DEFAULT_CURRENCY,
  currencyUnit,
  formatAssetAmount,
  isForeignCurrency,
} from "@/shared/lib/groo/currency";
import { money } from "@/shared/lib/groo/format";
import { dsLocale } from "@/shared/ds/i18n";
import { isLoanTarget, transferPartiesReady } from "@/features/asset-transfer";

/** 카드사 공통 할부 개월 — 2~12, 18, 24. */
export const INSTALLMENT_MONTHS = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24,
] as const;

export type TxType = "EXPENSE" | "INCOME" | "TRANSFER";

/** 검증이 걸리는 칸 — 틀린 칸에 초점을 옮긴다 */
export type TxField =
  | "entry"
  | "category"
  | "from"
  | "to"
  | "fx"
  | "fxAmount"
  | "interest"
  | "splits";

/** 1단계 값 단계의 한 칸 */
export type TxSub =
  | "amount"
  | "memo"
  | "fee"
  | "interest"
  | "sms"
  | "presetAll"
  | "presetSave"
  | "presetAmount"
  /** 외화 거래의 원화 금액 줄 — 카드사 청구액으로 원화만 고친다(현지 금액 · 환율은 그대로) */
  | "krwAmount";

export type TxFormProps = {
  onClose: () => void;
  /** 지금 인자 이름 그대로 둔다(0 의 3) — 표면 경계는 공용 Responsive Dialog 가 1280 으로 정한다 */
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
   * 그릴 때 쓴다(I-21 7a). 새로 만들기 · 고쳐 쓰기에는 부르지 않는다.
   */
  onSaved?: (saved: Expense) => void;
  /** 이체 수정 저장이 끝났다 — `onSaved` 의 이체 짝 */
  onTransferSaved?: (saved: AssetTransfer) => void;
  /** 고쳐 쓰기 저장이 끝났다(404 로 이미 교체돼 있던 갈래 포함) — 상세가 돌아갈 거래가 없어 상세까지 닫는다. `onClose` 보다 먼저 */
  onReplaced?: () => void;
  /**
   * [고쳐 쓰기] 를 눌렀다 — 호스트가 이 폼을 계속 들고 있으면(상세 시트 안 한 단계, I-21 7a) 호스트가 시드를 받아 `beginEdit` 로 갈아 끼운다.
   * 없으면 폼이 스스로 새 거래 모드로 바뀐다(`rewriting`)
   */
  onRewrite?: (seed: RewriteSeed) => void;
};

/** 고쳐 쓸 거래와 그 거래의 분할 — 분할은 교체 본문에 함께 실린다. */
export type RewriteSeed = {
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

/** 폼 칸의 처음 값 — 열 때 한 번, 호스트가 폼을 든 채 다른 거래로 갈아 끼울 때(`beginEdit`) 다시 쓴다 */
function initFrom(p: {
  expense?: Expense | null;
  editTransfer?: AssetTransfer | null;
  rewrite?: RewriteSeed | null;
  defaultDate?: string;
}) {
  const { editTransfer } = p;
  const isEdit = !!p.expense || !!editTransfer;
  const rewriteOf = !isEdit ? (p.rewrite?.of ?? null) : null;
  const seed = p.expense ?? rewriteOf;
  return {
    type: (editTransfer
      ? "TRANSFER"
      : (seed?.expenseType ?? "EXPENSE")) as TxType,
    amount: editTransfer
      ? String(editTransfer.amount)
      : seed?.amount
        ? String(seed.amount)
        : "",
    description: editTransfer?.description ?? seed?.description ?? "",
    expenseDate: editTransfer
      ? editTransfer.transferDate.slice(0, 10)
      : seed?.expenseDate
        ? seed.expenseDate.slice(0, 10)
        : (p.defaultDate ?? todayLocal()),
    // 이체 편집이면 그 이체의 시각 — 안 읽으면 금액만 고쳐도 시각이 지금으로 밀린다.
    expenseTime:
      extractTime(editTransfer?.transferDate ?? seed?.expenseDate) ??
      nowTimeLocal(),
    merchant: seed?.merchant ?? "",
    isFixed: seed?.isFixed ?? false,
    paymentMethod: seed?.paymentMethod ?? "",
    installmentMonths: seed?.installmentMonths
      ? String(seed.installmentMonths)
      : "",
    origAmount: seed?.originalAmount != null ? String(seed.originalAmount) : "",
    fxRate: seed?.exchangeRate != null ? String(seed.exchangeRate) : "",
    categoryRowId: seed?.categoryRowId ?? (null as number | null),
    assetRowId: seed?.assetRowId ?? (null as number | null),
    fromAssetRowId: editTransfer?.fromAssetRowId ?? (null as number | null),
    toAssetRowId: editTransfer?.toAssetRowId ?? (null as number | null),
    fee: editTransfer?.fee ? String(editTransfer.fee) : "",
    interest: editTransfer?.interestAmount
      ? String(editTransfer.interestAmount)
      : "",
    main: (p.expense || editTransfer || p.rewrite ? "2" : "1") as "1" | "2",
  };
}

export function useTxForm({
  onClose,
  expense,
  defaultDate,
  editTransfer,
  rewrite,
  onSaved,
  onTransferSaved,
  onReplaced,
  onRewrite,
}: Omit<TxFormProps, "mobile">) {
  const { t } = useTranslation("expense");
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

  const categoriesQ = useExpenseCategories({ silent: true });
  const assetsQ = useAssets({ silent: true });
  // 저장 실패는 폼 맨 위 Callout 이 알린다 — 전역 서버 원문 토스트와 겹치지 않게 호출처 silent
  const createMut = useCreateExpense({ silent: true });
  const updateMut = useUpdateExpense({ silent: true });
  const replaceMut = useReplaceExpense({ silent: true });
  const createTransferMut = useCreateTransfer({ silent: true });
  const updateTransferMut = useUpdateTransfer({ silent: true });
  const touchPresetMut = useTouchExpenseTemplate();
  const createPresetMut = useCreateExpenseTemplate({ silent: true });
  const commitSmsMut = useCommitSms({ silent: true });
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
  /**
   * 자산 · 카테고리 목록을 받았다 — 받기 전(또는 실패)에는 "목록에 없다" 를 판정하지 못한다. 렌더 중 지우기는 받은 뒤에만 한다
   * (받기 전에 지우면 읽어 온 할부 · 이자 · 카테고리가 돌아오지 않고, 그대로 저장되면 기록을 잃는다 — N1).
   */
  const assetsLoaded = assetsQ.data != null;
  const categoriesLoaded = categoriesQ.data != null;
  const listsReady = assetsLoaded && categoriesLoaded;

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
  const {
    currency: defaultCurrency,
    ready: defaultCurrencyReady,
    ensure: ensureDefaultCurrency,
  } = useDefaultCurrencyState();
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
  /** 문자 해석 확신이 낮다 — 2단계 맨 위 Callout 이 확인을 부탁한다 */
  const [smsLow, setSmsLow] = useState(false);
  // 낭독기에 알린 문자 묶음인가 — 2단계가 다시 붙을 때마다(1단계로 갔다 돌아옴) 같은 경고를 또 읽지 않게
  const [smsLowAnnounced, setSmsLowAnnounced] = useState(false);
  /** 문자를 읽는 중 — [문자 읽기] 버튼 진행 표시 */
  const [smsLoading, setSmsLoading] = useState(false);
  /** 저장 때 자산 · 카테고리 목록을 받아 오지 못했다 — 값을 추측해 보내지 않고 요청 없이 맨 위 알림으로 알린다 */
  const [listsFailed, setListsFailed] = useState(false);
  const [saveRetry, setSaveRetry] = useState(0);

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

  // 단계 — 새 거래는 1단계(금액)부터, 수정 · 고쳐 쓰기는 2단계로 바로(1-B)
  const [main, setMain] = useState<"1" | "2">(
    expense || editTransfer || rewrite ? "2" : "1",
  );
  /** 같은 시트 안 한 단계 — 값 하나를 치거나 고른다(I-09 29) */
  const [sub, setSubRaw] = useState<TxSub | null>(null);
  const [presetName, setPresetName] = useState("");
  /** 프리셋 금액 — 비우면 "비워 둠" 으로 저장된다(금액 있음 = 고정, I-20 Q2 2-B) */
  const [presetAmount, setPresetAmount] = useState("");
  const [presetShow, setPresetShow] = useState(false);
  /** 2단계로 올 때 거래처 칸에 초점 — 1단계에서 [다음] 으로 온 때만(프리셋 · 문자로 채운 값 위로 키보드가 덮지 않게) */
  const [focusMerchant, setFocusMerchant] = useState(false);
  /**
   * 단계 안 값은 칸 상태를 바로 고치고, 들어올 때 값을 적어 둔다 — "완료" 는 그대로 두고 ← 는 되돌린다(I-09 29).
   * 외화 환산(fxSeed)이 되돌린 값을 다시 계산해 덮지 않도록 환산 기준도 함께 되돌린다.
   */
  const [subSnap, setSubSnap] = useState<{
    amount: string;
    origAmount: string;
    origCurrencyPick: string | null;
    fxRate: string;
    description: string;
    fee: string;
    interest: string;
    presetAmount: string;
  } | null>(null);
  const takeSnap = () => ({
    amount,
    origAmount,
    origCurrencyPick,
    fxRate,
    description,
    fee,
    interest,
    presetAmount,
  });
  const setSub = (next: TxSub | null) => {
    if (next) setSubSnap(takeSnap());
    setSubRaw(next);
  };
  /** 단계 안에서 값이 들어올 때와 달라졌다 — ← 면 "작성한 내용이 사라져요" 를 묻는다 */
  const subDirty =
    subSnap != null &&
    sub != null &&
    sub !== "sms" &&
    sub !== "presetAll" &&
    sub !== "presetSave" &&
    JSON.stringify(subSnap) !== JSON.stringify(takeSnap());
  /** 단계를 나간다 — 값을 버리면(←) 들어올 때로 되돌린다. 프리셋 금액 단계는 프리셋 저장 단계로 돌아간다 */
  const leaveSub = (discard: boolean) => {
    if (discard && subSnap) {
      setAmount(subSnap.amount);
      setOrigAmount(subSnap.origAmount);
      setOrigCurrency(subSnap.origCurrencyPick);
      setFxRate(subSnap.fxRate);
      setFxSeed({ origAmount: subSnap.origAmount, fxRate: subSnap.fxRate });
      setDescription(subSnap.description);
      setFee(subSnap.fee);
      setInterest(subSnap.interest);
      setPresetAmount(subSnap.presetAmount);
    }
    setSubRaw(sub === "presetAmount" ? "presetSave" : null);
  };

  /** [다음] · [추가] 를 한 번 눌렀다 — 틀린 칸 아래에 글을 보인다 */
  const [showErrors, setShowErrors] = useState(false);
  /** 빈 금액 프리셋을 눌러 1단계에 남았다 — 금액 칸 아래 도움말에 이름 */
  const [emptyPresetName, setEmptyPresetName] = useState<string | null>(null);
  const fieldRefs = useRef<Record<TxField, HTMLElement | null>>({
    entry: null,
    category: null,
    from: null,
    to: null,
    fx: null,
    fxAmount: null,
    interest: null,
    splits: null,
  });
  const pendingFocus = useRef<TxField | null>(null);
  /** 칸마다 ref 콜백 — 틀린 칸으로 초점을 옮길 때 쓴다 */
  const refFor = (name: TxField) => (el: HTMLElement | null) => {
    fieldRefs.current[name] = el;
  };
  /** 틀린 칸으로 초점 — 그 칸이 다른 단계에 있으면 단계를 먼저 옮기고 그린 뒤 초점 */
  const focusField = (f: TxField) => {
    pendingFocus.current = f;
    const wanted = f === "entry" ? "1" : "2";
    if (main !== wanted && !(isEdit || isRewrite)) setMain(wanted);
    if (sub) setSub(null);
  };
  useEffect(() => {
    const f = pendingFocus.current;
    if (!f) return;
    const el = fieldRefs.current[f];
    if (el) {
      pendingFocus.current = null;
      el.focus({ preventScroll: false });
    }
  });

  // 프리셋: 적용 추적 + 저장 다이얼로그
  const templatesQ = useExpenseTemplates();
  const templates: ExpenseTemplate[] = useMemo(
    () => templatesQ.data ?? [],
    [templatesQ.data],
  );
  const [activePresetId, setActivePresetId] = useState<number | null>(null);

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
    // 문자 초안 뒤 프리셋을 누르면 문자 경로(취소 문자 차단 · 카드 기억)를 떠난다 — 프리셋으로 채운 새 거래로 저장된다
    setSmsDraft(null);
    setRememberCard(false);
    setSmsLow(false);
    setSmsLowAnnounced(false);
    setType(p.expenseType as TxType);
    // 프리셋 금액은 원화다 — 통화 칩이 ₩ KRW 로 돌아온다(20a). 금액은 채운 값일 뿐 잠그지 않는다(33a)
    setOrigCurrency(DEFAULT_CURRENCY);
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

  // 선택된 카테고리 정보 (자식이면 부모 id 도 파악)
  const selectedCategory =
    categoryRowId != null
      ? categories.find((c) => c.rowId === categoryRowId)
      : null;

  // 결제 수단 + 거래 타입으로 계좌·카드 목록 필터.
  //
  // 지출에선 예·적금(SAVINGS: 청약·정기예금·정기적금)을 뺀다 — 만기 전까지 묶인 돈이라
  // 거기서 직접 결제나 출금이 나가지 않는다(쓰려면 해지해서 입출금으로 옮긴다).
  // 납입·해지는 이체로 처리하므로 이체 목록에는 그대로 남는다.
  // 수입은 이자가 그 계좌로 직접 들어오므로 남긴다.
  const allowAsset = useCallback(
    (a: Asset) => allowAssetFor(a, paymentMethod, type),
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
  if (assetsLoaded && !showInterest && interest) setInterest("");

  // 할부는 신용카드 지출에만 존재한다 — 체크카드는 긁는 즉시 계좌에서 빠지고, 현금·이체는 나눌 수 없다.
  const showInstallment = useMemo(() => {
    if (type !== "EXPENSE") return false;
    const picked =
      assetRowId != null ? assets.find((a) => a.rowId === assetRowId) : null;
    return picked?.assetType === "CREDIT_CARD";
  }, [type, assetRowId, assets]);

  // 신용카드가 아니게 되면 남아 있던 할부 개월을 지운다(저장 시 흘러들지 않도록).
  if (assetsLoaded && !showInstallment && installmentMonths)
    setInstallmentMonths("");

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
  // 목록에 없는 값은 프리셋 · 문자로 새로 채운 것만 비운다 — 거래에서 읽어 온 값은 기록이라 그대로 두고 줄에 "지운 계좌" 로 보인다(N4)
  if (assetRowId != null && assetsLoaded) {
    const picked = assets.find((a) => a.rowId === assetRowId);
    if (
      picked ? !allowAsset(picked) : assetRowId !== (seed?.assetRowId ?? null)
    )
      setAssetRowId(null);
  }
  if (fromAssetRowId != null && assetsLoaded) {
    if (
      !assets.some((a) => a.rowId === fromAssetRowId) &&
      fromAssetRowId !== (editTransfer?.fromAssetRowId ?? null)
    )
      setFromAssetRowId(null);
  }
  if (toAssetRowId != null && assetsLoaded) {
    if (
      !assets.some((a) => a.rowId === toAssetRowId) &&
      toAssetRowId !== (editTransfer?.toAssetRowId ?? null)
    )
      setToAssetRowId(null);
  }

  // 타입 전환 시 해당 타입에 속하지 않는 카테고리는 리셋
  if (categoryRowId != null && categoriesLoaded) {
    const cat = categories.find((c) => c.rowId === categoryRowId);
    if (
      cat
        ? cat.expenseType !== type
        : categoryRowId !== (seed?.categoryRowId ?? null)
    )
      setCategoryRowId(null);
  }

  const amountNumber = parseAmount(amount);

  // 이체 금액 · 수수료 · 이자는 **보내는 계좌 통화**다(I-13 서버 정의) — 칸 뒤 글자 · 줄 값이 그 통화를 따른다.
  // 보내는 계좌를 아직 안 골랐으면 원화. 외화 예수금은 정수 1단위라(센트 없음) 칸은 정수 그대로다.
  const transferFrom =
    isTransfer && fromAssetRowId != null
      ? assets.find((a) => a.rowId === fromAssetRowId)
      : undefined;
  const transferTo =
    isTransfer && toAssetRowId != null
      ? assets.find((a) => a.rowId === toAssetRowId)
      : undefined;
  const transferCurrency = transferFrom?.currency || DEFAULT_CURRENCY;
  const transferUnit = currencyUnit(transferCurrency);
  /** 보내는 계좌 통화로 쓴 금액 글 — 원화 "1,300,000원" · 외화 "$1,000.00" */
  const transferMoney = (n: number) =>
    isForeignCurrency(transferCurrency)
      ? formatAssetAmount(n, transferCurrency, dsLocale())
      : money(n);
  // 두 계좌 통화가 다르면 받는 금액(읽기 전용) — round(금액 × 보내는 환율 ÷ 받는 환율) HALF_UP, 서버 resolveToAmount 와 같은 식
  const transferReceive =
    isTransfer && amountNumber > 0
      ? transferReceiveAmount(amountNumber, transferFrom, transferTo)
      : null;
  const transferReceiveText =
    transferReceive != null && transferTo
      ? t("addTx.receiveAmount", {
          amount: isForeignCurrency(transferTo.currency)
            ? formatAssetAmount(
                transferReceive,
                transferTo.currency,
                dsLocale(),
              )
            : money(transferReceive),
        })
      : null;
  // 보내는 계좌가 외화면 원화 어림 "약 130,000원" — 원 단위로 친 줄 알았던 사람이 2단계 · 금액 단계에서 알아보게(I-13 검수).
  // 받는 쪽이 원화면 받는 금액 줄이 같은 말을 하므로 그때는 두지 않는다.
  const transferApproxText =
    isTransfer &&
    amountNumber > 0 &&
    transferFrom &&
    isForeignCurrency(transferCurrency) &&
    !(transferReceive != null && !isForeignCurrency(transferTo?.currency))
      ? t("addTx.approxKrw", {
          amount: money(toKrw(amountNumber, transferFrom)),
        })
      : null;
  /** 이체 금액 칸 아래 · 2단계 받는 계좌 줄 아래 읽기 전용 글 — 원화 어림과 받는 금액 */
  const transferHintText =
    [transferApproxText, transferReceiveText].filter(Boolean).join(" · ") ||
    null;

  // 유효 분할 = 이번 세션에서 맞춘 분할 ?? 서버 분할. 금액이 분할 합과 어긋나면 일치화 필요.
  const serverSplitForms: ExpenseSplitFormValue[] = useMemo(
    () =>
      (splitsQ.data ?? []).map((s) => ({
        rowId: s.rowId,
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
  /** 1단계 칸의 값 — 외화면 현지 금액, 아니면 금액 */
  const entryNumber = isForeignTx ? parseFloat(origAmount) || 0 : amountNumber;
  /**
   * 누를 때 검증(field.md:86) — 버튼은 늘 켜 두고, 틀린 칸마다 그 아래에 글을 보인다.
   * 편집 모드: 나눈 내역을 아직 모르면(로딩/에러) 저장 보류. 합 정합 판정이 불가한 상태에서
   * 금액을 바꾼 분할 거래를 저장하면 백엔드 400(EXP_012)로 새고 정합 안내가 우회되므로 게이트.
   */
  const errors = {
    entry: entryNumber <= 0,
    tooLarge: amountNumber > MAX_AMOUNT,
    category: type !== "TRANSFER" && !categoryRowId,
    from: type === "TRANSFER" && !fromAssetRowId,
    to:
      type === "TRANSFER" &&
      (!toAssetRowId || (!!fromAssetRowId && fromAssetRowId === toAssetRowId)),
    /** 이자는 상환액 안에 포함된 몫이라 그보다 클 수 없다(서버 ASSET_TRANSFER_INVALID_INTEREST) — 칸 오류로 먼저 막는다 */
    interest:
      type === "TRANSFER" &&
      !!interest &&
      amountNumber > 0 &&
      Number(interest) > amountNumber,
    /** 외화인데 환율도 원화 금액도 없다 */
    fx: isForeignTx && entryNumber > 0 && amountNumber <= 0,
    // 분할만은 값이 있어도 마지막 받기가 실패면 막는다(loadFailed 가 아니라 isError) — 다른 기기에서 바꾼 분할을
    // 옛 값으로 덮어쓸 수 있다(돈, 검수 L4)
    splitsPending:
      isEdit && type !== "TRANSFER" && (splitsQ.isPending || splitsQ.isError),
  };
  /**
   * 수정 폼에서 나눈 내역을 못 받았다 — 그 자리 실패 + [다시 시도](상세 · 나누기 단계와 같은 꼴).
   * 저장을 눌러야 알게 하지 않는다. 이체는 나눈 내역이 없어 보지 않는다.
   */
  const splitsLoadFailed =
    isEdit && !!expense && type !== "TRANSFER" && splitsQ.isError;
  const retrySplits = () => void splitsQ.refetch();
  const splitsRetrying = splitsQ.isFetching;
  const firstError = (): TxField | null => {
    if (errors.entry) return "entry";
    if (errors.category) return "category";
    if (errors.from) return "from";
    if (errors.to) return "to";
    if (errors.interest) return "interest";
    if (errors.fx) return "fx";
    if (errors.tooLarge) return "fxAmount";
    if (errors.splitsPending) return "splits";
    return null;
  };
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
    // 확인창을 거친 저장이 실패해도 확인창이 남아 알림을 가리지 않는다 — 성공이면 어차피 닫힌다
    setSaveConfirm(null);
  };
  /** 저장 확인창의 저장 — 다시 잠그고 기다리던 저장을 보낸다. */
  const confirmSave = () => {
    if (!saveConfirm) return;
    savingRef.current = true;
    saveConfirm.onConfirm();
  };
  // 프리셋으로 저장할 수 있는 조건 — 종류마다 있어야 하는 칸이 다르다.
  // 지출·수입은 카테고리가, 이체는 양쪽 계좌가 프리셋의 뼈대다.
  // 누를 때 걸러 글로 알린다(E 32) — 금액 0 은 막지 않는다("비워 둠" 으로 저장)
  const presetNeeds: "category" | "parties" | null =
    type === "TRANSFER"
      ? transferPartiesReady(fromAssetRowId, toAssetRowId)
        ? null
        : "parties"
      : categoryRowId
        ? null
        : "category";

  const submitting =
    createMut.isPending ||
    updateMut.isPending ||
    replaceMut.isPending ||
    createTransferMut.isPending ||
    updateTransferMut.isPending ||
    commitSmsMut.isPending;

  /** 저장 요청이 실패했다 — 폼 맨 위 Callout(고정 문구). 다시 누르면 요청이 시작되며 사라진다 */
  const saveFailed =
    createMut.isError ||
    updateMut.isError ||
    replaceMut.isError ||
    createTransferMut.isError ||
    updateTransferMut.isError ||
    commitSmsMut.isError ||
    listsFailed;
  /**
   * 저장 응답을 못 읽었다(PARSE) — 서버는 저장했을 수 있다. Callout 은 "저장하지 못했어요" 가 아니라 "저장됐는지 확인하지 못했어요"
   * (다시 누르면 같은 거래가 두 번 들어갈 수 있다). 목록은 훅이 성공 때처럼 다시 받는다
   */
  const saveUnconfirmed = [
    createMut,
    updateMut,
    replaceMut,
    createTransferMut,
    updateTransferMut,
    commitSmsMut,
  ].some((m) => isWriteUnconfirmed(m.error));

  /**
   * 문자 해석 결과를 폼에 채운다.
   *
   * 채우기만 하고 저장하지는 않는다 — 파서가 틀렸을 때 사용자가 고칠 수 있어야 한다.
   * 결제수단은 카드 고정이다(카드 결제 문자다) — 자산 목록도 그에 맞춰 좁혀진다.
   */
  const applySms = (text: string, parsed: SmsParseResult) => {
    setSmsDraft({ text, parsed });
    setSmsLow(parsed.confidence === "LOW");
    setSmsLowAnnounced(false);
    setActivePresetId(null);
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

  const loadListsThenSave = () => {
    savingRef.current = true;
    setListsFailed(false);
    void Promise.all([assetsQ.refetch?.(), categoriesQ.refetch?.()]).then(
      ([a, c]) => {
        savingRef.current = false;
        if (a?.data && c?.data) setSaveRetry((n) => n + 1);
        else setListsFailed(true);
      },
    );
  };
  const save = () => {
    // 저장이 나가 있는 동안 또 누르면 같은 거래가 두 번 생긴다(QA 2026-09-02) — 첫 요청이 끝날 때까지 막는다.
    if (submitting || savingRef.current) return;
    // 목록이 없으면 그때 받아 온 뒤 판정하고 보낸다(닫힌 회차 확인창도 그 뒤). 못 받으면 요청 없이 알림 — 값을 추측해 보내지 않는다
    if (!listsReady) {
      loadListsThenSave();
      return;
    }
    // 새 거래의 통화는 설정의 기본 통화에서 온다 — 못 받은 채 저장하면 KRW 로 조용히 저장된다. 다시 받고, 또 실패하면 요청 없이 알린다
    if (!seed && !defaultCurrencyReady) {
      savingRef.current = true;
      setListsFailed(false);
      void ensureDefaultCurrency().then((ok) => {
        savingRef.current = false;
        if (ok) setSaveRetry((n) => n + 1);
        else setListsFailed(true);
      });
      return;
    }
    setShowErrors(true);
    const bad = firstError();
    if (bad) {
      focusField(bad);
      return;
    }
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

  // 저장이 받아 온 목록으로 이어진다 — 최신 렌더의 save 를 부른다
  const saveRef = useRef<() => void>(() => {});
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    if (saveRetry > 0) saveRef.current();
  }, [saveRetry]);

  /**
   * 프리셋 칩 — 누르면 채운다. 금액이 있으면 2단계로, 비었으면 1단계에 남아 금액 칸에 초점(Q4 B).
   * 적용한 칩을 다시 누르면 표시만 해제한다(값은 그대로 · 사용 기록 touch 를 보내지 않는다).
   */
  const togglePreset = (p: ExpenseTemplate) => {
    if (activePresetId === p.rowId) {
      clearPresetMark();
      setEmptyPresetName(null);
      return;
    }
    applyPreset(p);
    if (p.lockAmount === "Y" && p.amount != null && p.amount > 0) {
      setEmptyPresetName(null);
      setShowErrors(false);
      setFocusMerchant(false);
      setSub(null);
      setMain("2");
    } else {
      setEmptyPresetName(p.templateName);
      setSub(null);
      setMain("1");
      pendingFocus.current = "entry";
    }
  };

  /** 종류 칩 — 안 맞는 카테고리를 놓고 프리셋 표시를 지운다. 수정 · 고쳐 쓰기는 종류를 바꾸지 않는다 */
  const changeType = (v: TxType) => {
    if (isEdit || (isRewrite && v === "TRANSFER")) return;
    // 결제 문자 초안은 이체로 못 바꾼다 — 문자 전용 저장 경로(취소 문자 차단 · 카드 기억)가 이체 경로로 새지 않게(앱 #326 과 같은 규칙)
    if (smsDraft && v === "TRANSFER") return;
    if (v === type) return;
    // 외화 입력은 이체에 없다 — 이체로 가면 원화로 돌아온다
    if (v === "TRANSFER") setOrigCurrency(DEFAULT_CURRENCY);
    setType(v);
    clearPresetMark();
    setEmptyPresetName(null);
  };

  /** 통화 칩(20a) — 원화 ↔ 외화로 가면 친 값이 자리를 옮긴다 */
  const changeCurrency = (code: string) => {
    if (code === origCurrency) return;
    const toForeign = code !== DEFAULT_CURRENCY;
    if (!isForeignTx && toForeign) {
      setOrigAmount(amount);
      setAmount("");
      setFxRate("");
    } else if (isForeignTx && !toForeign) {
      // 서버 환산과 같은 반올림(원 단위 HALF_UP — AssetServiceImpl 의 원화 환산)
      const n = Math.round(parseFloat(origAmount) || 0);
      setAmount(n > 0 ? String(n) : "");
    }
    setOrigCurrency(code);
    clearPresetMark();
  };

  /** [다음] — 금액을 확인하고 2단계로 */
  const goNext = () => {
    setShowErrors(true);
    if (errors.entry) {
      focusField("entry");
      return;
    }
    setShowErrors(false);
    setEmptyPresetName(null);
    setFocusMerchant(true);
    setMain("2");
  };

  // 바뀐 값 — 처음 값과 달라진 것이 하나라도 있으면 닫기 전에 묻는다. 단계를 오가는 것은 바뀐 값이 아니다
  const snapshotOf = (v: {
    type: string;
    amount: string;
    description: string;
    expenseDate: string;
    expenseTime: string;
    merchant: string;
    isFixed: boolean;
    paymentMethod: string;
    installmentMonths: string;
    origCurrencyPick: string | null;
    origAmount: string;
    fxRate: string;
    categoryRowId: number | null;
    assetRowId: number | null;
    fromAssetRowId: number | null;
    toAssetRowId: number | null;
    fee: string;
    interest: string;
    smsText: string | null;
    reconciledSplits: ExpenseSplitFormValue[] | null;
  }) =>
    JSON.stringify([
      v.type,
      v.amount,
      v.description,
      v.expenseDate,
      v.expenseTime,
      v.merchant,
      v.isFixed,
      v.paymentMethod,
      v.installmentMonths,
      v.origCurrencyPick,
      v.origAmount,
      v.fxRate,
      v.categoryRowId,
      v.assetRowId,
      v.fromAssetRowId,
      v.toAssetRowId,
      v.fee,
      v.interest,
      v.smsText,
      v.reconciledSplits,
    ]);
  const snapshot = snapshotOf({
    type,
    amount,
    description,
    expenseDate,
    expenseTime,
    merchant,
    isFixed,
    paymentMethod,
    installmentMonths,
    origCurrencyPick,
    origAmount,
    fxRate,
    categoryRowId,
    assetRowId,
    fromAssetRowId,
    toAssetRowId,
    fee,
    interest,
    smsText: smsDraft?.text ?? null,
    reconciledSplits,
  });
  const [initialSnapshot, setInitialSnapshot] = useState(snapshot);
  // 문자로 채운 값이 처음 값이다(지시서 24 "문자 초안: 채운 값") — 읽은 직후 닫아도 묻지 않는다
  const [rebaseSnapshot, setRebaseSnapshot] = useState(false);
  if (rebaseSnapshot) {
    setRebaseSnapshot(false);
    setInitialSnapshot(snapshot);
  }
  const dirty = snapshot !== initialSnapshot;

  /**
   * 호스트가 이 폼을 든 채 다른 거래를 열 때(상세 → [수정] · [고쳐 쓰기]) 칸 · 단계 · 처음 값(바뀐 값 비교)을 그 거래로 갈아 끼운다.
   * 이벤트 핸들러에서 부르므로 호스트가 같은 렌더에 새 `expense` 인자를 준다 — 이펙트로 맞추지 않아 옛 값이 한 번 비치지 않는다(09b-1 isSyncedWith 교훈).
   */
  const beginEdit = (next: {
    expense?: Expense | null;
    editTransfer?: AssetTransfer | null;
    rewrite?: RewriteSeed | null;
  }) => {
    const v = initFrom({ ...next, defaultDate });
    setType(v.type);
    setAmount(v.amount);
    setDescription(v.description);
    setExpenseDate(v.expenseDate);
    setExpenseTime(v.expenseTime);
    setMerchant(v.merchant);
    setIsFixed(v.isFixed);
    setPaymentMethod(v.paymentMethod);
    setInstallmentMonths(v.installmentMonths);
    setOrigCurrency(null);
    setOrigAmount(v.origAmount);
    setFxRate(v.fxRate);
    setFxSeed({ origAmount: v.origAmount, fxRate: v.fxRate });
    setCategoryRowId(v.categoryRowId);
    setAssetRowId(v.assetRowId);
    setFromAssetRowId(v.fromAssetRowId);
    setToAssetRowId(v.toAssetRowId);
    setFee(v.fee);
    setInterest(v.interest);
    setSmsDraft(null);
    setRememberCard(false);
    setSmsLow(false);
    setSmsLowAnnounced(false);
    setSmsLoading(false);
    setOpenReconcile(false);
    setSaveConfirm(null);
    setReconciledSplits(null);
    setActivePresetId(null);
    setMain(v.main);
    setSubRaw(null);
    setSubSnap(null);
    setShowErrors(false);
    setEmptyPresetName(null);
    setFocusMerchant(false);
    setPresetName("");
    setPresetAmount("");
    setPresetShow(false);
    setRewriting(false);
    // 지난 저장 실패 알림이 다음 [수정] · [고쳐 쓰기] 에 남아 뜨지 않게
    createMut.reset();
    updateMut.reset();
    replaceMut.reset();
    createTransferMut.reset();
    updateTransferMut.reset();
    commitSmsMut.reset();
    setListsFailed(false);
    setInitialSnapshot(
      snapshotOf({
        ...v,
        origCurrencyPick: null,
        smsText: null,
        reconciledSplits: null,
      }),
    );
  };

  /** [고쳐 쓰기] — 호스트가 갈아 끼우거나(`onRewrite`) 폼이 스스로 새 거래 모드로 바뀐다 */
  const requestRewrite = () => {
    if (!expense) return;
    if (onRewrite) onRewrite({ of: expense, splits: serverSplitForms });
    else setRewriting(true);
  };

  // ── 프리셋으로 저장 (E 32) — 같은 시트 안 한 단계 ──
  const openPresetSave = () => {
    // 이름은 12자까지 — 거래처가 더 길어도 처음 값이 상한을 넘지 않게 자른다
    setPresetName([...merchant].slice(0, 12).join(""));
    setPresetAmount(amountNumber > 0 ? String(amountNumber) : "");
    setPresetShow(false);
    createPresetMut.reset();
    setSub("presetSave");
  };
  /** [저장] — 누를 때 걸러 글로 알리고, 저장하면 연 단계로 돌아온다(넣던 값 그대로) */
  const savePreset = (onDone: (name: string) => void) => {
    setPresetShow(true);
    if (createPresetMut.isPending) return;
    const name = presetName.trim();
    if (presetNeeds || presetNameIssue) return;
    const transfer = type === "TRANSFER";
    const amt = parseAmount(presetAmount);
    const locked = amt > 0;
    createPresetMut.mutate(
      {
        templateName: name,
        categoryRowId: transfer ? null : categoryRowId,
        assetRowId: (transfer ? fromAssetRowId : assetRowId) ?? undefined,
        toAssetRowId: transfer ? (toAssetRowId ?? undefined) : undefined,
        fee: transfer && fee ? Number(fee) : undefined,
        // 이자는 금액을 따라간다 — 금액을 안 저장하면 이자도 안 저장한다(사용자 결정 2026-09-15)
        interestAmount:
          locked && showInterest && interest ? Number(interest) : undefined,
        expenseType: type,
        amount: locked ? amt : undefined,
        description: description || undefined,
        merchant: transfer ? undefined : merchant || undefined,
        paymentMethod: transfer ? undefined : paymentMethod || undefined,
        lockAmount: locked ? "Y" : "N",
        isFixed: transfer ? false : isFixed,
      },
      {
        onSuccess: () => {
          setSub(null);
          onDone(name);
        },
      },
    );
  };
  const presetFailed = createPresetMut.isError;
  /** 프리셋 이름 — 비었거나 이미 있는 이름이면 칸 오류로 먼저 막는다(서버 EXPENSE_TEMPLATE_DUPLICATE_NAME) */
  const presetNameIssue: "required" | "duplicate" | null =
    presetName.trim().length === 0
      ? "required"
      : templates.some((p) => p.templateName === presetName.trim())
        ? "duplicate"
        : null;

  /** 문자 단계가 성공했다 — 채운 값으로 2단계 */
  const finishSms = () => {
    setRebaseSnapshot(true);
    setSub(null);
    setFocusMerchant(false);
    setEmptyPresetName(null);
    setShowErrors(false);
    setMain("2");
  };

  return {
    t,
    tc,
    isEditTransfer,
    isEdit,
    rewriteOf,
    isRewrite,
    seed,
    isAutoGenerated,
    isMoneyLocked,
    moneyFieldsLocked,
    isReplaceable,
    rewriting,
    setRewriting,
    notifyResult,
    categoriesQ,
    assetsQ,
    createMut,
    updateMut,
    replaceMut,
    createTransferMut,
    updateTransferMut,
    touchPresetMut,
    commitSmsMut,
    splitsQ,
    categories,
    assets,
    type,
    setType,
    amount,
    setAmount,
    description,
    setDescription,
    expenseDate,
    setExpenseDate,
    expenseTime,
    setExpenseTime,
    merchant,
    setMerchant,
    isFixed,
    setIsFixed,
    paymentMethod,
    setPaymentMethod,
    installmentMonths,
    setInstallmentMonths,
    defaultCurrency,
    origCurrencyPick,
    setOrigCurrency,
    origCurrency,
    origAmount,
    setOrigAmount,
    fxRate,
    setFxRate,
    categoryRowId,
    setCategoryRowId,
    assetRowId,
    setAssetRowId,
    fromAssetRowId,
    setFromAssetRowId,
    toAssetRowId,
    setToAssetRowId,
    fee,
    setFee,
    interest,
    setInterest,
    smsDraft,
    setSmsDraft,
    rememberCard,
    setRememberCard,
    openReconcile,
    setOpenReconcile,
    saveConfirm,
    setSaveConfirm,
    reconciledSplits,
    setReconciledSplits,
    templatesQ,
    templates,
    activePresetId,
    setActivePresetId,
    topPresets,
    clearPresetMark,
    applyPreset,
    selectedCategory,
    allowAsset,
    filteredAssets,
    isTransfer,
    showInterest,
    showInstallment,
    isForeignTx,
    fxSeed,
    setFxSeed,
    amountNumber,
    transferCurrency,
    transferUnit,
    transferMoney,
    transferReceiveText,
    transferHintText,
    serverSplitForms,
    rewriteSplitsApply,
    effectiveSplits,
    splitSum,
    hasSplits,
    splitMismatch,
    amountTooLarge,
    canRewrite,
    splitsLoadFailed,
    retrySplits,
    splitsRetrying,
    savedInstallment,
    pickedCard,
    saveClosedSpan,
    confirmThen,
    rewriteNote,
    saveEdit,
    saveRewrite,
    savingRef,
    unlock,
    confirmSave,
    submitting,
    saveFailed,
    saveUnconfirmed,
    listsFailed,
    subDirty,
    leaveSub,
    expense,
    focusMerchant,
    presetName,
    setPresetName,
    presetAmount,
    setPresetAmount,
    presetShow,
    openPresetSave,
    savePreset,
    presetFailed,
    // 프리셋 저장 실패의 오류 — 결과를 확인하지 못한 쓰기면 글이 바뀐다
    presetError: createPresetMut.error,
    presetNameIssue,
    presetSaving: createPresetMut.isPending,
    finishSms,
    presetNeeds,
    main,
    setMain,
    sub,
    setSub,
    showErrors,
    setShowErrors,
    emptyPresetName,
    setEmptyPresetName,
    fieldRefs,
    refFor,
    focusField,
    errors,
    entryNumber,
    smsLow,
    smsLowAnnounced,
    markSmsLowAnnounced: () => setSmsLowAnnounced(true),
    smsLoading,
    setSmsLoading,
    assetsLoaded,
    categoriesLoaded,
    setSmsLow,
    togglePreset,
    changeType,
    changeCurrency,
    goNext,
    dirty,
    beginEdit,
    requestRewrite,
    applySms,
    save,
  };
}

export type TxForm = ReturnType<typeof useTxForm>;
