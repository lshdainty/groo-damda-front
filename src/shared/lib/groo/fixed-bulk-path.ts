/**
 * 통계 > 거래를 고정으로 정리하기 주소(I-wrap-b1 δ) — 1280 미만은 이 주소의 페이지, 이상은 통계 위 대화상자다.
 * 셸(풀스크린 판정)과 통계 화면(열림 = 주소)이 같은 값을 읽도록 한 자리에 둔다.
 */
export const FIXED_BULK_PATH = "/desk/stats/fixed";
export const isFixedBulkPath = (pathname: string) =>
  pathname === FIXED_BULK_PATH || pathname === `${FIXED_BULK_PATH}/`;
