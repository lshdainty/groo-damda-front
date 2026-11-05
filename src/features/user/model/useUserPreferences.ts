import { referenceMeta } from "@/shared/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_CURRENCY } from "@/shared/lib/groo/currency";
import { userApi, type UserPreferences } from "../api/userApi";

const PREF_KEY = ["user", "preferences"] as const;

export const useUserPreferences = (opts?: { reference?: boolean }) => {
  return useQuery({
    queryKey: PREF_KEY,
    queryFn: () => userApi.getPreferences(),
    ...referenceMeta(opts),
    // preferences 는 자주 안 바뀜 — 5분 신선도로 마운트/리마운트마다 재요청되던 폭주를 억제.
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
};

export const useUpdateUserPreferences = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<UserPreferences>) =>
      userApi.updatePreferences(data),
    onSuccess: (resp) => {
      qc.setQueryData(PREF_KEY, resp);
    },
  });
};

/**
 * 새 자산·거래가 먼저 골라 둘 통화 (QA #124 · D7).
 *
 * 값이 아직 안 왔을 때는 원화다 — 쿼리가 도는 사이 화면이 빈 통화로 뜨면 select 가
 * 값 없는 상태로 보인다. 이 훅을 쓰는 폼은 **여기서 받은 값을 `useState` 초기값으로
 * 굳히지 마라.** 설정 화면을 안 들른 세션에서는 이 쿼리가 폼보다 늦게 도착해서,
 * 초기값으로 받으면 첫 렌더의 `KRW` 에 그대로 잠긴다. 사용자가 고르기 전까지 이 값을
 * 매 렌더 읽는 쪽(`pick ?? item ?? 기본값`)으로 짜야 늦게 온 값이 반영된다.
 */
export const useDefaultCurrency = (): string => {
  const { data } = useUserPreferences();
  return data?.defaultCurrency ?? DEFAULT_CURRENCY;
};

/**
 * 알림 설정처럼 "누르는 순간 적용" 인 설정 편집 — 낙관적 값 + 키별 저장 (I-15 49 · switch.md "누르면 스위치가 바로 바뀐다").
 *
 * - `save` 는 키 하나씩 따로 보낸다(설정 전체를 덮어쓰지 않는다). 누르는 순간 화면 값(`pref`)이 바뀐다.
 * - 같은 키를 또 누르면 앞 요청의 응답은 버린다(늦게 온 응답이 나중 값을 되돌리지 않게). 응답은 그 키만 캐시에 병합한다.
 * - 실패하면 그 키의 화면 값을 서버 값으로 되돌리고 `onFail` 을 **요청마다** 부른다(앞 요청에 덮인 것은 부르지 않는다).
 * - 요청은 silent 다(전역 서버 글 없음) — 알림은 부르는 쪽이 한다.
 */
export function usePreferenceEditor(onFail: () => void) {
  const qc = useQueryClient();
  const query = useUserPreferences();
  const [overlay, setOverlay] = useState<Partial<UserPreferences>>({});
  const seq = useRef<Partial<Record<keyof UserPreferences, number>>>({});
  const failRef = useRef(onFail);
  useEffect(() => {
    failRef.current = onFail;
  });

  const pref = useMemo(
    () => (query.data ? { ...query.data, ...overlay } : undefined),
    [query.data, overlay],
  );

  const save = useCallback(
    (patch: Partial<UserPreferences>) => {
      for (const key of Object.keys(patch) as (keyof UserPreferences)[]) {
        const value = patch[key];
        const mine = (seq.current[key] ?? 0) + 1;
        seq.current[key] = mine;
        setOverlay((o) => ({ ...o, [key]: value }));
        const settle = () =>
          setOverlay((o) => {
            const next = { ...o };
            delete next[key];
            return next;
          });
        userApi.updatePreferences({ [key]: value }).then(
          (resp) => {
            if (seq.current[key] !== mine) return;
            qc.setQueryData<UserPreferences>(PREF_KEY, (prev) =>
              prev ? { ...prev, [key]: resp[key] } : resp,
            );
            settle();
          },
          () => {
            if (seq.current[key] !== mine) return;
            settle();
            failRef.current();
          },
        );
      }
    },
    [qc],
  );

  return { pref, query, save };
}
