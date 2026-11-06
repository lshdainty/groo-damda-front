import { useOutletContext } from "react-router-dom";
import { BudgetDesktop } from "./BudgetDesktop";
import { BudgetMobile } from "./BudgetMobile";
import { useBudgetMonth } from "./budget-model";

type OutletCtx = { mobile: boolean };

/** 예산 — 폰(띠 셋) · 데스크톱(카드) 두 파일을 고른다(I-08 3). 질의 · 계산은 budget-model, 구역은 budget-parts */
export const BudgetPage = () => {
  const { mobile } = useOutletContext<OutletCtx>();
  // 고른 달은 갈림 밖에서 든다 — 폭이 768 을 넘나들어도 보던 달이 남는다(I-wrap-b1 ε 9)
  const month = useBudgetMonth();
  return mobile ? (
    <BudgetMobile month={month} />
  ) : (
    <BudgetDesktop month={month} />
  );
};
