import * as React from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

import { ResultSection } from "@/shared/ds/result-section";

import {
  isChunkLoadError,
  isChunkReloadPending,
  reloadOnceForStaleChunk,
} from "../chunk-reload";

/*
 * 화면 경계 — 화면이 그리다 멈추면 빈 화면 대신 "문제가 생겼어요" + [다시 시도](result-section.md "찾을 수 없는 페이지 · 화면
 * 오류"). 경계가 없으면 React 는 잡히지 않은 오류에 루트를 통째로 내려 #root 가 빈다(QA 2026-11-17 web_dt_after_close3).
 *
 * 새 배포로 옛 화면 코드 조각을 못 받은 오류는 먼저 한 번 새로 고친다(chunk-reload.ts) — 고치는 동안은 빈 틀(높이만)이다.
 * [다시 시도] 는 문서를 새로 받는다 — 같은 트리를 다시 그리면 같은 조각 · 같은 오류로 또 멈춘다.
 * 다른 주소로 옮기면(resetKey) 경계를 풀어 그 화면을 그린다.
 *
 * 조각 받기 실패는 엔진마다 글이 다르다(Safari "Importing a module script failed." · 크롬 "Failed to fetch dynamically imported
 * module" · 파이어폭스 "error loading dynamically imported module" · 이름 ChunkLoadError) — 판정은 chunk-reload.ts 의
 * isChunkLoadError 한 곳이고, 새로 고침 표식(10초)도 vite:preloadError 와 같은 것을 쓴다.
 *
 * 라우터 밖(앱 맨 위의 알림 · 스낵바 자리 등)에서 멈춰도 루트가 통째로 내려가지 않게 같은 경계를 앱 맨 위에도 둔다(AppErrorBoundary).
 */

function ScreenError() {
  const { t } = useTranslation("common");
  return (
    <div data-slot="route-error" className="flex min-h-dvh flex-col">
      <ResultSection
        kind="failure"
        as="h1"
        title={t("screenError")}
        description={t("loadFailedDesc")}
        primaryAction={{
          label: t("retry"),
          onClick: () => window.location.reload(),
        }}
      />
    </div>
  );
}

type Props = { resetKey: string; children: React.ReactNode };
type State = { failed: boolean; reloading: boolean };

class Boundary extends React.Component<Props, State> {
  state: State = { failed: false, reloading: false };

  static getDerivedStateFromError(error: unknown): State {
    // 조각 받기 실패면 새로 고칠 참이라 빈 틀부터 — 고칠 수 없으면 componentDidCatch 가 실패로 바꾼다
    return { failed: true, reloading: isChunkLoadError(error) };
  }

  componentDidCatch(error: unknown) {
    if (!isChunkLoadError(error)) return;
    // vite:preloadError 가 이미 걸었으면 그대로 기다린다 — 최근에 고쳤는데 또 실패면 실패를 보인다
    if (!isChunkReloadPending() && !reloadOnceForStaleChunk()) {
      this.setState({ reloading: false });
    }
  }

  componentDidUpdate(prev: Props) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) {
      this.setState({ failed: false, reloading: false });
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    if (this.state.reloading)
      return <div data-slot="route-loading" className="min-h-dvh" />;
    return <ScreenError />;
  }
}

/** 앱 맨 위에 둔다 — 라우터 밖에서 멈춘 것을 받는다. 주소를 모르므로 풀지 않는다([다시 시도] 는 문서를 새로 받는다) */
export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return <Boundary resetKey="app">{children}</Boundary>;
}

/** 라우터 안에 둔다 — 주소가 바뀌면 경계를 푼다 */
export function RouteErrorBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  const { pathname } = useLocation();
  return <Boundary resetKey={pathname}>{children}</Boundary>;
}
