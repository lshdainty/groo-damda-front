import { useLayoutEffect, useState, type RefObject } from "react";

/*
 * 금액 · 지표 줄 옆 동작 — 금액이 먼저다(groo-design #265 card.md "금액 옆 동작은 금액이 먼저입니다").
 *
 *   금액 한 줄 폭 + 사이(줄의 column-gap — 12) + 단추 폭 ≤ 줄 폭  → 단추를 금액 옆에
 *   넘으면                                                       → 단추를 금액 아래 줄 오른쪽 끝으로
 *
 * 금액이 쉼표 뒤에서 여러 줄로 갈리지 않게 하려는 규칙이다 — 쉼표 뒤 줄바꿈은 금액 한 줄이 줄 폭보다 길 때만 남는다. 카드 머리의
 * "동작이 머리 폭의 절반을 넘으면 내린다"(card.md 머리)는 제목 줄 규칙이고, 금액 줄은 이 규칙을 쓴다.
 *
 * 금액 한 줄 폭은 실제로 잰다 — 금액 글은 rem 이라 글자 크기 설정을 따라 커지므로 어림이 아니라 그 순간의 글 폭이다. 줄 · 금액 · 단추의
 * 크기가 바뀌면(창 폭 · 글자 크기 · 웹폰트 도착 · 금액이 옴) 판(version)을 올려 다시 판정한다.
 */

/** 금액과 단추 사이 — card.md "남은 자리(사이 12)". 줄의 column-gap 을 읽고, 못 읽으면(레이아웃이 없는 환경) 이 값 */
export const AMOUNT_ROW_GAP = 12;

/** 금액 요소의 표지 — 줄 안에서 이 요소의 한 줄 폭을 잰다 */
export const AMOUNT_ROW_AMOUNT = "data-amount-row-amount";

/** 요소를 줄바꿈 없이 그렸을 때의 폭 — 잠깐 nowrap · max-content 로 바꿔 재고 되돌린다(그리기 전이라 화면에 보이지 않는다) */
function oneLineWidth(el: HTMLElement): number {
  const prev = el.style.cssText;
  el.style.whiteSpace = "nowrap";
  el.style.width = "max-content";
  el.style.maxWidth = "none";
  const width = el.getBoundingClientRect().width;
  el.style.cssText = prev;
  return width;
}

/**
 * 단추를 금액 아래로 내려야 하는지 — [row] 는 줄(flex), 금액은 그 안의 `[data-amount-row-amount]`, 단추는 줄의 마지막 자식.
 * [_keys] 는 판(version)을 열쇠로만 받는다 — 판을 버리고 재기만 부르면 React Compiler 가 처음 잰 값에 묶는다(axisWidth.ts measureTextWidthAt 와 같은 함정).
 */
export function amountRowStacks(row: HTMLElement, ..._keys: number[]): boolean {
  const amount = row.querySelector<HTMLElement>(`[${AMOUNT_ROW_AMOUNT}]`);
  const action = row.lastElementChild as HTMLElement | null;
  if (!amount || !action || action.contains(amount)) return false;
  const rowWidth = row.clientWidth;
  if (rowWidth <= 0) return false;
  const gap = parseFloat(getComputedStyle(row).columnGap);
  const between = Number.isFinite(gap) ? gap : AMOUNT_ROW_GAP;
  const need =
    oneLineWidth(amount) + between + action.getBoundingClientRect().width;
  return need > rowWidth;
}

/**
 * 줄 · 금액 · 단추의 크기 · 글이 바뀔 때마다 판을 올려 다시 판정한다 — 단추를 아래로 내릴지(true).
 * 판정이 바뀌어 배치가 달라져도 재는 값(금액 한 줄 폭 · 단추 폭 · 줄 폭)은 배치를 따르지 않아 오가지 않는다.
 */
export function useAmountRowStacks(
  ref: RefObject<HTMLElement | null>,
): boolean {
  const [version, setVersion] = useState(0);
  const [stacked, setStacked] = useState(false);
  useLayoutEffect(() => {
    const row = ref.current;
    if (!row) return;
    const bump = () => setVersion((v) => v + 1);
    const resize =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(bump);
    const watch = () => {
      if (!resize) return;
      resize.disconnect();
      resize.observe(row);
      for (const el of row.querySelectorAll<HTMLElement>(
        `[${AMOUNT_ROW_AMOUNT}], :scope > *`,
      ))
        resize.observe(el);
    };
    watch();
    // 금액이 오거나(스켈레톤 → 글) 단추 글이 바뀌면 지켜볼 요소도 다시 잡는다
    const mutation =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(() => {
            watch();
            bump();
          });
    mutation?.observe(row, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    let live = true;
    void document.fonts?.ready.then(() => live && bump());
    return () => {
      live = false;
      resize?.disconnect();
      mutation?.disconnect();
    };
  }, [ref]);
  useLayoutEffect(() => {
    const row = ref.current;
    if (!row) return;
    setStacked(amountRowStacks(row, version));
  }, [ref, version]);
  return stacked;
}
