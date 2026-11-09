export type DeviceSize = "mobile" | "tablet" | "desktop";

export const TABLET_QUERY = "(min-width: 768px)";
export const DESKTOP_QUERY = "(min-width: 1280px)";

export function detect(): DeviceSize {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return "desktop";
  if (!window.matchMedia(TABLET_QUERY).matches) return "mobile";
  if (!window.matchMedia(DESKTOP_QUERY).matches) return "tablet";
  return "desktop";
}

/**
 * 폰인가(768 미만) — 셸의 mobile 판정(`useDeviceSize`)과 스크롤 주체가 같은 질의 하나를 읽는다(소수 폭 767.98 ~ 768 에서 둘이 갈리지 않게).
 * matchMedia 가 없으면 폰이 아니다.
 */
export function isPhoneViewport(): boolean {
  return detect() === "mobile";
}
