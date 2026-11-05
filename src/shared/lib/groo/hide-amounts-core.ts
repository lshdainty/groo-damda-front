import { useEffect, useState, useSyncExternalStore } from "react";
import { hideCardsApi } from "@/shared/api";
import { isEn } from "@/shared/lib/groo/format";
import {
  ALL_HIDE_CARDS,
  cardsOfKind,
  cardsOfPage,
  SCREEN_HIDE_CARDS,
  type HideCardKey,
  type HideKind,
  type HidePageKey,
} from "@/shared/lib/groo/hide-amounts-cards";

/*
 * hide-amounts 코어(상수/훅/토글 함수) — hide-amounts.tsx 에서 분리
 * (Fast Refresh: 컴포넌트 파일은 컴포넌트만 export).
 *
 * 가리는 단위는 카드다. 어떤 카드가 있는지는 hide-amounts-cards.ts 에 있다.
 */

export const HIDE_AMOUNTS_MASK = "••••••";

/**
 * 통화 접두 기호 — 마스킹 금액의 `<MaskAmount>` 안, 숫자(부호 뒤) 바로 앞에 삽입.
 * ko: '' (단위는 접미사 `원`이 `<WonUnit/>` 로 렌더) / en: '₩' (접두사).
 */
export const wonPre = (): string => (isEn() ? "₩" : "");

/** 예전 단일 스위치. 값이 있으면 한 번 읽어 카드 전체로 펼치고 지운다. */
const LEGACY_KEY = "pd-hide";
const STORAGE_KEY = "pd-hide-cards";
/**
 * 로컬 캐시가 **누구 것인지**. 서버 동기화가 붙으면서 필요해졌다.
 *
 * 같은 브라우저에서 A 가 로그아웃하고 B 가 로그인하면 localStorage 에는 A 의 목록이
 * 그대로 남는다. 그 상태로 B 의 서버 값이 `null`(아직 안 올림)이면 **A 의 가림 설정이
 * B 의 계정으로 올라간다.** 세션 만료처럼 로그아웃을 안 거치는 경로도 있어서 지우는
 * 것만으로는 못 막는다 — 그래서 값에 주인을 적어 두고 대조한다.
 */
const OWNER_KEY = "pd-hide-cards-user";
const EVENT = "pd-hide-amounts";

declare global {
  interface Window {
    __pdHideCards?: Set<HideCardKey>;
  }
}

function load(): Set<HideCardKey> {
  const valid = new Set<string>(ALL_HIDE_CARDS);
  try {
    // 예전 사용자는 "전부 가림" 상태였다 — 켜져 있었으면 그대로 전부 켠 채로 옮긴다.
    // 안 그러면 업데이트하자마자 금액이 통째로 드러난다.
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy != null) {
      localStorage.removeItem(LEGACY_KEY);
      const on = legacy === "true" || legacy === "1";
      const migrated = on ? new Set(ALL_HIDE_CARDS) : new Set<HideCardKey>();
      save(migrated);
      return migrated;
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    // 새로 생긴 카드(거래 종류 3장)는 저장 배열에 없으므로 자동으로 꺼진 채 시작한다.
    // 켜 주지 않는다 — 사용자가 고른 적 없는 카드를 대신 켜는 셈이고, 화면 카드가 이미
    // 그 자리를 덮고 있어 새는 것도 없다. 필터는 **버리는 방향**이라 기존 설정도 안전하다.
    //
    // 없어진 카드 키는 버린다 — 남겨 두면 영영 못 지우는 유령이 된다.
    return new Set(
      parsed.filter(
        (k): k is HideCardKey => typeof k === "string" && valid.has(k),
      ),
    );
  } catch {
    // 사파리 프라이빗 모드 등 localStorage 가 막힌 환경 — 이번 세션만 유지된다.
    return new Set();
  }
}

function save(next: Set<HideCardKey>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    /* 저장 못 해도 화면은 돌아야 한다 */
  }
}

function current(): Set<HideCardKey> {
  if (!window.__pdHideCards) window.__pdHideCards = load();
  return window.__pdHideCards;
}

/** 로컬에만 반영한다. 서버에서 받아온 값을 되쏘지 않으려고 갈라 뒀다. */
function commitLocal(next: Set<HideCardKey>) {
  window.__pdHideCards = next;
  save(next);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
}

/**
 * 서버로 올리고 성공했는지 돌려준다.
 *
 * 실패를 삼키지 않는다 — 가린 금액은 계정에 붙어서, 서버 저장이 실패한 채 이 기기에만 반영하면 다음 동기화가
 * 서버의 옛 값으로 덮어 가려 둔 금액이 사용자도 모르게 다시 드러난다. 그래서 **성공했을 때만 로컬에 반영**하고
 * (`commit`), 실패는 호출한 화면이 자기 자리에서 알린다(Callout · 스낵바 + [다시 시도]).
 */
async function push(next: Set<HideCardKey>): Promise<boolean> {
  try {
    await hideCardsApi.put([...next]);
    return true;
  } catch {
    return false;
  }
}

/** 서버에 올려 성공하면 로컬에 반영한다. 실패하면 로컬은 그대로다(false). */
async function commit(next: Set<HideCardKey>): Promise<boolean> {
  if (!(await push(next))) return false;
  commitLocal(next);
  return true;
}

/** 이 브라우저 캐시의 주인. 다르면 남의 설정이므로 올려서는 안 된다. */
function cacheOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

function setCacheOwner(userId: string) {
  try {
    localStorage.setItem(OWNER_KEY, userId);
  } catch {
    /* 저장 못 해도 화면은 돌아야 한다 */
  }
}

/**
 * 로그인 직후 서버와 맞춘다.
 *
 * <p><b>서버가 `null` 이면 내려받지 않고 로컬을 올린다.</b> `null` 은 "아직 한 번도 안 올림"
 * 이라 그걸 빈 목록으로 받아 덮으면, 이 기능이 나가는 순간 **가려 뒀던 금액이 통째로 드러난다.**
 * 사용자가 실제로 다 푼 상태는 `[]` 로 따로 온다.
 *
 * <p>다른 사용자가 쓰던 브라우저면 로컬을 올리지 않는다 — 남의 가림 설정이 내 계정에 붙는다.
 *
 * @param userId 지금 로그인한 사용자
 */
export async function syncHideCardsFromServer(userId: string): Promise<void> {
  const mine = cacheOwner() === userId;
  let server: string[] | null;
  try {
    server = await hideCardsApi.get();
  } catch {
    // 못 받아왔으면 로컬 그대로 둔다 — 여기서 비우면 금액이 드러난다.
    return;
  }

  if (server === null) {
    // 첫 동기화는 **업로드**다. 단, 남의 브라우저 캐시는 올리지 않는다.
    const local = mine ? current() : new Set<HideCardKey>();
    setCacheOwner(userId);
    if (!mine) commitLocal(local);
    // **의도된 무음**: 로그인 직후 뒤에서 도는 첫 업로드다. 사용자가 누른 일이 아니라 알릴 자리가 없고, 실패해도
    // 로컬은 그대로이며 서버는 여전히 `null` 이라 다음 부팅의 동기화가 다시 올린다(덮어 드러내는 일이 없다).
    void push(local);
    return;
  }

  const valid = new Set<string>(ALL_HIDE_CARDS);
  setCacheOwner(userId);
  // 서버에서 받은 값은 되쏘지 않는다 — 부르자마자 PUT 이 나가는 왕복이 생긴다.
  commitLocal(new Set(server.filter((k): k is HideCardKey => valid.has(k))));
}

/** 가려짐 여부를 지금 값으로 계산한다 — 훅 밖에 두어 렌더마다 같은 함수를 쓴다. */
function readHidden(
  card?: HideCardKey | HideCardKey[],
  kind?: HideKind,
): boolean {
  const set = current();
  // 화면 카드와 종류 카드는 합집합이다 — 카드는 "가리기" 스위치라, 켰는데 아무 일도
  // 안 일어나는 조합이 있으면 안 된다. 켜는 방향으로만 넓어지므로 이미 가려진 게
  // 풀리는 경우도 생기지 않는다.
  if (kind && cardsOfKind(kind).some((c) => set.has(c))) return true;
  if (Array.isArray(card)) return card.some((c) => set.has(c));
  if (card) return set.has(card);
  // 카드도 종류도 없는 자리는 "하나라도 가려졌나" — 눈 아이콘용이다.
  // **종류 카드는 세지 않는다.** 세면 지출만 가린 사용자에게 예산·더치페이의 '원'
  // 단위(카드 없이 부르는 자리들)까지 사라진다 — 종류 카드가 안 덮기로 한 화면이다.
  if (kind) return false;
  return SCREEN_HIDE_CARDS.some((c) => set.has(c));
}

/** 가림 상태 변경 구독. 모듈 스코프라 참조가 고정된다. */
function subscribeHidden(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

/**
 * 이 카드(들)가 가려져 있는가.
 *
 * <p>값의 출처는 리액트 밖(모듈 전역 Set + window 이벤트)이라
 * <b>`useSyncExternalStore`</b> 로 읽는다. 예전엔 `useState` + `useEffect` 로 베껴
 * 두고 이벤트가 오면 다시 세팅했는데, 그러면 두 가지를 손으로 메워야 했다 —
 * 마운트와 구독 사이에 값이 바뀌는 틈, 그리고 배열 리터럴로 넘어오는 `card` 를
 * 의존성에 못 적는 문제(그래서 규칙을 꺼야 했다). 이 훅은 둘 다 스스로 처리한다.
 *
 * <p>카드를 여러 개 넘기면 <b>하나라도 켜져 있으면</b> 가린다. 같은 금액이 두 카드에
 * 걸치는 자리가 있다 — 캘린더 셀은 '캘린더 금액' 이면서 '거래 목록' 의 일별 합계이기도
 * 하다. 한쪽으로 몰아 두면 다른 쪽을 켠 사람에게는 안 가려진다.
 *
 * <p>카드를 지정하지 않으면 <b>하나라도 가려져 있는지</b>를 돌려준다 — 눈 아이콘처럼
 * "지금 뭔가 가려진 상태인가" 만 알면 되는 자리용이다. 실제 금액을 가리는 곳은
 * 반드시 카드를 넘길 것. 안 넘기면 다른 카드를 가렸을 때 같이 가려진다.
 */
export function useHideAmounts(
  card?: HideCardKey | HideCardKey[],
  kind?: HideKind,
): boolean {
  return useSyncExternalStore(subscribeHidden, () => readHidden(card, kind));
}

/** 페이지 단위 상태 — 전부/일부/없음. 설정 화면의 '페이지 잠그기' 스위치용. */
export function useHidePageState(page: HidePageKey): "all" | "some" | "none" {
  const [, setTick] = useState(0);
  useEffect(() => {
    const onChange = () => setTick((t) => t + 1);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  const cards = cardsOfPage(page);
  const on = cards.filter((c) => current().has(c)).length;
  return on === 0 ? "none" : on === cards.length ? "all" : "some";
}

/** 지금 가려진 카드들 — 설정 화면이 목록을 그릴 때 쓴다. */
export function useHiddenCards(): Set<HideCardKey> {
  const [set, setSet] = useState<Set<HideCardKey>>(() => new Set(current()));
  useEffect(() => {
    const onChange = () => setSet(new Set(current()));
    window.addEventListener(EVENT, onChange);
    onChange();
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return set;
}

/**
 * 가려진 카드 전체를 이 목록으로 교체 — 설정 화면이 [저장] 으로 한 번에 반영할 때.
 *
 * <p>지금 가려진 것 중 빠지는 카드는 곧 '푸는' 것이다 — 호출 전에 인증을 거칠 것(UI 책임).
 *
 * <p>서버 저장이 성공했을 때만 로컬에 반영하고 성공 여부를 돌려준다 — 실패(false)면 아무것도 바뀌지 않았으니
 * 호출한 화면이 알린다.
 */
/**
 * 서버를 거치지 않고 이 기기에만 반영한다 — 서버에서 받은 값을 되쏘지 않으려는 길과 시험 준비용.
 * 사용자가 고른 저장은 `setHiddenCards` 를 쓴다.
 */
export function setHiddenCardsLocal(cards: Iterable<HideCardKey>) {
  commitLocal(new Set(cards));
}

export function setHiddenCards(cards: Iterable<HideCardKey>): Promise<boolean> {
  return commit(new Set(cards));
}

export function hideAllCards(): Promise<boolean> {
  return setHiddenCards(ALL_HIDE_CARDS);
}

export function revealAllCards(): Promise<boolean> {
  return commit(new Set());
}

export function isCardHidden(card: HideCardKey): boolean {
  return current().has(card);
}

export function hiddenCardsNow(): Set<HideCardKey> {
  return new Set(current());
}
