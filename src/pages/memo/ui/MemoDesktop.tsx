import { useTranslation } from "react-i18next";
import { Pin, Plus, Search, SearchX, StickyNote, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Spinner } from "@/shared/ui/spinner";
import { ResultSection } from "@/shared/ds/result-section";
import { Skeleton as SkeletonBase } from "@/shared/ui/skeleton";
import { MANAGER_LAYOUT } from "@/shared/ui/groo/manager-layout";
import { PageHead } from "@/shared/ui/groo/page-head";
import type { Memo } from "@/entities/memo";
import { NO_TAG_KEY } from "../lib/memo-tags";
import { formatMemoStamp } from "../lib/memo-view";
import type { MemoScreen } from "../model/use-memo-screen";

// 데스크톱 · 태블릿 갈래 — 15-1 은 동작 변화 0 으로 옮기기만 한다(카드 격자 · 검색 · 칩 줄은 그대로).
// 카드 격자 · 왼쪽 태그 칸은 15-2 가 다시 짠다(I-15 4 · 15 ~ 19). 상세 · 폼 · 삭제 확인은 15-1 의 새 부품을 쓴다.

type MemoTone = {
  key: string;
  baseHex: string;
  cssVar: string;
};

const MEMO_TONES: MemoTone[] = [
  {
    key: "blue",
    baseHex: "#2c70bf",
    cssVar: "--color-chart-blue",
  },
  {
    key: "green",
    baseHex: "#2d8060",
    cssVar: "--color-chart-green",
  },
  {
    key: "pink",
    baseHex: "#b83b7a",
    cssVar: "--color-chart-pink",
  },
  {
    key: "violet",
    baseHex: "#8b4dba",
    cssVar: "--color-chart-violet",
  },
  {
    key: "red",
    baseHex: "#c73838",
    cssVar: "--color-chart-red",
  },
  {
    key: "orange",
    baseHex: "#b36418",
    cssVar: "--color-chart-orange",
  },
  {
    key: "indigo",
    baseHex: "#5e60c8",
    cssVar: "--color-chart-indigo",
  },
  {
    key: "yellow",
    baseHex: "#8c7400",
    cssVar: "--color-chart-yellow",
  },
  {
    key: "brown",
    baseHex: "#9a6536",
    cssVar: "--color-chart-brown",
  },
  {
    key: "gray",
    baseHex: "#6b7484",
    cssVar: "--color-chart-gray",
  },
];

const TONE_BY_HEX = new Map(
  MEMO_TONES.map((t) => [t.baseHex.toLowerCase(), t]),
);

type ResolvedTone = { swatch: string; bg: string; fg: string };

/** base hex → { swatch, bg, fg }. null/미지정/미정의 hex 는 blue fallback. */
function resolveTone(color: string | null | undefined): ResolvedTone {
  const tone =
    (color && TONE_BY_HEX.get(color.toLowerCase())) || MEMO_TONES[0]!;
  const v = `var(${tone.cssVar})`;
  return {
    swatch: v,
    // v111 짝 — 옅은 바탕 chart-{hue}-subtle · 글 chart-{hue}-contrast(라이트/다크 불투명 한 값)
    bg: `var(${tone.cssVar}-subtle)`,
    fg: `var(${tone.cssVar}-contrast)`,
  };
}

function SectionLabel({
  icon,
  label,
}: {
  icon: "pin" | "note";
  label: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        fontWeight: "700",
        color: "var(--fg-tertiary)",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        marginBottom: 4,
      }}
    >
      {icon === "pin" ? <Pin size={12} /> : <StickyNote size={12} />}
      {label}
    </div>
  );
}

function MemoSearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation("memo");
  return (
    <div style={MANAGER_LAYOUT.searchWrapStyle}>
      <Search size={14} style={MANAGER_LAYOUT.searchIconStyle} />
      <Input
        search
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("search")}
        aria-label={t("search")}
        className="w-full min-w-0 pl-9 pr-8"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("clearSearch")}
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: 0,
            background: "transparent",
            color: "var(--fg-tertiary)",
            cursor: "pointer",
            padding: 2,
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function MemoCard({ m, screen }: { m: Memo; screen: MemoScreen }) {
  const { t } = useTranslation("memo");
  const tone = resolveTone(m.color);
  const tag = m.tag || t("noTag");
  return (
    <Card
      key={m.rowId}
      onClick={() => screen.setViewing(m)}
      className="group/memo cursor-pointer transition-[transform,box-shadow] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-out)] hover:-translate-y-[2px] hover:shadow-[var(--shadow-md)]"
      style={{
        background: tone.bg,
        // 앱 그리드(mainAxisExtent 168)와 동일한 고정 높이 — 카드 높이 균일.
        height: 168,
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: tone.swatch,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: "var(--text-badge)",
            fontWeight: "600",
            color: tone.fg,
            letterSpacing: "0.02em",
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {tag}
        </span>
        {/* 핀 마크는 고정 메모에만 — 비고정 카드 노이즈 제거 (고정 설정은 편집 다이얼로그). */}
        {m.isPinned && (
          <button
            type="button"
            aria-label={t("unpin")}
            disabled={screen.pinPending.has(m.rowId)}
            aria-busy={screen.pinPending.has(m.rowId) || undefined}
            onClick={(ev) => {
              ev.stopPropagation();
              void screen.pinOf(m);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 4,
              border: 0,
              background: "transparent",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {screen.pinPending.has(m.rowId) ? (
              <Spinner size="sm" />
            ) : (
              <Pin size={13} strokeWidth={2.5} style={{ color: tone.swatch }} />
            )}
          </button>
        )}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: "700",
          color: "var(--fg-primary)",
          letterSpacing: "-0.015em",
          lineHeight: 1.3,
          // 앱(maxLines 1)과 동일 — 제목 1줄 ellipsis.
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {m.title || t("untitled")}
      </div>
      {m.content && (
        <div
          style={{
            fontSize: 12.5,
            color: "var(--fg-secondary)",
            lineHeight: 1.45,
            whiteSpace: "pre-wrap",
            display: "-webkit-box",
            // 고정 높이 168 안에서 깔끔히 떨어지는 3줄 (앱 렌더링과 동일 분량).
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            flex: 1,
            minHeight: 0,
          }}
        >
          {m.content}
        </div>
      )}
      <div
        style={{
          fontSize: 11,
          color: "var(--fg-tertiary)",
          marginTop: "auto",
        }}
      >
        {formatMemoStamp(m.modifyAt)}
      </div>
    </Card>
  );
}

/** 메모 카드 1장 skeleton — 톤 dot + 태그 + 제목 + 본문 라인 (실카드 168 고정 높이 동일). */
function MemoCardSkeleton() {
  return (
    <Card
      style={{
        height: 168,
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <SkeletonBase className="h-2 w-2 rounded-full" />
        <SkeletonBase className="h-3 w-12" />
      </div>
      <SkeletonBase className="h-4 w-4/5" />
      <SkeletonBase className="h-3.5 w-full" />
      <SkeletonBase className="h-3.5 w-11/12" />
      <SkeletonBase className="h-3.5 w-2/3" />
      <SkeletonBase className="h-3 w-20 mt-auto" />
    </Card>
  );
}

export function MemoDesktop({ screen }: { screen: MemoScreen }) {
  const { t } = useTranslation("memo");
  const { t: tc } = useTranslation("common");
  const { memos, query, tagFilter, chips, pinned, others, filtered } = screen;

  const grid = (items: Memo[]) => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: 12,
      }}
    >
      {items.map((m) => (
        <MemoCard key={m.rowId} m={m} screen={screen} />
      ))}
    </div>
  );

  const tagChips = (
    <Tabs
      value={tagFilter}
      onValueChange={(v) => v && screen.setTagFilter(v)}
      style={{ display: "flex", flexWrap: "wrap" }}
    >
      <TabsList variant="pills" size="sm" style={{ flexWrap: "wrap", gap: 6 }}>
        <TabsTrigger variant="pills" size="sm" value="all">
          {t("all")}
          <span style={{ marginLeft: 2 }}>{memos.length}</span>
        </TabsTrigger>
        {chips.map((c) => (
          <TabsTrigger key={c.key} variant="pills" size="sm" value={c.key}>
            {c.key === NO_TAG_KEY ? t("noTag") : c.key}
            <span style={{ marginLeft: 2 }}>{c.count}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );

  let content;
  if (screen.failed) {
    content = (
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
  } else if (screen.loading) {
    content = (
      <div
        aria-busy="true"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 12,
        }}
      >
        {Array.from({ length: 6 }, (_, i) => (
          <MemoCardSkeleton key={i} />
        ))}
      </div>
    );
  } else if (filtered.length === 0) {
    content = query ? (
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
    content = (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {pinned.length > 0 && (
          <section>
            <SectionLabel icon="pin" label={`${t("pin")} · ${pinned.length}`} />
            {grid(pinned)}
          </section>
        )}
        {others.length > 0 && (
          <section>
            {pinned.length > 0 && (
              <SectionLabel
                icon="note"
                label={`${t("allMemosSection")} · ${others.length}`}
              />
            )}
            {grid(others)}
          </section>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: 0 }}>
      <PageHead
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button size="sm" onClick={() => screen.openEditor({ _new: true })}>
            <Plus size={14} /> {t("newMemo")}
          </Button>
        }
        style={{ padding: "20px 32px 12px", margin: 0, maxWidth: 1320 }}
      />
      <div
        style={{
          padding: "0 32px 24px",
          maxWidth: 1320,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "420px 1fr",
            gap: 16,
            alignItems: "center",
          }}
        >
          <MemoSearchBar value={query} onChange={screen.setQuery} />
          {tagChips}
        </div>
        {content}
      </div>
    </div>
  );
}
