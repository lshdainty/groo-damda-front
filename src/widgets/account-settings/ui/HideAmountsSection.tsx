import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
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
import { Callout } from "@/shared/ds/callout";
import { SnackbarAvoidOverlap, useSnackbar } from "@/shared/ds/snackbar";
import { useScrollToError } from "@/shared/hooks/useScrollToError";
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
import { useBackClose, whenBackSlotsSettled } from "@/shared/ds/overlay";
import { useLeaveGuardBypass } from "@/shared/ui/groo/leave-guard-context";
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
  onBrowserBack = onBack,
}: {
  mobile: boolean;
  /** 뒤로 — 이 화면은 계정 > 보안에서 들어온다(눈 버튼도 여기로 직행). */
  onBack: () => void;
  /**
   * 브라우저 · 안드로이드 뒤로 → [나가기] 로 떠날 때 — 앞 칸으로 되돌아간다(앞으로 push 하지 않는다, 검수 3차 L1).
   * 주지 않으면 onBack
   */
  onBrowserBack?: () => void;
}) {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const uid = useId();
  // 말풍선은 위로 연다 — 폰은 스크롤 칸 윗변이 아니라 화면(껍데기) 안에서 자리를 본다
  const [boundary, setBoundary] = useState<HTMLElement | null>(null);
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

  // 저장은 서버에 올려 성공했을 때만 반영된다 — 실패하면 화면을 닫지 않고 고른 값 그대로 둔다
  const snackbar = useSnackbar();
  const [saveFailTick, setSaveFailTick] = useState(0);
  const saveFailed = saveFailTick > 0;
  const errorRef = useScrollToError<HTMLDivElement>(saveFailed, saveFailTick);
  // 저장이 나가 있다 — 그동안은 떠나기를 묻지도 받지도 않는다(busy — 떠나면 실패 Callout 자리가 사라진다)
  const [saving, setSaving] = useState(false);
  const commit = async (viaUnlock = false) => {
    setSaveFailTick(0);
    setSaving(true);
    const ok = await setHiddenCards(draft);
    setSaving(false);
    if (ok) {
      // 화면이 스스로 떠난다 — 칸을 먼저 걷고 가드를 지나 돌아간다(검수 2차 H1 · H3)
      leave(onBack);
      return;
    }
    if (viaUnlock) {
      // 본인 확인 창이 이미 닫힌 뒤라 맨 위 Callout 이 안 보일 수 있다 — 스낵바 + [다시 시도](확인은 이미 끝났다)
      snackbar.show({
        message: t("hideAmounts.saveFailed"),
        tone: "critical",
        action: { label: tc("retry"), onClick: () => void commit(true) },
      });
    } else setSaveFailTick((n) => n + 1);
  };

  const save = () => {
    // 푸는 게 하나라도 있으면 본인 확인 — 가리기만 늘리는 저장은 그냥 통과한다.
    //
    // 종류 카드가 화면 카드를 덮고 있을 때 화면 카드를 끄면 그 화면의 '다른 종류' 금액만
    // 드러난다(지출을 가려 둔 채 거래 목록을 끄면 수입 행이 나온다). 드러나는 게 있으므로
    // 인증은 그대로 받는다 — 카드를 끄는 건 어느 경우든 '푸는' 의도다.
    const revealing = [...saved].some((c) => !draft.has(c));
    if (revealing) setAwaitingUnlock(true);
    else void commit();
  };

  // 저장하지 않고 나가려 할 때 — 고른 내용이 날아가는 걸 알리고, 확인하면 화면을 닫는다.
  const back = () => {
    if (saving) return;
    if (dirty) setConfirmDiscard(true);
    else onBack();
  };

  // 바꾼 채 떠나는 모든 길이 묻는다(단계 5) — "‹ 계정"(틀) · 설정 구역 목록 · 사이드바 · 탭 바 · 머리 링크는 셸 공용 가드를,
  // 브라우저 · 안드로이드 뒤로 가기는 dirty 동안 쌓아 둔 히스토리 칸 하나를 지난다. 확인하면 가려던 곳으로 간다.
  const leaveTo = useRef<(() => void) | null>(null);
  // 화면이 스스로 떠나는 길(저장 성공 · [나가기]) — 바뀐 값의 뒤로 칸과 확인창 칸을 먼저 걷고(되돌림이 끝난 뒤) 가드를
  // 지나 옮긴다. 그래야 [나가기] 가 다시 묻지 않고(H2), 같은 주소 칸이 남아 뒤로 가기가 헛돌지 않는다(H3 · M1)
  const [leaving, setLeaving] = useState(false);
  const pendingLeave = useRef<(() => void) | null>(null);
  const bypass = useLeaveGuardBypass();
  const leave = (go: () => void) => {
    pendingLeave.current = go;
    setConfirmDiscard(false);
    setLeaving(true);
  };
  // 효과는 leaving 만 따른다 — bypass 가 렌더마다 새 함수여도 다시 돌지 않는다(검수 3차 L2). leaving 은 되돌리지 않는다:
  // 앞으로 가는 이동(navigate(-1))은 popstate 뒤에 끝나 그 사이 가드를 다시 켜면 뒤로 칸이 다시 쌓인다(시험으로 확인)
  const leaveNow = useEffectEvent((go: () => void) => bypass(go));
  useEffect(() => {
    if (!leaving) return;
    const go = pendingLeave.current;
    pendingLeave.current = null;
    if (!go) return;
    // 화면이 내려가면 기다림을 거둔다 — 늦게 온 popstate 가 내려간 화면의 이동을 부르지 않게
    return whenBackSlotsSettled(() => leaveNow(go));
  }, [leaving]);
  const guarding = dirty && !leaving;
  useSettingsLeaveGuard(
    guarding
      ? (go) => {
          if (saving) return;
          leaveTo.current = go;
          setConfirmDiscard(true);
        }
      : null,
  );
  // 뒤로 가기 — 칸을 바로 다시 쌓고(다음 뒤로 가기도 여기로) 묻는다. [나가기] 면 계정으로 간다(앞 화면으로 되돌리지 않고 이동)
  useBackClose(guarding, (keep) => {
    keep();
    if (saving) return;
    leaveTo.current = onBrowserBack;
    setConfirmDiscard(true);
  });

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
        <h2 id={kindId} className="m-0 text-inherit [font:inherit]">
          {t("hideAmounts.kindLabel")}
        </h2>
        <HelpBubble>
          <HelpBubbleTrigger asChild>
            <Button
              variant="ghost"
              ghostColor="neutralSubtle"
              size="small"
              layout="iconOnly"
              // 보이는 아이콘 끝이 체크 끝선에 서도록 오른쪽 −10, 머리 높이는 44(HelpBubble 의 알림 자리 형제 때문에 머리 블리드가 안 걸려 직접)
              className="-my-x2 -mr-x2_5"
              aria-label={t("hideAmounts.kindHelp")}
            >
              <Info aria-hidden />
            </Button>
          </HelpBubbleTrigger>
          <HelpBubbleContent
            side="top"
            collisionBoundary={boundary}
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
      <h2
        id={screensId}
        className="m-0 text-inherit [font:inherit] tabular-nums"
      >
        {t("hideAmounts.screensCount", {
          selected: onCount,
          total: tabCards.length,
        })}
      </h2>
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
            <h3
              id={`${uid}-p-${page}`}
              className="m-0 text-inherit [font:inherit]"
            >
              {pageLabel(page)}
            </h3>
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

  // 폼 실패 Callout — 본문 맨 위(모바일은 소개 글보다 위). 앱과 같은 자리
  const failure = saveFailed && (
    <div ref={errorRef} className="px-global-gutter pt-x3">
      <Callout tone="critical" role="alert">
        {t("hideAmounts.saveFailed")}
      </Callout>
    </div>
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
        onVerified={() => void commit(true)}
      />
      {confirmDiscard && (
        <AlertConfirm
          title={t("hideAmounts.discardTitle")}
          message={t("hideAmounts.discardBody")}
          confirmLabel={t("hideAmounts.discardConfirm")}
          onConfirm={() => {
            const go = leaveTo.current ?? onBack;
            leaveTo.current = null;
            leave(go);
          }}
          // 요청이 아니라 화면을 나가는 확인이다 — 던지지 않는다
          onError={() => {}}
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
        ref={setBoundary}
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
          {failure}
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
              loading={saving}
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
        {failure}
        {body}
        {/* 카드 바닥 줄 — 위 끝까지 선 · 채운 단추라 오른쪽 24 · 위아래 12 */}
        <div className="mt-x3 flex justify-end border-t border-stroke-neutral-subtle px-x6 py-x3">
          <Button
            variant="neutralSolid"
            size="small"
            disabled={!dirty}
            loading={saving}
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
