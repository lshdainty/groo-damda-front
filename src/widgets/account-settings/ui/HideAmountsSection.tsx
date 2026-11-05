import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { Chip } from "@/shared/ui/chip";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { ConfirmDialog } from "@/shared/ui/groo/dialogs";
import { SnackbarAvoidOverlap } from "@/shared/ds/snackbar";
import { useCoverBottomNav } from "@/shared/ui/groo/use-cover-bottom-nav";
import { MobileBackHeader } from "@/shared/ui/groo/mobile-back-header";
import { useSettingsLeaveGuard } from "@/shared/ui/groo/settings-frame-context";
import { HideAmountsUnlockDialog } from "./HideAmountsUnlockDialog";
import {
  cardsOfPage,
  HIDE_KIND_CARDS,
  HIDE_PAGES,
  SCREEN_HIDE_CARDS,
  type HideCardKey,
  type HidePageKey,
} from "@/shared/lib/groo/hide-amounts-cards";
import {
  setHiddenCards,
  useHiddenCards,
} from "@/shared/lib/groo/hide-amounts-core";

/**
 * 금액 가리기 — 계정 > 보안 > 금액 가리기 (앱 `hide_amounts_screen.dart` 미러).
 *
 * <p>예전엔 스위치 하나가 앱 전체 금액을 덮었다. 자산은 가리고 싶어도 가계부는 봐야 하는
 * 경우가 있어서 화면(8) → 카드(37) 로 쪼갰다.
 *
 * <p>카드를 하나 만질 때마다 저장·인증하지 않는다. 고르는 동안에는 아무 일도 일어나지 않고,
 * [저장] 을 눌러야 한 번에 반영된다. 예전엔 스위치를 내릴 때마다 풀기 인증이 떠서 여러 장을
 * 조정하려면 그만큼 비밀번호를 쳐야 했다.
 *
 * <p>인증은 <b>푸는 카드가 하나라도 있을 때만</b> 받는다. 가리기만 늘리는 저장은 그대로 통과.
 */
export function HideAmountsSection({
  mobile,
  onBack,
}: {
  mobile: boolean;
  /** 뒤로 — 이 화면은 계정 > 보안에서 들어온다(눈 버튼도 여기로 직행). */
  onBack: () => void;
}) {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  // 폰 껍데기가 탭 바를 덮는 동안 탭 바는 inert — 스낵바가 바닥 [저장] 위 8 에 선다
  useCoverBottomNav(mobile);
  const saved = useHiddenCards();

  /** 고르는 중인 선택 — 저장 전까지 어디에도 반영되지 않는다. */
  const [draft, setDraft] = useState<Set<HideCardKey>>(() => new Set(saved));
  /** `null` 은 '전체' 탭(모든 카드를 한 판에). */
  const [tab, setTab] = useState<HidePageKey | null>(null);
  /** 인증을 기다리는 저장 — 인증되면 그대로 반영한다. */
  const [awaitingUnlock, setAwaitingUnlock] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // 화면 탭은 화면 카드만 다룬다 — 종류 3장은 위 별도 영역이 맡는다.
  const screenPages = useMemo(() => HIDE_PAGES.filter((p) => p !== "kind"), []);
  const tabCards = useMemo(
    () => (tab === null ? SCREEN_HIDE_CARDS : cardsOfPage(tab)),
    [tab],
  );
  const allOnThisTab = tabCards.every((c) => draft.has(c));
  const dirty =
    draft.size !== saved.size || [...draft].some((c) => !saved.has(c));

  const toggle = (card: HideCardKey) =>
    setDraft((prev) => {
      const next = new Set(prev);
      if (!next.delete(card)) next.add(card);
      return next;
    });

  // 37장을 하나씩 누르게 두지 않는다 — 지금 탭 기준으로 한 번에 켜고 끈다.
  const toggleTabAll = () =>
    setDraft((prev) => {
      const next = new Set(prev);
      for (const c of tabCards) {
        if (allOnThisTab) next.delete(c);
        else next.add(c);
      }
      return next;
    });

  const commit = () => {
    setHiddenCards(draft);
    onBack();
  };

  const save = () => {
    // 푸는 게 하나라도 있으면 본인 확인 — 가리기만 늘리는 저장은 그냥 통과한다.
    //
    // 종류 카드가 화면 카드를 덮고 있을 때 화면 카드를 끄면 그 화면의 '다른 종류' 금액만
    // 드러난다(지출을 가려 둔 채 거래 목록을 끄면 수입 행이 나온다). 드러나는 게 있으므로
    // 인증은 그대로 받는다 — 카드를 끄는 건 어느 경우든 '푸는' 의도다.
    const revealing = [...saved].some((c) => !draft.has(c));
    if (revealing) setAwaitingUnlock(true);
    else commit();
  };

  // 저장하지 않고 나가려 할 때 — 고른 내용이 날아가는 걸 알리고, 확인하면 화면을 닫는다.
  const back = () => {
    if (dirty) setConfirmDiscard(true);
    else onBack();
  };

  // 데스크톱 · 태블릿은 "‹ 계정" 을 틀이 그린다(I-16 29) — 바꾼 채 누르면 틀이 이 가드를 먼저 부르고,
  // 확인하면 틀이 가려던 곳으로 간다.
  const leaveTo = useRef<(() => void) | null>(null);
  useSettingsLeaveGuard(
    mobile
      ? null
      : (go) => {
          if (dirty) {
            leaveTo.current = go;
            setConfirmDiscard(true);
          } else go();
        },
  );

  const pageLabel = (page: HidePageKey | null) =>
    page === null ? t("hideAmounts.tabAll") : t(`hideAmounts.page.${page}`);

  // 탭 라벨에 개수를 붙인다 — tabs spec 에 badge 가 없어 별도 스타일을 만들지 않는다(앱 정합).
  const tabLabel = (page: HidePageKey | null) => {
    const cards = page === null ? SCREEN_HIDE_CARDS : cardsOfPage(page);
    const on = cards.filter((c) => draft.has(c)).length;
    return on === 0 ? pageLabel(page) : `${pageLabel(page)} ${on}`;
  };

  const selectAllButton = (
    <Button variant="ghost" size="sm" onClick={toggleTabAll}>
      {allOnThisTab ? t("hideAmounts.clearAll") : t("hideAmounts.selectAll")}
    </Button>
  );

  // 탭 — 전체 + 화면별. 개수는 지금 고른 상태를 그대로 비춘다.
  // pill 채움으로 둔다. underline 은 활성 탭 밑줄과 탭바 아래 경계선이 나란히 겹쳐
  // 선이 두 줄로 보인다(앱도 같은 이유로 pills).
  const tabs = (
    <div className="scrollbar-hide" style={{ overflowX: "auto", minWidth: 0 }}>
      <Tabs
        value={tab ?? "all"}
        onValueChange={(v) => setTab(v === "all" ? null : (v as HidePageKey))}
      >
        <TabsList variant="pills" size="sm">
          <TabsTrigger variant="pills" value="all">
            {tabLabel(null)}
          </TabsTrigger>
          {screenPages.map((page) => (
            <TabsTrigger key={page} variant="pills" value={page}>
              {tabLabel(page)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );

  const desc = (
    <div
      style={{
        fontSize: "var(--text-caption)",
        color: "var(--fg-tertiary)",
        lineHeight: 1.55,
      }}
    >
      {t("hideAmounts.sectionDesc")}
    </div>
  );

  // 카드 그리드 — 라벨이 길어 모바일 3열은 말줄임이 잦다(앱과 같은 2열).
  const cardGrid = (cards: readonly HideCardKey[], columns: number) => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: "var(--spacing-sm)",
        gridAutoRows: 46,
      }}
    >
      {cards.map((card) => (
        <Chip
          key={card}
          shape="rounded"
          fullWidth
          selected={draft.has(card)}
          onClick={() => toggle(card)}
        >
          {t(`hideAmounts.card.${card}`)}
        </Chip>
      ))}
    </div>
  );

  const grid = cardGrid(tabCards, mobile ? 2 : 3);

  /**
   * 거래 종류 — 화면 축과 다르므로 탭 줄에 끼우지 않고 맨 위 별도 영역으로 둔다.
   * 탭에 넣으면 '화면' 목록에 화면이 아닌 게 섞이고, 어느 화면에서 왔든 늘 보여야 할
   * 스위치가 탭 하나를 골라야 보이는 자리로 숨는다.
   */
  const kindSection = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-sm)",
      }}
    >
      <div
        style={{
          fontSize: "var(--text-label-sm)",
          fontWeight: 600,
          color: "var(--fg-secondary)",
          letterSpacing: "-0.01em",
        }}
      >
        {t("hideAmounts.kindLabel")}
      </div>
      {cardGrid(HIDE_KIND_CARDS, 3)}
      <div
        style={{
          fontSize: "var(--text-caption)",
          color: "var(--fg-tertiary)",
          lineHeight: 1.55,
        }}
      >
        {t("hideAmounts.kindNote")}
      </div>
      <div
        style={{
          height: 1,
          background: "var(--border-subtle)",
          marginTop: "var(--spacing-xs)",
        }}
      />
    </div>
  );

  const dialogs = (
    <>
      <HideAmountsUnlockDialog
        open={awaitingUnlock}
        onOpenChange={(o) => {
          if (!o) setAwaitingUnlock(false);
        }}
        onVerified={() => {
          setAwaitingUnlock(false);
          commit();
        }}
      />
      {confirmDiscard && (
        <ConfirmDialog
          title={t("hideAmounts.discardTitle")}
          message={t("hideAmounts.discardBody")}
          confirmLabel={t("hideAmounts.discardConfirm")}
          danger
          onCancel={() => {
            leaveTo.current = null;
            setConfirmDiscard(false);
          }}
          onConfirm={() => {
            const go = leaveTo.current ?? onBack;
            leaveTo.current = null;
            setConfirmDiscard(false);
            go();
          }}
        />
      )}
    </>
  );

  if (mobile) {
    // 앱 화면 정합 — AppBar(뒤로 + 모두 선택) / 탭 / 안내 / 스크롤되는 그리드 / 아래 고정 [저장].
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: "var(--z-modal)",
          background: "var(--bg-surface)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <MobileBackHeader
          title={t("hideAmounts.label")}
          onBack={back}
          trailing={selectAllButton}
        />
        <div
          style={{
            // 모바일 페이지 좌우 인셋 24 — 앱 hide_amounts_screen 정합(QA #164).
            padding: "12px 24px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-md)",
            flexShrink: 0,
          }}
        >
          {kindSection}
          {tabs}
          {desc}
        </div>
        <div
          className="scrollbar-hide"
          style={{
            flex: 1,
            overflowY: "auto",
            minHeight: 0,
            padding: "0 24px 24px",
          }}
        >
          {grid}
        </div>
        {/* 저장 — 화면 아래 고정. 고르는 동안에는 아무것도 반영되지 않으므로 여기까지 와야 끝난다. */}
        <SnackbarAvoidOverlap>
          <div
            style={{
              padding: "12px 24px",
              paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
              flexShrink: 0,
            }}
          >
            <Button
              size="lg"
              className="w-full"
              disabled={!dirty}
              onClick={save}
            >
              {tc("save")}
            </Button>
          </div>
        </SnackbarAvoidOverlap>
        {dialogs}
      </div>
    );
  }

  // 데스크톱 — 설정 우측 패널. 돌아가는 길 "‹ 계정" 과 제목 줄은 틀이 그린다(I-16 29).
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-lg)",
      }}
    >
      {kindSection}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--spacing-md)",
        }}
      >
        {tabs}
        <div style={{ marginLeft: "auto", flexShrink: 0 }}>
          {selectAllButton}
        </div>
      </div>
      {desc}
      {grid}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button disabled={!dirty} onClick={save}>
          {tc("save")}
        </Button>
      </div>
      {dialogs}
    </div>
  );
}
