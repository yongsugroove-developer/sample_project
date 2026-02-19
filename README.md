# GTO 확률 계산기

카드 이미지를 클릭해서 핸드/보드를 선택하고,
몬테카를로 승률 + 레인지 기반 샘플링 + GTO 프리셋/외부 솔버 API 결과를 함께 확인하는 웹 앱입니다.

## 실행

```bash
python3 -m http.server 4173
```

브라우저에서 `http://localhost:4173`.

## 사용 방법

1. 스트리트를 선택합니다(프리플랍/플랍/턴/리버).
2. **핸드 2장**, **보드 카드(스트리트에 맞는 장수)**를 카드 이미지로 선택합니다.
   - 카드 슬롯 우클릭 또는 X 버튼: 카드 제거
3. 상대 레인지(`22+,A2s+,KTs+,QJs,ATo+`)를 입력하거나 프리셋 버튼을 누릅니다.
4. 상대 인원/팟오즈/시뮬레이션 횟수, 포지션/IP-OOP, 스택, 베팅 사이즈를 입력합니다.
5. 빠른 입력(`As Kd | Qh Jh 2c`) 또는 최근 시나리오 복원을 사용할 수 있습니다.
6. 분석 모드 선택:
   - **하이브리드**: 로컬 시뮬레이션 + 프리플랍 GTO 프리셋
   - **외부 GTO 솔버 API 우선**: URL 입력 시 POST로 액션 요청
7. 계산 버튼을 눌러 승률/무승부율/오차범위/브레이크이븐/추천 액션을 확인합니다.

## 외부 솔버 API 포맷

`POST {solverUrl}`

요청 예시:

```json
{
  "street": "flop",
  "hero": ["As", "Kd"],
  "board": ["Qh", "Jh", "2c"],
  "opponents": 1,
  "potOdds": 0.33,
  "equity": 0.51,
  "villainRange": "22+,A2s+,AJo+,KTs+,QJs",
  "position": "ip",
  "stackBb": 100,
  "betSize": 66
}
```

응답 예시:

```json
{
  "action": "Bet 66% Pot",
  "mix": "Bet 72% / Check 28%",
  "reason": "OOP capped range on turn"
}
```

## 주의

- 카드 이미지는 `assets/cards/*.svg`(52장)로 프로젝트 내부에 포함되어 있습니다.
- 로컬 프리셋은 간소화된 GTO 스타일 범위이며, 완전한 솔버 출력이 아닙니다.
- 실제 GTO 결과가 필요하면 외부 솔버 API를 연결하세요.
