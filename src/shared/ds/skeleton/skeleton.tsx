import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "@/shared/lib/cn";
import { ProgressCircle } from "@/shared/ds/progress-circle";

import { LOADING_TIMING } from "./skeleton-variants";
import { useWaitPhase, type WaitPhase } from "./use-wait-phase";
import { dsText } from "@/shared/ds/i18n";

/*
 * Groo Skeleton — 구조는 SEED Skeleton(2026-10-03). 수치 원본은 groo-design specs/components/skeleton.yaml
 * (값은 src/shared/ds/spec/skeleton.json). groo-design recipes/shadcn/components/ui/skeleton.tsx 를 첫 판으로 가져왔다(앱 적용 1A).
 * 기다리는 동안의 시간표(1초 · 5초 · 10초)는 SEED Loading 패턴을 규칙으로 옮긴 것이다 — skeleton.md 의 "기다리는 동안".
 * 옛 Skeleton(깜빡임 · surface-input · 모서리 4 · 브랜드 25% 띠의 SkeletonShimmer)을 대신한다.
 *
 *   Skeleton          면 하나 — 곧 나타날 내용 하나의 자리. 크기 · 폭은 className 으로 준다
 *     radius          "0"(화면 끝에 붙는 사진) · "4" · "6"(폭 24 이하 · 48 이하의 그림 자리 — Image Frame 모서리) ·
 *                     "8"(기본 — 글 · 숫자 · 작은 조각 · 폭 49 이상의 그림 자리) · "12"(목록 앞 타일 — List 타일 · Logo Tile 40) ·
 *                     "16"(카드 면 — Card 모양 자리 전체만) · "full"(아바타 · 원 아이콘 · 칩).
 *                     그림 자리(썸네일 · 카드 그림)는 다 받은 그림과 같은 모서리다 — 손으로 고르지 않고 Image Frame 의
 *                     imageFrameRadius(폭) 으로 고른다. 카드 그림(신용카드 그림)은 카드 면이 아니라 그림이라 4 · 6 · 8 이다
 *     text            "t1" ~ "t14" — 높이를 그 글자의 줄 높이로(t3 13 → 18 · t4 14 → 19 · t5 16 → 22). 글로 바뀌어도 줄이 밀리지
 *                     않는다. 글 줄의 폭은 실제 글 길이와 비슷하게, 여러 줄이면 마지막 줄을 짧게(60 ~ 80%)
 *   LoadingRegion     기다리는 영역 — 데이터 자리 하나(쿼리 하나). 아래 "기다리는 영역"
 *   LoadingAnnouncer  화면의 상태 글 하나 — 앱 맨 위에 한 번 둔다. LoadingRegion 들이 여기에 알리고 같은 글은 한 번만 읽힌다
 *   useWaitPhase      pending 이 이어진 시간 → "quiet"(0 ~ 1초) · "waiting"(1초 ~) · "slow"(5초 ~). 영역을 직접 짤 때 쓴다(use-wait-phase.ts)
 *   LOADING_TIMING    { showAfter 1000 · slowAfter 5000 · timeout 10000 · retryDelays [1000, 2000] } — 요청 설정에도 쓴다(skeleton-variants.ts)
 *
 * 면 — bg-neutral-weak. 흰 면(bg-layer-default · bg-layer-floating) 위에만 둔다 — 페이지 바탕(bg-layer-basement)과 같은 색이라
 *   바탕 위에서는 사라진다. 바탕 위의 자리는 카드 면을 먼저 그리고 그 안에 둔다.
 * 반짝임 — 면과 같은 크기의 흰 띠(gradient-shimmer-neutral · 다크 gradient-shimmer-neutral-dark)가 자기 폭만큼 왼쪽 밖에서 오른쪽
 *   밖으로 motion-duration-loop(1.5초) · motion-ease-easing 으로 쉬지 않고 지난다(토큰 키프레임 shimmer). 면 밖은 잘린다.
 *   깜빡임(펄스)은 없다. 같은 화면의 띠는 한 박자로 지난다 — 띠의 애니메이션이 시작될 때마다 시작 시각을 문서 시계의 0 에 둬서
 *   늦게 붙은 띠도 먼저 붙은 띠와 같은 자리를 지난다. 모션 줄이기면 띠를 멈추고 지운다(투명도 0) — 면만 남는다.
 * 스켈레톤은 늘 보조 기술에 숨긴다(aria-hidden) — 기다리는 상태는 영역의 aria-busy 와 화면의 상태 글이 알린다.
 *   span(블록)으로 그려 글 자리(span · p) 안에도 둘 수 있다. 누르지 않고 초점을 받지 않는다.
 *
 * 기다리는 영역(LoadingRegion) — skeleton.yaml 의 region
 *   pending   처음 받는 중 — 보일 내용이 아직 없다. 내용이 이미 있으면(같은 내용을 다시 받는 중) pending 이 아니다 — 내용을 그대로 둔다
 *   failed    내용 없이 실패 — failure 를 그린다. 10초 요청 제한도 실패다(요청을 끊는 것은 제품의 요청 설정 — LOADING_TIMING.timeout)
 *   fallback  기다리는 동안의 모습 — 스켈레톤(틀은 그리고 데이터 자리만), 또는 "circle"(영역 가운데 Progress Circle 40)
 *   failure   실패 때 — Result Section failure + "다시 시도"
 *   children  내용
 *   시간표 — 0 ~ 1초는 fallback 을 보이지 않게 그려(visibility) 높이만 지킨다 — 1초 안에 오면 아무것도 깜빡이지 않는다.
 *   1초부터 fallback, 5초부터 오래 걸림 글 "평소보다 오래 걸리고 있어요." 한 줄(t4 · 400 · fg-neutral-muted · 단어 단위 줄바꿈) —
 *   스켈레톤이면 첫 스켈레톤 위에 왼쪽 맞춤으로 16 띄워, 원이면 원 아래에 가운데 맞춤으로 16 띄워 둔다. 스켈레톤 · 원은 그대로다.
 *   영역이 목록 카드(body="list")의 바로 아래 자식이면 오래 걸림 글과 실패의 Result Section 이 좌우 24 를 갖는다 — 목록 카드는 카드
 *   여백이 없고 줄이 제 24 를 가지므로(스켈레톤 줄도 List 줄이라 그대로). 내용 카드 안이면 카드의 24 그대로 — 더하지 않는다(23B).
 *   기다리는 동안 영역에 aria-busy="true" — 다 오거나 실패하면 푼다. 기다린 뒤 내용으로 바뀌면 투명도로 나타난다(motion-duration-d3 ·
 *   motion-ease-enter, 모션 줄이기면 바로 — 토큰 키프레임 fade-in). 처음부터 내용이 있으면(받아 둔 것) 그대로 보인다.
 *   원 모드는 영역이 가운데 맞춤 세로 묶음이 되고, 부모가 세로 flex 면 남는 높이를 채운다(Result Section 과 같다).
 *   개발 중에는 LoadingAnnouncer 가 없거나, 요청 제한(10초)이 지나고도 1초 넘게 pending 이면 알린다.
 *
 * 화면의 상태 글(LoadingAnnouncer) — role="status" · aria-live="polite" · 보이지 않게, body 끝에 둔다(열린 대화상자 · 시트가 나머지를
 *   aria-hidden 으로 가려도 aria-live 자리는 남는다 — 그래서 시트 안의 불러오기도 읽힌다). 처음부터 빈 채로 있다가(상태 글은 영역보다
 *   먼저 있어야 읽힌다) 기다리는 영역 중 하나가 1초가 되면 "불러오는 중…", 5초가 되면 "평소보다 오래 걸리고 있어요." 를 넣는다.
 *   영역이 여럿이어도 한 번의 기다림(기다리는 영역이 하나라도 있는 동안)에 같은 글은 한 번만 넣는다 — 다 오면 비우고 처음부터 센다.
 *   실패 · 비어 있음은 Result Section 이 알린다(role="status").
 *   영역들이 알릴 곳(report)은 처음 한 번 만들어 바뀌지 않는다 — 바뀌면 영역의 알림 효과가 다시 돌며 비웠다 다시 넣어 같은 글을
 *   또 읽는다(손 메모이제이션 대신 처음 한 번 만드는 상태로 둔다 — 테스트는 컴파일되지 않은 코드를 돈다).
 */

// 상태 글 · 오래 걸림 글(Writing v106 — 영어 "Loading" · 세 점 "..." 을 쓰지 않는다)
const waitingText = () => dsText("skeleton.waiting");
const slowText = () => dsText("skeleton.slow");

// 개발 중 — 요청 제한(10초)이 지나고도 이만큼 더 pending 이면 알린다
const TIMEOUT_GRACE = 1000;

// ── 스켈레톤 ─────────────────────────────────────────────────
export type SkeletonRadius = "0" | "4" | "6" | "8" | "12" | "16" | "full";
export type SkeletonText =
  | "t1"
  | "t2"
  | "t3"
  | "t4"
  | "t5"
  | "t6"
  | "t7"
  | "t8"
  | "t9"
  | "t10"
  | "t11"
  | "t12"
  | "t13"
  | "t14";

// 모서리 — 화면 폭 사진 0 · 그림 자리 4 · 6 · 8(Image Frame — 폭으로) · 글 8 · 타일 12 · 카드 면 16 · 원 full
const RADIUS: Record<SkeletonRadius, string> = {
  "0": "rounded-none",
  "4": "rounded-r1",
  "6": "rounded-r1_5",
  "8": "rounded-r2",
  "12": "rounded-r3",
  "16": "rounded-r4",
  full: "rounded-full",
};

// 글 자리의 높이 = 그 글자의 줄 높이(--text-tN--line-height). Tailwind 는 소스의 글자 그대로를 읽으므로 열넷을 다 적는다
const TEXT_HEIGHT: Record<SkeletonText, string> = {
  t1: "h-(--text-t1--line-height)",
  t2: "h-(--text-t2--line-height)",
  t3: "h-(--text-t3--line-height)",
  t4: "h-(--text-t4--line-height)",
  t5: "h-(--text-t5--line-height)",
  t6: "h-(--text-t6--line-height)",
  t7: "h-(--text-t7--line-height)",
  t8: "h-(--text-t8--line-height)",
  t9: "h-(--text-t9--line-height)",
  t10: "h-(--text-t10--line-height)",
  t11: "h-(--text-t11--line-height)",
  t12: "h-(--text-t12--line-height)",
  t13: "h-(--text-t13--line-height)",
  t14: "h-(--text-t14--line-height)",
};

// 면 — 블록 span, 띠를 면 모양으로 자른다
const ROOT = "relative block overflow-hidden bg-bg-neutral-weak";

// 띠 — 면과 같은 크기, 처음 자리는 왼쪽 밖. 키프레임 shimmer 가 transform(translateX −100% → 100%)을 움직이므로 처음 자리도
// transform 으로 둔다(translate 유틸리티는 transform 과 따로 더해진다). 모션 줄이기면 멈추고 지운다
const SHIMMER = [
  "pointer-events-none absolute inset-0 [transform:translateX(-100%)]",
  "bg-[image:var(--gradient-shimmer-neutral)] dark:bg-[image:var(--gradient-shimmer-neutral-dark)]",
  "animate-[shimmer_var(--motion-duration-loop)_var(--motion-ease-easing)_infinite]",
  "motion-reduce:animate-none motion-reduce:opacity-0",
].join(" ");

// 같은 화면의 띠를 한 박자로 — 띠의 애니메이션이 시작될 때(처음 · 다시 붙을 때) 시작 시각을 문서 시계의 0 에 둔다.
// 그러면 모든 띠의 진행 = 지금 시각 ÷ 1.5초의 나머지로 같다
function alignShimmer(e: React.AnimationEvent<HTMLSpanElement>) {
  if (e.target !== e.currentTarget) return;
  for (const animation of e.currentTarget.getAnimations())
    animation.startTime = 0;
}

export interface SkeletonProps extends Omit<
  React.HTMLAttributes<HTMLSpanElement>,
  "children"
> {
  /** "0"(화면 폭 사진) · "4" · "6"(그림 자리 — imageFrameRadius(폭)) · "8"(기본 — 글 · 숫자 · 폭 49 이상의 그림 자리) · "12"(목록 앞 타일) · "16"(카드 면) · "full"(아바타 · 원 아이콘 · 칩) */
  radius?: SkeletonRadius;
  /** 글 자리 — 그 글자의 줄 높이를 높이로(t4 → 19). 폭은 className 으로 */
  text?: SkeletonText;
}

const Skeleton = React.forwardRef<HTMLSpanElement, SkeletonProps>(
  ({ radius = "8", text, className, ...props }, ref) => {
    // 붙어 있는 동안이 곧 기다림이다 — 앱의 상태 글에 알리고(1초 "불러오는 중…" · 5초 "평소보다 오래 걸리고 있어요."),
    // 0 ~ 1초는 면을 보이지 않게 둔다(틀과 높이는 지킨다 — 1초 안에 오면 아무것도 깜빡이지 않는다, skeleton.md 시간표).
    // 화면마다 LoadingRegion 으로 감싸지 않은 82개 파일의 스켈레톤이 이 한 자리에서 같은 시간표를 따른다
    const phase = useWaitPhase(true);
    const id = React.useId();
    const announcer = React.useContext(LoadingAnnouncerContext);
    React.useEffect(() => {
      announcer?.report(id, phase);
    }, [announcer, id, phase]);
    React.useEffect(() => () => announcer?.report(id, null), [announcer, id]);
    return (
      <span
        ref={ref}
        data-slot="skeleton"
        data-radius={radius}
        data-text={text}
        data-wait={phase}
        className={cn(
          ROOT,
          RADIUS[radius],
          text && TEXT_HEIGHT[text],
          phase === "quiet" && "opacity-0",
          className,
        )}
        {...props}
        // 늘 숨긴다 — 회색 면에는 읽을 것이 없다
        aria-hidden="true"
      >
        <span
          data-slot="skeleton-shimmer"
          className={SHIMMER}
          onAnimationStart={alignShimmer}
        />
      </span>
    );
  },
);
Skeleton.displayName = "Skeleton";

// ── 화면의 상태 글 ────────────────────────────────────────────
type LoadingAnnouncerContextValue = {
  /** 영역 하나의 기다림 — 기다리지 않으면 null */
  report: (id: string, phase: WaitPhase | null) => void;
};
const LoadingAnnouncerContext =
  React.createContext<LoadingAnnouncerContextValue | null>(null);

// 영역들이 알릴 곳 — 영역마다의 기다림과 이번 기다림에서 이미 넣은 글을 들고, 화면의 상태 글을 정한다
function createAnnouncer(
  setMessage: (message: string) => void,
): LoadingAnnouncerContextValue {
  const phases = new Map<string, WaitPhase>();
  // 이번 기다림에서 이미 넣은 글 — 기다리는 영역이 모두 끝나면 비운다
  const said = new Set<string>();
  return {
    report(id, phase) {
      if (phase) phases.set(id, phase);
      else phases.delete(id);
      // 모두 끝났다 — 비우고 다음 기다림은 처음부터
      if (phases.size === 0) {
        said.clear();
        setMessage("");
        return;
      }
      const all = [...phases.values()];
      const next = all.includes("slow")
        ? slowText()
        : all.includes("waiting")
          ? waitingText()
          : null;
      // 같은 글은 한 번만 — 오래 걸리던 영역이 끝나고 남은 영역이 1 ~ 5초여도 "불러오는 중…" 을 다시 넣지 않는다
      if (next && !said.has(next)) {
        said.add(next);
        setMessage(next);
      }
    },
  };
}

// 상태 글을 둘 곳 — 브라우저에서는 body, 서버에서 그릴 때는 없다(바뀌지 않으므로 구독할 것이 없다)
const subscribeNothing = () => () => {};
const getBody = () => document.body;
const getNoBody = () => null;

// 앱 맨 위에 한 번 — 상태 글은 body 끝(보이지 않게)
function LoadingAnnouncer({ children }: { children?: React.ReactNode }) {
  const [message, setMessage] = React.useState("");
  // 처음 한 번 만든다 — 알릴 곳이 바뀌지 않아야 영역의 알림 효과가 다시 돌지 않는다
  const [announcer] = React.useState(() => createAnnouncer(setMessage));
  const container = React.useSyncExternalStore(
    subscribeNothing,
    getBody,
    getNoBody,
  );

  return (
    <LoadingAnnouncerContext.Provider value={announcer}>
      {children}
      {container &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-slot="loading-announcer"
            className="sr-only"
          >
            {message}
          </div>,
          container,
        )}
    </LoadingAnnouncerContext.Provider>
  );
}
LoadingAnnouncer.displayName = "LoadingAnnouncer";

// ── 기다리는 영역 ─────────────────────────────────────────────
// 오래 걸림 글 — t4 · 400 · fg-neutral-muted, 단어 단위 줄바꿈(v114).
// 영역이 목록 카드(body="list")의 바로 아래 자식이면 좌우 24 — 목록 카드는 줄마다 24 를 가져 카드 여백이 없다(23B 와 같은 원칙 —
// 어느 카드에서나 글이 카드 끝에서 24). 스켈레톤 줄은 List 의 24 를 그대로 가진다. 내용 카드 안이면 카드가 24 를 준다 — 더하지 않는다
const SLOW =
  "m-0 text-t4 font-normal text-fg-neutral-muted break-keep [overflow-wrap:break-word] [[data-slot=card][data-body=list]>[data-slot=loading-region]>&]:px-x6";

// 기다린 뒤 내용으로 — 투명도 0 → 1, motion-duration-d3 · motion-ease-enter(모션 줄이기면 바로)
const ENTER =
  "animate-[fade-in_var(--motion-duration-d3)_var(--motion-ease-enter)] motion-reduce:animate-none";

// 원 모드 — 영역 가운데 세로 묶음. 부모가 세로 flex 면 남는 높이를 채운다
const CIRCLE_REGION = "flex grow flex-col items-center justify-center";

let warnedNoAnnouncer = false;

export interface LoadingRegionProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> {
  /** 처음 받는 중 — 보일 내용이 아직 없다. 내용이 이미 있으면(같은 내용을 다시 받는 중) false — 내용을 그대로 둔다 */
  pending: boolean;
  /** 내용 없이 실패 — failure 를 그린다(10초 요청 제한도 실패다) */
  failed?: boolean;
  /** 기다리는 동안 — 스켈레톤(틀은 그리고 데이터 자리만), 또는 "circle"(영역 가운데 Progress Circle 40) */
  fallback: React.ReactNode;
  /** 실패 때 — Result Section failure + "다시 시도" */
  failure?: React.ReactNode;
  /** 내용 */
  children?: React.ReactNode;
}

const LoadingRegion = React.forwardRef<HTMLDivElement, LoadingRegionProps>(
  (
    {
      pending,
      failed = false,
      fallback,
      failure,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const waiting = pending && !failed;
    const phase = useWaitPhase(waiting);
    const id = React.useId();
    const announcer = React.useContext(LoadingAnnouncerContext);
    const circle = fallback === "circle";

    // 기다리는 모습을 그린 적이 있다 — 내용이 오면 투명도로 나타난다. 처음부터 내용이 있었으면(받아 둔 것) 그대로 보인다
    const [waited, setWaited] = React.useState(waiting || failed);
    if ((waiting || failed) && !waited) setWaited(true);

    // 화면의 상태 글에 알린다 — 바뀔 때마다. 떠날 때는 따로(바뀌는 사이에 빈 순간이 생겨 같은 글을 다시 읽지 않게)
    React.useEffect(() => {
      announcer?.report(id, waiting ? phase : null);
    }, [announcer, id, waiting, phase]);
    React.useEffect(() => () => announcer?.report(id, null), [announcer, id]);

    // 개발 중 — 상태 글 자리가 없거나, 요청 제한이 지나도 끝나지 않는다
    React.useEffect(() => {
      if (!import.meta.env.DEV || !waiting) return;
      if (!announcer && !warnedNoAnnouncer) {
        warnedNoAnnouncer = true;
        console.warn(
          "[LoadingRegion] 앱 맨 위에 LoadingAnnouncer 를 한 번 둔다 — 없으면 기다리는 동안을 보조 기술에 알리지 못한다.",
        );
      }
      const timer = window.setTimeout(() => {
        console.warn(
          `[LoadingRegion] ${(LOADING_TIMING.timeout + TIMEOUT_GRACE) / 1000}초가 지나도 pending 이다 — 요청은 LOADING_TIMING.timeout(10초) 안에 끊고 실패(failed)로 그린다.`,
        );
      }, LOADING_TIMING.timeout + TIMEOUT_GRACE);
      return () => window.clearTimeout(timer);
    }, [waiting, announcer]);

    const state = failed ? "failed" : waiting ? phase : "ready";
    const slow = waiting && phase === "slow";

    let body: React.ReactNode;
    if (failed) body = failure;
    else if (!waiting) body = children;
    else if (circle)
      body = (
        <>
          <ProgressCircle size="40" />
          {slow && (
            <p className={cn(SLOW, "mt-x4 text-center")}>{slowText()}</p>
          )}
        </>
      );
    else
      body = (
        <>
          {slow && <p className={cn(SLOW, "mb-x4")}>{slowText()}</p>}
          {fallback}
        </>
      );

    return (
      <div
        ref={ref}
        data-slot="loading-region"
        data-state={state}
        data-fallback={circle ? "circle" : undefined}
        aria-busy={waiting || undefined}
        className={cn(
          waiting && circle && CIRCLE_REGION,
          // 0 ~ 1초 — 그려 두되 보이지 않게(높이는 지킨다). 영역 자체는 남아 aria-busy 를 알린다
          state === "quiet" && "[&>*]:invisible",
          state === "ready" && waited && ENTER,
          className,
        )}
        {...props}
      >
        {body}
      </div>
    );
  },
);
LoadingRegion.displayName = "LoadingRegion";

export { Skeleton, LoadingRegion, LoadingAnnouncer };
