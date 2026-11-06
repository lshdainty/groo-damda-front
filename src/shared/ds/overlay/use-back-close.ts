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
  if (count === 0 || window.history.state?.[BACK_FLAG] !== true) return;
  selfPops += 1;
  window.history.go(-count);
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
    pushBackSlot(slot);
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
export function whenBackSlotsSettled(cb: () => void) {
  // flushBack 은 정리 중 queueMicrotask 로 걸린다 — 그 뒤에 본다
  queueMicrotask(() => {
    if (selfPops === 0) {
      cb();
      return;
    }
    const onPop = () => {
      // onPopState(먼저 걸린 리스너)가 우리 되돌림을 센 뒤다
      if (selfPops > 0) return;
      window.removeEventListener("popstate", onPop);
      cb();
    };
    window.addEventListener("popstate", onPop);
  });
}
