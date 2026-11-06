import { formatDateSmart, parseServerUtc } from "@/shared/lib/date";

/** 서버 `[UTC]` 시각 → 화면 날짜("11월 5일"). 못 읽으면 null */
export function verifiedDate(verifiedAt: string | null): string | null {
  const d = parseServerUtc(verifiedAt);
  return d ? formatDateSmart(d) : null;
}
