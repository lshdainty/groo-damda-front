import type {
  ExpenseSplit,
  ExpenseSplitFormValue,
} from "@/entities/expense-split";

/** 나누기 단계의 항목 하나 — 저장된 항목이면 `rowId` 를 들고 다닌다(I-21 F 36: 보내면 서버가 제자리 수정) */
export type SplitRow = {
  uid: string;
  rowId?: number;
  categoryRowId: number | null;
  amount: string;
  label: string;
};

let uidSeq = 0;
export const newSplitUid = () => `s${(uidSeq += 1)}`;

export interface SplitSeedSource {
  categoryRowId: number | null;
  merchant?: string | null;
  description?: string | null;
}

const fromForm = (s: ExpenseSplitFormValue | ExpenseSplit): SplitRow => ({
  uid: newSplitUid(),
  rowId: s.rowId,
  categoryRowId: s.categoryRowId,
  amount: String(s.amount),
  label: s.label ?? "",
});

/**
 * 처음 항목. 아직 정할 수 없으면 `null`(서버 값 대기 중).
 * 우선순위: 편집 중 값 → 저장된 분할 → 반반 나누기.
 */
export function seedSplitRows(
  initialSplits: ExpenseSplitFormValue[] | undefined,
  persisted: ExpenseSplit[] | undefined,
  total: number,
  source: SplitSeedSource,
): SplitRow[] | null {
  if (initialSplits) return initialSplits.map(fromForm);
  if (persisted === undefined) return null;
  if (persisted.length > 0) return persisted.map(fromForm);
  const half = Math.floor(total / 2);
  return [
    {
      uid: newSplitUid(),
      categoryRowId: source.categoryRowId,
      amount: String(total - half),
      label: source.merchant ?? source.description ?? "",
    },
    {
      uid: newSplitUid(),
      categoryRowId: source.categoryRowId,
      amount: String(half),
      label: "",
    },
  ];
}

/**
 * 금액 배열의 합이 정확히 target 이 되도록 잔차를 분배한다(항상 균형).
 * 부족은 가장 큰 행에 더하고, 초과는 큰 행부터 바닥(행 수 이상이면 1)까지 깎아 흡수한다.
 */
export function settleRemainder(amts: number[], target: number): number[] {
  const n = amts.length;
  if (n === 0) return amts;
  const floor = target >= n ? 1 : 0;
  const out = amts.map((v) => Math.max(floor, Math.round(v)));
  const diff = target - out.reduce((s, v) => s + v, 0);
  const order = out
    .map((_, i) => i)
    .sort((a, b) => (out[b] ?? 0) - (out[a] ?? 0));
  if (diff > 0) {
    const top = order[0] ?? 0;
    out[top] = (out[top] ?? 0) + diff;
  } else if (diff < 0) {
    let need = -diff;
    for (const idx of order) {
      if (need <= 0) break;
      const take = Math.min((out[idx] ?? 0) - floor, need);
      out[idx] = (out[idx] ?? 0) - take;
      need -= take;
    }
  }
  return out;
}

const amountOf = (r: SplitRow) => Number(r.amount) || 0;

export const sumRows = (rows: SplitRow[]) =>
  rows.reduce((s, r) => s + amountOf(r), 0);

/** 균등 분배 — 나머지는 첫 항목 */
export function evenRows(rows: SplitRow[], total: number): SplitRow[] {
  if (rows.length === 0) return rows;
  const each = Math.floor(total / rows.length);
  const rest = total - each * rows.length;
  return rows.map((r, i) => ({
    ...r,
    amount: String(i === 0 ? each + rest : each),
  }));
}

/** ① 비례 배분 — 지금 금액 비중대로 새 총액에 맞춘다 */
export function proportionalRows(rows: SplitRow[], total: number): SplitRow[] {
  const base = sumRows(rows) || 1;
  const settled = settleRemainder(
    rows.map((r) => (amountOf(r) * total) / base),
    total,
  );
  return rows.map((r, i) => ({ ...r, amount: String(settled[i] ?? 0) }));
}

/** ② 큰 항목 반영 — 차액을 가장 큰 항목부터 흘려보낸다 */
export function largestRows(rows: SplitRow[], total: number): SplitRow[] {
  if (rows.length === 0) return rows;
  const settled = settleRemainder(rows.map(amountOf), total);
  return rows.map((r, i) => ({ ...r, amount: String(settled[i] ?? 0) }));
}

/** 본문 — `sortOrder` = 줄 차례, 저장된 항목은 `rowId` 를 싣는다(없으면 키를 뺀다) */
export function rowsToPayload(rows: SplitRow[]): ExpenseSplitFormValue[] {
  return rows.map((r, i) => ({
    ...(r.rowId != null ? { rowId: r.rowId } : {}),
    categoryRowId: r.categoryRowId as number,
    amount: Number(r.amount),
    label: r.label.trim() || null,
    sortOrder: i,
  }));
}
