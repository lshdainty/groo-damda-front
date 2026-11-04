import type { SplitMethod } from "../model/types";

/** 몫을 셀 사람 하나 — 결제자는 늘 나다(I-21 G 40 · I-15 Q2 A) */
export interface ShareInput {
  isPayer: boolean;
  /** 비율 방식의 몫 수(0 보다 큰 수, 소수 허용) */
  ratio: number;
  /** 개별 금액 방식의 금액(결제자는 칸이 없다) */
  custom: number;
}

export interface Shares {
  /** `people` 와 같은 차례의 사람별 몫 */
  amounts: number[];
  /**
   * 나 포함을 끈 경우 목록에 없는 결제자(나)의 몫 — 남는 원이다. 나 포함이면 목록 안 결제자 줄에 이미 들어 있어 0.
   */
  mine: number;
  /** N분의 1 의 1인당(내림). 다른 방식은 0 */
  perPerson: number;
  /** 총액 − 몫의 합. 0 이면 맞다. 개별 금액이 어긋날 때만 0 이 아니다(양수 모자람 · 음수 넘침) */
  gap: number;
}

/**
 * 더치페이 몫 셈 — 거래에서 시작과 정산 만들기가 같이 쓴다(I-21 G 40 · I-15 40).
 * N분의 1 은 내림(총액 ÷ 인원)을 모두에게, 비율도 사람마다 내림(총액 × 몫 ÷ 몫 합) 이고 남는 원은 결제자에게 간다.
 * 나 포함을 끄면 결제자는 목록에 없고 남는 원은 내 몫(`mine`)이다. 개별 금액은 결제자 줄이 총액 − 다른 사람 합이다.
 */
export function computeShares(
  method: SplitMethod,
  total: number,
  people: ShareInput[],
  includeMe: boolean,
): Shares {
  const n = people.length;
  if (n === 0) return { amounts: [], mine: 0, perPerson: 0, gap: total };
  const payerIdx = people.findIndex((p) => p.isPayer);

  if (method === "CUSTOM") {
    const others = people.reduce(
      (s, p, i) => (i === payerIdx ? s : s + (p.custom || 0)),
      0,
    );
    const amounts = people.map((p, i) =>
      i === payerIdx ? Math.max(0, total - others) : p.custom || 0,
    );
    const sum = amounts.reduce((s, a) => s + a, 0);
    return {
      amounts,
      mine: 0,
      perPerson: 0,
      gap: includeMe ? total - sum : total - others,
    };
  }

  let amounts: number[];
  let perPerson = 0;
  if (method === "EQUAL") {
    perPerson = Math.floor(total / n);
    amounts = people.map(() => perPerson);
  } else {
    // 소수 몫(0.71 · 0.29)을 실수로 곱하면 28.999… 로 내림돼 1원이 어긋난다 — 소수 6자리를 정수로 올려 BigInt 로 센다
    const w = people.map((p) =>
      p.ratio > 0 ? BigInt(Math.round(p.ratio * 1_000_000)) : 0n,
    );
    const sumW = w.reduce((s, x) => s + x, 0n);
    amounts = w.map((x) =>
      sumW > 0n ? Number((BigInt(total) * x) / sumW) : 0,
    );
  }
  const rest = total - amounts.reduce((s, a) => s + a, 0);
  let mine = 0;
  if (includeMe && payerIdx >= 0)
    amounts[payerIdx] = (amounts[payerIdx] ?? 0) + rest;
  else mine = rest;
  return { amounts, mine, perPerson, gap: 0 };
}
