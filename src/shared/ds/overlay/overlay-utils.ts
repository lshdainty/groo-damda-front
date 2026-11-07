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
 * 닫힌 뒤 초점을 연 자리로 — 트리거, 없으면 열 때 초점이 있던 곳. 둘 다 문서에서 빠졌으면 그대로 둔다.
 */
export function focusOpener(
  trigger: HTMLElement | null,
  opener: Element | null,
) {
  const target = trigger?.isConnected
    ? trigger
    : opener instanceof HTMLElement &&
        opener.isConnected &&
        opener !== opener.ownerDocument.body
      ? opener
      : null;
  target?.focus({ preventScroll: true });
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
  return (
    active instanceof Element &&
    active.closest('[role="dialog"],[role="alertdialog"]') !== null
  );
}
