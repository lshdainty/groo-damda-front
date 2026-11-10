import * as React from "react";

/*
 * 겹침 표면(Alert Dialog · Bottom Sheet · Dialog)이 함께 쓰는 작은 도구. groo-design recipes/shadcn/components/ui/
 * {alert-dialog,bottom-sheet,dialog}.tsx 가 파일마다 되풀이하던 것을 한 곳에 모았다.
 */

export type OpenChange = (open: boolean) => void;

export function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<T | null>).current = node;
    }
  };
}

/**
 * 열림 — open 을 주면 그 값(제어), 아니면 안에서 든다. 같은 값을 거듭 청하면(닫으면서 Radix 도 닫기를 청한다) 한 번만 알린다.
 */
export function useOpenState(
  prop: boolean | undefined,
  defaultOpen: boolean | undefined,
  onChange: OpenChange | undefined,
) {
  const [inner, setInner] = React.useState(defaultOpen ?? false);
  const controlled = prop !== undefined;
  const value = controlled ? prop : inner;
  const onChangeRef = React.useRef(onChange);
  const lastRef = React.useRef(value);
  React.useLayoutEffect(() => {
    onChangeRef.current = onChange;
    lastRef.current = value;
  });
  const setOpen = (next: boolean) => {
    if (next === lastRef.current) return;
    lastRef.current = next;
    if (!controlled) setInner(next);
    onChangeRef.current?.(next);
  };
  return [value, setOpen] as const;
}

/**
 * 바닥 버튼의 크기 — 크기를 주지 않은 바로 아래 자식(컴포넌트)에만 넣는다. Fragment 는 펼친다.
 */
export function withButtonSize(
  children: React.ReactNode,
  size: "small" | "medium" | "large",
): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (
      !React.isValidElement<{ size?: unknown; children?: React.ReactNode }>(
        child,
      )
    )
      return child;
    if (child.type === React.Fragment)
      return withButtonSize(child.props.children, size);
    if (typeof child.type === "string" || child.props.size !== undefined)
      return child;
    return React.cloneElement(child, { size });
  });
}

/**
 * 연 자리의 둘레 — 열 때 잡아 둔다. 연 자리(트리거 · 열 때 초점이 있던 곳)가 닫힌 뒤 사라졌을 때(⋮ 메뉴의 항목이 지운 줄 ·
 * 줄이 지워져 ⋮ 도 없어짐) 초점이 문서 맨 앞(body)으로 빠지지 않도록 그 줄 → 목록 머리 → main 순으로 간다(alert-dialog.md 닫힌 뒤).
 * 줄 · 머리는 열 때 이미 문서에 있던 요소라 지워지면 isConnected 가 거짓이 된다 — 그때는 다음 후보로 넘어간다.
 */
export interface FocusAnchor {
  opener: Element | null;
  row: Element | null;
  head: Element | null;
}

const ROW_SELECTOR =
  '[data-slot="list-item"],[data-slot="list-parent-item"],[data-slot="table-row"],tr,li,[role="row"],[role="listitem"]';
const HEAD_SELECTOR =
  'h1,h2,h3,h4,h5,h6,[role="heading"],[data-slot="list-header"],[data-slot="list-title"],thead,[data-slot="table-header"]';

/** 줄에서 목록 머리를 찾는다 — 표는 표 머리, 그 밖에는 줄을 품은 상자들을 거슬러 오르며 앞 형제의 제목 · 목록 머리 */
function findHead(row: Element): Element | null {
  const table = row.closest('table,[role="table"],[role="grid"]');
  if (table) {
    return (
      table.querySelector('thead,[data-slot="table-header"]') ??
      table.querySelector('[role="columnheader"]')
    );
  }
  const list = row.closest('[data-slot="list"]');
  const ownHeader = list?.querySelector(':scope > [data-slot="list-header"]');
  if (ownHeader) return ownHeader;
  let node: Element | null = row;
  while (node && node.tagName !== "MAIN" && node.parentElement) {
    for (
      let prev = node.previousElementSibling;
      prev;
      prev = prev.previousElementSibling
    ) {
      if (prev.matches(HEAD_SELECTOR)) return prev;
      const inside = prev.querySelector(HEAD_SELECTOR);
      if (inside) return inside;
    }
    node = node.parentElement;
  }
  return null;
}

export function captureAnchor(el: Element | null): FocusAnchor {
  const opener = el instanceof Element ? el : null;
  const row = opener?.closest(ROW_SELECTOR) ?? null;
  return { opener, row, head: row ? findHead(row) : null };
}

/** 초점을 둘 수 있게 — 일반 요소(제목 · 줄 · main)는 tabindex -1 을 달아 준다(탭 순서에는 들어오지 않는다) */
function focusPlace(el: Element | null): boolean {
  if (!(el instanceof HTMLElement) || !el.isConnected) return false;
  if (!el.matches("a[href],button,input,select,textarea,[tabindex]")) {
    el.setAttribute("tabindex", "-1");
  }
  el.focus({ preventScroll: true });
  return document.activeElement === el;
}

/**
 * 닫힌 뒤 초점을 연 자리로 — 트리거, 없으면 열 때 초점이 있던 곳. 둘 다 사라졌으면 그 줄(안의 첫 초점 가능한 곳, 없으면 줄) →
 * 목록 머리 → main 순으로 남아 있는 첫 곳에 둔다. 아무 데도 없으면 그대로 둔다.
 * opener 에 요소만 주면(둘레를 잡지 않은 옛 호출) 요소만 본다.
 */
export function focusOpener(
  trigger: HTMLElement | null,
  anchor: FocusAnchor | Element | null,
) {
  const a: FocusAnchor =
    anchor && "opener" in anchor
      ? anchor
      : { opener: anchor as Element | null, row: null, head: null };
  const opener = a.opener;
  if (trigger?.isConnected) {
    trigger.focus({ preventScroll: true });
    return;
  }
  if (
    opener instanceof HTMLElement &&
    opener.isConnected &&
    opener !== opener.ownerDocument.body
  ) {
    opener.focus({ preventScroll: true });
    return;
  }
  const row = a.row;
  if (row?.isConnected) {
    const inner = row.querySelector<HTMLElement>(
      'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])',
    );
    if (inner) {
      inner.focus({ preventScroll: true });
      return;
    }
    if (focusPlace(row)) return;
  }
  if (focusPlace(a.head)) return;
  focusPlace(document.querySelector("main,[role=main]"));
}

/**
 * 닫힌 뒤인데 `open` 이 아직 참이면 둘 중 하나다 — (a) 폭이 1280 을 넘나들어 다른 표면(시트 ↔ 대화상자)이 대신 떴다,
 * (b) 부모가 `open` 을 그대로 둔 채 표면을 통째로 지웠다(상세 시트처럼 `{detail && <Sheet open />}`).
 * (a) 는 새 표면이 초점을 가져가 초점이 표면 안에 있고, (b) 는 초점이 문서로 떨어진다. 그래서 초점이 다른 표면 안에 있을 때만
 * 새 표면에 맡기고, 아니면 연 자리로 돌려준다(I-wrap-b5 1-b).
 */
export function surfaceTookOver(stillOpen: boolean) {
  if (!stillOpen) return false;
  const active = document.activeElement;
  if (!(active instanceof Element)) return false;
  // Radix Popover 내용도 role="dialog" 다 — 관련 없는 팝오버 안에 초점이 있다고 새 표면이 이어받았다고 읽지 않는다
  const surface = active.closest('[role="dialog"],[role="alertdialog"]');
  return surface !== null && !surface.matches('[data-slot="popover-content"]');
}
