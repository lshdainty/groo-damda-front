import { useLayoutEffect, useRef } from "react";

/** 설정 본문 상자(`createSettingsBodyHost`)를 지금 틀 안에 끼운다 — 설명은 model/settings-body-host.ts(I-wrap-b1 ε 9) */
export function SettingsBodySlot({ host }: { host: HTMLElement }) {
  const ref = useRef<HTMLDivElement>(null);
  // 그리기 전에 끼운다 — 본문 안의 layout effect(재기 · 초점)보다 먼저 붙어 있어야 한다(틀이 본문보다 앞 형제다)
  useLayoutEffect(() => {
    const slot = ref.current;
    if (!slot) return;
    slot.appendChild(host);
    return () => {
      if (host.parentNode === slot) slot.removeChild(host);
    };
  }, [host]);
  return <div ref={ref} data-slot="settings-body-slot" className="contents" />;
}
