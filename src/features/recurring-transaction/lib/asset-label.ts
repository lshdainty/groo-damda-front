import type { Asset } from "@/entities/asset";

/** 계좌 · 카드 이름 — 기관이 있고 이름과 다르면 "기관 · 이름", 같으면 한 번만 */
export const assetLabel = (a: Asset) =>
  a.institution && a.institution !== a.assetName
    ? `${a.institution} · ${a.assetName}`
    : a.assetName;
