import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import { Button } from "@/shared/ds/button";
import { Card } from "@/shared/ds/card";
import {
  HelpBubble,
  HelpBubbleContent,
  HelpBubbleTrigger,
} from "@/shared/ds/help-bubble";
import { ListCheckGroup, ListCheckItem, ListHeader } from "@/shared/ds/list";
import { SnackbarAvoidOverlap } from "@/shared/ds/snackbar";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ds/tabs";
import {
  TopNavigation,
  TopNavigationBackButton,
  TopNavigationTitle,
} from "@/shared/ds/top-navigation";
import { AlertConfirm } from "@/shared/ui/groo/alert-confirm";
import { ManagerHead } from "@/shared/ui/groo/manager-layout";
import { useCoverBottomNav } from "@/shared/ui/groo/use-cover-bottom-nav";
import { useSettingsLeaveGuard } from "@/shared/ui/groo/settings-frame-context";
import { HideAmountsUnlockSurface } from "./HideAmountsUnlockSurface";
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
 * 금액 가리기 — 계정 > 보안 > 금액 가리기 (앱 `hide_amounts_screen.dart` 미러). I-14 14-3 · 5-B List 체크 줄.
 *
 * <p>예전엔 스위치 하나가 앱 전체 금액을 덮었다. 자산은 가리고 싶어도 가계부는 봐야 하는
 * 경우가 있어서 화면(8) → 카드(37) 로 쪼갰다.
 *
 * <p>카드를 하나 만질 때마다 저장·인증하지 않는다. 고르는 동안에는 아무 일도 일어나지 않고,
 * [저장] 을 눌러야 한 번에 반영된다. 예전엔 스위치를 내릴 때마다 풀기 인증이 떠서 여러 장을
 * 조정하려면 그만큼 비밀번호를 쳐야 했다.
 *
 * <p>인증은 <b>푸는 카드가 하나라도 있을 때만</b> 받는다. 가리기만 늘리는 저장은 그대로 통과.
 *
 * <p>모양: 폰은 흰 면 하나(소개 → 거래 종류 → 탭 → 가릴 화면 → 체크 줄) + 바닥 [저장] 띠,
 * 데스크톱 · 태블릿은 제목 줄 + 카드 하나 + 카드 바닥 [저장]. 줄 사이 선은 두지 않는다 —
 * 묶음은 목록 제목 + 여백으로 가르고 탭 줄만 끝까지 닿는 선을 갖는다(24 들인 선은 없다).
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
  const uid = useId();
  // 폰 껍데기가 탭 바를 덮는 동안 탭 바는 inert — 스낵바가 바닥 [저장] 위 8 에 선다
  useCoverBottomNav(mobile);
  const saved = useHiddenCards();

  /** 고르는 중인 선택 — 저장 전까지 어디에도 반영되지 않는다. */
  const [draft, setDraft] = useState<Set<HideCardKey>>(() => new Set(saved));
  /** `null` 은 '전체' 탭(모든 화면 카드를 화면 이름으로 묶어서). */
  const [tab, setTab] = useState<HidePageKey | null>(null);
  /** 인증을 기다리는 저장 — 인증되면 그대로 반영한다. */
  const [awaitingUnlock, setAwaitingUnlock] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // 화면 탭은 화면 카드만 다룬다 — 종류 3장은 위 별도 영역이 맡는다.
  const screenPages = HIDE_PAGES.filter((p) => p !== "kind");
  const tabCards = tab === null ? SCREEN_HIDE_CARDS : cardsOfPage(tab);
  const onCount = tabCards.filter((c) => draft.has(c)).length;
  const allOnThisTab = onCount === tabCards.length;
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

  const pageLabel = (page: HidePageKey) => t(`hideAmounts.page.${page}`);

  const checkRows = (cards: readonly HideCardKey[]) =>
    cards.map((card) => (
      <ListCheckItem
        key={card}
        markPosition="suffix"
        title={t(`hideAmounts.card.${card}`)}
        checked={draft.has(card)}
        onCheckedChange={() => toggle(card)}
      />
    ));

  const kindId = `${uid}-kind`;
  const screensId = `${uid}-screens`;

  // 거래 종류 — 화면 축과 다르므로 탭 줄에 끼우지 않고 맨 위 별도 묶음으로 둔다. 제목 오른쪽 ⓘ 가 설명(Help Bubble)을 연다.
  const kindSection = (
    <>
      <ListHeader as="div" variant="boldSolid">
        <h3 id={kindId} className="m-0 text-inherit font-inherit">
          {t("hideAmounts.kindLabel")}
        </h3>
        <HelpBubble>
          <HelpBubbleTrigger asChild>
            <Button
              variant="ghost"
              ghostColor="neutralSubtle"
              size="small"
              layout="iconOnly"
              aria-label={t("hideAmounts.kindHelp")}
            >
              <Info aria-hidden />
            </Button>
          </HelpBubbleTrigger>
          <HelpBubbleContent
            title={t("hideAmounts.kindLabel")}
            description={t("hideAmounts.kindNote")}
          />
        </HelpBubble>
      </ListHeader>
      <ListCheckGroup aria-labelledby={kindId}>
        {checkRows(HIDE_KIND_CARDS)}
      </ListCheckGroup>
    </>
  );

  // 탭 — 전체 + 화면별. 이름만(개수는 아래 "가릴 화면 · n / m" 이 말한다). 넘치면 가로 스크롤(Hug).
  const tabs = (
    <div className="mt-x2">
      <Tabs
        value={tab ?? "all"}
        onValueChange={(v) => setTab(v === "all" ? null : (v as HidePageKey))}
      >
        <TabsList layout="hug" aria-label={t("hideAmounts.tabsAria")}>
          <TabsTrigger value="all">{t("hideAmounts.tabAll")}</TabsTrigger>
          {screenPages.map((page) => (
            <TabsTrigger key={page} value={page}>
              {pageLabel(page)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );

  // 가릴 화면 · n / m + 모두 선택 · 해제 — 수는 지금 탭 기준
  const screensHeader = (
    <ListHeader as="div" className="pt-x4">
      <h3 id={screensId} className="m-0 text-inherit font-inherit tabular-nums">
        {t("hideAmounts.screensCount", {
          selected: onCount,
          total: tabCards.length,
        })}
      </h3>
      <Button
        variant="ghost"
        ghostColor="neutralMuted"
        size="small"
        onClick={toggleTabAll}
      >
        {allOnThisTab ? t("hideAmounts.clearAll") : t("hideAmounts.selectAll")}
      </Button>
    </ListHeader>
  );

  // 전체 탭은 화면 이름(목록 제목)마다 묶는다. 화면 탭은 그 화면 줄만(제목은 탭 이름과 같은 말이라 두지 않는다)
  const screens =
    tab === null ? (
      screenPages.map((page, i) => (
        <div key={page}>
          <ListHeader
            as="div"
            variant="boldSolid"
            className={i === 0 ? "pt-x1" : "pt-x3"}
          >
            <h4
              id={`${uid}-p-${page}`}
              className="m-0 text-inherit font-inherit"
            >
              {pageLabel(page)}
            </h4>
          </ListHeader>
          <ListCheckGroup aria-labelledby={`${uid}-p-${page}`}>
            {checkRows(cardsOfPage(page))}
          </ListCheckGroup>
        </div>
      ))
    ) : (
      <ListCheckGroup aria-labelledby={screensId}>
        {checkRows(tabCards)}
      </ListCheckGroup>
    );

  const body = (
    <>
      {kindSection}
      {tabs}
      {screensHeader}
      {screens}
    </>
  );

  const dialogs = (
    <>
      <HideAmountsUnlockSurface
        open={awaitingUnlock}
        onOpenChange={setAwaitingUnlock}
        onVerified={commit}
      />
      {confirmDiscard && (
        <AlertConfirm
          title={t("hideAmounts.discardTitle")}
          message={t("hideAmounts.discardBody")}
          confirmLabel={t("hideAmounts.discardConfirm")}
          onConfirm={() => {
            const go = leaveTo.current ?? onBack;
            leaveTo.current = null;
            go();
          }}
          onClose={() => {
            leaveTo.current = null;
            setConfirmDiscard(false);
          }}
        />
      )}
    </>
  );

  if (mobile) {
    // 흰 면 하나 — 상단 바(← 금액 가리기) / 한 번에 스크롤(소개 → 거래 종류 → 탭 → 가릴 화면) / 바닥 [저장] 띠
    return (
      <div
        data-slot="hide-amounts-page"
        className="fixed inset-0 z-(--z-modal) flex flex-col bg-bg-layer-default"
      >
        <TopNavigation type="standard">
          <TopNavigationBackButton
            fallbackHref="/desk/settings?section=account"
            onClick={back}
          />
          <TopNavigationTitle>{t("hideAmounts.label")}</TopNavigationTitle>
        </TopNavigation>
        {/* 본문 아래 여백 = 띠 높이는 flex 가 맡는다 — 마지막 줄이 띠 위로 끝까지 스크롤된다 */}
        <div className="min-h-0 flex-1 overflow-y-auto pb-x6">
          <p className="m-0 px-global-gutter pt-x4 pb-x2 font-sans text-t4 text-fg-neutral-subtle">
            {t("hideAmounts.sectionDesc")}
          </p>
          {body}
        </div>
        {/* 저장 — 고르는 동안에는 아무것도 반영되지 않으므로 여기까지 와야 끝난다. 위 끝까지 선 · 좌우 24 · 위 12 · 아래 16 + 안전 영역 */}
        <SnackbarAvoidOverlap>
          <div className="shrink-0 border-t border-stroke-neutral-subtle px-global-gutter pt-x3 pb-[calc(var(--spacing-x4)+env(safe-area-inset-bottom))]">
            <Button
              variant="neutralSolid"
              size="large"
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

  // 데스크톱 · 태블릿 — 설정 우측 패널. 돌아가는 길 "‹ 계정" 은 틀이 그린다(I-16 29). 제목 줄 + 카드 하나 + 카드 바닥 [저장]
  return (
    <>
      <ManagerHead
        title={t("hideAmounts.label")}
        description={t("hideAmounts.sectionDesc")}
      />
      <Card body="list" className="pb-0">
        {body}
        {/* 카드 바닥 줄 — 위 끝까지 선 · 채운 단추라 오른쪽 24 · 위아래 12 */}
        <div className="mt-x3 flex justify-end border-t border-stroke-neutral-subtle px-x6 py-x3">
          <Button
            variant="neutralSolid"
            size="small"
            disabled={!dirty}
            onClick={save}
          >
            {tc("save")}
          </Button>
        </div>
      </Card>
      {dialogs}
    </>
  );
}
