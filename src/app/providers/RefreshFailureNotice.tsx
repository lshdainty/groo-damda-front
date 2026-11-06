import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { onRefreshFailure } from "@/shared/api/refresh-failure";
import { useSnackbar } from "@/shared/ds/snackbar";

// 액션 없는 스낵바가 떠 있는 시간(snackbar.yaml root.duration 4초) — 이 안에 또 실패가 와도 다시 띄우지 않는다
const SHOWN_MS = 4000;

/**
 * 내용이 있는 채 다시 받다 실패했을 때 앱 한 자리에서 알린다 — critical 스낵바 "새로 고치지 못했어요." 한 문장, [다시 시도] 없음
 * (result-section.md:53 · skeleton.md:167). 보던 내용은 그대로 둔다. 무엇을 알릴지는 QueryCache onError 가 가른다
 * (shared/api/refresh-failure.ts). 여러 질의가 함께 실패해도(망 끊김 · 탭으로 돌아온 포커스 갱신) 하나 — 떠 있는 동안은 다시 띄우지 않는다.
 */
export const RefreshFailureNotice = () => {
  const snackbar = useSnackbar();
  const { t } = useTranslation("common");
  // t 는 언어가 바뀌면 달라진다 — 구독을 다시 걸지 않게 ref 로 읽는다
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    let shownTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = onRefreshFailure(() => {
      if (shownTimer !== undefined) return;
      shownTimer = setTimeout(() => {
        shownTimer = undefined;
      }, SHOWN_MS);
      snackbar.show({
        message: tRef.current("query.refreshFailed"),
        tone: "critical",
      });
    });
    return () => {
      unsubscribe();
      if (shownTimer !== undefined) clearTimeout(shownTimer);
    };
  }, [snackbar]);

  return null;
};
