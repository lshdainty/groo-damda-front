/*
 * Groo Slider — 구조는 SEED Slider(2026-10-09). 수치 원본은 groo-design specs/components/slider.yaml(값은 src/shared/ds/spec/slider.json).
 * groo-design recipes/shadcn/components/ui/slider.tsx 를 첫 판으로 가져왔다 — 이 파일은 상수 · 길이 식 · 문서 입력 추적, 컴포넌트는 slider.tsx 다(컴포넌트 파일은 컴포넌트만 내보낸다 — 빠른 새로 고침).
 *
 * 레시피와 다른 자리 — 누르는 동안 손잡이 24 는 scale 1.2 가 아니라 크기(size-5 → size-6)다. 손잡이는 가운데 기준으로 놓여 자라도 자리가 안 바뀌고,
 * 검사기(ds:check)가 계산된 폭으로 스펙 24 를 잴 수 있다.
 *
 *
 *   Slider        값 하나 — min · max · step(기본 1) · value · defaultValue · onValueChange(value — 움직일 때마다, 화면만) ·
 *                 onValueCommit(value — 손을 뗄 때 · 키마다 한 번, 바로 적용하는 저장은 여기서) · formatValue(value — 단위를 붙인 글,
 *                 기본은 숫자 그대로) · disabled · name · dir. 구간이 2 ~ 5개면 눈금 · 단계 표식을 스스로 그린다
 *   RangeSlider   값 둘 — value · defaultValue 가 [최소, 최대], onValueChange · onValueCommit 도 두 값. thumbLabels(기본 ["최소", "최대"] —
 *                 손잡이 이름은 "{라벨} {thumbLabels}"). 나머지는 Slider 와 같다
 *   SliderValue   머리 값 — Field 의 headerAction 자리에 둔다. 16 / 22 · 700 · 고정폭 숫자, 보조 기술에는 숨긴다(값은 손잡이가 읽힌다)
 *
 * Field 안이면 Field 의 라벨이 손잡이 이름(aria-labelledby), 설명 · 오류가 설명(aria-describedby)이 되고(useFieldGroup), Field 의 막힘 ·
 * 오류를 받는다(useFieldGroupState). 라벨이 없으면 aria-label. 이름 자리에 값을 넣지 않는다 — 값은 aria-valuetext(formatValue — "80%")다.
 *
 * 자리: 위 24 는 말풍선 자리다(root paddingTop) — Field 머리 ↔ 손잡이 줄 32(Field 간격 8 + 24)라 말풍선(26)이 라벨 · 머리 값을 덮지 않는다.
 *   누르는 자리는 손잡이 줄 44 뿐이다(위 24 는 누르는 자리가 아니다).
 * 모양(사용자 결정 1B — SEED 무채색): 손잡이 줄 44(줄 전체가 누르는 자리) 가운데에 트랙 4 stroke-neutral-weak · 채움 fg-neutral ·
 *   손잡이 20 bg-neutral-inverted(테두리 · 그림자 없음, 끄는 동안 24 — 1.2배). 손잡이 가운데는 트랙 양 끝에서 10 들어온 자리까지만 가고,
 *   채움은 트랙 끝(범위는 앞 손잡이)에서 손잡이 가운데까지다. 브랜드 색으로 칠하지 않는다.
 * 값(2C): 머리 값(SliderValue) · 말풍선(끄는 동안 · 마우스를 손잡이에 올렸을 때 · 키보드 포커스일 때 — 손잡이 위 12, 13 / 18 · 500,
 *   bg-neutral-inverted · 위아래 4 · 좌우 8 · 모서리 6 · 아래 8 × 6 화살표, 트랙 끝에서는 상자만 안으로 밀린다) · 아래 2 의 표식(양 끝 값,
 *   13 / 18 fg-neutral-muted). 말풍선 · 표식은 보조 기술에 숨긴다.
 * 눈금(3B): 구간((max − min) ÷ step)이 2 ~ 5개면 양 끝을 뺀 단계 자리마다 트랙 · 채움을 끊는 틈 4(놓인 표면이 비친다 — 마스크로 끊어
 *   시트 · 팝오버 위에서도 표면 색 그대로)와 단계마다 표식. 6개 이상이면 눈금 없이 양 끝 표식만 — 숫자를 늘어놓지 않는다.
 * 누르기: 손잡이를 누르면 바로 끈다(24 + 말풍선). 손잡이 밖(손잡이 줄 어디든)을 누르면 가장 가까운 손잡이가 그 자리(가장 가까운 단계)로
 *   150ms 에 건너뛰고, 그대로 움직이거나 150ms 넘게 누르고 있으면 끌기가 된다 — 짧게 누르고 떼기만 하면(Tap jump) 말풍선은 뜨지 않는다(SEED).
 *   끄는 동안은 손가락을 1:1 로 따른다(전환 없음). 두 손잡이는 서로를 넘지 않는다.
 * 저장(4B): 손을 뗄 때 한 번 onValueCommit — 값이 바뀌었을 때만. 키보드는 키마다 한 번. 요청 중이라고 스스로 막지 않는다(막으면 손잡이가
 *   Tab 순서에서 빠져 초점이 본문으로 떨어진다). 실패하면 부르는 쪽이 값을 되돌리고 Field 오류로 알린다.
 * 키보드(APG): ← ↓ · → ↑ 한 단계, Shift + 화살표 · PageDown · PageUp 10단계(끝에서 멈춘다), Home · End 는 포커스한 손잡이를 최솟값 ·
 *   최댓값으로(범위면 다른 손잡이 값까지). RTL 은 ← → 만 뒤집고 ↑ 는 늘 늘린다. 손잡이마다 Tab 한 번.
 * 상태: 키보드 포커스에만 손잡이 둘레 링 2px · 띄움 2px + 말풍선. 막힘은 전용 색(트랙 bg-disabled · 채움 · 손잡이 · 표식 fg-disabled) —
 *   흐리게 하지 않고 Tab 순서에서 빠진다. 오류는 모양을 바꾸지 않는다(Field 꼬리의 글).
 * 모션: 건너뛰기(누름 · 키보드)는 손잡이 · 채움 150ms easing, 누름 크기 150ms, 말풍선은 200ms enter(0.9배 · 투명 · 아래 5 에서) ·
 *   200ms easing(투명 · 아래 5 로). 모션 줄이기면 건너뛰기 · 크기는 바로, 말풍선은 투명도만.
 */

// 손잡이 반지름 — 손잡이 가운데가 트랙 양 끝에서 이만큼 들어온 자리까지만 간다
export const INSET = 10;
// 짧게 누르기(Tap jump)와 끌기를 가르는 시간 · 거리 — 손잡이 밖을 누른 채 이만큼 지나거나 움직이면 끌기
export const HOLD_MS = 150;
export const MOVE_PX = 3;

export type Dir = "ltr" | "rtl";

export const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
export const decimalsOf = (n: number) => {
  const s = String(n);
  const at = s.indexOf(".");
  return at < 0 ? 0 : s.length - at - 1;
};

// 단계 자리 — 진행 비율(0 ~ 1) 계산의 길이 식. CSS 의 % 는 손잡이 줄(= 트랙) 폭이다
export const at = (p: number) =>
  `calc(${INSET}px + (100% - ${INSET * 2}px) * ${p})`;

// 눈금 — 양 끝을 뺀 단계 자리마다 폭 4 의 틈. 트랙(채움 포함)을 마스크로 끊어 놓인 표면이 비치게 한다
export function tickMask(intervals: number) {
  const stops: string[] = [];
  let from = "0px";
  for (let k = 1; k < intervals; k++) {
    const x = `${INSET}px + (100% - ${INSET * 2}px) * ${k} / ${intervals}`;
    stops.push(
      `#000 ${from} calc(${x} - 2px)`,
      `transparent calc(${x} - 2px) calc(${x} + 2px)`,
    );
    from = `calc(${x} + 2px)`;
  }
  stops.push(`#000 ${from} 100%`);
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

// 말풍선 화살표 — 8 × 6, 아래를 가리키고 끝을 둥글린다(SEED 모서리 2)
export const ARROW_PATH = "M0 0H8L4.67 5A0.8 0.8 0 0 1 3.33 5Z";

export const defaultFormat = (v: number) => String(v);
