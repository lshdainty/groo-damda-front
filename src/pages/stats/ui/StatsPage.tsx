import { useOutletContext } from "react-router-dom";
import { FixedBulk } from "@/features/expense/ui/FixedBulk";
import { useWideSurface } from "@/shared/ds/overlay";
import { HideCard } from "@/shared/lib/groo/hide-amounts";
import { StatsDesktop } from "./StatsDesktop";
import { StatsMobile } from "./StatsMobile";
import { fmt } from "./stats-range";
import { useStatsState } from "./stats-model";

type OutletCtx = { mobile: boolean };

/**
 * 통계 — 폰(띠 구역) · 데스크톱(카드) 두 파일을 고른다(I-08 3). 질의 · 계산은 stats-model, 구역은 stats-parts 등.
 * 거래를 고정으로 정리하기(`/desk/stats/fixed`)도 여기서 그린다 — 열림은 주소가 들고(1280 미만 페이지가 통계를 대신하고,
 * 이상은 통계 위 대화상자), 고른 체크 · 종류 · 방향은 FixedBulk 하나가 갈림 밖에서 든다(I-wrap-b1 δ M3).
 */
export const StatsPage = () => {
  const { mobile } = useOutletContext<OutletCtx>();
  // 탭 · 기간 · 열린 기간 고르기 · 고정 정리는 갈림 밖에서 든다 — 폭이 768 을 넘나들어도 남는다(I-wrap-b1 ε 9)
  const state = useStatsState();
  const wide = useWideSurface();
  const open = state.manageOpen;
  // 1280 미만에서는 정리 페이지가 통계를 대신한다. 이상은 통계가 그대로 뒤에 있다
  const showStats = !open || wide;
  return (
    <>
      {showStats &&
        (mobile ? (
          <StatsMobile state={state} />
        ) : (
          <StatsDesktop state={state} />
        ))}
      {open && (
        <HideCard card="stats.fixed">
          <FixedBulk
            mobile={mobile}
            startDate={fmt(state.period.from)}
            endDate={fmt(state.period.to)}
            onClose={() => state.setManageOpen(false)}
          />
        </HideCard>
      )}
    </>
  );
};
