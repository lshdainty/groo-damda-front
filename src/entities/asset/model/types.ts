import type { YNType } from "@/shared/types";
export type AssetType =
  | "BANK_ACCOUNT"
  | "CREDIT_CARD"
  | "CHECK_CARD"
  | "CASH"
  | "SAVINGS"
  | "LOAN"
  | "INVESTMENT";

export interface AssetCardCatalogBrief {
  rowId: number;
  cardName: string;
  imgUrl: string | null;
  companyName: string | null;
  companyLogoUrl: string | null;
}

/**
 * 투자 자산 보유 항목 — 증권사(자산) 단위 아래 다건.
 * linked=true → tossSymbol+quantity(토스 현재가 × 수량으로 평가) /
 * linked=false → holdingName+holdingValue(직접 입력 평가액).
 */
/** 보유 유형 — 수량 단위가 다르다(주식 주 / 금 g / 코인 개). 토스 시세 연동은 STOCK 만 가능. */
export type HoldingType = "STOCK" | "GOLD" | "CRYPTO";

export interface AssetHolding {
  rowId?: number;
  /** 구버전 응답이면 없음 — STOCK 으로 간주 */
  holdingType?: HoldingType;
  linked: boolean;
  /**
   * 종목 마스터 기준 시장코드(NAS·KOSPI …) — 선택.
   *
   * 같은 티커가 여러 시장에 걸린다(SPY·IVV·JEPI·SOXL). 종목 검색 응답이 이미 들고 있으니
   * 저장할 때 그대로 돌려보내면 서버가 종목을 확정한다. 안 보내면 서버가 심볼로 해석하고,
   * 여러 시장에 걸리면 비워 둔다.
   */
  marketCode?: string | null;
  tossSymbol?: string | null;
  /**
   * 코인 0.05·금 3.75g 등 소수 허용. 미연동도 기록 가능(선택).
   * 서버는 decimal(28,8)/BigDecimal 이고 JS number 는 십진 소수를 정확히 담지 못한다 —
   * 왕복 정밀도를 지키려 문자열로 주고받는다(Jackson 이 문자열→BigDecimal 로 받는다).
   */
  quantity?: string | null;
  holdingName?: string | null;
  holdingValue?: number | null;
  /** 총 매수원가 (원화, 수수료 포함). 평가액과의 차이가 평가손익이다. */
  totalCost?: number | null;
  /** 평단가 — 총원가 / 수량. 서버 파생값이라 읽기 전용. */
  avgPrice?: string | null;
  sortOrder?: number;
}

/** 매수·매도 거래 유형. OPENING 은 앱을 쓰기 전부터 갖고 있던 보유라 돈이 오가지 않는다. */
export type TradeType = "OPENING" | "BUY" | "SELL";

export interface AssetTrade {
  rowId: number;
  assetRowId: number;
  tradeType: TradeType;
  holdingType: HoldingType;
  /** 종목 식별자 — 연동은 토스 종목코드, 미연동은 항목명. */
  holdingKey: string;
  linked: boolean;
  /** 소수 허용이라 문자열로 주고받는다(AssetHolding.quantity 와 같은 이유). */
  quantity: string;
  /** 거래대금 — 수수료 제외. */
  amount: number;
  fee: number;
  /** 실현손익 (매도 전용). 이익 양수 / 손실 음수. */
  realizedPl?: number | null;
  tradeDate: string;
  description?: string | null;
  /** 결제 계좌 — 지정하면 증권계좌 예수금 대신 이 계좌에서 오간다. */
  settlementAssetRowId?: number | null;
}

/**
 * 매매 미리보기 — 서버가 계산해 준다.
 *
 * <p>실현손익·평균단가는 이동평균 원가 규칙을 타는데, 그 규칙을 화면에도 적어 두면
 * 서버와 갈라진다. JS 는 수를 double 로 다뤄서 끝자리도 어긋난다.
 */
export interface AssetTradePreview {
  /** 이번에 파는 만큼의 취득원가 (매도 전용). */
  soldCost: number | null;
  /** 실현손익 — 이익 양수 / 손실 음수 (매도 전용). */
  realizedPl: number | null;
  /** 이 거래로 예수금이 움직이는 양 — 매수 음수 / 매도 양수. */
  cashDelta: number;
  /** 거래 후 예수금. */
  cashAfter: number;
  /** 예수금이 모자라 결제 계좌에서 끌어올 금액(결제 계좌 통화) — 0 이면 이체가 생기지 않는다. */
  fundingAmount: number;
  /** cashDelta · cashAfter 의 통화(투자 계좌 통화). 옛 서버면 없다 */
  cashCurrency?: string | null;
  /** fundingAmount 의 통화(결제 계좌 통화). 결제 계좌가 없거나 옛 서버면 없다 */
  fundingCurrency?: string | null;
}

export interface AssetTradeFormValues {
  assetRowId: number;
  tradeType: TradeType;
  holdingType: HoldingType;
  holdingKey: string;
  linked: boolean;
  quantity: string;
  amount: number;
  fee?: number;
  tradeDate: string;
  description?: string;
  settlementAssetRowId?: number | null;
}

export interface Asset {
  rowId: number;
  userRowId: number;
  assetName: string;
  assetType: AssetType;
  balance: number;
  /** 예수금·현금 잔액 (투자 계좌의 매수 대기 자금). balance = cashBalance + holdingBalance */
  cashBalance: number;
  /** 보유 종목 평가금액. 보유가 없으면 0 */
  holdingBalance: number;
  currency: string;
  /** 원화 환산율 (통화 1단위당 원화). KRW 는 1 — 예수금(cashBalance)에만 곱한다(보유 평가는 원화) */
  exchangeRate: number;
  /**
   * 원화 합계 — 서버 한 식 `round(cashBalance × exchangeRate) + holdingBalance`(I-13 길 A). 줄 · 묶음 합계 · 상세 큰 금액이
   * 이 값을 읽는다. 옛 서버면 없다(그때만 balance × 환율로 폴백 — `assetBalanceInKrw`).
   */
  balanceInKrw?: number | null;
  color: string | null;
  institution: string | null;
  memo: string | null;
  sortOrder: number;
  isIncludedInTotal: YNType;
  /**
   * 이 자산의 **금액만** 가린다.
   *
   * <p>화면 카드 가리기(`hide_cards`)와 별개 축이고 **합집합**이다 — 하나라도 켜져
   * 있으면 가려진다. 합계·구성·순자산은 이 값을 보지 않는다(서버도 집계에 안 넣는다).
   */
  isAmountHidden: YNType;
  cardCatalog: AssetCardCatalogBrief | null;
  /** 신용카드 한도 (CREDIT_CARD 전용, nullable) */
  creditLimit?: number | null;
  /** 결제일 1~31 (CREDIT_CARD 전용, nullable) */
  paymentDay?: number | null;
  /** 결제 출금계좌 자산 rowId (CREDIT_CARD 전용, nullable) */
  paymentAssetRowId?: number | null;
  /** 연동 종목의 시장코드 (nullable) — 서버가 확정 못 했으면 없다 */
  marketCode?: string | null;
  /** 토스 연동 종목코드 (INVESTMENT 시세×수량 평가, nullable) — holdings 도입으로 deprecated */
  tossSymbol?: string | null;
  /** 토스 연동 보유수량 (INVESTMENT 시세×수량 평가, nullable) — holdings 도입으로 deprecated */
  tossQuantity?: number | null;
  /** 투자 보유 항목들 (INVESTMENT 전용, 구버전 응답이면 없음) */
  holdings?: AssetHolding[];
  /** 이번 달(1일~말일) 사용 합계 — CHECK_CARD 전용, 서버 계산(예정 제외·환불 상계).
      연결계좌 즉시 차감으로 잔액이 늘 0 이라, 행·상세는 잔액 대신 이 값을 보여준다 */
  monthlyUsedAmount?: number | null;
  /**
   * 신용카드의 **이월 금액** — 카드를 등록할 때 적은 "이전 미결제 사용액"(없으면 0).
   * 신용카드가 아니면 null. 카드 수정 폼의 그 칸이 이 값으로 열린다(D7).
   *
   * `balance` 와 다르다 — 잔액은 지금 미결제 총액(이월 + 그 뒤 사용)이다. 폼을 잔액으로
   * 채워 그대로 저장하면 이월 거래가 잔액만큼 새로 잡혀 빚이 두 배가 됐다(QA 23차 1).
   */
  carryoverAmount?: number | null;
  /** 이월 거래가 든 회차의 결제일이 됐다 — 이월 금액 칸은 읽기 전용이다(D15). */
  carryoverLocked?: boolean;
  /**
   * 신용카드의 **결제 대기 청구분** 칸(2026-09-22) — 결제일 전에 카드를 등록할 때 따로 적은
   * 지난달 청구분. 청구분이 있거나 등록한 달의 그 회차 결제일이 아직 안 왔으면 값(폼이 칸을
   * 그린다), 아니면 null. `paymentDate` 는 그 회차의 결제일 — 칸 이름에 쓴다.
   */
  dueCarryover?: {
    amount: number;
    locked: boolean;
    paymentDate: string | null;
  } | null;
  /**
   * 이 날짜(`yyyy-MM-dd`) 이하 거래는 **결제가 끝난 회차**다 — 결제일이 오늘(서울) 이하인
   * 가장 최근 회차의 말일. 닫힌 회차가 없거나 결제일 없는 카드·신용카드 아님이면 null.
   *
   * 회차는 서버가 센다(결제일 변경 이력 D5 · 서울 시계 D11). 화면은 거래 날짜와 이 값만
   * 견준다.
   */
  cardClosedThrough?: string | null;
  /**
   * 결제일 있는 신용카드의 **결제일이 오늘보다 뒤인 첫 회차**가 실제로 결제되는 날
   * (`yyyy-MM-dd`, 결제일 변경 이력 반영 — D5). 그 회차는 이 날짜의 전달 1일~말일이고, 그 뒤
   * 회차들은 지금 `paymentDay` 로 결제된다. 결제일을 바꾼 직후엔 이 회차만 옛 결제일에
   * 결제되므로 `paymentDay` 로 세면 틀린 날짜를 말한다. 결제일 없는 카드·신용카드 아님·옛
   * 서버면 없다.
   */
  nextPaymentDate?: string | null;
  createAt: string;
  modifyAt: string;
}

export interface AssetFormValues {
  assetName: string;
  assetType: AssetType;
  /** 미전달 = 서버 산정. 투자+holdings 는 서버가 평가액을 BigDecimal 로 잡으므로 보내지 않는다 */
  balance?: number;
  /**
   * 통화. **고르는 칸이 있는 화면만 싣는다** — 안 실으면 생성은 서버가 `"KRW"` 로
   * 채우고(`AssetServiceImpl.createAsset`) 수정은 지금 통화를 지킨다(`currency().orKeep`).
   *
   * 칸도 없이 `"KRW"` 를 실어 외화 자산이 편집 한 번에 원화가 됐고, 서버가 환산율까지
   * 1 로 정규화해 총자산이 환산 없이 합쳐졌다(QA #106). 앱도 같다(desk-app #326).
   */
  currency?: string;
  /** 원화 환산율 (외화 자산 전용). 미전달·KRW 면 1 */
  exchangeRate?: number | null;
  color?: string;
  institution?: string;
  /**
   * 메모. `null` 을 실으면 지운다 — PUT 은 "키 없음=유지 · null=지움" 이라(`Patch`)
   * 비운 칸을 키째 빼면 옛 메모가 그대로 남는다(QA #110).
   *
   * 메모 칸이 **없는** 화면(카드 편집)은 읽어 온 값을 그대로 되돌려 보낸다 — 지어낸
   * 값이 아니라 그 자산의 지금 값이라, 이 칸을 무조건 대입하던 옛 서버에서도 안 지워진다.
   */
  memo?: string | null;
  sortOrder?: number;
  isIncludedInTotal?: YNType;
  isAmountHidden?: YNType;
  cardCatalogRowId?: number | null;
  creditLimit?: number | null;
  paymentDay?: number | null;
  paymentAssetRowId?: number | null;
  /**
   * 신용카드: 결제를 기다리던 지난달 청구분(양수) — 다가오는 결제일에 청구된다. `balance` 는
   * 그 뒤 쓴 금액이다. 결제 대기 청구분이 없을 때 보내면 400(AST_035). 0 이면 안 보낸다.
   */
  dueCarryoverAmount?: number;
  /** 투자 보유 항목 전체 교체 (INVESTMENT 전용, 미전달 시 유지) */
  holdings?: AssetHolding[];
}

export interface AssetUpdateFormValues {
  assetName: string;
  assetType: AssetType;
  /** 미전달 = 기존 잔액 유지(투자+holdings 는 서버 산정) */
  balance?: number;
  /**
   * 통화. **고르는 칸이 있는 화면만 싣는다** — 안 실으면 생성은 서버가 `"KRW"` 로
   * 채우고(`AssetServiceImpl.createAsset`) 수정은 지금 통화를 지킨다(`currency().orKeep`).
   *
   * 칸도 없이 `"KRW"` 를 실어 외화 자산이 편집 한 번에 원화가 됐고, 서버가 환산율까지
   * 1 로 정규화해 총자산이 환산 없이 합쳐졌다(QA #106). 앱도 같다(desk-app #326).
   */
  currency?: string;
  /** 원화 환산율 (외화 자산 전용). 미전달·KRW 면 1 */
  exchangeRate?: number | null;
  color?: string;
  institution?: string;
  /**
   * 메모. `null` 을 실으면 지운다 — PUT 은 "키 없음=유지 · null=지움" 이라(`Patch`)
   * 비운 칸을 키째 빼면 옛 메모가 그대로 남는다(QA #110).
   *
   * 메모 칸이 **없는** 화면(카드 편집)은 읽어 온 값을 그대로 되돌려 보낸다 — 지어낸
   * 값이 아니라 그 자산의 지금 값이라, 이 칸을 무조건 대입하던 옛 서버에서도 안 지워진다.
   */
  memo?: string | null;
  isIncludedInTotal?: YNType;
  /** 안 보내면 유지. 명시적 `null` 은 400 — NOT NULL 칸이라 "지운다" 가 없다. */
  isAmountHidden?: YNType;
  cardCatalogRowId?: number | null;
  creditLimit?: number | null;
  paymentDay?: number | null;
  paymentAssetRowId?: number | null;
  /**
   * 신용카드 이월 금액(양수, D7). 안 보내면 유지. 신용카드는 서버가 `balance` 를
   * **무시**하므로 이월 금액은 이 키로만 바뀐다. 이월 회차가 닫혔으면(`carryoverLocked`)
   * 값이 달라질 때 400 이다(D15).
   */
  carryoverAmount?: number;
  /**
   * 신용카드 결제 대기 청구분(양수). 안 보내면 유지, 0 이면 지운다. 등록한 달의 그 회차 결제일
   * 전까지만 — 지나면 400(AST_034), 등록한 달이 아니면 400(AST_035).
   */
  dueCarryoverAmount?: number;
  /** 투자 보유 항목 전체 교체 (INVESTMENT 전용, 미전달 시 유지) */
  holdings?: AssetHolding[];
}

/**
 * 청구 기록 상태. `REFUNDED` 는 그 회차에서 결제계좌로 돌려준 환급(선결제가 남았을 때, D3),
 * `RECORD_REFUNDED` 는 폐지된 기록용 환급의 옛 기록이다 — 둘 다 `history` 에 섞여 온다.
 */
export type BillingStatus =
  | "PENDING"
  | "COMPLETED"
  | "FAILED"
  | "SKIPPED"
  | "REFUNDED"
  | "RECORD_REFUNDED";

export interface BillingItem {
  rowId: number;
  cardAssetRowId: number;
  paymentAssetRowId: number | null;
  billingAmount: number;
  /** "yyyy-MM-dd" */
  periodStart: string;
  /** "yyyy-MM-dd" */
  periodEnd: string;
  /** "yyyy-MM-dd" */
  paymentDate: string;
  status: BillingStatus;
  transferRowId: number | null;
  failureReason: string | null;
}

/** 다가오는 회차에 빠지는 할부 한 건 — 명세서의 "원금·N개월 중 k회차" 표시용. */
export interface InstallmentDue {
  expenseRowId: number;
  merchant: string | null;
  description: string | null;
  /** 할부 원금(거래 전액). */
  principalAmount: number;
  /** 총 회차 수(N). */
  installmentMonths: number;
  /** 이번이 몇 회차인지(1-base). */
  sequence: number;
  /** 이번 회차에 빠지는 금액. 나머지는 1회차에 몰린다(카드사 관행). */
  amount: number;
  /** 중도 전액 상환으로 남은 원금을 몰아 받은 회차인지 — "정리됨" 배지 + 되돌리기를 그린다. */
  paidOff: boolean;
  /** 결제가 끝난 회차에 걸린 기록용 회차분 — "· 기록만" 을 붙인다(D10). 옛 서버면 없다. */
  recordOnly?: boolean;
}

export interface CardBilling {
  cardAssetRowId: number;
  /**
   * 다가오는 결제 회차의 결제예정액 = 청구 기간(결제일의 전월 1일~말일) 순사용액
   * − 같은 회차 기결제액(선결제 차감). 결제일 미설정 시 잔액 전액 fallback.
   */
  upcomingAmount: number;
  /** 회차 내 일시불 순사용액(환불 상계, 음수 가능). 옛 서버 호환으로 옵셔널. */
  upcomingLumpSumAmount?: number | null;
  /** 같은 회차에 이미 낸 금액(선결제 차감분). */
  upcomingAlreadyPaidAmount?: number | null;
  /** 이 회차에 빠지는 할부 구성 — 예정액이 이용 내역 합과 다른 이유를 설명한다. */
  upcomingInstallments?: InstallmentDue[];
  /** 다가오는 회차 청구 기간 "yyyy-MM-dd" | null (결제일 미설정 시 null) */
  upcomingPeriodStart: string | null;
  upcomingPeriodEnd: string | null;
  /** "yyyy-MM-dd" | null */
  nextPaymentDate: string | null;
  paymentDay: number | null;
  paymentAssetRowId: number | null;
  history: BillingItem[];
  /**
   * 다가오는 회차의 다음 회차 — 지금 쌓이고 있는 이용분(당월 1일~말일, 다음 달 결제일).
   * 결제일 미설정이거나 옛 서버면 없다.
   */
  nextCycle?: UpcomingCycle | null;
  /**
   * 닫힌 회차(결제일이 지난) — 회차 선택기의 과거 칸, 최신 회차부터. 결제 기록이 있는
   * 회차와 기록용 거래가 있는 회차의 합집합이다(닫힌 회차 규칙 R2·R4). 옛 서버면 없다 —
   * 그때는 `history` 의 결제 완료 행으로 그린다.
   */
  closedCycles?: ClosedCycle[];
}

/**
 * 닫힌 회차 하나 — 명세서 머리 금액은 **지금 기록 합** `recordedAmount` 다(D10).
 * 실제로 계좌에서 나간 돈(`paidAmount`)과 다르면 머리 아래 한 줄로 말한다.
 */
export interface ClosedCycle {
  periodStart: string;
  periodEnd: string;
  /** 그 회차에 실제로 적용된 결제일(결제일을 바꿨어도 그 회차 것, D5). */
  paymentDate: string;
  /** 앱이 결제계좌에서 실제로 뺀 순 금액(결제 − 환급). */
  paidAmount: number;
  /**
   * 그 회차의 **지금 기록 합**(일시불 지출 − 수입 + 할부 회차분, 환불 제외, 기록용 포함).
   * 옛 서버면 없다 — 그때는 `paidAmount + recordedOnlyAmount` 로 본다.
   */
  recordedAmount?: number;
  /** 하위 호환 — `max(0, recordedAmount − paidAmount)`. */
  recordedOnlyAmount: number;
  /** 카드 등록 전 회차 — "실제와 맞지 않을 수 있어요" 주의 문구. */
  preRegistration: boolean;
  /** 폐지된 환급 기한(D1) — 이제 늘 null. 옛 서버면 날짜가 온다. */
  refundableUntil: string | null;
  /** 그 회차의 할부 회차분 — 거래 날짜가 앞 달이라 이용 내역에는 안 나온다(24차 8). */
  installmentDues?: InstallmentDue[];
}

/** 회차 하나 — 청구 응답의 nextCycle. */
export interface UpcomingCycle {
  paymentDate: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  lumpSumAmount: number | null;
  alreadyPaidAmount: number | null;
  installments: InstallmentDue[];
}

export interface AssetSummary {
  totalBalance: number;
  totalAssets: number;
  totalDebt: number;
  netWorth: number;
  lastMonthNetWorth: number;
  changeAmount: number;
  changePercent: number;
  byType: AssetTypeSummary[];
}

export interface AssetTypeSummary {
  assetType: AssetType;
  totalBalance: number;
  count: number;
}

export interface NetWorthTrendPoint {
  year: number;
  month: number;
  netWorth: number;
}

export interface AssetBalancePoint {
  /** 주 시작일 (월요일) — "YYYY-MM-DD" */
  weekStart: string;
  /** 해당 주 말 시점 자산 잔액(자산 통화 · 옛 뜻 예수금 + 보유) */
  balance: number;
  /** 같은 시점 원화 합계(자산 화면과 같은 한 식). 옛 서버면 없다 */
  balanceInKrw?: number | null;
}

export interface AssetTransfer {
  rowId: number;
  userRowId: number;
  fromAssetRowId: number;
  fromAssetName: string;
  toAssetRowId: number;
  toAssetName: string;
  amount: number;
  fee: number;
  /** 이자 (대출 상환 시). amount 중 이 금액은 부채를 줄이지 않고 지출로 잡힌다. */
  interestAmount: number;
  /** 원금 = amount − interestAmount. 입금 자산(대출)에 실제로 반영된 금액. */
  principalAmount: number;
  description: string | null;
  /**
   * 시스템이 만든 이체의 출처 — `TRADE_SETTLEMENT`(매수 예수금 충당) /
   * `CARD_PAYMENT`(카드 자동결제) / `CARD_REFUND`(카드 과납금을 결제계좌로 환급).
   * null 이면 사용자가 직접 만든 이체다.
   *
   * <p>값이 있으면 금액이 원본(매수·청구)과 묶여 있어 고칠 수 없다. 화면은 수정·삭제
   * 버튼을 감춘다.
   */
  autoSource: string | null;
  /** ISO-LOCAL-DATETIME (YYYY-MM-DDTHH:mm:ss) */
  transferDate: string;
  createAt: string;
  /**
   * 받는 쪽 자산 통화로 받은 금액 — 두 계좌 통화가 다를 때만 값(서버 round(amount × 보내는 환율 ÷ 받는 환율)).
   * null · 없음 = amount 와 같은 값을 받았다(같은 통화 · 옛 이체 · 옛 서버). amount · fee · interestAmount 는 보내는 계좌 통화.
   */
  toAmount?: number | null;
}

export interface AssetTransferFormValues {
  fromAssetRowId: number;
  toAssetRowId: number;
  amount: number;
  fee?: number;
  /** 이자 (대출 상환 시). 상환액 중 이자 몫 — 부채는 amount − interestAmount 만큼만 줄어든다. */
  interestAmount?: number;
  description?: string;
  /** ISO-LOCAL-DATETIME (YYYY-MM-DDTHH:mm:ss) */
  transferDate: string;
}

export interface ReorderItem {
  assetId: number;
  sortOrder: number;
}
