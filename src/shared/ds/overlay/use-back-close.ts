import * as React from "react";

/*
 * 1280 미만에서 열린 표면을 뒤로 가기로 닫는다 — Alert Dialog · Bottom Sheet 가 쓴다(Dialog 는 1280 이상이라 걸지 않는다 —
 * 거기서 뒤로 가기는 "이전 페이지" 다). groo-design recipes/shadcn/components/ui/alert-dialog.tsx 의 useBackClose 를 옮겼다.
 *
 * 열린 표면마다 히스토리에 같은 주소로 한 칸을 쌓는다. 칸은 서로 구별하지 않고 개수로 센다 — popstate 하나가 칸 하나를 쓴다.
 * history.state 는 물려준다(react-router 가 위치를 세는 idx 가 사라지지 않게).
 */
const BACK_FLAG = "grooOverlayBack";

type BackSlot = { onBack: () => void; inHistory: boolean };

const backStack: BackSlot[] = [];
let selfPops = 0;
let pendingBack = 0;
let backBound = false;

/*
 * 되돌림(flushBack 의 history.go)은 비동기다 — popstate 가 오기 전에 다른 히스토리 쓰기(탭 이동 pushState · 새 표면의 칸)가
 * 끼어들면 되돌림이 엉뚱한 칸에 떨어진다. 엔진마다 결과가 다르다: Safari 는 옮긴 화면을 보이면서 위치만 맨 앞으로 가 뒤로 단추가
 * 꺼지고 앞으로 단추가 켜졌고(QA web_dt_repro2), 크롬 셈법은 방금 옮긴 탭을 무른다(첫 탭 씹힘), jsdom 은 되돌림을 버려 닫은
 * 칸이 남는다. 그래서 되돌리는 동안(settling) 들어온 쓰기는 줄 세웠다가 우리 popstate 가 온 뒤에 넘긴다(afterBackSlotsSettle).
 * popstate 가 끝내 오지 않는 엔진에 대비해 SETTLE_GIVE_UP 뒤에는 줄을 그냥 푼다 — 이동이 영영 막히는 것보다 낫다.
 */
const SETTLE_GIVE_UP = 1000;
let settling = false;
let settleTimer: ReturnType<typeof setTimeout> | undefined;
const settleQueue: (() => void)[] = [];

function releaseSettled() {
  settling = false;
  clearTimeout(settleTimer);
  settleTimer = undefined;
  for (const cb of settleQueue.splice(0)) cb();
}

function pushBackSlot(slot: BackSlot) {
  window.history.pushState(
    { ...window.history.state, [BACK_FLAG]: true },
    "",
    window.location.href,
  );
  slot.inHistory = true;
}

function onPopState() {
  // 우리가 되돌린 칸이 만든 popstate 는 건너뛴다 — 아래 표면까지 닫지 않게
  if (selfPops > 0) {
    selfPops -= 1;
    // 되돌림이 끝났다 — 기다리던 쓰기를 넘긴다(라우터의 popstate 는 먼저 걸려 이미 위치를 맞췄다)
    if (selfPops === 0 && settling) releaseSettled();
    return;
  }
  for (let i = backStack.length - 1; i >= 0; i--) {
    const slot = backStack[i];
    if (slot?.inHistory) {
      slot.inHistory = false;
      slot.onBack();
      return;
    }
  }
}

function flushBack() {
  const count = pendingBack;
  pendingBack = 0;
  // 표면 안에서 다른 화면으로 이동했으면 꼭대기가 우리 칸이 아니다 — 되돌리면 방금 연 화면을 떠나므로 둔다
  if (count === 0 || window.history.state?.[BACK_FLAG] !== true) {
    if (!settling) releaseSettled();
    return;
  }
  selfPops += 1;
  settling = true;
  clearTimeout(settleTimer);
  settleTimer = setTimeout(releaseSettled, SETTLE_GIVE_UP);
  window.history.go(-count);
}

/**
 * 히스토리에 쓰는 일(pushState · replaceState · go)을 거둔 칸의 되돌림이 끝난 뒤로 미룬다 — 되돌릴 칸이 없으면 바로 부른다.
 * 앱 라우터의 히스토리(app/router/app-history)와 새 표면의 칸 쌓기가 거친다. 표면을 닫은 정리와 같은 틱(되돌림 예약 전)에
 * 들어온 쓰기도 기다린다.
 */
export function afterBackSlotsSettle(cb: () => void): () => void {
  if (!settling && pendingBack === 0) {
    cb();
    return () => {};
  }
  settleQueue.push(cb);
  return () => {
    const i = settleQueue.indexOf(cb);
    if (i >= 0) settleQueue.splice(i, 1);
  };
}

/**
 * enabled 인 동안 칸 하나를 쌓고, 뒤로 가기가 오면 맨 위 표면의 onBack 을 부른다. 버튼 · Esc 로 먼저 닫으면 쌓은 칸을 되돌린다
 * (시트와 그 위 확인창이 함께 닫히면 한 번에 되돌린다).
 * onBack 이 받는 keep — onBack 이 닫지 않았으면(바뀐 값이 있어 물었으면) 불러서 칸을 다시 쌓는다. 다음 뒤로 가기도 이 표면으로 온다.
 */
export function useBackClose(
  enabled: boolean,
  onBack: (keep: () => void) => void,
) {
  const onBackRef = React.useRef(onBack);
  React.useEffect(() => {
    onBackRef.current = onBack;
  });
  React.useEffect(() => {
    if (!enabled) return;
    if (!backBound) {
      backBound = true;
      window.addEventListener("popstate", onPopState);
    }
    const slot: BackSlot = {
      onBack: () =>
        onBackRef.current(() => {
          if (!slot.inHistory) pushBackSlot(slot);
        }),
      inHistory: false,
    };
    backStack.push(slot);
    // 방금 닫은 표면의 칸을 되돌리는 중이면 그 뒤에 쌓는다 — 먼저 쌓으면 되돌림이 새 칸을 지운다
    afterBackSlotsSettle(() => {
      if (backStack.includes(slot) && !slot.inHistory) pushBackSlot(slot);
    });
    return () => {
      const i = backStack.indexOf(slot);
      if (i >= 0) backStack.splice(i, 1);
      if (!slot.inHistory) return; // 뒤로 가기가 닫았다 — 칸도 함께 사라졌다
      slot.inHistory = false;
      pendingBack += 1;
      if (pendingBack === 1) queueMicrotask(flushBack);
    };
  }, [enabled]);
}

/**
 * 거둔 칸을 되돌리는 이동(flushBack 의 history.go)이 끝난 뒤에 cb 를 부른다 — 화면이 스스로 떠날 때 먼저 칸을 걷고(바뀐 값의 칸 ·
 * 확인창 칸) 그다음 옮겨야 뒤로 가기가 같은 주소 칸에서 헛돌지 않는다(검수 2차 H3 · M1). 칸을 거두는 정리(effect 정리)가
 * 끝난 다음(커밋 뒤)에 부른다 — 되돌릴 칸이 없으면 바로 부른다.
 */
export function whenBackSlotsSettled(cb: () => void): () => void {
  let cancelled = false;
  let dequeue = () => {};
  // flushBack 은 정리 중 queueMicrotask 로 걸린다 — 그 뒤에 본다
  queueMicrotask(() => {
    if (!cancelled) dequeue = afterBackSlotsSettle(cb);
  });
  /** 기다림을 거둔다 — 화면이 내려가면 늦게 온 popstate 로 엉뚱한 이동이 나지 않게(검수 3차 L2) */
  return () => {
    cancelled = true;
    dequeue();
  };
}
