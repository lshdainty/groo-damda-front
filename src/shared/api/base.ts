import axios from "axios";
import type {
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from "axios";
import { rememberCurrentPath } from "@/shared/lib/groo/login-redirect";
import { beginAttempt, endChain } from "./request-budget";

const AUTH_FLAG_KEY = "authenticated";

export const setAuthenticated = () =>
  localStorage.setItem(AUTH_FLAG_KEY, "true");
export const clearAuthenticated = () => localStorage.removeItem(AUTH_FLAG_KEY);
export const isAuthenticated = (): boolean =>
  localStorage.getItem(AUTH_FLAG_KEY) === "true";

// 하위 호환
export const setToken = (_token: string) => setAuthenticated();
export const getToken = (): string | null =>
  isAuthenticated() ? "cookie" : null;
export const removeToken = () => clearAuthenticated();
export const hasToken = (): boolean => isAuthenticated();

/**
 * 요청 설정의 "알림은 호출처가 한다" 표식.
 *
 * 전역 서버 원문 토스트는 없앴다(단계 9) — 응답 인터셉터는 더 이상 실패를 화면에 알리지 않는다. 실패는 늘
 * 호출처가 자기 자리에서 고정 글로 말한다(조회 = Result Section · 폼 저장 = Callout · 삭제 등 = 스낵바).
 * 그래서 아래 두 값은 **동작이 아니라 표식**이다 — 호출처 177줄이 "이 요청의 실패는 내가 말한다" 는 뜻으로 넘기고 있어
 * 타입과 이름을 남겼다. (옛 뜻: silent = 전역 토스트 끔 · silentStatuses = 예상된 상태 코드만 끔.)
 *
 * - `silent` — 이 요청의 실패는 호출처가 직접 알린다.
 * - `silentStatuses` — 적어 둔 상태 코드는 "예상된 답"(하위 자원 404 등)으로, 호출처가 `isHttpStatus` 로 알아보고
 *   도메인 값으로 옮긴다.
 */
export type QuietRequestConfig = AxiosRequestConfig & {
  silent?: boolean;
  silentStatuses?: readonly number[];
  /**
   * 쓰기 결과 확인 — **모든 쓰기(GET 이 아닌 요청)에 기본으로 켜져 있다**(앱 저장 실패 규칙과 같은 범위). 2xx 인데 응답 본문이
   * `{ success: true, … }` 모양이 아니거나(깨진 JSON 이 문자열로 들어옴 · 다른 모양) 요청은 나갔는데 응답 전에 끊기면
   * `WriteUnconfirmedError` 로 거절한다 — 서버는 처리했을 수 있으므로 호출처는 "…확인하지 못했어요" 로 말하고, 성공 때와
   * 같은 범위를 다시 받는다(app/providers/query-client.ts MutationCache). 본문이 비어 있으면(204 · 빈 응답) 성공이다.
   * false 면 끈다(응답이 껍데기 모양이 아닌 쓰기용 — 지금은 없다).
   */
  confirmWrite?: boolean;
};

/**
 * 쓰기 결과를 확인하지 못했다 — 응답을 풀지 못했거나(PARSE, 2xx) 요청은 나갔는데 응답 전에 끊겼다(status 0).
 * 서버는 처리했을 수 있다. 다시 누르면 같은 거래가 두 번 들어갈 수 있어 실패로 말하지 않는다(앱 M3 와 같은 규칙).
 */
export class WriteUnconfirmedError extends Error {
  readonly code = "PARSE";
  constructor(readonly status: number) {
    super("write response could not be read");
    this.name = "WriteUnconfirmedError";
  }
}

export const isWriteUnconfirmed = (
  error: unknown,
): error is WriteUnconfirmedError => error instanceof WriteUnconfirmedError;

const isEnvelope = (body: unknown): boolean =>
  typeof body === "object" &&
  body !== null &&
  (body as { success?: unknown }).success === true;

/** 결과를 확인할 쓰기인가 — GET · HEAD · OPTIONS 가 아니고, 파일을 받는 요청이 아니고, 끄지 않았다 */
const confirmsWrite = (config: QuietRequestConfig | undefined): boolean => {
  if (!config || config.confirmWrite === false) return false;
  const method = (config.method ?? "get").toLowerCase();
  if (method === "get" || method === "head" || method === "options")
    return false;
  const rt = config.responseType;
  return rt !== "blob" && rt !== "arraybuffer" && rt !== "stream";
};

/**
 * 이 실패가 그 상태 코드인가.
 *
 * `silentStatuses` 로 넘긴 응답을 호출처가 알아보고 도메인 값(빈 목록 등)으로
 * 옮기는 자리에서 쓴다.
 */
export const isHttpStatus = (error: unknown, status: number): boolean =>
  (error as { response?: { status?: number } } | null | undefined)?.response
    ?.status === status;

const apiBaseUrl = `${import.meta.env.VITE_BASE_URL}${import.meta.env.VITE_API_URL}`;

// Content-Type 기본값을 고정하지 않는다 — axios 가 바디 타입으로 자동 결정한다
// (객체 → application/json, FormData → multipart/form-data+boundary).
// 인스턴스 기본을 application/json 으로 박으면 axios v1 transformRequest 가
// FormData 를 JSON 으로 직렬화해버려 파일 업로드(/import/*, /files/upload)가
// 415(HttpMediaTypeNotSupportedException)로 깨진다.
export const apiClient: AxiosInstance = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const lang = localStorage.getItem("i18nextLng") || "ko";
    config.headers["Accept-Language"] = lang;
    // 불러오기는 처음 요청부터 다시 시도까지 합쳐 10초 안에 끝낸다(request-budget.ts)
    beginAttempt(config);
    return config;
  },
  (error) => Promise.reject(error),
);

/**
 * 응답 인터셉터 — 알림을 띄우지 않는다(전역 서버 원문 토스트 없음, 단계 9).
 * - 401 은 /login 으로 보낸다(세션 만료). 병렬 401 이 동시에 나도 이동은 1회만.
 * - 그 밖의 실패는 그대로 호출처에 던진다 — 호출처가 자기 자리에서 고정 글로 알린다
 *   (조회 = Result Section · 폼 저장 = Callout · 삭제 등 = 스낵바 + [다시 시도]).
 */

// 401 동시 발생 시 redirect 1회만 — 병렬 query 가 401 로 떨어질 때 리다이렉트 중복 방지
let isRedirectingToLogin = false;

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    endChain(response.config);
    // 쓰기는 응답 모양을 확인한다 — 못 읽으면 성공도 실패도 아닌 PARSE
    if (
      confirmsWrite(response.config as QuietRequestConfig) &&
      response.status !== 204 &&
      response.data !== "" &&
      response.data != null &&
      !isEnvelope(response.data)
    )
      return Promise.reject(new WriteUnconfirmedError(response.status));
    return response.data;
  },
  (error) => {
    if (error.response?.status === 401) {
      if (!isRedirectingToLogin) {
        isRedirectingToLogin = true;
        clearAuthenticated();
        // 보던 자리를 적어 둔다 — 무음 재인증으로 돌아왔는데 늘 /desk 로 떨어지면
        // 세션이 끊긴 줄도 모르고 하던 일만 잃는다(QA #131).
        rememberCurrentPath();
        // expired=1 — 로그인 페이지가 버튼 대기 없이 곧장 SSO 로 넘어가게 하는 신호.
        // SSO 에 Refresh 쿠키(7일)가 살아 있으면 무음 재인증으로 비밀번호 없이 돌아온다.
        window.location.href = "/login?expired=1";
      }
      return Promise.reject(error);
    }
    if (confirmsWrite(error?.config as QuietRequestConfig | undefined)) {
      // 게이트웨이(502 · 504) 뒤에서 서버는 이미 처리했을 수 있다 — 실패가 아니라 "확인하지 못했어요"(검수 2차 M3).
      // 503 · 그 밖 5xx 는 서버가 받지 않았다는 뜻이라 그대로 실패다(앱과 같은 규칙)
      const status = error.response?.status;
      if (status === 502 || status === 504)
        return Promise.reject(new WriteUnconfirmedError(status));
      // 쓰기가 나갔는데 응답 전에 끊겼다(error.request 는 있고 response 가 없다) — 서버는 처리했을 수 있다.
      // 실패로 말하면 다시 눌러 두 번 들어간다 → PARSE 와 같은 "확인하지 못했어요" 쪽. 요청을 만들지도 못했거나
      // (request 없음) 시간 제한(ECONNABORTED) · 취소, 그리고 **기기가 오프라인**이면(보내지도 못했다 — M2) 그대로 실패다.
      // 서버 꺼짐 · CORS 는 오프라인과 구분이 안 돼 확인 쪽으로 둔다
      if (
        error.request != null &&
        error.response == null &&
        error.code !== "ECONNABORTED" &&
        error.code !== "ERR_CANCELED" &&
        !(typeof navigator !== "undefined" && navigator.onLine === false)
      )
        return Promise.reject(new WriteUnconfirmedError(0));
    }
    return Promise.reject(error);
  },
);
