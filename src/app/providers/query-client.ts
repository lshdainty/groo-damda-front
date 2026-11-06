import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { isWriteUnconfirmed } from "@/shared/api/base";
import { retryDelay, retryOnlyServerErrors } from "@/shared/api/retry";
import {
  clearRefreshFailure,
  notifyRefreshFailure,
} from "@/shared/api/refresh-failure";

/** 앱의 QueryClient 설정 — 시험이 같은 설정으로 만든다 */
export const createAppQueryClient = () =>
  new QueryClient({
    // 받아 둔 값이 있는 채 다시 받기가 실패하면 공용 스낵바 "새로 고치지 못했어요." 한 줄 —
    // 폴링 · 참조 · 화면을 떠난 질의 · 401 · 같은 조회의 연달은 실패는 뺀다(shared/api/refresh-failure.ts, 띄우는 자리는 RefreshFailureNotice)
    queryCache: new QueryCache({
      onError: notifyRefreshFailure,
      onSuccess: clearRefreshFailure,
    }),
    // 쓰기 결과를 확인하지 못했다(PARSE · 응답 없음 — shared/api/base.ts) — 서버는 처리했을 수 있다. 그 쓰기의 성공 처리기를
    // 그대로 한 번 불러 성공 때와 같은 범위를 다시 받는다(성공 처리기가 없으면 끝 처리기를 error 없이). 폼은 onError 경로라
    // 닫히지 않고, 글은 폼이 고른다(useSaveFailureText — "…확인하지 못했어요"). 앱 저장 실패 규칙과 같은 범위
    mutationCache: new MutationCache({
      onError: (error, variables, onMutateResult, mutation, context) => {
        if (!isWriteUnconfirmed(error)) return;
        const o = mutation.options;
        // 성공 처리기가 응답 값을 읽다 던지면(동기 · 비동기 모두) 화면이 보는 것을 모두 다시 받는다
        const everything = () => context.client.invalidateQueries();
        // 성공 · 끝 처리기가 둘 다 없는 쓰기(다시 받기를 요청 함수 안에서 하는 것 — 알림 지우기 · 모두 읽음 · 기기 전부 로그아웃 ·
        // 비밀번호 바꾸기 · 해지)는 다시 받을 범위를 모른다 — 화면이 보는 것을 모두 다시 받는다
        if (!o.onSuccess && !o.onSettled) return everything();
        try {
          return Promise.resolve(
            o.onSuccess
              ? o.onSuccess(undefined, variables, onMutateResult, context)
              : o.onSettled?.(
                  undefined,
                  null,
                  variables,
                  onMutateResult,
                  context,
                ),
          ).catch(everything);
        } catch {
          return everything();
        }
      },
    }),
    defaultOptions: {
      queries: {
        // 마운트/리마운트/포커스마다 전 쿼리 재요청되어 요청 폭주 → 60초 신선도로 억제.
        // 폭주를 실제로 막는 건 이 값이다. 아래 포커스 갱신이 켜져 있어도 60초 안에 받은
        // 데이터는 fresh 라 재요청하지 않는다.
        staleTime: 60_000,
        // 탭으로 돌아오면 오래된 것만 다시 받는다.
        //
        // 예전엔 전역으로 껐는데, 그러면 다른 기기(앱)에서 바꾼 내용을 웹이 따라잡을
        // 계기가 사라진다 — 탭을 열어 둔 채 앱에서 지출을 넣으면 새로고침 전까지
        // 모른다. 폭주의 원인은 staleTime 0 이었고 그건 위에서 잡았다.
        //
        // 포커스로 갱신하면 안 되는 것들은 개별로 꺼져 있다(주식 시세는 자체 폴링,
        // 사용자 환경설정은 바뀔 일이 드물다).
        refetchOnWindowFocus: true,
        // 4xx 는 재시도하지 않는다 — 없는 자산 조회가 두 번 나가던 자리(QA #4).
        // 읽기는 처음 요청부터 합쳐 10초 안에서 2번까지, 1초 · 2초 뒤(skeleton.md "요청 제한 10초").
        retry: retryOnlyServerErrors,
        retryDelay,
      },
    },
  });
