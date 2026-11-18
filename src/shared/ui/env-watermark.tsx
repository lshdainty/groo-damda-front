import { config } from "@/shared/config/env";

/**
 * 개발 환경 워터마크 컴포넌트
 * 운영 배포(VITE_ENV=prod)가 아닐 때 화면 중앙에 "DEVELOPMENT" 워터마크를 표시합니다.
 *
 * 판정은 빌드 시점 env 로 한다 — Jenkins 가 배포 환경별 <env>.env 를 .env.production 으로
 * 복사해 빌드하므로 dev/prod 가 번들에 확정된다. (이전엔 window.location.hostname 을
 * 도메인 문자열과 비교했는데, 실제 운영 주소가 서브도메인이라 운영에서도 워터마크가
 * 노출됐다. 도메인·서브도메인이 바뀌어도 안 깨지도록 env 기준으로 전환.)
 */
export const EnvWatermark = () => {
  if (config.isProd) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-(--z-dev) overflow-hidden">
      <span className="text-7xl font-bold text-fg-neutral-subtle/10 select-none tracking-widest whitespace-nowrap">
        DEVELOPMENT
      </span>
    </div>
  );
};
