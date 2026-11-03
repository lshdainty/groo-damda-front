import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  SearchX,
  StickyNote,
  Trash2,
} from "lucide-react";
import { ChipRadio, ChipRadioGroup } from "@/shared/ds/chip";
import { FloatingActionButton } from "@/shared/ds/floating-action-button";
import { Input } from "@/shared/ds/input";
import { List, ListHeader } from "@/shared/ds/list";
import { ResultSection } from "@/shared/ds/result-section";
import { Skeleton } from "@/shared/ds/skeleton";
import { SwipeActions } from "@/shared/ds/swipe-actions";
import {
  TopNavigation,
  TopNavigationBackButton,
  TopNavigationTitle,
} from "@/shared/ds/top-navigation";
import { cn } from "@/shared/lib/cn";
import type { Memo } from "@/entities/memo";
import { NO_TAG_KEY } from "../lib/memo-tags";
import type { MemoScreen } from "../model/use-memo-screen";
import { MemoDeleteConfirm } from "./MemoDeleteConfirm";
import { MemoRow } from "./MemoRow";

/** 첫 진입 — 점 8 · 제목 · 본문 · 메타 세 줄 높이의 줄 자리(실제 줄과 같은 좌우 24 · 위아래 12) */
function MemoRowSkeleton() {
  return (
    <div className="flex items-start gap-x3 px-global-gutter py-x3">
      <Skeleton className="mt-[7px] size-[8px] shrink-0" radius="full" />
      <div className="flex min-w-0 flex-1 flex-col gap-x0_5">
        <Skeleton text="t5" className="w-3/5" />
        <Skeleton text="t4" className="w-4/5" />
        <Skeleton text="t3" className="w-2/5" />
      </div>
    </div>
  );
}

/**
 * 메모 폰 화면(I-15 5 ~ 12) — 흰 면 하나: 상단 바(← "메모") → 밑줄형 검색칸 → 태그 칩 줄(가로로 밀림) →
 * "고정 · N" + 줄 → "모든 메모 · N" + 줄 → 떠 있는 [+](메모 추가). 띠 · 카드 · 줄 사이 선이 없고 흰 면이 화면 아래 끝까지 닿는다.
 * 줄을 밀면 [고정 / 고정 해제, 수정, 삭제] — 줄 끝 ⋮ 는 두지 않는다(좁은 목록 줄 — 10-25).
 */
export function MemoMobile({ screen }: { screen: MemoScreen }) {
  const { t } = useTranslation("memo");
  const { t: tc } = useTranslation("common");
  const [askDelete, setAskDelete] = useState<Memo | null>(null);
  const {
    memos,
    query,
    setQuery,
    tagFilter,
    setTagFilter,
    chips,
    pinned,
    others,
    filtered,
    loading,
    failed,
  } = screen;

  const count = (n: number, on: boolean) => (
    <span
      className={cn(
        "ml-x1 tabular-nums",
        on ? "text-fg-neutral-inverted" : "text-fg-neutral-subtle",
      )}
    >
      {n}
    </span>
  );

  const rows = (items: Memo[]) =>
    items.map((m) => (
      <SwipeActions
        key={m.rowId}
        rowLabel={m.title || t("untitled")}
        enabled
        actions={[
          {
            label: m.isPinned ? t("swipeUnpin") : t("swipePin"),
            icon: m.isPinned ? <PinOff /> : <Pin />,
            kind: "neutral",
            onSelect: () => void screen.pinOf(m),
          },
          {
            label: tc("edit"),
            icon: <Pencil />,
            kind: "primary",
            onSelect: () => screen.openEditor(m),
          },
          {
            label: tc("delete"),
            icon: <Trash2 />,
            kind: "destructive",
            onSelect: () => setAskDelete(m),
          },
        ]}
      >
        <List>
          <MemoRow memo={m} onOpen={screen.setViewing} />
        </List>
      </SwipeActions>
    ));

  let body;
  if (failed) {
    body = (
      <ResultSection
        kind="failure"
        title={t("loadFailed")}
        description={t("loadFailedDesc")}
        primaryAction={{
          label: tc("retry"),
          onClick: () => void screen.memosQ.refetch(),
        }}
      />
    );
  } else if (loading) {
    body = (
      <div aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <MemoRowSkeleton key={i} />
        ))}
      </div>
    );
  } else if (filtered.length === 0) {
    body = query ? (
      <ResultSection
        icon={<SearchX />}
        title={t("noResults")}
        description={t("noResultsHint")}
      />
    ) : (
      <ResultSection
        icon={<StickyNote />}
        title={t("noMemos")}
        description={t("noMemosHint")}
      />
    );
  } else {
    body = (
      <>
        {pinned.length > 0 && (
          <section>
            <ListHeader as="h2">
              {t("pin")} · {pinned.length}
            </ListHeader>
            {rows(pinned)}
          </section>
        )}
        {others.length > 0 && (
          <section>
            {pinned.length > 0 && (
              <ListHeader as="h2" className="pt-x4">
                {t("allMemosSection")} · {others.length}
              </ListHeader>
            )}
            {rows(others)}
          </section>
        )}
      </>
    );
  }

  return (
    <>
      <TopNavigation type="standard">
        <TopNavigationBackButton fallbackHref="/desk/more" />
        <TopNavigationTitle>{t("title")}</TopNavigationTitle>
      </TopNavigation>
      {/* 목록이 짧아도 흰 면이 화면 아래 끝까지 닿는다 — 아래 96 은 [+] 가 마지막 줄을 가리지 않게 하는 흰 면 안 여백 */}
      <div className="relative flex-1 bg-bg-layer-default pb-[96px]">
        <div className="px-global-gutter pt-x1">
          <Input
            variant="underline"
            size="large"
            prefixIcon={<Search />}
            clearable
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            aria-label={t("search")}
          />
        </div>
        {!failed && !loading && memos.length > 0 && (
          <div className="mb-x1 mt-x3">
            <ChipRadioGroup
              layout="scroll"
              aria-label={t("tagFilter")}
              value={tagFilter}
              onValueChange={setTagFilter}
            >
              <ChipRadio value="all" variant="outlineStrong" size="small">
                {t("all")}
                {count(memos.length, tagFilter === "all")}
              </ChipRadio>
              {chips.map((c) => (
                <ChipRadio
                  key={c.key}
                  value={c.key}
                  variant="outlineStrong"
                  size="small"
                >
                  {c.key === NO_TAG_KEY ? t("noTag") : c.key}
                  {count(c.count, tagFilter === c.key)}
                </ChipRadio>
              ))}
            </ChipRadioGroup>
          </div>
        )}
        {body}
        <FloatingActionButton
          icon={<Plus />}
          aria-label={t("newMemo")}
          onClick={() => screen.openEditor({ _new: true })}
        />
      </div>
      {askDelete && (
        <MemoDeleteConfirm
          memo={askDelete}
          remove={screen.remove}
          onClose={() => setAskDelete(null)}
        />
      )}
    </>
  );
}
