import { useQuery } from "@tanstack/react-query";
import {
  referenceMeta,
  referenceSilent,
  type ReferenceOpts,
} from "@/shared/api";
import { constellationKeys } from "@/shared/config";
import { constellationApi } from "../api/constellationApi";

/** `reference` — 화면의 보조 표시(스트립 · 마크 · 캡션)로 읽는다: 요청은 silent, 실패는 앱 공용 스낵바 한 자리가 알린다 */
export const useConstellationToday = (opts?: ReferenceOpts) => {
  return useQuery({
    queryKey: constellationKeys.today(),
    queryFn: () => constellationApi.getToday(referenceSilent(opts)),
    ...referenceMeta(opts),
  });
};

export const useConstellationSky = (days = 14, opts?: ReferenceOpts) => {
  return useQuery({
    queryKey: constellationKeys.sky(days),
    queryFn: () => constellationApi.getSky(days, referenceSilent(opts)),
    select: (data) => data.days,
    ...referenceMeta(opts),
  });
};

export const useConstellationCollection = (opts?: ReferenceOpts) => {
  return useQuery({
    queryKey: constellationKeys.collection(),
    queryFn: () => constellationApi.getCollection(referenceSilent(opts)),
    ...referenceMeta(opts),
  });
};
