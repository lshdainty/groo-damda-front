import type { QueryClient, QueryKey } from "@tanstack/react-query";
import {
  assetKeys,
  calendarKeys,
  cardKeys,
  constellationKeys,
  dashboardKeys,
  deviceSessionKeys,
  dutchPayKeys,
  eventLabelKeys,
  expenseKeys,
  expenseSplitKeys,
  memoKeys,
  memoTagKeys,
  notificationKeys,
  oauthKeys,
  recurringTransactionKeys,
  savingGoalKeys,
  stockKeys,
  subscriptionKeys,
  todoKeys,
  todoTagKeys,
  userCalendarKeys,
} from "./queryKeys";

/**
 * 무엇이 바뀌면 무엇을 비우는가 — **이 표 하나가 정의다.**
 *
 * 뮤테이션마다 호출처에서 키를 손으로 나열하면 샌다. 실제로 샜다 — 카드로 지출을
 * 넣어도 `cardKeys` 를 비우는 곳이 앱 전체에 하나도 없어 카드 실적이 `0 / 300,000`
 * 으로 남았고, 카드 결제는 이체를 만들면서 가계부를 안 비웠는데 결제 **취소**는
 * 비웠다(같은 화면, 반대 방향, 다른 범위). 접두가 같은 도메인은 `expenseKeys.all`
 * 한 줄로 덮여 놓칠 일이 없다 — 놓치는 건 언제나 **접두가 다른 옆 도메인**이다.
 * 그래서 옆 도메인을 아는 자리를 여기 하나로 모은다.
 *
 * 넓게 비우는 쪽으로 기운다. 안 비워서 틀린 값을 보여 주면 아무도 못 찾지만, 더
 * 비워서 드는 비용은 **화면에 떠 있는** 쿼리의 재조회뿐이다 — `invalidateQueries`
 * 는 떠 있지 않은 쿼리에는 낡음 표시만 하고 요청을 보내지 않는다.
 *
 * 새 변경 경로가 생기면 여기 줄을 더하고 호출처는 이름 하나만 고른다. 표에 없는
 * 이름은 타입이 막고, 손으로 나열해 우회하면 테스트가 잡는다
 * (`tests/mutation-invalidation.test.ts`).
 */
export const INVALIDATION_MAP = {
  /**
   * 가계부 행이 생기거나·바뀌거나·사라진다.
   *
   * 거래 CRUD·환불 마크·환불 취소·문자 커밋만이 아니다. **거래를 딸고 움직이는 것 전부**
   * 가 여기다 — 이체·매매(이자·실현손익이 거래로 잡힌다), 카드 결제·결제 취소·할부
   * 상환(이체가 생기고 청구·실적이 함께 바뀐다), 자산 삭제(그 자산의 거래가 함께
   * 사라진다). 금액이 움직이면 카드 실적도, 분할·더치페이도, 홈 합계도 같이 늙는다.
   */
  ledger: [
    expenseKeys.all,
    assetKeys.all,
    cardKeys.all,
    expenseSplitKeys.all,
    dutchPayKeys.all,
    dashboardKeys.all,
  ],
  /** 자산 자체만 바뀐다 — 추가·수정·정렬. 거래는 그대로다. */
  asset: [assetKeys.all],
  /** 할 일이 바뀐다. 홈 위젯이 할 일 개수·최근 목록을 들고 있다. */
  todo: [todoKeys.all, dashboardKeys.all],
  /** 할 일 완료 토글 — 별빛이 적립·회수되므로 별자리도 함께 늙는다. */
  "todo-status": [todoKeys.all, constellationKeys.all, dashboardKeys.all],
  /** 일정이 바뀐다. 홈 위젯이 오늘·다가오는 일정을 들고 있다. */
  "calendar-event": [calendarKeys.all, dashboardKeys.all],
  /** 메모가 바뀐다. 홈 위젯이 개수·고정·최근 제목을 들고 있다. */
  memo: [memoKeys.all, dashboardKeys.all],
  /** 캘린더의 속성이 바뀐다 — 이름·색·표시·초대코드·멤버. 일정 자체는 안 움직인다. */
  "user-calendar": [userCalendarKeys.all],
  /**
   * 내가 가진 캘린더 집합이 바뀐다 — 삭제·참여.
   *
   * 삭제하면 서버가 그 캘린더의 일정을 **기본 캘린더로 옮긴다.** 일정 캐시를 안
   * 비우면 옛 캘린더 아이디를 든 일정이 그대로 남고, 화면의 표시 필터가 사라진
   * 캘린더를 못 찾아 색·이름을 옛것으로 그린다.
   */
  "user-calendar-scope": [userCalendarKeys.all, calendarKeys.all],

  /**
   * 이름표가 바뀐다 — 일정 라벨·메모 태그·할 일 태그.
   *
   * 세 쌍(`*-usage`)이 따로 있는 건 **만들 때와 고칠 때가 다르기 때문**이다. 새로
   * 만든 이름표는 아직 아무것도 달고 있지 않아 목록 하나만 늙는다. 반대로 개명·삭제는
   * 서버가 **그걸 달고 있던 것까지** 손댄다 — 메모 태그는 `memo.tag` 문자열이 새 이름으로
   * 옮겨 가거나 비워지고, 라벨·할 일 태그도 같은 식이다. 그래서 고칠 때만 옆 도메인이
   * 딸려 늙는다.
   */
  "event-label": [eventLabelKeys.all],
  /** 일정 라벨을 고치거나 지운다 — 그 라벨을 단 일정의 색·이름이 함께 바뀐다. */
  "event-label-usage": [eventLabelKeys.all, calendarKeys.all],
  /** 메모 태그를 새로 만든다. 아직 아무 메모도 달고 있지 않다. */
  "memo-tag": [memoTagKeys.all],
  /** 메모 태그를 고치거나 지운다 — 그 태그를 쓰던 메모의 태그 문자열이 서버에서 바뀐다. */
  "memo-tag-usage": [memoTagKeys.all, memoKeys.all],
  /** 할 일 태그를 새로 만든다. 아직 아무 할 일도 달고 있지 않다. */
  "todo-tag": [todoTagKeys.all],
  /** 할 일 태그를 고치거나 지운다 — 그 태그를 쓰던 할 일이 함께 바뀐다. */
  "todo-tag-usage": [todoTagKeys.all, todoKeys.all],

  /**
   * 가계부의 밑바탕이 바뀐다 — 분류·예산.
   *
   * 거래 행 자체는 그대로지만 목록·통계·예산·달성률이 전부 그 위에 서 있어 접두 하나로
   * 통째로 비운다. 분류 이동(`moveTransactions`)·쪼개기는 거래의 분류를 실제로 바꾼다.
   * 옆 도메인은 안 건드린다 — 금액이 안 움직이므로 자산·카드·홈 합계는 그대로다.
   */
  "expense-meta": [expenseKeys.all],
  /** 분류 순서만 바뀐다. 낙관적 업데이트 뒤 서버 순서로 맞추는 자리라 분류 목록만 비운다. */
  "expense-category-order": [expenseKeys.categories()],
  /** 지출 프리셋이 바뀐다 — 추가·수정·삭제·최근 사용. 거래는 안 만들어진다. */
  "expense-template": [expenseKeys.templates()],

  /**
   * 더치페이가 바뀐다 — 등록·수정·삭제·참가자 정산.
   *
   * 거래는 안 움직인다. 서버는 원거래를 연결만 하고 정산은 참가자 상태만 바꾼다.
   */
  "dutch-pay": [dutchPayKeys.all],
  /**
   * 저축목표가 바뀐다 — 추가·수정·적립·삭제·정렬.
   *
   * 적립도 목표의 모은 금액만 올린다. 서버가 거래·잔액을 안 건드리므로 가계부는 그대로다.
   */
  "saving-goal": [savingGoalKeys.all],
  /**
   * 반복 거래 예약이 바뀐다 — 추가·수정·삭제·켜고 끄기.
   *
   * 추가·수정·다시 켜기에서 **오늘이 회차면 서버가 그 거래를 바로 기록한다**(QA 30 1 —
   * 종전엔 자정 배치를 기다려 다음 날 날짜로 찍혔다). 거래가 생기므로 가계부 쪽도 함께 늙는다.
   */
  "recurring-transaction": [
    recurringTransactionKeys.all,
    expenseKeys.all,
    assetKeys.all,
    cardKeys.all,
    expenseSplitKeys.all,
    dutchPayKeys.all,
    dashboardKeys.all,
  ],

  /** 알림이 바뀐다 — 읽음·모두 읽음·삭제. 목록과 안 읽은 개수가 한 접두다. */
  notification: [notificationKeys.all],
  /** 소셜 계정 연동이 바뀐다 — 연동 해제. provider 목록이 연동 여부를 함께 들고 있다. */
  "oauth-link": [oauthKeys.all],
  /** 로그인한 기기 목록이 바뀐다 — 개별 기기 끊기. */
  "device-session": [deviceSessionKeys.all],
  /** 관심목록이 바뀐다 — 그룹 추가·개명·삭제, 종목 담기·빼기. 그룹 하나에 항목이 딸려 온다. */
  "stock-watchlist": [stockKeys.watchGroups()],
  /** 구독이 바뀐다 — 가입·해지. 기능권한·구독 정보가 한 접두다. */
  subscription: [subscriptionKeys.all],
  /**
   * 증권사 연결이 바뀐다 — 등록·해제·대표 지정.
   *
   * 연결 목록만이 아니라 기능권한(`myFeatures`)도 같이 늙는다 — 메뉴 게이트와 사이드바가
   * 연결된 증권사를 거기서 읽는다. 구독 접두 전체를 비우지는 않는다(요금제·구독 정보는
   * 그대로다).
   */
  "broker-connection": [
    subscriptionKeys.brokerConnections(),
    subscriptionKeys.myFeatures(),
  ],
  /** 프로그램용 API 토큰이 바뀐다 — 발급·폐기. 목록 하나만 늙는다. */
  "api-token": [subscriptionKeys.apiTokens()],
} as const satisfies Record<string, readonly QueryKey[]>;

/** 서버 상태를 바꾸는 변경의 이름. 뮤테이션은 이 중 하나를 고른다. */
export type ChangeKind = keyof typeof INVALIDATION_MAP;

/**
 * 변경 하나가 늙히는 캐시를 전부 비운다.
 *
 * 호출처는 "무엇이 바뀌었는지" 이름 하나만 고른다 — 어느 도메인이 딸려 늙는지는
 * 위 표가 안다.
 */
export function invalidateFor(
  queryClient: QueryClient,
  change: ChangeKind,
): void;
/**
 * `{ wait: true }` 면 다시 받기가 끝날 때까지 기다리는 약속을 돌려준다 — 뮤테이션 `onSuccess` 에서 돌려주면 `mutate(…, { onSuccess })` 의
 * 호출처 콜백은 새 값이 캐시에 들어온 뒤에 불린다(저장 뒤 상세가 옛 값을 보이거나 지운 일정의 버튼이 남는 틈을 막는다).
 * 기본(옵션 없음)은 기다리지 않는다 — 다른 모든 호출처는 그대로다.
 */
export function invalidateFor(
  queryClient: QueryClient,
  change: ChangeKind,
  options: { wait: true },
): Promise<unknown>;
export function invalidateFor(
  queryClient: QueryClient,
  change: ChangeKind,
  options?: { wait?: boolean },
): Promise<unknown> | void {
  const pending = INVALIDATION_MAP[change].map((queryKey) =>
    queryClient.invalidateQueries({ queryKey }),
  );
  if (options?.wait) return Promise.all(pending);
}
