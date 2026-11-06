import { loadFailed } from "@/shared/api";
import type { ReactNode } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card } from "@/shared/ds/card";
import { Skeleton } from "@/shared/ds/skeleton";
import {
  TopNavigation,
  TopNavigationBackButton,
  TopNavigationTitle,
} from "@/shared/ds/top-navigation";
import { BandFailure } from "@/shared/ui/groo/band-parts";
import { ScreenBands } from "@/shared/ui/groo/screen-bands";
import {
  CollectionSection,
  ListRowSkeleton,
  MySkySection,
  NightSkyHero,
  ReportRow,
  useNightSkyModel,
  type NightSkyModel,
} from "@/widgets/constellation";
import { REPORT_PATH } from "@/shared/config";
import { DesktopFrame } from "./DesktopFrame";

type OutletCtx = { mobile: boolean };

/** 밤하늘(`/desk/todo/night-sky`) — 폰은 띠 셋, 데스크톱은 카드(I-11 2 · 7 ~ 14). 폭으로 틀만 갈린다. */
export const NightSkyPage = () => {
  const { mobile } = useOutletContext<OutletCtx>();
  return mobile ? <NightSkyMobile /> : <NightSkyDesktop />;
};

const stateOf = (q: {
  isLoading: boolean;
  isError: boolean;
  data?: unknown;
}) => (q.isError && !q.data ? "failed" : q.isLoading ? "loading" : "ready");

/**
 * 폰 — 상단 바(← "밤하늘") + 띠 셋: ① 오늘(하늘 그림 + 관측 리포트 줄 — 한 띠) ② 지난 기록(나의 밤하늘) ③ 모음(별자리 도감 87줄).
 * 띠 사이 8 둘 · 시작 · 끝 0(T1 ~ T5). 오늘이 실패하면 화면 전체 실패 하나, 나머지는 그 구역 안에서만 실패한다.
 */
function NightSkyMobile() {
  const { t } = useTranslation("constellation");
  const navigate = useNavigate();
  const m = useNightSkyModel();
  const today = m.todayQ.data;
  return (
    <>
      <TopNavigation type="standard">
        <TopNavigationBackButton fallbackHref="/desk/todo" />
        <TopNavigationTitle>{t("nightSky.title")}</TopNavigationTitle>
      </TopNavigation>
      {m.failed ? (
        <ScreenBands>
          <div data-band="flush" data-section="today">
            <div className="pb-x6 pt-x3">
              <BandFailure band title={t("fail.today")} onRetry={m.retryAll} />
            </div>
          </div>
        </ScreenBands>
      ) : (
        <ScreenBands>
          <div data-band="flush" data-section="today">
            <TodayBand m={m} onOpenReport={() => navigate(REPORT_PATH)} />
          </div>
          <div data-band="flush" data-section="sky">
            <MySkySection
              place="band"
              state={stateOf(m.skyQ)}
              onRetry={() => void m.skyQ.refetch()}
              sky={m.skyQ.data ?? []}
              today={today}
              entries={m.collectionQ.data?.entries ?? []}
            />
          </div>
          <div data-band="flush" data-section="collection">
            <CollectionSection
              place="band"
              state={stateOf(m.collectionQ)}
              onRetry={() => void m.collectionQ.refetch()}
              collection={m.collectionQ.data}
              todayKey={today?.constellation.constellationKey ?? ""}
              today={today}
            />
          </div>
        </ScreenBands>
      )}
    </>
  );
}

/** 띠 ① — 하늘 그림(위 20 · 좌우 24 · 아래 16) + 관측 리포트 줄(줄이 제 위 12). 불러오는 동안은 같은 자리를 스켈레톤으로 */
function TodayBand({
  m,
  onOpenReport,
}: {
  m: NightSkyModel;
  onOpenReport: () => void;
}) {
  const today = m.todayQ.data;
  return (
    <>
      <div className="px-x6 pb-x4 pt-x5">
        {today ? (
          <NightSkyHero today={today} doneToday={m.doneToday} />
        ) : (
          <Skeleton radius="16" className="h-[168px] w-full" />
        )}
      </div>
      {today && m.skyQ.data && m.collectionQ.data ? (
        <ReportRow
          today={today}
          sky={m.skyQ.data}
          entries={m.collectionQ.data.entries}
          onOpen={onOpenReport}
        />
      ) : loadFailed(m.skyQ) || loadFailed(m.collectionQ) ? null : (
        <ListRowSkeleton />
      )}
    </>
  );
}

/**
 * 데스크톱 · 태블릿 — 1280 이상 2 : 1 두 칸(왼쪽 하늘 그림 카드 → 도감 카드, 오른쪽 관측 리포트 줄 카드 → 나의 밤하늘 카드),
 * 768 ~ 1279 한 칸 720(하늘 → 리포트 줄 → 나의 밤하늘 → 도감). 칸 사이 24 · 같은 칸 카드 사이 8.
 */
function NightSkyDesktop() {
  const { t } = useTranslation("constellation");
  const { t: tl } = useTranslation("layout");
  const navigate = useNavigate();
  const m = useNightSkyModel();
  const today = m.todayQ.data;
  const frame = (children: ReactNode) => (
    <DesktopFrame
      slot="night-sky-desktop"
      parent={{ to: "/desk/todo", label: tl("todoNav") }}
      title={t("nightSky.title")}
    >
      {children}
    </DesktopFrame>
  );
  if (m.failed)
    return frame(
      <Card>
        <BandFailure
          title={t("fail.today")}
          onRetry={m.retryAll}
          band={false}
        />
      </Card>,
    );
  // 하늘 카드는 제 면(그라디언트)을 그리고 누르면 2px 축소만 한다(card.yaml hero 규칙) — Card 로 감싸 테두리 · 여백을 덮지 않는다
  const hero = today ? (
    <NightSkyHero today={today} doneToday={m.doneToday} wide />
  ) : (
    <Skeleton radius="16" className="h-[220px] w-full" />
  );
  const report = (
    <Card body="list">
      {today && m.skyQ.data && m.collectionQ.data ? (
        <ReportRow
          today={today}
          sky={m.skyQ.data}
          entries={m.collectionQ.data.entries}
          onOpen={() => navigate(REPORT_PATH)}
        />
      ) : loadFailed(m.skyQ) || loadFailed(m.collectionQ) ? null : (
        <ListRowSkeleton />
      )}
    </Card>
  );
  return frame(
    <div className="flex flex-col gap-x2 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-[var(--layout-gutter)] lg:items-start">
      <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-x2">
        <div className="order-1 lg:order-none">{hero}</div>
        <Card body="list" className="order-4 lg:order-none">
          <CollectionSection
            place="card"
            state={stateOf(m.collectionQ)}
            onRetry={() => void m.collectionQ.refetch()}
            collection={m.collectionQ.data}
            todayKey={today?.constellation.constellationKey ?? ""}
            today={today}
          />
        </Card>
      </div>
      <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-x2">
        <div className="order-2 lg:order-none">{report}</div>
        <Card className="order-3 lg:order-none">
          <MySkySection
            place="card"
            state={stateOf(m.skyQ)}
            onRetry={() => void m.skyQ.refetch()}
            sky={m.skyQ.data ?? []}
            today={today}
            entries={m.collectionQ.data?.entries ?? []}
          />
        </Card>
      </div>
    </div>,
  );
}
