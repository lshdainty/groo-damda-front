import type { DutchPay } from "@/entities/dutch-pay";
import type { TabKey } from "./DutchLists";

/** 폰 · 데스크톱 갈래가 같이 읽는 화면 값 — 페이지가 한 번 셈하고 넘긴다 */
export interface DutchView {
  list: DutchPay[];
  active: DutchPay[];
  past: DutchPay[];
  tab: TabKey;
  setTab: (tab: TabKey) => void;
  receivable: { amount: number; people: number };
  month: { count: number; totalAmount: number; avg: number };
  loading: boolean;
  failed: boolean;
  retry: () => void;
  open: (d: DutchPay) => void;
  create: () => void;
}
