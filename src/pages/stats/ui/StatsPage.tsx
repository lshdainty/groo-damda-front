import { useOutletContext } from "react-router-dom";
import { StatsDesktop } from "./StatsDesktop";
import { StatsMobile } from "./StatsMobile";
import { useStatsState } from "./stats-model";

type OutletCtx = { mobile: boolean };

/** 통계 — 폰(띠 구역) · 데스크톱(카드) 두 파일을 고른다(I-08 3). 질의 · 계산은 stats-model, 구역은 stats-parts 등 */
export const StatsPage = () => {
  const { mobile } = useOutletContext<OutletCtx>();
  // 탭 · 기간 · 열린 기간 고르기 · 고정 정리는 갈림 밖에서 든다 — 폭이 768 을 넘나들어도 남는다(I-wrap-b1 ε 9)
  const state = useStatsState();
  return mobile ? (
    <StatsMobile state={state} />
  ) : (
    <StatsDesktop state={state} />
  );
};
