import { apiClient, NOT_A_SAVE } from "@/shared/api";
import type { ApiResponse } from "@/shared/types";

// ─── 타입 (백엔드 dataimport 미러) ─────────────────────────────

export type ImportSource =
  "POREST" | "EASYBUDGET" | "BANKSALAD" | "TOSS" | "CUSTOM";

export type ImportField =
  | "DATE"
  | "TYPE"
  | "AMOUNT"
  | "AMOUNT_OUT"
  | "AMOUNT_IN"
  | "CATEGORY"
  | "SUBCATEGORY"
  | "ASSET"
  | "MEMO"
  | "TIME"
  | "MERCHANT"
  | "PAYMENT_METHOD";

export type ImportMapping = Partial<Record<ImportField, number>>;

export interface ImportColumn {
  index: number;
  name: string;
}

export interface ImportPreviewRow {
  lineNo: number;
  date: string | null;
  type: string | null;
  amount: number | null;
  category: string | null;
  asset: string | null;
  memo: string | null;
  duplicate: boolean;
  error: string | null;
}

export interface ImportAnalyzeResult {
  fileName: string;
  totalRows: number;
  validRows: number;
  duplicateCount: number;
  /** 거래가 달려 있어 하위를 만들 수 없는 대분류 — 비어 있지 않으면 그 행들이 전부 실패한다 */
  blockedParents: string[];
  columns: ImportColumn[];
  suggestedMapping: ImportMapping;
  preview: ImportPreviewRow[];
  /**
   * 이대로 실행하면 새로 만들어질 카테고리 경로("대분류 > 소분류", 최상위는 이름만).
   * 서버가 상한(50)까지만 담는다 — 전체 개수는 `newCategoryCount`.
   */
  newCategories: string[];
  /** 새로 만들어질 카테고리 전체 개수. `newCategories.length` 보다 클 수 있다. */
  newCategoryCount: number;
}

export interface ImportExecuteResult {
  imported: number;
  skipped: number;
  failed: number;
  /** 실패한 행. `reason` 은 화면 문구가 아니라 **사유 코드**다(FAIL_REASONS 참고). */
  failures: { lineNo: number; reason: string }[];
  /** `failures` 가 서버 상한(50)에서 잘렸는지. 참이면 화면이 그 사실을 말해야 한다. */
  failuresTruncated: boolean;
  /** 이번 실행에서 실제로 만들어진 카테고리 경로(생성 순서) — 상한까지만. */
  createdCategories: string[];
  /** 실제로 만들어진 카테고리 전체 개수. `createdCategories.length` 보다 클 수 있다. */
  createdCategoryCount: number;
}

// ─── API ───────────────────────────────────────────────────────

/** 파일 분석 — 자동매핑 제안 + 미리보기 + 유효/중복 건수. */
export async function analyzeImport(
  file: File,
  source: ImportSource,
): Promise<ImportAnalyzeResult> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("source", source);
  // 실패는 화면이 고정 글로 말한다 — 전역 서버 원문 토스트는 끈다
  const resp: ApiResponse<ImportAnalyzeResult> = await apiClient.post(
    "/v1/import/analyze",
    fd,
    { silent: true, ...NOT_A_SAVE } as import("axios").AxiosRequestConfig & {
      silent?: boolean;
    },
  );
  return resp.data;
}

/** 실제 저장 — 최종 매핑·옵션대로 거래 생성. */
export async function executeImport(
  file: File,
  request: {
    source: ImportSource;
    mapping: ImportMapping;
    dupSkip: boolean;
    autoCat: boolean;
  },
): Promise<ImportExecuteResult> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append(
    "request",
    new Blob([JSON.stringify(request)], { type: "application/json" }),
  );
  const resp: ApiResponse<ImportExecuteResult> = await apiClient.post(
    "/v1/import/execute",
    fd,
    // 파일을 올리지만 거래를 만드는 저장이다 — 쓰기 확인을 둔다(응답을 못 받으면 확인 못 함 + 다시 받기, 검수 3차 M2)
    { silent: true } as import("axios").AxiosRequestConfig & {
      silent?: boolean;
    },
  );
  return resp.data;
}
