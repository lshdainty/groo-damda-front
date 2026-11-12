# 베이스는 버전을 고정한다 — 움직이는 태그는 빌드 시점 따라 내용물이 바뀐다. 업데이트는 태그를 올려서.
FROM node:22.23.2-alpine AS builder

WORKDIR /app

# 의존성 설치
COPY package.json package-lock.json* ./
RUN npm ci

# 소스 복사 및 빌드
COPY . .
RUN npm run i18n:generate && npm run build

# 실행 단계 — 비루트(uid 101) nginx. 1024 미만 포트를 못 물어 8080 을 쓴다.
# 엣지 nginx(prod/dev)의 프록시 대상도 :8080 이어야 한다 — 서버 conf 와 동시 전환.
# nginx 는 안정판(짝수) 최신 패치로 고정한다. 올릴 때는 nginx.org 보안 권고(security_advisories)와
# 대조한다 — 1.30.6 은 2026-11 기준 공개 권고 전부에서 '취약하지 않음'(보안 점검 INF-3).
FROM nginxinc/nginx-unprivileged:1.30.6-alpine AS runtime

# nginx 설정 복사
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 빌드 결과물 복사
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
