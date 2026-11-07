import { loadFailed } from "@/shared/api";
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/cn";
import { Search } from "lucide-react";
import { BottomSheet, BottomSheetContent } from "@/shared/ds/bottom-sheet";
import { useInputButtonSurface } from "@/shared/ds/input-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ds/popover";
import { ScrollFog } from "@/shared/ds/scroll-fog";
import {
  focusSearchableList,
  SearchableList,
  SearchableListEmpty,
  SearchableListError,
  SearchableListInput,
  SearchableListItem,
  SearchableListResults,
  SearchableListSkeleton,
} from "@/shared/ds/searchable-list";
import type { StockMasterItem } from "../../api/stockApi";
import { useStockSearch } from "../../model/useStockMaster";

/*
 * 종목 찾기(I-13 10 · 24) — 입구는 밑줄형 검색칸 모양의 단추, 누르면 1280 미만 Bottom Sheet · 이상 Popover 의 Searchable List.
 * 결과 줄은 종목 이름 + "{코드} · {시장} · {유형}", 앞 타일도 오른쪽 라디오도 없다(고르면 상세로 가는 찾기 — selectionMark off).
 * 서버 검색은 마지막 입력 뒤 300ms 에 한 번(ds 가 기다린다). 고르면 표면을 닫고 `onPick` 이 상세 주소로 보낸다.
 */

/**
 * 입구 — Searchable List 칸 모양의 단추(밑줄형 large 40 · 앞 돋보기 24 · 글 t6).
 * 단추 자신이 Popover 트리거가 된다(`PopoverTrigger asChild`) — 감싼 div 가 트리거면 닫을 때 초점을 돌려줄 곳이 없다(검수 M8).
 * 그래서 ref 와 button 속성(aria-expanded · onClick …)을 그대로 받아 단추에 건다.
 */
const SearchEntryButton = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<"button"> & {
    /** 카드 머리(13-2 30) — 입구 폭은 둘러싼 상자가 정하고, 1280 이상은 medium 34 · 글 t5 · 돋보기 20 */
    compact?: boolean;
  }
>(({ compact, className, ...props }, ref) => {
  const { t } = useTranslation("stocks");
  return (
    <button
      ref={ref}
      type="button"
      aria-haspopup="dialog"
      aria-label={t("search.label")}
      {...props}
      // 트리거가 넘기는 data-slot(popover-trigger)에 덮이지 않게 펼친 뒤에 둔다 — 폭과 상관없이 같은 이름
      data-slot="stock-search-entry"
      className={cn(
        compact
          ? "flex min-h-[40px] w-full cursor-pointer items-center gap-x2_5 py-x2 text-t6 text-fg-placeholder shadow-[inset_0_-1px_0_0_var(--color-stroke-neutral-weak)] lg:min-h-[34px] lg:gap-x2 lg:py-x1_5 lg:text-t5"
          : "flex min-h-[40px] w-full cursor-pointer items-center gap-x2_5 py-x2 text-t6 text-fg-placeholder shadow-[inset_0_-1px_0_0_var(--color-stroke-neutral-weak)]",
        className,
      )}
    >
      <Search
        aria-hidden
        className={compact ? "size-6 shrink-0 lg:size-5" : "size-6 shrink-0"}
      />
      <span className="min-w-0 truncate text-start">
        {t("search.placeholder")}
      </span>
    </button>
  );
});
SearchEntryButton.displayName = "SearchEntryButton";

export function StockSearchEntry({
  onPick,
  className,
  compact,
}: {
  onPick: (item: StockMasterItem) => void;
  className?: string;
  /** 종목 카드 머리의 입구(13-2 30) — 팝오버는 입구 오른쪽 끝에 맞춘다 */
  compact?: boolean;
}) {
  const { t } = useTranslation("stocks");
  const surface = useInputButtonSurface();
  const entryRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const body: ReactNode = open ? (
    <SearchBody
      onPick={(item) => {
        setOpen(false);
        onPick(item);
      }}
    />
  ) : null;
  return surface === "sheet" ? (
    <BottomSheet open={open} onOpenChange={setOpen}>
      <div className={className}>
        <SearchEntryButton
          ref={entryRef}
          compact={compact}
          aria-expanded={open}
          onClick={() => setOpen(true)}
        />
      </div>
      <BottomSheetContent
        title={t("search.label")}
        onOpenAutoFocus={focusSearchableList}
        // 닫으면 초점은 입구로(B3 3A) — 시트에는 트리거가 없어 Radix 가 돌려줄 곳을 모른다
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          entryRef.current?.focus({ preventScroll: true });
        }}
      >
        <div className="flex min-h-0 flex-1 flex-col">{body}</div>
      </BottomSheetContent>
    </BottomSheet>
  ) : (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={className}>
        <PopoverTrigger asChild>
          <SearchEntryButton compact={compact} />
        </PopoverTrigger>
      </div>
      <PopoverContent
        aria-label={t("search.label")}
        align={compact ? "end" : "start"}
        // 찾기 Popover 는 최대 폭 480(I-13 24 · popover.yaml 최대) — ds 폭 prop 은 없어 className 으로 준다(최대 480 이 상한이다)
        className="w-[480px]"
        onOpenAutoFocus={focusSearchableList}
      >
        <div className="flex min-h-0 flex-1 flex-col">{body}</div>
      </PopoverContent>
    </Popover>
  );
}

function SearchBody({ onPick }: { onPick: (item: StockMasterItem) => void }) {
  const { t } = useTranslation("stocks");
  const [typed, setTyped] = useState("");
  const [keyword, setKeyword] = useState("");
  const q = useStockSearch(keyword.trim(), 20);
  const asked = typed.trim().length > 0;
  // 받는 동안은 옛 결과를 그대로 둔다 — 첫 글자 뒤 300ms(질의가 아직 안 나간 때)에 "결과 없음" 이 비치지 않게(검수 M2)
  const [kept, setKept] = useState<StockMasterItem[]>([]);
  if (q.data && q.data !== kept) setKept(q.data);
  const results = q.data ?? kept;
  // 입력과 검색어가 갈리거나(기다리는 300ms) 질의가 도는 중이면 "받는 중" 이다
  const pending = typed.trim() !== keyword.trim() || q.isFetching;
  // 받는 중이 1초를 넘으면 옛 결과 대신 Skeleton — 1초를 센 입력값을 기억하고, 입력이 바뀌면 다시 센다
  const [slowFor, setSlowFor] = useState<string | null>(null);
  useEffect(() => {
    if (!asked || !pending) return;
    const id = window.setTimeout(() => setSlowFor(typed), 1000);
    return () => window.clearTimeout(id);
  }, [asked, pending, typed]);
  const slow = pending && slowFor === typed;
  return (
    <SearchableList
      selectionMark="off"
      query={typed}
      onQueryChange={setTyped}
      onSearch={setKeyword}
      onValueChange={(v) => {
        const hit = results.find((s) => `${s.marketCode}:${s.symbol}` === v);
        if (hit) onPick(hit);
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <SearchableListInput placeholder={t("search.placeholder")} />
      {!asked ? (
        <p className="m-0 px-x6 pt-x4 text-t4 text-fg-neutral-subtle">
          {t("search.hint")}
        </p>
      ) : (
        <ScrollFog use="overlayBody" className="min-h-0 flex-1">
          {loadFailed(q) && !pending ? (
            <SearchableListError
              title={t("search.failTitle")}
              retrying={q.isFetching}
              onRetry={() => void q.refetch()}
            />
          ) : pending && (slow || results.length === 0) ? (
            <SearchableListSkeleton />
          ) : results.length === 0 ? (
            <SearchableListEmpty />
          ) : (
            <SearchableListResults aria-label={t("search.label")}>
              {results.map((s) => (
                <SearchableListItem
                  key={`${s.marketCode}:${s.symbol}`}
                  value={`${s.marketCode}:${s.symbol}`}
                  title={s.nameKr}
                  detail={`${s.symbol} · ${t(`market.${s.marketCode}`, { defaultValue: s.marketCode })} · ${t(`securityType.${s.securityType}`, { defaultValue: s.securityType })}`}
                />
              ))}
            </SearchableListResults>
          )}
        </ScrollFog>
      )}
    </SearchableList>
  );
}
