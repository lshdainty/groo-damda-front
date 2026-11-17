import { UNSAFE_createBrowserHistory } from "react-router-dom";

import { afterBackSlotsSettle } from "@/shared/ds/overlay";

type AppHistory = ReturnType<typeof UNSAFE_createBrowserHistory>;

/**
 * 앱 라우터의 히스토리 — BrowserRouter 가 안에서 만드는 것과 같고(v5Compat), 쓰기(push · replace · go)만 표면 칸의 되돌림이
 * 끝난 뒤로 미룬다(shared/ds/overlay 의 afterBackSlotsSettle).
 *
 * 1280 미만 시트 · 확인창은 열 때 히스토리에 칸을 쌓고 [×] 로 닫으면 history.go(-1) 로 되돌린다. 이 되돌림은 비동기라, 닫자마자
 * 하단 탭을 누르면 탭 이동(pushState)이 되돌림보다 먼저 들어가 히스토리가 꼬였다 — Safari 에서 옮긴 화면인데 뒤로 단추가 꺼지고
 * 앞으로 단추가 켜졌다(QA 2026-11-17 web_dt_repro2). 되돌릴 칸이 없으면 그 자리에서 바로 옮긴다.
 */
export function createAppHistory(): AppHistory {
  const base = UNSAFE_createBrowserHistory({ v5Compat: true });
  return {
    get action() {
      return base.action;
    },
    get location() {
      return base.location;
    },
    createHref: (to) => base.createHref(to),
    createURL: (to) => base.createURL(to),
    encodeLocation: (to) => base.encodeLocation(to),
    listen: (listener) => base.listen(listener),
    push: (to, state) => {
      afterBackSlotsSettle(() => base.push(to, state));
    },
    replace: (to, state) => {
      afterBackSlotsSettle(() => base.replace(to, state));
    },
    go: (delta) => {
      afterBackSlotsSettle(() => base.go(delta));
    },
  };
}
