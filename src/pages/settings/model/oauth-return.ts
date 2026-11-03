/**
 * 소셜 연동 복귀 주소의 `?linked=` 값 → 알림에 쓸 이름(I-14 N4).
 * 지금 연결할 수 있는 소셜(Google)만 표에 둔다 — 표에 없는 값 · 프로토타입 키(`constructor` · `__proto__`)는 null 이라 알림을 띄우지 않는다.
 */
const OAUTH_PROVIDER_LABELS: ReadonlyMap<string, string> = new Map([
  ["google", "Google"],
]);

export function linkedProviderName(linked: string): string | null {
  return OAUTH_PROVIDER_LABELS.get(linked.toLowerCase()) ?? null;
}
