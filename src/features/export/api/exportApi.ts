import { apiClient, type QuietRequestConfig } from "@/shared/api";
import type { ApiResponse } from "@/shared/types";

export type ExportFormat = "CSV" | "EXCEL" | "JSON";
export type ExportPeriod =
  "THIS_MONTH" | "LAST_MONTH" | "LAST_3_MONTHS" | "THIS_YEAR" | "CUSTOM";
export type ExportDataType =
  "EXPENSE" | "ASSET" | "BUDGET" | "CATEGORY" | "MEMO" | "CALENDAR" | "TODO";

export interface ExportTypeCount {
  type: string;
  displayName: string;
  count: number;
}

export interface ExportPreviewTable {
  type: string;
  displayName: string;
  headers: string[];
  rows: string[][];
  totalCount: number;
}

export interface ExportQueryBody {
  period: ExportPeriod;
  startDate?: string;
  endDate?: string;
  types: ExportDataType[];
}

export interface ExportDownloadBody extends ExportQueryBody {
  format: ExportFormat;
  mask: boolean;
}

/** 선택 종 + 기간의 건수 (체크박스 배지). */
export async function fetchExportCounts(
  body: ExportQueryBody,
): Promise<ExportTypeCount[]> {
  // 실패는 데이터 종류 묶음 아래에서 알린다(전역 토스트 대신 — I-05 42)
  const config: QuietRequestConfig = { silent: true };
  const resp: ApiResponse<{ counts: ExportTypeCount[] }> = await apiClient.post(
    "/v1/export/counts",
    body,
    config,
  );
  return resp.data.counts;
}

/** 선택 종 + 기간의 미리보기 (종별 상위 N행). */
export async function fetchExportPreview(
  body: ExportQueryBody,
): Promise<ExportPreviewTable[]> {
  const resp: ApiResponse<{ tables: ExportPreviewTable[] }> =
    await apiClient.post("/v1/export/preview", body, {
      silent: true,
    } as QuietRequestConfig);
  return resp.data.tables;
}

/** 받은 바이트가 이만큼(ms) 늘지 않으면 끊고 실패로 본다(I-05 47 · followups — 진행이 10초 멈추면 실패). */
export const EXPORT_STALL_MS = 10_000;

/** 파일 받기가 멈춰서 끊었다 — 서버가 답한 오류가 아니라 받는 도중 진행이 없었다. */
export class ExportStalledError extends Error {
  constructor() {
    super("export download stalled");
    this.name = "ExportStalledError";
  }
}

/**
 * 파일 생성 → Blob (대용량은 서버 스트리밍, 브라우저가 점진 수신).
 *
 * 받은 바이트가 `stallMs`(기본 10초) 동안 늘지 않으면 끊고 `ExportStalledError` 를 던진다.
 * 시계는 요청을 보낸 때부터 세고, 바이트가 늘 때마다 다시 센다 — 조금씩이라도 오면 끊기지 않는다.
 * 전역 토스트는 끈다(silent) — 실패는 부르는 쪽이 "다시 시도" 와 함께 알린다.
 */
export async function downloadExport(
  body: ExportDownloadBody,
  stallMs: number = EXPORT_STALL_MS,
): Promise<Blob> {
  const controller = new AbortController();
  let stalled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let received = 0;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      stalled = true;
      controller.abort();
    }, stallMs);
  };
  arm();
  try {
    const config: QuietRequestConfig = {
      responseType: "blob",
      signal: controller.signal,
      silent: true,
      onDownloadProgress: (e) => {
        if (e.loaded > received) {
          received = e.loaded;
          arm();
        }
      },
    };
    const blob: Blob = await apiClient.post("/v1/export", body, config);
    return blob;
  } catch (e) {
    if (stalled) throw new ExportStalledError();
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
