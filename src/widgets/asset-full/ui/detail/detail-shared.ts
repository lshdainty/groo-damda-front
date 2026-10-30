import { type Asset } from "@/entities/asset";
import type { Expense } from "@/entities/expense";
import type { AssetTransfer } from "@/entities/asset";

export type AssetGroup = "account" | "card" | "invest";

export const groupOf = (asset: Asset): AssetGroup => {
  if (asset.assetType === "CREDIT_CARD" || asset.assetType === "CHECK_CARD")
    return "card";
  if (asset.assetType === "INVESTMENT") return "invest";
  return "account";
};

/** 'yyyy-MM-dd' → 'M.d' 표기 — app _fmtDate 미러. */
export function fmtBillingDate(iso: string): string {
  const [, mm, dd] = iso.split("-");
  if (mm == null || dd == null) return iso;
  const m = parseInt(mm, 10);
  const d = parseInt(dd, 10);
  if (!Number.isFinite(m) || !Number.isFinite(d)) return iso;
  return `${m}.${d}`;
}

export function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 자산 상세의 한 행. 이체는 지출/수입이 아니라 자산 간 이동이라 별도 종류로 둔다. */
export type AssetLedgerItem =
  | { kind: "expense"; at: string; expense: Expense }
  | { kind: "transfer"; at: string; transfer: AssetTransfer };
