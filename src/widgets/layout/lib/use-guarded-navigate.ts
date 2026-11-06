import { useNavigate, type NavigateOptions } from "react-router-dom";
import { useLeaveGuard } from "@/shared/ui/groo/leave-guard-context";

/**
 * 셸의 이동(사이드바 · 탭 바 · 머리 링크 · 돈 탭)은 navigate 전에 공용 떠나기 가드를 부른다(I-wrap-b2b 단계 5) —
 * 바꾼 채 떠나면 버려지는 화면(설정 > 금액 가리기)이 맡긴 가드가 "저장하지 않고 나가기" 를 묻는다. 가드가 없으면 바로 간다.
 */
export function useGuardedNavigate() {
  const navigate = useNavigate();
  const leaveGuard = useLeaveGuard();
  return (to: string, options?: NavigateOptions) =>
    leaveGuard(() => navigate(to, options));
}
