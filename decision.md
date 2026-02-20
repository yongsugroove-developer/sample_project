# FE Decision Log

## FE 결정/제안 (2026-02-19)

| id | status | 주제 | 제안 내용 | 리더/사용자 확인 포인트 |
|---|---|---|---|---|
| FE-01 | completed | 추천 믹스 비율 계산 | `Raise/Call/Fold` 합계가 항상 100%가 되도록 계산식을 보정한다. | 보정 방식(정규화 vs fold 재계산) 선택 |
| FE-02 | completed | 카드 슬롯 DOM 구조 | 버튼 중첩 제거를 위해 슬롯 컨테이너 + 선택 버튼 + 삭제 버튼 구조로 변경한다. | 마크업 변경 범위 승인 |
| FE-03 | completed | 고비용 계산 UX | 시뮬레이션을 청크 처리하고 계산 중 재클릭을 차단한다. | 진행 상태 표시 수준(간단 문구 vs 진행률) |
| FE-04 | proposed | 저장 데이터 손상 대응 | `localStorage` 파싱 실패 시 해당 키를 자동 초기화하고 1회 경고를 표기한다. | 자동 초기화 정책 수용 여부 |
| FE-05 | proposed | 수치 입력 검증 정책 | `potOdds/stackBb/betSize` 범위 초과/NaN 입력 시 계산을 중단하고 필드별 오류를 노출한다. | 자동 보정(clamp) 허용 여부 |
| FE-06 | proposed | 메시지 가독성/i18n | 내부 키(`preflop`, `flop` 등) 노출 대신 한국어 라벨 매핑을 사용한다. | 도메인 용어(영문 병기 여부) |
| FE-07 | proposed | 외부 솔버 대기시간 | 솔버 API 요청 타임아웃(예: 5초) 후 로컬 폴백 문구를 표준화한다. | 기본 타임아웃 값 |
| FE-08 | confirmed | 작업 제약 준수 | 의존성 추가/빌드 변경/테스트 실행 없이 FE 분석 문서만 작성한다. | 정책상 확정 |

## BE 결정/제안 (2026-02-19)

| id | status | 주제 | 제안 내용 | 리더/사용자 확인 사항 |
|---|---|---|---|---|
| BE-01 | confirmed | 백엔드 코드 부재 | 현재 레포에는 런타임 백엔드(`apps/api`, `backend`, `server`, `services`)가 없고, Solver 연동은 클라이언트 직접 호출 구조로 확인됨. | 확인 완료(현 상태 기준) |
| BE-02 | proposed | Solver 연동 경계(BFF) | 외부 Solver 호출을 BE 엔드포인트(`/api/solver/decision`)로 수렴해 CORS/보안/정책을 중앙 통제. | BFF 도입 승인 여부 |
| BE-03 | proposed | API 계약 검증 | 요청/응답 스키마 검증을 도입해 `action/mix/reason` 필수 계약과 타입 불일치 차단. | 허용할 에러 코드/메시지 규격 |
| BE-04 | proposed | timeout/retry 정책 | outbound timeout(3~5초), 제한적 retry(1~2회, 5xx/timeout만), 실패 시 502/504 표준화. | timeout/retry 기본값 확정 |
| BE-05 | proposed | CORS/배포 가정 명시 | 브라우저 직접 호출 대신 BE 경계에서 CORS를 관리하고 환경별 endpoint 정책을 분리. | 환경별 허용 도메인/엔드포인트 정책 |
| BE-06 | proposed | 운영 견고성 | 요청ID 기반 구조화 로그, 실패 분류, rate limit, health/readiness 체크를 최소 운영 기준으로 채택. | 최소 운영 기준 적용 범위 |
| BE-07 | confirmed | 제약 준수 | 네트워크 접근/테스트 실행/의존성 추가/빌드 변경 없이 문서 분석 및 제안만 수행. | 확인 완료 |
v