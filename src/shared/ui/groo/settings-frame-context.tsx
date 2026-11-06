import { createContext, useContext } from "react";
import { useRegisterLeaveGuard, type LeaveGuard } from "./leave-guard-context";

/**
 * 설정 데스크톱 · 태블릿 틀(I-16)이 본문 위젯에 건네는 것.
 *
 * `headSlot` — 틀이 본문 칸 맨 위에 둔 "제목 줄 자리". 위젯이 그리는 `ManagerHead` 는 위젯 안이 아니라 이 자리로 그려져,
 * 제목 줄 ↔ 첫 내용 간격(T7)이 위젯마다 갈리지 않는다(위젯이 감싸는 사이가 16 · 32 로 다르다).
 *
 * 떠나기 가드(바꾼 채면 "저장하지 않고 나가기")는 이제 틀이 아니라 셸 공용 가드(leave-guard.tsx)에 맡긴다 —
 * "‹ 계정" 만이 아니라 설정 구역 목록 · 사이드바 · 탭 바 · 머리 링크도 같은 가드를 부른다(I-wrap-b2b 단계 5).
 */
export type { LeaveGuard };

export interface SettingsFrameContextValue {
  headSlot: HTMLElement | null;
}

export const SettingsFrameContext =
  createContext<SettingsFrameContextValue | null>(null);

export function useSettingsFrame() {
  return useContext(SettingsFrameContext);
}

/** 위젯이 떠나기 가드를 셸 공용 가드에 맡긴다(null 이면 맡기지 않는다) */
export function useSettingsLeaveGuard(guard: LeaveGuard | null) {
  useRegisterLeaveGuard(guard);
}
