import { useState, type FocusEvent, type ReactNode } from "react";
import {
  Bell,
  Eye,
  EyeOff,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
} from "lucide-react";

import { Button } from "@/shared/ds/button";
import { DemoBlock, DemoRow, Specimen } from "@/shared/ds/catalog/DemoKit";

import {
  ScreenTitle,
  TopNavigation,
  TopNavigationActions,
  TopNavigationBackButton,
  TopNavigationCloseButton,
  TopNavigationIconButton,
  TopNavigationMenuButton,
  TopNavigationPrimaryButton,
  TopNavigationTextButton,
  TopNavigationTitle,
} from "./top-navigation";

const noop = () => {};

// 폰 폭 칸 — 바는 화면 폭이라 폭이 그림의 일부다. 안전 영역은 크로미움에서 0 이다
const Phone = ({
  children,
  width = 360,
}: {
  children: ReactNode;
  width?: number;
}) => (
  <div
    className="relative shrink-0 overflow-hidden rounded-r3 border border-stroke-neutral-subtle bg-bg-layer-basement"
    style={{ width }}
  >
    {children}
  </div>
);

// 검사기가 견본 뿌리(바)에 준 키보드 포커스를 그 안의 단추로 넘긴다 — 바는 초점을 받지 않는다(컴포넌트는 그대로다)
const passFocus = {
  tabIndex: -1,
  onFocus: (e: FocusEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    e.currentTarget.querySelector<HTMLElement>("button")?.focus({
      preventScroll: true,
    });
  },
};

const STATES = [
  "enabled",
  "hovered",
  "pressed",
  "focused",
  "disabled",
] as const;
type State = (typeof STATES)[number];

// 단추 하나만 감싼 바 — 가운데가 단추라 검사기가 올리고 누를 수 있다(w-fit). 실제 화면의 바가 아니라 상태를 재는 견본이다
const ButtonStateBar = ({
  kind,
  state,
}: {
  kind: "icon" | "text";
  state: State;
}) => (
  <Specimen
    spec="top-navigation"
    combo={{ type: "standard", leadingIcon: "back" }}
    state={state}
  >
    <TopNavigation
      type="standard"
      className="w-fit rounded-r3"
      {...(state === "focused" ? passFocus : {})}
    >
      {kind === "icon" ? (
        <TopNavigationIconButton
          aria-label="검색"
          disabled={state === "disabled"}
          onClick={noop}
        >
          <Search />
        </TopNavigationIconButton>
      ) : (
        <TopNavigationTextButton disabled={state === "disabled"} onClick={noop}>
          완료
        </TopNavigationTextButton>
      )}
    </TopNavigation>
  </Specimen>
);

const TypesDemo = () => (
  <DemoBlock title="타입 — root(탭 첫 화면 · 큰 제목) · standard(← ✕ ☰ + 제목) · desktop(본문 제목 · 주 버튼)">
    <DemoRow label="root · 홈">
      <Phone>
        <Specimen
          spec="top-navigation"
          combo={{ type: "root", leadingIcon: "back" }}
        >
          <TopNavigation type="root">
            <TopNavigationTitle>홈</TopNavigationTitle>
            <TopNavigationActions>
              <TopNavigationIconButton aria-label="검색" onClick={noop}>
                <Search />
              </TopNavigationIconButton>
              <TopNavigationIconButton
                notification
                aria-label="알림, 새 알림 있음"
                onClick={noop}
              >
                <Bell />
              </TopNavigationIconButton>
            </TopNavigationActions>
          </TopNavigation>
        </Specimen>
      </Phone>
    </DemoRow>
    <DemoRow label="standard · ←">
      <Phone>
        <Specimen
          spec="top-navigation"
          combo={{ type: "standard", leadingIcon: "back" }}
        >
          <TopNavigation>
            <TopNavigationBackButton fallbackHref="/desk" onClick={noop} />
            <TopNavigationTitle>알림</TopNavigationTitle>
            <TopNavigationActions>
              <TopNavigationTextButton onClick={noop}>
                모두 읽음
              </TopNavigationTextButton>
            </TopNavigationActions>
          </TopNavigation>
        </Specimen>
      </Phone>
    </DemoRow>
    <DemoRow label="standard · ✕">
      <Phone>
        <Specimen
          spec="top-navigation"
          combo={{ type: "standard", leadingIcon: "close" }}
        >
          <TopNavigation>
            <TopNavigationCloseButton onClick={noop} />
            <TopNavigationTitle>카드 가져오기</TopNavigationTitle>
            <TopNavigationActions>
              <TopNavigationTextButton onClick={noop}>
                완료
              </TopNavigationTextButton>
            </TopNavigationActions>
          </TopNavigation>
        </Specimen>
      </Phone>
    </DemoRow>
    <DemoRow label="standard · ☰">
      <Phone>
        <Specimen
          spec="top-navigation"
          combo={{ type: "standard", leadingIcon: "menu" }}
        >
          <TopNavigation>
            <TopNavigationMenuButton aria-expanded={false} />
            <TopNavigationTitle>휴가 현황</TopNavigationTitle>
          </TopNavigation>
        </Specimen>
      </Phone>
    </DemoRow>
    <DemoRow label="desktop · Desk">
      <Phone width={560}>
        <Specimen
          spec="top-navigation"
          combo={{ type: "desktop", leadingIcon: "back" }}
        >
          <TopNavigation type="desktop">
            <TopNavigationActions>
              <TopNavigationPrimaryButton onClick={noop}>
                <Plus />
                내역 추가
              </TopNavigationPrimaryButton>
              <TopNavigationIconButton
                aria-label="금액 가리기"
                aria-pressed={false}
                onClick={noop}
              >
                <Eye />
              </TopNavigationIconButton>
              <TopNavigationIconButton
                notification
                aria-label="알림, 새 알림 있음"
                onClick={noop}
              >
                <Bell />
              </TopNavigationIconButton>
              <TopNavigationIconButton aria-label="설정" onClick={noop}>
                <Settings />
              </TopNavigationIconButton>
            </TopNavigationActions>
          </TopNavigation>
          <div className="px-x8 pb-x6">
            <ScreenTitle
              description="모든 거래 내역"
              actions={
                <>
                  <Button variant="neutralOutline" size="small" onClick={noop}>
                    필터 · 3
                  </Button>
                  <Button variant="neutralOutline" size="small" onClick={noop}>
                    내보내기
                  </Button>
                </>
              }
            >
              가계부
            </ScreenTitle>
          </div>
        </Specimen>
      </Phone>
    </DemoRow>
  </DemoBlock>
);

const TrailingDemo = () => {
  const [hidden, setHidden] = useState(false);
  return (
    <DemoBlock title="오른쪽 자리 — 아이콘 둘(권장) · 셋(최대) · 켜고 끄는 단추(금액 가리기 — 켬 선 2.5 · 끔 선 2, 색은 같다) · 글 버튼 하나">
      <DemoRow label="아이콘 둘">
        <Phone>
          <TopNavigation type="root">
            <TopNavigationTitle>가계부</TopNavigationTitle>
            <TopNavigationActions>
              <TopNavigationIconButton aria-label="검색" onClick={noop}>
                <Search />
              </TopNavigationIconButton>
              <TopNavigationIconButton
                aria-label="가계부 더보기"
                onClick={noop}
              >
                <MoreHorizontal />
              </TopNavigationIconButton>
            </TopNavigationActions>
          </TopNavigation>
        </Phone>
      </DemoRow>
      <DemoRow label="아이콘 셋 · 켜고 끄기">
        <Phone>
          <TopNavigation type="root">
            <TopNavigationTitle>자산</TopNavigationTitle>
            <TopNavigationActions>
              <TopNavigationIconButton
                aria-label="금액 가리기"
                aria-pressed={hidden}
                onClick={() => setHidden((h) => !h)}
              >
                {hidden ? <EyeOff /> : <Eye />}
              </TopNavigationIconButton>
              <TopNavigationIconButton
                notification
                aria-label="알림, 새 알림 있음"
                onClick={noop}
              >
                <Bell />
              </TopNavigationIconButton>
              <TopNavigationIconButton aria-label="설정" onClick={noop}>
                <Settings />
              </TopNavigationIconButton>
            </TopNavigationActions>
          </TopNavigation>
        </Phone>
        <Phone>
          <TopNavigation type="root">
            <TopNavigationTitle>자산</TopNavigationTitle>
            <TopNavigationActions>
              <TopNavigationIconButton
                aria-label="금액 가리기"
                aria-pressed
                onClick={noop}
              >
                <EyeOff />
              </TopNavigationIconButton>
              <TopNavigationIconButton aria-label="알림" onClick={noop}>
                <Bell />
              </TopNavigationIconButton>
            </TopNavigationActions>
          </TopNavigation>
        </Phone>
      </DemoRow>
    </DemoBlock>
  );
};

const WorstDemo = () => (
  <DemoBlock title="가장 나쁜 값 — 긴 제목은 오른쪽 자리 앞 8 에서 말줄임(동작 셋) · 폰 320 · 안전 영역 흉내 · 막힌 글 버튼">
    <DemoRow label="긴 제목 · 셋">
      <Phone>
        <TopNavigation>
          <TopNavigationBackButton fallbackHref="/desk" onClick={noop} />
          <TopNavigationTitle>
            신용카드 결제 예정 금액과 할부 내역 전체 보기
          </TopNavigationTitle>
          <TopNavigationActions>
            <TopNavigationIconButton aria-label="검색" onClick={noop}>
              <Search />
            </TopNavigationIconButton>
            <TopNavigationIconButton
              notification
              aria-label="알림, 새 알림 있음"
              onClick={noop}
            >
              <Bell />
            </TopNavigationIconButton>
            <TopNavigationIconButton aria-label="설정" onClick={noop}>
              <Settings />
            </TopNavigationIconButton>
          </TopNavigationActions>
        </TopNavigation>
      </Phone>
    </DemoRow>
    <DemoRow label="폰 320 · 글 버튼">
      <Phone width={320}>
        <TopNavigation>
          <TopNavigationCloseButton onClick={noop} dirty />
          <TopNavigationTitle>반복 거래 수정하기</TopNavigationTitle>
          <TopNavigationActions>
            <TopNavigationTextButton disabled onClick={noop}>
              완료
            </TopNavigationTextButton>
          </TopNavigationActions>
        </TopNavigation>
      </Phone>
    </DemoRow>
    <DemoRow label="위 안전 영역 44">
      <Phone>
        {/* 크로미움에는 안전 영역이 없다 — pt 로 흉내 낸다. 바탕은 위로 늘고 내용은 그 아래 56 에 놓인다 */}
        <TopNavigation className="pt-11">
          <TopNavigationBackButton fallbackHref="/desk" onClick={noop} />
          <TopNavigationTitle>알림</TopNavigationTitle>
        </TopNavigation>
      </Phone>
    </DemoRow>
  </DemoBlock>
);

const ScrollDemo = () => (
  <DemoBlock title="스크롤 — 바는 맨 위에 그대로 · 목록이 밑으로 지나가도 선 · 그림자 없음 · 숨지 않는다">
    <DemoRow label="목록 아래로">
      <Phone>
        <div className="h-72 overflow-y-auto">
          <TopNavigation type="root">
            <TopNavigationTitle>가계부</TopNavigationTitle>
            <TopNavigationActions>
              <TopNavigationIconButton aria-label="검색" onClick={noop}>
                <Search />
              </TopNavigationIconButton>
            </TopNavigationActions>
          </TopNavigation>
          <ul className="m-0 list-none p-x4">
            {Array.from({ length: 14 }, (_, i) => (
              <li
                key={i}
                className="mb-x2 rounded-r3 bg-bg-layer-default p-x4 text-t4 text-fg-neutral"
              >
                거래 {i + 1} · {(i + 1) * 4_800}원
              </li>
            ))}
          </ul>
        </div>
      </Phone>
    </DemoRow>
  </DemoBlock>
);

const StatesDemo = () => (
  <DemoBlock title="상태 — 아이콘 버튼 · 글 버튼: 기본 · 호버(누름과 같은 바탕) · 누름(바탕 + 2px 축소) · 포커스(안쪽 링) · 막힘(fg-disabled)">
    {(["icon", "text"] as const).map((kind) => (
      <DemoRow key={kind} label={kind === "icon" ? "아이콘 버튼" : "글 버튼"}>
        {STATES.map((state) => (
          <div key={state} className="flex flex-col items-center gap-x1">
            <ButtonStateBar kind={kind} state={state} />
            <span className="text-t1 text-fg-neutral-subtle">{state}</span>
          </div>
        ))}
      </DemoRow>
    ))}
  </DemoBlock>
);

/** 카탈로그(/dev/ds) — 타입 × 왼쪽 버튼 · 오른쪽 자리 · 가장 나쁜 값 · 스크롤 · 버튼 상태 */
export const TopNavigationDemo = () => (
  <div className="flex flex-col gap-x8">
    <TypesDemo />
    <TrailingDemo />
    <WorstDemo />
    <ScrollDemo />
    <StatesDemo />
  </div>
);
