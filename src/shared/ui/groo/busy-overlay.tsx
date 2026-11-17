import { useEffect } from "react";
import { createPortal } from "react-dom";
import { OVERLAY_DIM_BOUNDS } from "@/shared/ds/overlay/dim-bounds";
import { ProgressCircle } from "@/shared/ds/progress-circle";
import { useWaitPhase } from "@/shared/ds/skeleton";

/**
 * BusyOverlay — 뒤를 만지면 안 되는 처리 동안 화면 전체를 덮는다(I-05 37 · 49, progress-circle.md "뒤를 만지면 안 되는 처리").
 *
 * 딤(`overlay-dim-light` 50% · `overlay-dim-dark` 65%) + 흰 원 40(`staticWhite`, 값 없음).
 * 켜자마자 뒤는 눌리지 않고(투명 막), **1초가 지나야** 딤과 원이 보인다(빨리 끝나면 번쩍이지 않게).
 * 딤 위에 안내 글은 두지 않는다(글자색 짝이 스펙에 없다 — 열린 일).
 * 덮는 범위는 시트 · 대화상자 딤과 같은 `OVERLAY_DIM_BOUNDS`(overlay/dim-bounds.ts) — 화면 위아래로 lvh 만큼 넘쳐, 키보드가 뜬 채
 * 처리 중일 때 iPhone Safari 26 이 레이아웃 뷰포트 아래(주소 알약 · 입력 도구줄 둘레 ~ 키보드 윗변)에 그리는 띠까지 덮는다
 * (`fixed inset-0` 은 그 띠에 뒤 페이지가 흐림 없이 비쳤다). 위아래가 같은 만큼 넘쳐 원은 그대로 레이아웃 뷰포트 가운데다.
 * 딤이 보이기 전의 투명 막도 같은 범위다 — 띠를 눌러도 뒤가 눌리지 않는다.
 * 층은 스펙 층 이름 `z-alert`(L5 Alert Dialog 딤 — DESIGN.md Z-index 표 `z-alert 300`, 화면 겹침 Global 3 "다른 모달보다도 위") — 시트(101) 위 · 스낵바(400) 아래.
 * 보이는 동안 뒤 화면(열린 시트 포함)은 보조 기술에서 숨긴다 — `body` 의 다른 자식에 `aria-hidden` 을 달고
 * 걷을 때 원래 값으로 되돌린다. 원은 `label` 이름의 progressbar 다.
 */
export function BusyOverlay({
  busy,
  label,
}: {
  busy: boolean;
  /** 원 이름 — "해지하는 중" · "가져오는 중" */
  label: string;
}) {
  const phase = useWaitPhase(busy);
  const visible = busy && phase !== "quiet";

  useEffect(() => {
    if (!visible) return;
    const hidden: Array<[Element, string | null]> = [];
    for (const el of Array.from(document.body.children)) {
      if (el.hasAttribute("data-busy-overlay")) continue;
      hidden.push([el, el.getAttribute("aria-hidden")]);
      el.setAttribute("aria-hidden", "true");
    }
    return () => {
      for (const [el, prev] of hidden) {
        if (prev === null) el.removeAttribute("aria-hidden");
        else el.setAttribute("aria-hidden", prev);
      }
    };
  }, [visible]);

  if (!busy) return null;
  return createPortal(
    <div
      data-busy-overlay=""
      data-slot="busy-overlay"
      data-visible={visible || undefined}
      className={
        visible
          ? `${OVERLAY_DIM_BOUNDS} z-(--z-alert) flex items-center justify-center bg-[var(--overlay-dim-light)] dark:bg-[var(--overlay-dim-dark)]`
          : `${OVERLAY_DIM_BOUNDS} z-(--z-alert)`
      }
    >
      {visible && (
        <ProgressCircle size="40" tone="staticWhite" aria-label={label} />
      )}
    </div>,
    document.body,
  );
}
