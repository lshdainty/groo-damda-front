import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Plus, Search, SearchX, StickyNote } from "lucide-react";
import { Button } from "@/shared/ds/button";
import { Card } from "@/shared/ds/card";
import { Input } from "@/shared/ds/input";
import { List, ListButtonItem, ListHeader } from "@/shared/ds/list";
import { useWideSurface } from "@/shared/ds/overlay";
import { ResultSection } from "@/shared/ds/result-section";
import { cn } from "@/shared/lib/cn";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import { PageHead } from "@/shared/ui/groo/page-head";
import { useStickyFit } from "@/pages/todo/ui/desktop/use-sticky-fit";
import { NO_TAG_KEY } from "../lib/memo-tags";
import type { MemoScreen } from "../model/use-memo-screen";
import { MemoRow, MemoRowSkeleton } from "./MemoRow";
import { MemoTagChips } from "./MemoTagChips";

const MEMO_TAGS_PATH = "/desk/settings?section=memo-tags";

/** 검색칸 — 밑줄형 large 40(폰과 같은 부품) */
function SearchField({ screen }: { screen: MemoScreen }) {
  const { t } = useTranslation("memo");
  return (
    <Input
      variant="underline"
      size="large"
      prefixIcon={<Search />}
      clearable
      value={screen.query}
      onChange={(e) => screen.setQuery(e.target.value)}
      placeholder={t("search")}
      aria-label={t("search")}
    />
  );
}

/**
 * 목록 본문 — "고정 · N" · "모든 메모 · N" 묶음과 줄(본문은 두 줄). 불러오는 동안 줄 자리 Skeleton, 실패 · 0건 · 검색 0건은
 * 카드 안 Result Section(medium). 줄을 누르면 상세 — 줄 끝 ⋮ · 밀기는 두지 않는다(고정 · 수정 · 삭제는 상세 머리 ⋮ 와 폼이 맡는다).
 */
function MemoSections({ screen }: { screen: MemoScreen }) {
  const { t } = useTranslation("memo");
  const { t: tc } = useTranslation("common");
  const { pinned, others, filtered, loading, failed, query } = screen;
  if (failed)
    return (
      <ResultSection
        kind="failure"
        size="medium"
        title={t("loadFailed")}
        description={t("loadFailedDesc")}
        primaryAction={{
          label: tc("retry"),
          onClick: () => void screen.memosQ.refetch(),
        }}
      />
    );
  if (loading)
    return (
      <div aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <MemoRowSkeleton key={i} />
        ))}
      </div>
    );
  if (filtered.length === 0)
    return query ? (
      <ResultSection
        size="medium"
        icon={<SearchX />}
        title={t("noResults")}
        description={t("noResultsHint")}
      />
    ) : (
      <ResultSection
        size="medium"
        icon={<StickyNote />}
        title={t("noMemos")}
        description={t("noMemosHint")}
      />
    );
  return (
    <>
      {pinned.length > 0 && (
        <section>
          <ListHeader as="h2">
            {t("pin")} · {pinned.length}
          </ListHeader>
          <List>
            {pinned.map((m) => (
              <MemoRow
                key={m.rowId}
                memo={m}
                bodyLines={2}
                onOpen={screen.setViewing}
              />
            ))}
          </List>
        </section>
      )}
      {others.length > 0 && (
        <section>
          {pinned.length > 0 && (
            <ListHeader as="h2" className="pt-x4">
              {t("allMemosSection")} · {others.length}
            </ListHeader>
          )}
          <List>
            {others.map((m) => (
              <MemoRow
                key={m.rowId}
                memo={m}
                bodyLines={2}
                onOpen={screen.setViewing}
              />
            ))}
          </List>
        </section>
      )}
    </>
  );
}

/** 1280 이상 왼쪽 칸의 태그 줄 — 하나 고르기(`role="radio"`), 고른 줄은 강조 바탕 + 이름 700. 칩 줄과 같은 상태 하나 */
function TagRail({ screen }: { screen: MemoScreen }) {
  const { t } = useTranslation("memo");
  const { tagFilter, setTagFilter, chips, memos, tagColors } = screen;
  const rows = [
    { key: "all", label: t("all"), count: memos.length, dot: undefined },
    ...chips.map((c) => ({
      key: c.key,
      label: c.key === NO_TAG_KEY ? t("noTag") : c.key,
      count: c.count,
      dot:
        c.key === NO_TAG_KEY
          ? "var(--color-chart-gray)"
          : getPaletteByColor(tagColors.get(c.key)).color,
    })),
  ];
  return (
    <List role="radiogroup" aria-label={t("tagFilter")}>
      {rows.map((r) => {
        const on = tagFilter === r.key;
        return (
          <ListButtonItem
            key={r.key}
            role="radio"
            aria-checked={on}
            highlighted={on}
            onClick={() => setTagFilter(r.key)}
            prefix={
              r.dot ? (
                <span
                  aria-hidden
                  className="block size-[8px] rounded-full"
                  style={{ background: r.dot }}
                />
              ) : undefined
            }
            title={<span className={cn(on && "font-bold")}>{r.label}</span>}
            suffix={
              <span className="tabular-nums text-t4 text-fg-neutral-subtle">
                {r.count}
              </span>
            }
          />
        );
      })}
    </List>
  );
}

/**
 * 메모 넓은 화면(I-15 15 ~ 19, 2-B) — 제목 줄(h1 "메모" + 설명 + [메모 추가]) 아래 24, 좌우 여백 32, 본문 폭은 768 ~ 1279 최대 720 ·
 * 1280 이상 최대 1040 가운데. 1280 이상: 왼쪽 336 카드(검색칸 · "태그" + "관리" · 태그 줄, 스크롤해도 붙는다) + 사이 24 + 오른쪽 목록 카드.
 * 768 ~ 1279: 한 카드 안 검색칸 → 칩 줄 → 묶음 · 줄 — 폰과 같은 부품 · 같은 상태라 1280 을 넘나들어도 고른 태그 · 검색어가 남는다.
 * 목록과 상세를 나란히 두지 않는다 — 줄을 누르면 상세(1280 이상 대화상자 · 미만 시트).
 */
export function MemoDesktop({ screen }: { screen: MemoScreen }) {
  const { t } = useTranslation("memo");
  const wide = useWideSurface();
  const navigate = useNavigate();
  const { ref: leftRef, sticky } = useStickyFit(wide);
  const showFilters =
    !screen.failed && !screen.loading && screen.memos.length > 0;

  return (
    <div
      data-slot="memo-desktop"
      className="px-[var(--layout-margin)] pb-screen-bottom pt-nav-to-title"
    >
      <div className="mx-auto w-full max-w-[var(--layout-max-low)] lg:max-w-[var(--layout-max-medium)]">
        <PageHead
          title={t("title")}
          description={t("subtitle")}
          actions={
            <Button
              variant="neutralOutline"
              size="small"
              onClick={() => screen.openEditor({ _new: true })}
            >
              <Plus />
              {t("newMemo")}
            </Button>
          }
          style={{ marginBottom: "var(--spacing-x6)" }}
        />
        {wide ? (
          <div className="grid grid-cols-[336px_minmax(0,1fr)] items-start gap-x-x6">
            <div
              ref={leftRef}
              data-slot="memo-left"
              className={cn("min-w-0", sticky && "sticky top-x5")}
            >
              <Card body="list">
                <div className="px-global-gutter pb-x2 pt-x1">
                  <SearchField screen={screen} />
                </div>
                {showFilters && (
                  <>
                    <ListHeader as="div">
                      <h2 className="m-0 font-[inherit] text-[length:inherit]">
                        {t("tagsHeading")}
                      </h2>
                      <Button
                        variant="ghost"
                        ghostColor="neutralMuted"
                        size="small"
                        onClick={() => navigate(MEMO_TAGS_PATH)}
                      >
                        {t("tagsManage")}
                      </Button>
                    </ListHeader>
                    <TagRail screen={screen} />
                  </>
                )}
              </Card>
            </div>
            <Card body="list" className="min-w-0">
              <MemoSections screen={screen} />
            </Card>
          </div>
        ) : (
          <Card body="list">
            <div className="px-global-gutter pb-x1 pt-x3">
              <SearchField screen={screen} />
            </div>
            {showFilters && (
              <div className="mb-x1 mt-x3">
                <MemoTagChips screen={screen} />
              </div>
            )}
            <MemoSections screen={screen} />
          </Card>
        )}
      </div>
    </div>
  );
}
