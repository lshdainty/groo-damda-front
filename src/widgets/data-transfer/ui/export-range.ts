import type {
  ExportDataType,
  ExportFormat,
  ExportPeriod,
} from "@/features/export/api/exportApi";

export const SLUG_TO_EXT: Record<ExportFormat, string> = {
  CSV: "csv",
  EXCEL: "xlsx",
  JSON: "json",
};
export const TYPE_SLUG: Record<ExportDataType, string> = {
  EXPENSE: "expense",
  ASSET: "asset",
  BUDGET: "budget",
  CATEGORY: "category",
  MEMO: "memo",
  CALENDAR: "calendar",
  TODO: "todo",
};

// ─── 날짜 유틸 (백엔드 PeriodResolver 와 동일 규칙) ───────────────

const pad = (n: number) => String(n).padStart(2, "0");
export const iso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export interface Range {
  start: string;
  end: string;
}

export function resolveRange(
  period: ExportPeriod,
  customFrom: string,
  customTo: string,
): Range {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const firstOf = (yy: number, mm: number) => new Date(yy, mm, 1);
  const lastOf = (yy: number, mm: number) => new Date(yy, mm + 1, 0);
  switch (period) {
    case "THIS_MONTH":
      return { start: iso(firstOf(y, m)), end: iso(lastOf(y, m)) };
    case "LAST_MONTH":
      return { start: iso(firstOf(y, m - 1)), end: iso(lastOf(y, m - 1)) };
    case "LAST_3_MONTHS":
      return { start: iso(firstOf(y, m - 2)), end: iso(lastOf(y, m)) };
    case "THIS_YEAR":
      // 서버 PeriodResolver THIS_YEAR 와 같은 값(1월 1일 ~ 12월 31일) — 범위 글 · 파일명이 이 끝을 쓴다.
      return { start: iso(new Date(y, 0, 1)), end: iso(new Date(y, 11, 31)) };
    case "CUSTOM":
      return { start: customFrom, end: customTo };
  }
}

export function buildFilename(
  format: ExportFormat,
  types: ExportDataType[],
  range: Range,
): string {
  const ext = SLUG_TO_EXT[format];
  const rangePart = `${range.start}_${range.end}`;
  if (format !== "EXCEL" && types.length > 1)
    return `groo-export-${rangePart}.zip`;
  const namePart = types.length === 1 ? TYPE_SLUG[types[0]!] : "export";
  return `groo-${namePart}-${rangePart}.${ext}`;
}
