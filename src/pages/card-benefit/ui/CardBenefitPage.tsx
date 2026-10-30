import { useEffect, useRef, useState, type ReactNode } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search, SearchX } from "lucide-react";
import { Card } from "@/shared/ds/card";
import { Checkbox } from "@/shared/ds/checkbox";
import { useDsText } from "@/shared/ds/i18n";
import { InfiniteListEnd } from "@/shared/ds/infinite-list";
import { Input } from "@/shared/ds/input";
import { List, ListHeader } from "@/shared/ds/list";
import { useWideSurface } from "@/shared/ds/overlay";
import { Pagination } from "@/shared/ds/pagination";
import { ResultSection } from "@/shared/ds/result-section";
import { ScrollFog } from "@/shared/ds/scroll-fog";
import { Skeleton } from "@/shared/ds/skeleton";
import {
  TopNavigation,
  TopNavigationBackButton,
  TopNavigationTitle,
} from "@/shared/ds/top-navigation";
import { PageHead } from "@/shared/ui/groo/page-head";
import {
  useCardCatalogs,
  useInfiniteCardCatalogs,
} from "@/features/card-catalog";
import type { CardType } from "@/entities/card";
import {
  DESKTOP_PAGE_SIZE,
  PHONE_PAGE_SIZE,
  formatKRW,
  type BenefitFilterKey,
  type TypeFilterKey,
} from "../model/card-format";
import { CardBenefitDetailDialog } from "./CardBenefitDetailDialog";
import { CardDetailContent } from "./CardDetailContent";
import { CardFilterBar } from "./CardFilterBar";
import { CardRow } from "./CardRow";

type OutletCtx = { onAddTx: () => void; mobile: boolean };

/**
 * 카드 혜택 (I-20 E 30 ~ 37) — 신규 API 없이 useCardCatalogs(params) 만 쓴다.
 *  - 폰(768 미만): 상단 바 + 흰 면 하나 — 밑줄 검색칸 → 거르기 칩 → "총 n장" + 단종 포함 → 카드 줄 → 끝없이 불러오기. 줄을 누르면 조회 시트.
 *  - 768 ~ 1279: 가운데 720 한 칸 — 제목 줄 · 조절 줄 · 개수 줄 · 목록 카드 + 쪽 넘김(`?page=N`). 줄을 누르면 시트.
 *  - 1280 이상: 가운데 1040 — 목록 카드 | 오른쪽 상세 패널 400. 처음 고른 카드는 그 쪽의 첫 줄.
 * 요청 실패는 전역 서버 원문 토스트 없이(silent) 그 자리 Result Section 으로 알린다.
 */

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** 불러오는 동안의 줄 — 카드 그림 56 · 세 줄 */
function RowsSkeleton({ count }: { count: number }) {
  return (
    <div aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-start gap-x4 px-global-gutter py-x3">
          <Skeleton className="aspect-[1.586] w-14 shrink-0" radius="6" />
          <div className="flex min-w-0 flex-1 flex-col gap-x0_5">
            <Skeleton text="t5" className="w-3/4" />
            <Skeleton text="t3" className="w-1/2" />
            <Skeleton text="t3" className="w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export const CardBenefitPage = () => {
  const { t } = useTranslation("card");
  const dsT = useDsText();
  const { mobile } = useOutletContext<OutletCtx>();
  const wide = useWideSurface();
  const listRef = useRef<HTMLDivElement | null>(null);
  const [params, setParams] = useSearchParams();

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilterKey>("all");
  const [benefitKey, setBenefitKey] = useState<BenefitFilterKey>("all");
  const [includeDiscontinued, setIncludeDiscontinued] = useState(false);
  // 1280 미만 조회 시트 · 1280 이상 패널이 보여 주는 카드
  const [sheetId, setSheetId] = useState<number | null>(null);
  const [pickedId, setPickedId] = useState<number | null>(null);

  // 쪽은 주소에 — ?page=N(1부터). 검색 · 조건을 바꾸면 1쪽(주소에서 page 를 지운다)
  const rawPage = Number(params.get("page"));
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
  const resetPage = () => {
    if (!params.has("page")) return;
    const next = new URLSearchParams(params);
    next.delete("page");
    setParams(next, { replace: true });
  };
  const goPage = (n: number) => {
    const next = new URLSearchParams(params);
    if (n <= 1) next.delete("page");
    else next.set("page", String(n));
    setParams(next);
  };

  const debouncedQuery = useDebounced(query.trim(), 300);
  const baseParams = {
    keyword: debouncedQuery || undefined,
    cardType: typeFilter === "all" ? undefined : (typeFilter as CardType),
    benefitType: benefitKey === "all" ? undefined : benefitKey,
    includeDiscontinued,
  };

  // 폰: 끝없이 불러오기 / 768 이상: 쪽 넘김 — 쓰는 쪽 질의만 켠다
  const pageQ = useCardCatalogs(
    { ...baseParams, page: page - 1, size: DESKTOP_PAGE_SIZE },
    { enabled: !mobile, silent: true },
  );
  const infQ = useInfiniteCardCatalogs(
    { ...baseParams, size: PHONE_PAGE_SIZE },
    { enabled: mobile, silent: true },
  );

  const cards = mobile
    ? (infQ.data?.pages.flatMap((p) => p.content) ?? [])
    : (pageQ.data?.content ?? []);
  const total = mobile
    ? (infQ.data?.pages[0]?.meta.totalElements ?? cards.length)
    : (pageQ.data?.meta.totalElements ?? cards.length);
  const isLoading = mobile ? infQ.isLoading : pageQ.isLoading;
  const failed = mobile
    ? infQ.isError && !infQ.data
    : pageQ.isError && !pageQ.data;
  const totalPages = pageQ.data?.meta.totalPages ?? 1;
  const refetch = () => void (mobile ? infQ.refetch() : pageQ.refetch());

  // 1280 으로 넓어지면 열린 시트는 닫히고 그 카드가 패널에 고른 채 보인다(상태는 여기)
  if (wide && sheetId != null) {
    setPickedId(sheetId);
    setSheetId(null);
  }
  // 패널의 카드 — 지금 쪽에 없으면(쪽을 넘김 · 조건이 바뀜) 그 쪽의 첫 줄
  const panelId =
    cards.find((c) => c.rowId === pickedId)?.rowId ?? cards[0]?.rowId ?? null;
  const openCard = (rowId: number) => {
    if (wide) setPickedId(rowId);
    else setSheetId(rowId);
  };

  const search = (
    <Input
      variant="underline"
      size="responsive"
      value={query}
      onChange={(e) => {
        setQuery(e.target.value);
        resetPage();
      }}
      placeholder={t("benefit.searchPlaceholder")}
      aria-label={t("benefit.searchPlaceholder")}
      prefixIcon={<Search />}
      clearable
      autoComplete="off"
      enterKeyHint="search"
      rootClassName={mobile ? undefined : "min-w-0 max-w-[420px] flex-1"}
    />
  );
  const filters = (
    <CardFilterBar
      type={typeFilter}
      benefit={benefitKey}
      onType={(v) => {
        setTypeFilter(v);
        resetPage();
      }}
      onBenefit={(v) => {
        setBenefitKey(v);
        resetPage();
      }}
      wide={wide}
    />
  );
  const countRow = (
    <ListHeader
      as="div"
      variant="mediumWeak"
      className={mobile ? undefined : "px-0"}
    >
      <h2
        className="m-0 font-sans text-t4 font-medium text-fg-neutral-subtle tabular-nums"
        aria-live="polite"
      >
        {isLoading ? "" : t("benefit.resultCount", { count: formatKRW(total) })}
      </h2>
      <Checkbox
        size="large"
        checked={includeDiscontinued}
        onCheckedChange={(v) => {
          setIncludeDiscontinued(v === true);
          resetPage();
        }}
        label={t("benefit.includeDiscontinued")}
      />
    </ListHeader>
  );

  let body: ReactNode;
  if (failed) {
    body = (
      <ResultSection
        size={mobile ? "large" : "medium"}
        kind="failure"
        title={t("benefit.listFailTitle")}
        description={t("benefit.failDesc")}
        primaryAction={{ label: dsT("common.retry"), onClick: refetch }}
      />
    );
  } else if (isLoading) {
    body = <RowsSkeleton count={6} />;
  } else if (cards.length === 0) {
    body = (
      <ResultSection
        size={mobile ? "large" : "medium"}
        icon={<SearchX />}
        title={t("benefit.emptyTitle")}
        description={t("benefit.emptyDesc")}
      />
    );
  } else {
    body = (
      <>
        <List aria-label={t("benefit.headerTitle")}>
          {cards.map((c) => (
            <CardRow
              key={c.rowId}
              card={c}
              picked={wide && !mobile && c.rowId === panelId}
              onClick={() => openCard(c.rowId)}
            />
          ))}
        </List>
        {mobile && (
          <InfiniteListEnd
            status={
              infQ.isFetchNextPageError
                ? "error"
                : infQ.hasNextPage
                  ? "loading"
                  : "end"
            }
            endText={t("benefit.endText")}
            onReachEnd={() => {
              if (infQ.hasNextPage && !infQ.isFetchingNextPage)
                void infQ.fetchNextPage();
            }}
            onRetry={() => void infQ.fetchNextPage()}
            className={
              !infQ.hasNextPage && (infQ.data?.pages.length ?? 0) < 2
                ? "hidden"
                : undefined
            }
          />
        )}
      </>
    );
  }

  const sheet = !wide && sheetId != null && (
    <CardBenefitDetailDialog rowId={sheetId} onClose={() => setSheetId(null)} />
  );

  // ── 폰 — 흰 면 하나 ──────────────────────────────────────────────────────
  if (mobile) {
    return (
      <>
        <TopNavigation type="standard">
          <TopNavigationBackButton fallbackHref="/desk/more" />
          <TopNavigationTitle>{t("benefit.headerTitle")}</TopNavigationTitle>
        </TopNavigation>
        <div className="flex-1 bg-bg-layer-default pb-screen-bottom">
          <div className="px-global-gutter pt-x2">{search}</div>
          <div className="px-global-gutter pt-x3">{filters}</div>
          {countRow}
          {body}
        </div>
        {sheet}
      </>
    );
  }

  // ── 768 이상 — 제목 줄 · 조절 줄 · 개수 줄 · 목록 카드 (1280 이상은 오른쪽에 패널) ──
  const listCard = (
    <div ref={listRef}>
      <Card body="list" data-slot="card-benefit-list">
        {body}
      </Card>
      {!failed && !isLoading && totalPages > 1 && (
        <Pagination
          aria-label={t("benefit.pageNav")}
          totalPages={totalPages}
          page={page}
          getHref={(n) => (n <= 1 ? "?" : `?page=${n}`)}
          onPageChange={goPage}
          scrollTarget={listRef}
          disabled={pageQ.isFetching}
        />
      )}
    </div>
  );
  return (
    <>
      <div
        data-slot="card-benefit-desktop"
        className="px-[var(--layout-margin)] pb-screen-bottom pt-nav-to-title"
      >
        <div className="mx-auto w-full max-w-[var(--layout-max-low)] lg:max-w-[var(--layout-max-medium)]">
          <PageHead
            title={t("benefit.headerTitle")}
            description={t("benefit.headerSub")}
            style={{ marginBottom: "var(--spacing-x6)" }}
          />
          <div className="flex flex-wrap items-center gap-x4 pb-x2">
            {search}
            {filters}
          </div>
          {countRow}
          {wide ? (
            <div className="grid grid-cols-[minmax(0,1fr)_400px] items-start gap-x6">
              {listCard}
              <aside
                aria-label={t("benefit.detailTitle")}
                className="sticky top-x5"
              >
                <Card className="py-x5">
                  <ScrollFog className="max-h-[calc(100dvh-var(--spacing-x14)-var(--spacing-x10))]">
                    {panelId != null ? (
                      <CardDetailContent rowId={panelId} />
                    ) : null}
                  </ScrollFog>
                </Card>
              </aside>
            </div>
          ) : (
            listCard
          )}
        </div>
      </div>
      {sheet}
    </>
  );
};
