import {
  formatDateLong,
  formatMonthDay,
  formatMonthDayDow,
} from "@/shared/lib/date";
import type { DutchPay, DutchPayParticipant } from "@/entities/dutch-pay";

/**
 * 더치페이 화면 셈 — 폰 · 데스크톱 · 만들기 · 상세가 같이 쓴다(I-15 25).
 * 결제자는 서버가 저장한 표식(`isPayer`)이다. 몫은 `p.amount`(저장 값) — 화면이 따로 나누지 않는다.
 */

/** 결제한 사람 — 표식이 없던 옛 응답은 첫 참여자(마이그레이션이 채운 규칙과 같다) */
export function payerOf(d: DutchPay): DutchPayParticipant | undefined {
  return d.participants.find((p) => p.isPayer) ?? d.participants[0];
}

export function isPayer(d: DutchPay, p: DutchPayParticipant): boolean {
  return payerOf(d)?.rowId === p.rowId;
}

/** 낸 수 = 결제자 + 낸 사람(서버는 결제자의 `isPaid` 를 N 으로 만든다 — 결제자가 먼저 냈다) */
export function paidCountOf(d: DutchPay): number {
  return d.participants.filter((p) => isPayer(d, p) || p.isPaid).length;
}

/** 모두 냈다 = 서버 `isSettled` */
export const isActiveSession = (d: DutchPay): boolean => !d.isSettled;

export type PerPerson =
  /** 몫이 모두 같다 — "1인당 m" */
  | { kind: "equal"; amount: number }
  /** 딱 한 사람만 m + r(r < 인원) — "1인당 m · r원은 {그 사람}" (저장된 몫에서 찾는다 — 결제자로 짐작하지 않는다) */
  | { kind: "rest"; amount: number; extra: number; name: string }
  /** 그 밖(비율 · 직접 입력 …) — "1인당" 조각을 빼고 날짜 · 인원만 */
  | { kind: "none" };

/**
 * "1인당" 규칙(I-15 40 일반화) — 가장 작은 몫을 m 으로 두고 판정한다. 목록 메타 · 만들기 · 상세가 같은 함수를 쓴다.
 */
export function perPersonOf(
  shares: readonly { name: string; amount: number }[],
): PerPerson {
  if (shares.length === 0) return { kind: "none" };
  const m = Math.min(...shares.map((x) => x.amount));
  const above = shares.filter((x) => x.amount !== m);
  if (above.length === 0) return { kind: "equal", amount: m };
  const only = above[0]!;
  const r = only.amount - m;
  if (above.length === 1 && r > 0 && r < shares.length)
    return { kind: "rest", amount: m, extra: r, name: only.name };
  return { kind: "none" };
}

export const perPersonOfSession = (d: DutchPay): PerPerson =>
  perPersonOf(
    d.participants.map((p) => ({ name: p.participantName, amount: p.amount })),
  );

/** 정산 날짜 내림(같으면 만든 차례 내림) — 진행 중 · 완료 모두 */
export function sortByDateDesc(list: readonly DutchPay[]): DutchPay[] {
  return [...list].sort(
    (a, b) => b.dutchPayDate.localeCompare(a.dutchPayDate) || b.rowId - a.rowId,
  );
}

/** 목록 날짜 — 올해 "10월 14일" · 다른 해 "2025년 10월 14일"(정산 날짜 그대로, 해를 버리지 않는다) */
export function dutchDate(iso: string, now: Date = new Date()): string {
  const d = iso.slice(0, 10);
  const y = Number(d.slice(0, 4));
  if (!y) return iso;
  return y === now.getFullYear() ? formatMonthDay(d) : formatDateLong(d);
}

/** 상세 날짜 — "10월 20일 (화)" · 다른 해 "2025년 10월 20일 (월)" */
export function dutchDateDow(iso: string): string {
  return formatMonthDayDow(iso.slice(0, 10));
}

/** 받을 돈 = 진행 중 정산의 안 낸 참여자(결제자 제외) 몫 합 + 인원 */
export function receivableOf(active: readonly DutchPay[]) {
  let amount = 0;
  let people = 0;
  for (const d of active)
    for (const p of d.participants) {
      if (isPayer(d, p) || p.isPaid) continue;
      amount += p.amount;
      people += 1;
    }
  return { amount, people };
}

/** 친구 집계 — 이름 기준(결제자 제외), N회 함께 정산 + 안 낸 몫 합 */
export function friendsOf(list: readonly DutchPay[]) {
  const map = new Map<
    string,
    { name: string; sessions: number; net: number }
  >();
  for (const d of list) {
    const payer = payerOf(d);
    for (const p of d.participants) {
      if (payer && p.rowId === payer.rowId) continue;
      const cur = map.get(p.participantName) ?? {
        name: p.participantName,
        sessions: 0,
        net: 0,
      };
      cur.sessions += 1;
      if (isActiveSession(d) && !p.isPaid) cur.net += p.amount;
      map.set(p.participantName, cur);
    }
  }
  return [...map.values()].sort(
    (a, b) => b.sessions - a.sessions || b.net - a.net,
  );
}

/** 이번 달 정산 통계 */
export function monthStatsOf(list: readonly DutchPay[], todayISO: string) {
  const ym = todayISO.slice(0, 7);
  const inMonth = list.filter((d) => d.dutchPayDate.slice(0, 7) === ym);
  const totalAmount = inMonth.reduce((s, d) => s + d.totalAmount, 0);
  const people = inMonth.reduce((s, d) => s + d.participants.length, 0);
  return {
    count: inMonth.length,
    totalAmount,
    avg: inMonth.length > 0 ? people / inMonth.length : 0,
  };
}

export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
