/**
 * 기능 비교의 줄 — Pro 가 실제로 더 주는 것은 증권 하나다. 플랜 features 는 `["SECURITIES"]` 뿐이고
 * 서버·웹 게이트도 증권 API·시세 스냅샷·증권 탭·자산 실시간 평가에만 걸려 있다.
 * 거래 건수·가져오기/내보내기·캘린더 공유·카드 혜택에는 어떤 제한도 없으므로 여기에 적지 않는다 —
 * 표에만 있는 제한은 광고가 된다(QA #161). 줄 셋 · 차례 · 있음/없음 값은 앱 `_featuresOf` 와 같다.
 */
export interface SubFeature {
  /** `subscription` 네임스페이스의 키 — 글은 세 레포 락(바꾸지 않는다) */
  labelKey: string;
  free: boolean;
  pro: boolean;
}

export const SUB_FEATURES: readonly SubFeature[] = [
  { labelKey: "feature.core", free: true, pro: true },
  { labelKey: "feature.budget", free: true, pro: true },
  { labelKey: "feature.securities", free: false, pro: true },
];
