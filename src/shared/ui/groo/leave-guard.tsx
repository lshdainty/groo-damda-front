import { useState, type ReactNode } from "react";
import { LeaveGuardContext, type LeaveGuardStore } from "./leave-guard-context";

/** 셸(AppLayout)이 한 번 둔다 — 떠나기 가드 하나(규칙은 leave-guard-context.ts) */
export function LeaveGuardProvider({ children }: { children: ReactNode }) {
  // 셸 수명 동안 같은 상자 하나 — 맡기기 · 통과 표식은 효과 · 누름 처리에서만 바꾼다(그리기에 쓰지 않는다)
  const [store] = useState<LeaveGuardStore>(() => ({
    current: null,
    passing: false,
  }));
  return (
    <LeaveGuardContext.Provider value={store}>
      {children}
    </LeaveGuardContext.Provider>
  );
}
