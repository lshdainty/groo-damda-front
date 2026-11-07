/**
 * 오버레이가 사라진 직후, 그 자리 밑에 있던 요소가 포인터를 받는 걸 잠깐 막는다.
 *
 * 저장 버튼을 따닥 누르면 첫 클릭이 저장·닫힘을 끝내고, 두 번째 클릭은 이미 사라진
 * 버튼이 아니라 **뒤 화면의 다른 요소**에 떨어진다 — 달력 셀이 눌려 일자 상세가 열리고
 * (QA #14 #36), 모바일에선 시트 footer 바로 아래의 탭바가 눌려 통계 화면으로 넘어가고
 * (#37), 삭제 확인창 뒤에선 그 자리로 올라온 다른 거래의 상세가 열린다(#57).
 *
 * `shared/ui/button.tsx` 의 더블클릭 방어(DOUBLE_CLICK_GUARD_MS)로는 못 막는다 —
 * 그건 **같은 버튼 인스턴스**의 재클릭만 버리는데, 여기서 두 번째 클릭을 받는 건
 * 그 버튼을 지나지 않는 남의 요소다. Radix 의 `body.style.pointerEvents = "none"` 도
 * 언마운트 cleanup 에서 바로 풀려 다음 입력 전에 이미 없다.
 *
 * CSS 실드(투명 fixed div)가 아니라 window capture 리스너인 이유:
 *   - Radix 가 `body.style.pointerEvents` 를 직접 쓰므로 실드와 서로 덮어쓴다.
 *   - 모바일 탭바는 `.m-app` 스택 컨텍스트 안이라 바깥 실드의 z-index 우위를 보장 못 한다.
 *   - jsdom 은 레이아웃·히트테스트가 없어 실드는 테스트로 검증할 방법이 아예 없다.
 *     리스너는 `dispatchEvent` 로 그대로 검증된다.
 */

/** 오버레이가 사라진 뒤 뒤 화면이 포인터를 받기까지 두는 유예(ms).
 *  OS 더블탭/더블클릭 판정(≈300~500ms) 안쪽의 두 번째 입력을 삼킨다.
 *  더 길게 잡으면 닫고 바로 다음 동작을 하려는 사용자가 헛손질한다. */
export const POINTER_BLOCK_MS = 350;

/** 차단 창 안에서 삼킬 이벤트. `pointermove`/`pointercancel`/`touchmove` 는 없다 —
 *  진행 중인 스와이프·스크롤을 끊지 않기 위해서다. `mousedown`/`mouseup` 이 반드시
 *  들어가야 한다: 캘린더 월뷰 셀은 click 이 아니라 그 둘로 눌린다(QA #36). */
const SWALLOWED = [
  "pointerdown",
  "pointerup",
  "mousedown",
  "mouseup",
  "click",
  "dblclick",
  "touchstart",
  "touchend",
] as const;

/** preventDefault 까지 거는 건 마우스·클릭 계열만 — touch 계열에 걸면 차단 창 동안
 *  스크롤·핀치가 같이 죽는다. */
const PREVENTED = new Set<string>([
  "pointerdown",
  "mousedown",
  "click",
  "dblclick",
]);

/** 차단 중에도 통과시킬 자리 — 저장 뒤 뜨는 스낵바(되돌리기 · 다시 시도)를 못 누르면 곤란하고,
 *  아직 살아 있는 다른 오버레이 안은 애초에 '뒤 화면' 이 아니다.
 *  (vaul 시트도 내부적으로 Radix Dialog 라 `role="dialog"` 가 붙는다.) */
const EXEMPT =
  '[role="dialog"],[role="alertdialog"],[data-slot="snackbar-region"]';

/** 차단이 풀리는 시각(epoch ms). 0 이면 차단 없음. */
let until = 0;
/** 지금 떠 있는 오버레이 수 — 마지막 하나가 사라질 때만 차단을 건다. */
let openOverlays = 0;
let bound = false;

function swallow(e: Event) {
  if (Date.now() >= until) return;
  const target = e.target;
  if (target instanceof Element && target.closest(EXEMPT)) return;
  e.stopPropagation();
  e.stopImmediatePropagation();
  if (PREVENTED.has(e.type)) e.preventDefault();
}

/** 리스너는 한 번만 붙이고 계속 둔다 — 차단이 안 걸린 동안은 `Date.now()` 비교
 *  한 번으로 즉시 빠지므로, 매번 붙였다 떼는 것보다 싸고 경합이 없다. */
function bind() {
  if (bound || typeof window === "undefined") return;
  for (const type of SWALLOWED)
    window.addEventListener(type, swallow, { capture: true, passive: false });
  bound = true;
}

export function beginPointerBlock(ms: number = POINTER_BLOCK_MS) {
  bind();
  until = Date.now() + ms;
}

export function cancelPointerBlock() {
  until = 0;
}

/** 지금 차단 중인가 — 테스트·디버깅용. */
export function isPointerBlocked(): boolean {
  return Date.now() < until;
}

/**
 * 오버레이 하나의 생애를 등록한다. `useEffect(registerOverlay, [])` 로 건다.
 *
 * **Portal 안에서 마운트되는 컴포넌트에만 건다** — dialog/drawer/alert-dialog 의
 * overlay 가 그 자리다. 바깥의 `*Content` 래퍼는 `open={false}` 여도 계속 살아 있어서
 * (확인창·시트를 controlled 로 쓰는 화면이 전부 그 패턴이다) 거기 걸면 아래 수가
 * 영원히 0 으로 안 떨어지고 차단이 한 번도 안 걸린다.
 *
 * - **마지막 하나가 사라질 때만** 차단을 건다 → 중첩 모달의 안쪽만 닫혀도 바깥은 안 막힌다.
 * - 새로 뜨면 남은 차단을 즉시 푼다 → 상세→편집 연속 열기, StrictMode 이중 마운트.
 */
export function registerOverlay(): () => void {
  openOverlays += 1;
  cancelPointerBlock();
  return () => {
    openOverlays = Math.max(0, openOverlays - 1);
    if (openOverlays === 0) beginPointerBlock();
  };
}

/** 테스트 전용 — 모듈 스코프 상태를 초기화한다(리스너는 그대로 둔다). */
export function __resetPointerBlockForTest() {
  until = 0;
  openOverlays = 0;
}
