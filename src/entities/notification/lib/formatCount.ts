import { i18n } from "@/shared/i18n/config";

/** 안 읽은 수 — 천 단위 쉼표는 브라우저가 아니라 앱 언어(ko · en)를 따른다. */
export function formatCount(n: number): string {
  return n.toLocaleString(i18n.language?.startsWith("en") ? "en-US" : "ko-KR");
}
