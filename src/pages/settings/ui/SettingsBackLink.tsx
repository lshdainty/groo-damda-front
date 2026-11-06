import { useNavigate } from "react-router-dom";
import { ParentLink } from "@/shared/ui/groo/parent-link";
import { useLeaveGuard } from "@/shared/ui/groo/leave-guard-context";
import { isPlainClick } from "../model/plain-click";

/**
 * "‹ {부모}" — 설정 하위 구역의 돌아가기(공용 `ParentLink`). 떠나기 전에 묻는 화면(금액 가리기)이 맡긴
 * 셸 공용 가드를 먼저 거친다.
 */
export function SettingsBackLink({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate();
  const leaveGuard = useLeaveGuard();
  return (
    <ParentLink
      to={to}
      label={label}
      onClick={(e) => {
        if (!isPlainClick(e)) return;
        e.preventDefault();
        leaveGuard(() => navigate(to));
      }}
    />
  );
}
