export interface TokenExchangeRequest {
  ssoToken: string;
}

/**
 * `POST /auth/exchange-code` 응답 본문. **토큰은 없다** — desk 토큰은 HttpOnly 쿠키로만 온다
 * (groo-damda-back#431, 보안 점검 N-4). 본문에 토큰이 있으면 페이지 스크립트가 읽을 수 있어
 * HttpOnly 의 뜻이 사라진다. 화면도 이 본문의 토큰을 쓴 적이 없다.
 */
export interface TokenExchangeResponse {
  userId: string;
  userName: string;
  userEmail: string;
}

export interface LoginCheckResponse {
  rowId: number;
  userId: string;
  userName: string;
  userEmail: string;
  timezone: string;
  /** 가입 시각(ISO) — desk-back /auth/check joinedAt (core AuditingFields). 구백엔드 호환 optional. */
  joinedAt?: string | null;
}
