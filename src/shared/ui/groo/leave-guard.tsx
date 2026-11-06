import { useRef, type ReactNode } from "react";
import { LeaveGuardContext, type LeaveGuard } from "./leave-guard-context";

/** 셸(AppLayout)이 한 번 둔다 — 떠나기 가드 하나(규칙은 leave-guard-context.ts) */
export function LeaveGuardProvider({ children }: { children: ReactNode }) {
  const ref = useRef<LeaveGuard | null>(null);
  return (
    <LeaveGuardContext.Provider value={ref}>
      {children}
    </LeaveGuardContext.Provider>
  );
}
