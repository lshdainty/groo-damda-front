import { Button } from "@/shared/ds/button";
import { DemoBlock, Specimen } from "@/shared/ds/catalog/DemoKit";

import { ScrollFog } from "./scroll-fog";

const TERMS =
  "그루 담다 는 사용자가 직접 적은 거래 · 메모 · 할 일을 기기와 서버에 저장합니다. 저장한 내용은 사용자가 지우기 전까지 남고, 계정을 닫으면 30일 뒤 모두 지웁니다. 다른 서비스에서 가져온 거래는 가져온 날짜와 함께 저장하며, 가져오기를 끊으면 더 가져오지 않습니다. 알림은 사용자가 켠 것만 보내고, 언제든 설정에서 끌 수 있습니다. 서비스를 고치거나 바꿀 때는 적어도 7일 전에 알립니다.";

const FILTERS = [
  "전체",
  "식비",
  "카페",
  "교통",
  "쇼핑",
  "문화",
  "의료",
  "교육",
  "통신",
  "주거",
  "경조사",
  "기타",
];

const CATEGORIES = [
  "식비",
  "카페 · 간식",
  "편의점",
  "교통",
  "자동차",
  "쇼핑",
  "생활용품",
  "문화 · 여가",
  "여행",
  "의료 · 건강",
  "교육",
  "통신",
  "주거 · 관리비",
  "보험",
  "경조사",
  "반려동물",
];

const IMPORTED = [
  ["스타벅스 역삼점", "6,500원"],
  ["GS25 선릉점", "3,200원"],
  ["교보문고", "15,000원"],
  ["카카오 T 택시", "9,800원"],
  ["올리브영", "21,900원"],
  ["넷플릭스", "13,500원"],
  ["쿠팡", "32,000원"],
  ["다이소", "12,300원"],
  ["버스", "1,500원"],
  ["김밥천국", "8,000원"],
];

const CARDS = [
  "현대카드 M",
  "신한 SOL",
  "국민 노리",
  "삼성 taptap",
  "롯데 라이킷",
];

/** 카탈로그(/dev/ds) — 자리마다(use) 방향 · 깊이 · 여백. 처음 · 가운데 · 끝 어디서나 흐림이 그대로인 것을 스크롤해 본다 */
export const ScrollFogDemo = () => (
  <div className="flex flex-col gap-x6">
    <DemoBlock title="box(기본) — 카드 · 상자 안의 높이를 정한 스크롤, 넘치는 방향 양 끝 20 · 여백 20">
      <div className="w-full max-w-(--container-sm) rounded-r3 border border-stroke-neutral-subtle">
        <Specimen spec="scroll-fog" combo={{ use: "box" }}>
          <ScrollFog
            className="max-h-48"
            tabIndex={0}
            role="region"
            aria-label="이용 약관"
          >
            <p className="px-x4 text-t4 text-fg-neutral-muted">{TERMS}</p>
          </ScrollFog>
        </Specimen>
      </div>
    </DemoBlock>

    <DemoBlock title="row — 칩 필터 바 · 가로 카드 줄, 좌우 20 · 여백은 화면 여백 24(처음 · 끝 칩은 흐리지 않는다)">
      <div className="w-full max-w-(--container-sm) rounded-r3 border border-stroke-neutral-subtle py-x3">
        <Specimen spec="scroll-fog" combo={{ use: "row" }}>
          <ScrollFog use="row">
            <div className="flex gap-x2 py-x1">
              {FILTERS.map((name) => (
                <Button key={name} size="xsmall" variant="neutralOutline">
                  {name}
                </Button>
              ))}
            </div>
          </ScrollFog>
        </Specimen>
      </div>
    </DemoBlock>

    <DemoBlock title="overlayBody — 시트 · 대화상자 · 팝오버의 넘칠 수 있는 본문, 위 20 · 아래 80">
      <div className="flex w-full max-w-(--container-sm) flex-col rounded-r4 border border-stroke-neutral-subtle bg-bg-layer-floating">
        <p className="px-x5 pt-x5 pb-x4 text-t6 font-bold text-fg-neutral">
          카테고리 고르기
        </p>
        <Specimen spec="scroll-fog" combo={{ use: "overlayBody" }}>
          <ScrollFog
            use="overlayBody"
            className="max-h-72"
            tabIndex={0}
            role="region"
            aria-label="카테고리"
          >
            <ul className="flex flex-col px-x5">
              {CATEGORIES.map((name) => (
                <li key={name} className="py-x3 text-t5 text-fg-neutral">
                  {name}
                </li>
              ))}
            </ul>
          </ScrollFog>
        </Specimen>
      </div>
    </DemoBlock>

    <DemoBlock title="page — 바닥 고정 버튼이 있는 화면 전체 스크롤, 위 20 · 아래 80(바닥 버튼 위에서 끝난다)">
      <div className="flex h-80 w-full max-w-(--container-sm) flex-col rounded-r3 border border-stroke-neutral-subtle">
        <Specimen spec="scroll-fog" combo={{ use: "page" }}>
          <ScrollFog
            use="page"
            className="min-h-0 flex-1"
            tabIndex={0}
            role="region"
            aria-label="가져온 거래"
          >
            <ul className="flex flex-col px-x6">
              {IMPORTED.map(([name, amount]) => (
                <li
                  key={name}
                  className="flex items-center justify-between py-x3 text-t5 text-fg-neutral"
                >
                  <span>{name}</span>
                  <span className="font-bold">{amount}</span>
                </li>
              ))}
            </ul>
          </ScrollFog>
        </Specimen>
        <div className="px-x6 pt-x3 pb-x4">
          <Button size="large" className="w-full">
            가계부에 넣기
          </Button>
        </div>
      </div>
    </DemoBlock>

    <DemoBlock title="box · 가로 — 가로로만 스크롤하는 상자(overflow-x-auto overflow-y-hidden)면 흐림 · 여백이 좌우 20 으로 간다">
      <div className="w-full max-w-(--container-sm) rounded-r3 border border-stroke-neutral-subtle py-x3">
        <ScrollFog
          className="overflow-x-auto overflow-y-hidden"
          tabIndex={0}
          role="region"
          aria-label="카드"
        >
          <div className="flex gap-x3">
            {CARDS.map((name) => (
              <span
                key={name}
                className="flex h-[70px] w-28 shrink-0 items-end rounded-r2 bg-bg-neutral-inverted p-x2 text-t2 font-bold text-fg-neutral-inverted"
              >
                {name}
              </span>
            ))}
          </div>
        </ScrollFog>
      </div>
    </DemoBlock>
  </div>
);
