import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  isReferenceNoticeHeld,
  isReferenceQuery,
  onReferenceNoticeRelease,
} from "@/shared/api/reference";
import { useSnackbar } from "@/shared/ds/snackbar";

// 같은 순간 여러 훅이 함께 실패해도 한 번만 알리려고 모으는 시간
const GATHER_MS = 300;
// 스낵바(액션 있음)가 떠 있는 시간 — 이 안에는 새 실패가 나도 같은 글을 다시 띄우지 않는다
const SHOWN_MS = 6000;

/**
 * 참조 데이터(카테고리 · 계좌 · 현재 사용자 …) 조회 실패를 앱 한 자리에서 알린다.
 *
 * 훅이 `meta: { reference: true }` 를 달고 요청을 silent 로 보내면, 값이 하나도 없는 채 실패했을 때
 * "일부 정보를 불러오지 못했어요." 스낵바(critical) 한 줄과 [다시 시도] 를 띄운다. [다시 시도]는 실패한
 * 참조 조회만 다시 받는다. 이미 받아 둔 값이 있는 채 다시 받기에 실패한 것은 값을 그대로 두고 알리지 않는다.
 * 화면의 주 데이터(목록 · 카드)는 이 자리가 아니라 그 화면의 Result Section 이 맡는다.
 */
export const ReferenceFailureNotice = () => {
  const queryClient = useQueryClient();
  const snackbar = useSnackbar();
  const { t } = useTranslation("common");
  // t 는 언어가 바뀌면 달라진다 — 구독을 다시 걸지 않게 ref 로 읽는다
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    let gatherTimer: ReturnType<typeof setTimeout> | undefined;
    let shownTimer: ReturnType<typeof setTimeout> | undefined;
    let shown = false;
    // 알린 뒤 창 안에서 새 참조 실패가 있었다
    let missed = false;

    const isFailedReference = (q: {
      meta: unknown;
      state: { status: string; data: unknown };
    }) =>
      isReferenceQuery(q.meta) &&
      q.state.status === "error" &&
      q.state.data === undefined;

    const retry = () => {
      void queryClient.refetchQueries({
        type: "active",
        predicate: isFailedReference,
      });
    };

    const show = () => {
      gatherTimer = undefined;
      // 모으는 동안 다시 받기에 성공한 것은 알릴 일이 아니다
      const stillFailed = queryClient
        .getQueryCache()
        .findAll({ type: "active", predicate: isFailedReference }).length;
      // 폼 · 시트가 열려 있으면 그 안이 맡는다(useHoldReferenceNotice)
      if (stillFailed === 0 || shown || isReferenceNoticeHeld()) return;
      shown = true;
      shownTimer = setTimeout(() => {
        shown = false;
        shownTimer = undefined;
        // 창 안에서 새 참조 실패가 있었다면(missed) 창이 닫힐 때 한 번 다시 판단한다 — 아직 값 없이 실패한 채면 알린다.
        // 새 실패가 없었다면 같은 실패를 6초마다 되풀이하지 않는다
        if (missed && gatherTimer === undefined) {
          missed = false;
          gatherTimer = setTimeout(show, GATHER_MS);
        }
      }, SHOWN_MS);
      snackbar.show({
        message: tRef.current("query.referenceFailed"),
        tone: "critical",
        action: { label: tRef.current("retry"), onClick: retry },
      });
    };

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "error") return;
      if (!isFailedReference(event.query)) return;
      if (shown) {
        missed = true;
        return;
      }
      if (gatherTimer !== undefined) return;
      gatherTimer = setTimeout(show, GATHER_MS);
    });

    // 폼 · 시트가 모두 닫히면 한 번 다시 판단한다 — 그 사이 쉰 실패가 값 없이 남았으면 알린다
    const unsubscribeRelease = onReferenceNoticeRelease(() => {
      if (gatherTimer !== undefined || shown) return;
      gatherTimer = setTimeout(show, GATHER_MS);
    });

    return () => {
      unsubscribe();
      unsubscribeRelease();
      if (gatherTimer !== undefined) clearTimeout(gatherTimer);
      if (shownTimer !== undefined) clearTimeout(shownTimer);
    };
  }, [queryClient, snackbar]);

  return null;
};
