import { useBackClose } from "@/shared/ds/overlay";

/**
 * 기기 뒤로 가기 = 한 단계 뒤. 단계가 열린 동안 히스토리 칸을 하나 더 쌓아, 폼 전체가 닫히지 않고 이 단계만 닫는다.
 * `back` 은 단계를 닫았으면 true, 바뀐 글이 있어 물었으면 false — 물었을 때는 칸을 다시 쌓아 [계속 작성] 뒤에도 뒤로 가기가 이 단계로 온다.
 */
export function useStepBack(active: boolean, back: () => boolean) {
  useBackClose(active, (keep) => {
    if (!back()) keep();
  });
}
