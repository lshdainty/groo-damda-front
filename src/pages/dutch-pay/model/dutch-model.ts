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

/**
 * "1인당" 글 — 몫이 모두 같으면 그 값, 나눠 떨어지지 않으면 가장 많은 몫이 아니라 가장 흔한(=보낼 사람의) 몫과
 * 그와 다른 사람(남는 원을 진 사람)을 함께 돌려준다. 화면이 "1인당 61,333원 · 1원은 나" 로 적는다(I-15 40).
 */
export function perPersonInfo(d: DutchPay): {
  amount: number;
  /** 다른 몫을 가진 사람(없으면 null) — 남는 원을 진 사람 */
  restName: string | null;
  /** 그 사람 몫이 1인당보다 더 낸 원 수 */
  restExtra: number;
} {
  const ps = d.participants;
  if (ps.length === 0) return { amount: 0, restName: null, restExtra: 0 };
  const payer = payerOf(d);
  // 보낼 사람(결제자가 아닌 사람)의 몫이 "1인당" 이다 — 모두 같다는 것이 규칙이다
  const sender = ps.find((p) => p.rowId !== payer?.rowId) ?? ps[0]!;
  const amount = sender.amount;
  const other = ps.find((p) => p.amount !== amount);
  if (!other) return { amount, restName: null, restExtra: 0 };
  return {
    amount,
    restName: other.participantName,
    restExtra: Math.abs(other.amount - amount),
  };
}

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
