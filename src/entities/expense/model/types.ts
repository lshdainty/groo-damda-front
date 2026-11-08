import type { ExpenseSplitFormValue } from "@/entities/expense-split";

export type ExpenseType = "INCOME" | "EXPENSE";

/**
 * 반복 거래·프리셋이 가리키는 거래 종류.
 *
 * `ExpenseType` 에 `TRANSFER` 를 끼우지 않는다 — 그 값은 거래·통계·예산이 전부 지나는
 * 자리라, 이체를 넣으면 그 셋이 모두 "이체를 어느 쪽으로 셀 것인가" 를 답해야 한다.
 * 이체는 지출/수입 어느 쪽으로도 집계되면 안 되는 값이다. 서버도 같은 이유로
 * `ExpenseType` 을 그대로 두고 `TxKind` 를 따로 뒀다.
 */
export type TxKind = ExpenseType | "TRANSFER";
export type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "OTHER";

export interface ExpenseCategory {
  rowId: number;
  categoryName: string;
  icon: string | null;
  color: string | null;
  expenseType: ExpenseType;
  sortOrder: number;
  parentRowId: number | null;
  hasChildren: boolean;
  createAt: string;
  modifyAt: string;
}

export interface ExpenseCategoryTreeNode extends ExpenseCategory {
  children: ExpenseCategoryTreeNode[];
}

export interface Expense {
  rowId: number;
  categoryRowId: number;
  categoryName?: string;
  categoryColor?: string;
  categoryIcon?: string;
  assetRowId: number | null;
  assetName: string | null;
  expenseType: ExpenseType;
  amount: number;
  description: string | null;
  /** ISO-LOCAL-DATETIME (YYYY-MM-DDTHH:mm:ss). 10자 "YYYY-MM-DD" 도 호환됨. */
  expenseDate: string;
  merchant: string | null;
  paymentMethod: string | null;
  /** 할부 개월 (null = 일시불). 신용카드 결제에만 의미. */
  installmentMonths: number | null;
  /**
   * 환불 처리 시각 (null = 환불 아님).
   *
   * 환불은 **원거래에 찍는 표식**이다 — 수입 행을 만들지 않는다. 있으면 합계·예산·통계·
   * 청구·실적에서 삭제와 똑같이 빠지고, 목록·검색·상세에는 남는다.
   */
  refundedAt: string | null;
  /**
   * 옛 환불 마크가 만든 카드→결제계좌 환급 이체 (null = 없음). 이제 환불은 환급 이체를
   * 만들지 않는다(D1) — 옛 데이터에만 있고, 있으면 환불 취소가 그 이체를 되돌린다.
   */
  refundTransferRowId: number | null;
  /**
   * 이 요청이 **방금 만든** 선결제 환급액 (없으면 없음) — 거래의 속성이 아니라 그 요청의
   * 결과다. 조회로 받은 거래에는 늘 없다. 0 보다 크면 토스트로 알린다(D4).
   */
  refundedAmount?: number | null;
  /**
   * 이 날짜(회차 말일)까지의 카드 회차분은 계좌 이체 없이 정리된 **기록용** (null = 정상).
   *
   * 결제가 끝난(닫힌) 회차에 뒤늦게 적은 카드 지출에 붙는다 — 가계부 합계에는 들어가지만
   * 계좌에서는 빠지지 않았고 이후 청구에도 안 얹힌다(닫힌 회차 규칙 R2). 옛 서버면 없다.
   */
  cardSettledThrough?: string | null;
  /**
   * 그 가운데 기록만 남긴 금액. 거래 금액과 같을 때만 행에 "기록만" 배지를 단다 —
   * 작으면 할부의 지난 회차분뿐이라 상세에서 "이 중 N원" 으로 말한다(D10).
   */
  recordOnlyAmount?: number | null;
  /**
   * **돈 칸 잠금**(D12) — 결제일이 된 회차분이 하나라도 있는 신용카드 거래(기록용 포함).
   * 금액·날짜·시간·자산·할부·유형·통화 3칸·결제수단을 못 고치고, 카테고리·가맹점·메모만
   * 고친다. 돈 칸을 바꾸려면 [고쳐 쓰기](`POST /expense/{id}/replace`, D13). 옛 서버면 없다.
   */
  moneyLocked?: boolean;
  /**
   * [고쳐 쓰기]를 쓸 수 있는 거래 — 잠겼고(`moneyLocked`) 환불 안 됐고 자동 생성이 아니고
   * 중도 정리하지 않은 할부. 잠겼는데 이게 false 면 사실상 중도 정리한 할부다(서버가 교체를
   * EXP_047 로 거절한다). 옛 서버면 없다 — 그때는 `moneyLocked` 로 본다.
   */
  replaceable?: boolean;
  /** 원 통화 금액 (해외 결제). null 이면 원화 결제 */
  originalAmount: number | null;
  /** 원 통화 (ISO 4217, 예: USD) */
  originalCurrency: string | null;
  /** 적용 환율 (원 통화 1단위당 원화) */
  exchangeRate: number | null;
  calendarEventRowId: number | null;
  todoRowId: number | null;
  /**
   * 시스템이 만든 거래의 출처 — `TRADE_REALIZED`(매도 실현손익) / `TRANSFER_INTEREST`(이체 이자).
   * null 이면 손으로 쓴 거래다.
   *
   * <p>값이 있으면 금액·날짜·자산은 계산 결과라 고칠 수 없다. 원본 거래를 지우면 함께 사라진다.
   * 카테고리·메모는 분류라서 그대로 고칠 수 있다.
   */
  autoSource: string | null;
  /**
   * 지금 이 사용자가 직접 지울 수 있나(서버 판정). 자동 생성이면 보통 false 지만, 그 기록을 만든
   * 증권 자산이 이미 삭제됐으면 true. 삭제 버튼 판정에만 쓴다 — 수정·환불·분할은 `autoSource` 기준.
   * 옛 서버면 없다(그땐 `autoSource == null` 로 본다).
   */
  deletable?: boolean;
  /** 활성 분할 항목들의 카테고리 id (없으면 빈 배열). 목록 카테고리 필터를 split-aware 하게 매칭. */
  splitCategoryRowIds?: number[];
  /**
   * 고정 수입·지출 — 월급·월세처럼 매달 정해진 거래. 통계가 전체 · 고정 · 변동으로 나눠 보는
   * **분류 표식**이다(돈·잔액·카드 청구에는 영향 없음). 이체는 대상이 아니다. 옛 서버면 없다.
   */
  isFixed?: boolean;
  createAt: string;
  modifyAt: string;
}

/**
 * 거래 생성·수정 본문.
 *
 * PUT 은 세 갈래다 — **키 없음=유지 · `null`=지움 · 값=교체**(`Patch`, QA #96).
 * 그래서 화면이 그리는 칸은 비었을 때 `null` 을 실어야 지워지고(`undefined` 는 키를
 * 빼는 것이라 옛 값이 남는다), 화면에 없는 칸은 아예 안 실어야 남의 값을 안 덮는다.
 * `?: T | null` 로 적힌 칸이 "지울 수 있는 칸" 이다.
 */
export interface ExpenseFormValues {
  categoryRowId: number;
  /** 결제 계좌·카드. `null` = 연결 해제('선택 안 함'). */
  assetRowId?: number | null;
  expenseType: ExpenseType;
  amount: number;
  /** `null` = 설명 지움. */
  description?: string | null;
  /** ISO-LOCAL-DATETIME (YYYY-MM-DDTHH:mm:ss). 10자 "YYYY-MM-DD" 도 호환됨. */
  expenseDate: string;
  /** `null` = 거래처 지움. */
  merchant?: string | null;
  /** `null` = 결제수단 지움('선택 안 함'). */
  paymentMethod?: string | null;
  /** 할부 개월 (미전달·1 = 일시불). 신용카드 결제에만 의미. */
  installmentMonths?: number | null;
  /** 원 통화 금액 (해외 결제) */
  originalAmount?: number | null;
  /** 원 통화 (ISO 4217) */
  originalCurrency?: string | null;
  /** 적용 환율 */
  exchangeRate?: number | null;
  calendarEventRowId?: number;
  todoRowId?: number;
  /**
   * 고정 수입·지출. 생성은 안 실으면 변동, 수정은 **안 실으면 유지**(Patch)다 — 이 칸을 그리는
   * 시트는 늘 실어 켜고 끄는 대로 저장된다. 이체에는 쓰지 않는다.
   */
  isFixed?: boolean;
  /**
   * 분할 내역 동시 수정(선택). 미전달/undefined = 분할 미변경(기존 유지).
   * 전달 시 새 분할로 교체되며, 합이 amount와 같아야 한다(백엔드 원자 검증).
   * 거래 금액을 바꿔 기존 분할 합과 어긋날 때, 맞춘 분할을 함께 보내 일치화하는 용도.
   */
  splits?: ExpenseSplitFormValue[];
}

export interface ExpenseCategoryFormValues {
  categoryName: string;
  icon?: string;
  color?: string;
  expenseType: ExpenseType;
  sortOrder?: number;
  parentRowId?: number | null;
}

export interface ExpenseBudget {
  rowId: number;
  categoryRowId: number | null;
  categoryName: string | null;
  budgetAmount: number;
  budgetYear: number;
  budgetMonth: number;
  createAt: string;
}

export interface ExpenseBudgetFormValues {
  categoryRowId?: number | null;
  budgetAmount: number;
  budgetYear: number;
  budgetMonth: number;
}

export interface RangeSummary {
  startDate: string;
  endDate: string;
  totalIncome: number;
  totalExpense: number;
  /**
   * 합계 중 **고정**인 몫 — 변동 = 합계 − 고정. 고정은 전체의 부분집합이다(환불·미래분 규칙을
   * 서버가 한 곳에서 같이 적용한다). 옛 서버면 없다 — 소비 측에서 0 으로 본다.
   */
  fixedIncome?: number;
  fixedExpense?: number;
  categoryBreakdown: CategoryBreakdown[];
  monthlyBuckets: RangeMonthlyBucket[];
}

export interface RangeMonthlyBucket {
  year: number;
  month: number;
  totalIncome: number;
  totalExpense: number;
  /** 그 달 합계 중 고정인 몫. 옛 서버면 없다. */
  fixedIncome?: number;
  fixedExpense?: number;
  // 그 달의 카테고리별 지출(EXPENSE만, split-aware). 카테고리 월별 추이 차트용.
  // 백엔드 배포 전이거나 데이터 없으면 undefined/빈 배열일 수 있음 — 소비 측에서 안전 처리.
  categoryExpenses?: CategoryAmount[];
}

export interface CategoryAmount {
  categoryRowId: number;
  amount: number;
  /** 그 금액 중 고정인 몫. 옛 서버면 없다. */
  fixedAmount?: number;
}

export interface MonthlyTrend {
  year: number;
  month: number;
  totalIncome: number;
  totalExpense: number;
  /** 그 달 합계 중 고정인 몫. 옛 서버면 없다. */
  fixedIncome?: number;
  fixedExpense?: number;
}

export interface BudgetComplianceMonth {
  year: number;
  month: number;
  totalLimit: number;
  totalSpent: number;
  compliancePercent: number;
}

export interface CategoryBreakdown {
  /** null = 미분류 — 카테고리 없이 자동 생성되는 거래(실현손익·대출이자)가 여기 모인다. */
  categoryRowId: number | null;
  categoryName: string | null;
  totalAmount: number;
  parentCategoryRowId: number | null;
  parentCategoryName: string | null;
  expenseType: ExpenseType;
  /** 그 금액 중 고정인 몫. 같은 카테고리에 고정과 변동이 섞일 수 있다. 옛 서버면 없다. */
  fixedAmount?: number;
}

export interface ParentCategoryBreakdown {
  categoryRowId: number | null;
  categoryName: string | null;
  totalAmount: number;
  children: CategoryBreakdown[];
}

export type StatsPeriod = "3m" | "6m" | "1y";

export interface BudgetVsActualItem {
  categoryName: string;
  budgetAmount: number;
  actualAmount: number;
  percentage: number;
}

export interface MerchantSummary {
  merchant: string;
  totalAmount: number;
  count: number;
}

export interface HeatmapCell {
  /** Java DayOfWeek 기준: 1=월 ~ 7=일 */
  dayOfWeek: number;
  /** 0-23 */
  hour: number;
  totalAmount: number;
}

/** 삭제 응답 — 이 삭제가 만든 선결제 환급액(없으면 null, D4). */
export interface DeleteExpenseResult {
  refundedAmount: number | null;
}

/** 일괄 삭제 결과 — 지운 건수와 결제계좌로 돌려준 금액 합 */
export interface BulkDeleteExpenseResult {
  deletedCount: number;
  refundedAmount: number | null;
}
