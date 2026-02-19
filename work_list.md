# FE Work Log

## FE 작업 로그 (2026-02-19)

### Scope checked
- `index.html`
- `styles.css`
- `app.js`

### Findings (prioritized)
1. [P1][정확성] 추천 믹스 비율 합계가 100%를 초과할 수 있음
- 근거: `app.js:407`~`app.js:412`에서 `Raise 5%` 고정 + `callRatio` 하한 5% + `foldRatio` 최대 95% 조합 시 105%가 가능함.
2. [P1][접근성/표준] 버튼 중첩 구조 사용
- 근거: 슬롯을 버튼으로 만들고(`app.js:203`) 삭제 버튼(`app.js:170`)을 자식으로 추가함.
- 영향: 브라우저/스크린리더별 포커스 및 이벤트 해석이 불안정할 수 있음.
3. [P1][성능/UX] 대량 시뮬레이션이 메인 스레드를 장시간 점유
- 근거: 동기 루프(`app.js:416`~`app.js:467`) + 최대 반복 50,000(`index.html:39`) + 최대 상대 8명(`index.html:29`).
- 영향: 계산 중 UI 멈춤, 입력 지연, 중복 클릭 가능성 증가.
4. [P1][안정성] `localStorage` JSON 파싱 예외 미처리
- 근거: `JSON.parse` 직접 호출(`app.js:490`, `app.js:501`, `app.js:514`).
- 영향: 저장 데이터 손상 시 초기 렌더 단계에서 오류 가능.
5. [P2][입력 검증] 일부 수치 필드 런타임 검증 누락
- 근거: `potOdds`, `stackBb`, `betSize`는 숫자 변환만 수행(`app.js:542`, `app.js:548`, `app.js:549`), 범위/NaN 검사 없음.
6. [P2][동시성/UX] 계산 중 버튼 잠금/진행 상태 없음
- 근거: `runBtn` 클릭 시 재진입 방지 처리 부재(`app.js:645`).
7. [P3][접근성] 비활성 보드 슬롯이 시각적으로만 비활성
- 근거: `opacity`만 조정(`app.js:198`), `disabled`/`aria-disabled` 미적용.
8. [P3][i18n/가독성] 사용자 문구에 내부 키가 그대로 노출됨
- 근거: 오류 문구에 `${street}` 직접 사용(`app.js:152`, `app.js:557`)으로 `preflop/flop` 등 내부 값 노출.
9. [P3][유지보수성] 단일 파일에 역할이 과도하게 혼재
- 근거: `app.js` 679라인에 UI 렌더, 시뮬레이션, 저장소, API 요청 로직이 집중됨.

### Improvement proposals
1. 믹스 비율 계산 유틸을 분리하고 합계 100% 보정 로직(정규화 또는 fold 재계산)을 적용.
2. 슬롯 구조를 `div + 선택 버튼 + 삭제 버튼`으로 재구성해 버튼 중첩을 제거.
3. 시뮬레이션 루프를 청크 단위로 분할하고 계산 중 버튼 비활성화/상태 문구를 추가.
4. `safeParseHistory()`를 도입해 파싱 실패 시 복구(키 초기화) 후 안내 메시지를 표시.
5. `validateNumericInputs()` 공통 검증으로 `potOdds(0~100)`, `stackBb(5~300)`, `betSize(0~200)`, `NaN` 처리.
6. 비활성 보드 슬롯에 `disabled` 및 `aria-disabled="true"`를 부여.
7. 사용자 메시지에서 내부 키(`preflop` 등)를 한국어 라벨로 매핑해 노출.
8. `app.js`를 최소 논리 단위(UI/계산/검증)로 분리하는 리팩터링을 단계적으로 진행.

### Validation plan (명령/체크리스트만, 실행 금지)
- 실행 명령(사람 실행):
- `python -m http.server 4173`
- 브라우저에서 `http://localhost:4173` 접속
- 확인 체크리스트(사람 확인):
- 추천 믹스 출력이 항상 합계 100%인지 확인
- 계산 중 버튼이 잠기고 중복 클릭이 차단되는지 확인
- `potOdds`, `stackBb`, `betSize`에 공백/문자/범위 밖 입력 시 에러 문구 확인
- `localStorage` 데이터 손상 상황에서 화면이 정상 복구되는지 확인
- 키보드만으로 슬롯/다이얼로그 조작 시 포커스 이동이 자연스러운지 확인
- `iterations=50000`, `opponents=8`에서 UI 프리징 체감 개선 여부 확인

## BE 작업 로그 (2026-02-19)

### Scope checked
- `README.md` (실행 방식/외부 Solver API 명세)
- `app.js` (`requestExternalSolver`, `runCalculation` 연동 흐름)
- `index.html` (`mode`, `solverUrl` 입력 경로)
- 레포 구조 전체 (`apps/api`, `backend`, `server`, `services` 부재 확인)

### Findings (prioritized)
1. [P1][백엔드 부재] 서버 코드/엔드포인트가 없어 외부 Solver API를 브라우저에서 직접 호출함.
- 영향: 인증/비밀값 보호 불가, CORS 정책에 강결합, 운영 통제 지점 부재.
2. [P1][API 계약 검증 미흡] Solver 응답을 `action/mix/reason`으로 가정하고 스키마/타입 검증이 없음.
- 영향: 필드 누락/타입 불일치 시 오동작 또는 잘못된 안내 노출 가능.
3. [P1][타임아웃/재시도 부재] `fetch` 호출에 timeout/retry/backoff/abort 제어가 없음.
- 영향: 지연/일시 장애 시 복구력 낮고 사용자 대기시간이 비결정적임.
4. [P2][CORS/배포 가정 불명확] 임의 `solverUrl` 직접 호출 구조라 대상 API의 CORS 허용 여부에 런타임이 좌우됨.
- 영향: 로컬/운영 환경 간 동작 편차와 배포 리스크 증가.
5. [P2][운영 견고성 부족] 요청 ID, 에러 분류, 레이트 제한, 가용성 점검 포인트가 없음.
- 영향: 장애 원인 파악/재현/완화 난이도 상승.

### Improvement proposals
1. 최소 BFF 엔드포인트(`/api/solver/decision`)를 두고 외부 Solver 호출을 서버로 이동.
2. BE에서 요청/응답 계약 검증 추가(필수 필드, 타입, 범위, enum).
3. 외부 호출 정책 정의: timeout(예: 3~5초), 제한적 retry(예: 1~2회, 5xx/timeout만), 표준 에러 코드.
4. 장애 응답 표준화: 4xx(입력 오류), 502/504(업스트림 오류/지연)와 사용자 메시지 매핑.
5. 운영성 보강: 구조화 로그(요청ID/지연/에러코드), 기본 rate limit, health/readiness 체크.
6. 단기 완화(백엔드 도입 전): `solverUrl` 허용 정책 문서화와 응답 필드 최소 검증 추가.

### Validation plan (commands/checklist only, no execution)
- 점검 명령(실행 계획):
- `rg -n "requestExternalSolver|fetch\\(|solverUrl|mode" app.js index.html README.md`
- `rg --files`
- 확인 체크리스트(실행은 리더 승인 후):
- 정상 응답 계약(`action/mix/reason`) 수신 시 필드 매핑/표시 일관성 확인
- 응답 필드 누락/타입 오류 시 표준 에러 처리(502 등)와 폴백 메시지 확인
- solver 지연/무응답 시 timeout 처리와 사용자 피드백 확인
- 일시적 5xx에서 제한적 retry 정책 동작 여부 확인
- CORS 제어가 브라우저가 아니라 BE(BFF) 경계에서 수행되는지 확인
- 요청ID 기반 로그 상관관계 추적 가능 여부 확인
