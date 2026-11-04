import type { Asset } from "@/entities/asset";

/** 계좌 · 카드 이름 — 기관이 있으면 "기관 · 이름" */
export const assetLabel = (a: Asset) =>
  a.institution ? `${a.institution} · ${a.assetName}` : a.assetName;
