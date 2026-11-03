# 작업 워크플로우 규칙

## 칸반보드 업데이트 규칙
- **버그 발견 즉시** → 칸반보드에 티켓 생성 (status: todo, priority 지정)
- **수정 시작** → status: in_progress로 변경
- **수정 완료** → status: done으로 변경
- **칸반보드 API**: http://localhost:3001/api/tasks
  - POST: 생성 (project_id: 2 필수)
  - PATCH: 상태 변경
  - 에이전트 ID: frontend=1, backend=2, tech-lead=3, infra=5, tester=6

## QA 테스트 규칙
- API 직접 호출(curl)이 아니라 **반드시 UI에서 직접 클릭/입력**하여 테스트
- 폼 저장, 토글, 드롭다운 등 **모든 인터랙션을 실제로 수행**
- 코드 레벨 분석도 병행하여 데이터 변환, 타입 불일치 등 숨은 버그 찾기

## 빌드 확인
- 프론트: `cd /Users/lshdainty/study/groo-damda-front && npx vite build`
- 백엔드: `cd /Users/lshdainty/study/groo-damda-back && ./gradlew build -x test`
- 수정 후 반드시 빌드 확인

## 커밋
- 사용자가 명시적으로 요청할 때만 커밋
