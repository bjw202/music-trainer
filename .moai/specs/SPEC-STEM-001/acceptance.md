---
spec_id: SPEC-STEM-001
title: AI 음원 분리 및 스템 믹서 - 수락 기준
version: 1.0.0
status: draft
created: 2026-02-15
updated: 2026-02-15
author: jw
tags: demucs, stem-mixer, source-separation, web-audio, multi-track
---

# SPEC-STEM-001: 수락 기준

## 1. 시나리오 1: 음원 분리 전체 플로우

### Given-When-Then

```gherkin
Feature: 음원 분리 전체 플로우

  Scenario: 사용자가 오디오 파일을 분리한다
    Given 사용자가 오디오 파일을 Music Trainer에 로드한 상태이다
    And 오디오가 정상적으로 파형에 표시되고 있다
    When 사용자가 "Separate" 버튼을 클릭한다
    Then 파일이 백엔드 서버에 업로드된다
    And 진행률 표시가 나타나며 0%에서 시작한다
    And 진행률이 점진적으로 증가하여 100%에 도달한다
    And 분리 완료 후 4개 스템(vocals, drums, bass, other)이 자동으로 다운로드된다
    And 스템 믹서 모드로 자동 전환된다
    And 4개 스템 트랙이 믹서 패널에 표시된다

  Scenario: 분리 중 오류가 발생한다
    Given 사용자가 오디오 파일을 로드한 상태이다
    When 사용자가 "Separate" 버튼을 클릭한다
    And 서버에서 분리 처리 중 오류가 발생한다
    Then 에러 메시지가 사용자에게 표시된다
    And "재시도" 버튼이 제공된다
    And 단일 트랙 모드는 정상 유지된다

  Scenario: 이미 분리된 파일을 재요청한다
    Given 사용자가 이전에 동일한 오디오 파일을 분리한 적이 있다
    When 사용자가 같은 파일에 대해 "Separate" 버튼을 클릭한다
    Then 캐시된 결과를 즉시 반환한다
    And 진행률 표시 없이 바로 스템 믹서 모드로 전환된다
```

---

## 2. 시나리오 2: 스템별 볼륨 변경

### Given-When-Then

```gherkin
Feature: 스템별 볼륨 제어

  Scenario: vocals 볼륨을 0%로 변경한다
    Given 스템 믹서 모드에서 4개 스템이 로드되어 재생 중이다
    And vocals 볼륨이 100%로 설정되어 있다
    When 사용자가 vocals 볼륨 슬라이더를 0%로 변경한다
    Then vocals의 GainNode 값이 0.0으로 설정된다
    And vocals 오디오 출력이 음소거된다
    And drums, bass, other 스템은 변경 없이 그대로 재생된다
    And vocals 볼륨 표시가 "0%"로 업데이트된다

  Scenario: bass 볼륨을 50%로 변경한다
    Given 스템 믹서 모드에서 재생 중이다
    And bass 볼륨이 100%로 설정되어 있다
    When 사용자가 bass 볼륨 슬라이더를 50%로 변경한다
    Then bass의 effectiveGain이 0.5로 계산된다
    And bass 오디오 출력 레벨이 절반으로 감소한다
    And 볼륨 변경이 100ms 이내에 오디오에 반영된다

  Scenario: 빠르게 연속으로 볼륨을 조작한다
    Given 스템 믹서 모드에서 재생 중이다
    When 사용자가 drums 볼륨 슬라이더를 빠르게 100% -> 30% -> 80%로 조작한다
    Then 최종 볼륨 80%가 정확히 반영된다
    And 오디오 끊김이나 글리치가 발생하지 않는다
```

---

## 3. 시나리오 3: 솔로 기능

### Given-When-Then

```gherkin
Feature: 솔로 기능

  Scenario: drums 솔로를 활성화한다
    Given 스템 믹서 모드에서 4개 스템이 모두 재생 중이다
    And 어떤 솔로도 활성화되지 않은 상태이다
    When 사용자가 drums 솔로 버튼을 클릭한다
    Then drums만 재생된다
    And vocals, bass, other의 effectiveGain이 0이 된다
    And drums 솔로 버튼이 활성 상태로 시각 표시된다
    And vocals, bass, other 트랙이 시각적으로 비활성 표시된다

  Scenario: 다중 솔로를 활성화한다
    Given drums 솔로가 활성화된 상태이다
    When 사용자가 bass 솔로 버튼을 추가로 클릭한다
    Then drums과 bass만 재생된다
    And vocals, other의 effectiveGain이 0이 된다
    And drums, bass 솔로 버튼이 모두 활성 상태이다

  Scenario: 솔로를 해제한다
    Given drums 솔로만 활성화된 상태이다
    When 사용자가 drums 솔로 버튼을 다시 클릭한다
    Then 솔로가 해제된다
    And 4개 스템 모두 각자의 설정된 볼륨으로 재생된다
    And 이전에 설정한 개별 볼륨 값이 유지된다
```

---

## 4. 시나리오 4: 속도/피치 연동

### Given-When-Then

```gherkin
Feature: 속도/피치 연동

  Scenario: 속도를 0.8x로 변경한다
    Given 스템 믹서 모드에서 4개 스템이 재생 중이다
    And 속도가 1.0x, 피치가 0 반음으로 설정되어 있다
    When 사용자가 속도를 0.8x로 변경한다
    Then SoundTouch 인스턴스의 tempo가 0.8로 설정된다
    And 모든 4개 스템에 동일한 속도 0.8x가 적용된다
    And 스템 간 재생 위치 동기화가 유지된다
    And 피치는 0 반음으로 변경 없이 유지된다

  Scenario: 피치를 +3 반음으로 변경한다
    Given 스템 믹서 모드에서 재생 중이다
    When 사용자가 피치를 +3 반음으로 변경한다
    Then SoundTouch 인스턴스의 pitch가 적절히 변경된다
    And 모든 4개 스템에 동일한 피치가 적용된다
    And 재생 속도는 변경 없이 유지된다

  Scenario: 속도와 피치를 동시에 변경한다
    Given 스템 믹서 모드에서 재생 중이다
    When 사용자가 속도를 0.7x, 피치를 -2 반음으로 변경한다
    Then 두 파라미터가 모든 스템에 동시에 적용된다
    And 스템 간 오프셋이나 지연이 발생하지 않는다
    And 오디오 끊김이 발생하지 않는다
```

---

## 5. 시나리오 5: A-B 루프 연동

### Given-When-Then

```gherkin
Feature: A-B 루프 연동

  Scenario: 스템 믹서 모드에서 A-B 루프가 동작한다
    Given 스템 믹서 모드에서 4개 스템이 재생 중이다
    And A 지점이 10초, B 지점이 20초로 설정되어 있다
    When 재생 위치가 B 지점(20초)에 도달한다
    Then 모든 4개 스템이 동시에 A 지점(10초)으로 돌아간다
    And 루프가 끊김 없이 반복 재생된다
    And 각 스템의 개별 볼륨/뮤트/솔로 설정이 유지된다

  Scenario: A-B 루프 중 볼륨을 변경한다
    Given A-B 루프가 설정된 상태에서 반복 재생 중이다
    When 사용자가 vocals 볼륨을 30%로 변경한다
    Then 볼륨 변경이 즉시 반영된다
    And 루프 반복이 중단되지 않는다
    And 다음 루프 사이클에서도 변경된 볼륨이 유지된다

  Scenario: 스템 믹서 모드에서 새 A-B 루프를 설정한다
    Given 스템 믹서 모드에서 재생 중이다
    And 기존 A-B 루프는 설정되지 않았다
    When 사용자가 파형에서 A 지점과 B 지점을 설정한다
    Then 루프 영역이 파형에 시각적으로 표시된다
    And 모든 스템이 해당 구간 내에서 반복 재생된다
    And 키보드 단축키(I/O)로도 루프 설정이 가능하다
```

---

## 6. 시나리오 6: 뮤트 기능

### Given-When-Then

```gherkin
Feature: 뮤트 기능

  Scenario: vocals를 뮤트한다
    Given 스템 믹서 모드에서 재생 중이다
    And vocals 볼륨이 75%로 설정되어 있다
    When 사용자가 vocals 뮤트 버튼을 클릭한다
    Then vocals의 effectiveGain이 0이 된다
    And vocals 뮤트 버튼이 활성(음소거) 상태로 표시된다
    And vocals 볼륨 슬라이더는 75% 위치를 유지한다 (시각적으로)

  Scenario: 뮤트를 해제한다
    Given vocals가 뮤트된 상태이다 (이전 볼륨 75%)
    When 사용자가 vocals 뮤트 버튼을 다시 클릭한다
    Then vocals의 effectiveGain이 0.75로 복원된다
    And vocals 뮤트 버튼이 비활성(재생) 상태로 표시된다

  Scenario: 뮤트와 솔로를 함께 사용한다
    Given drums 솔로가 활성화된 상태이다
    When 사용자가 drums 뮤트 버튼을 클릭한다
    Then drums 솔로가 활성이지만 뮤트도 활성이므로 drums 소리가 나지 않는다
    And 결과적으로 모든 스템이 음소거 상태가 된다
```

---

## 7. 시나리오 7: 모드 전환

### Given-When-Then

```gherkin
Feature: 단일 트랙 <-> 스템 믹서 모드 전환

  Scenario: 스템 믹서 모드에서 단일 트랙으로 복귀한다
    Given 스템 믹서 모드에서 재생 중이다
    And vocals가 뮤트, drums가 솔로 상태이다
    When 사용자가 "단일 트랙" 모드로 전환한다
    Then 스템 믹서 패널이 닫힌다
    And 원본 오디오 파일로 단일 트랙 재생이 시작된다
    And 기존 AudioEngine이 재활성화된다
    And 이전에 설정한 속도/피치 값이 유지된다

  Scenario: 단일 트랙에서 스템 믹서로 전환한다 (이미 분리 완료)
    Given 단일 트랙 모드에서 재생 중이다
    And 이전에 분리를 완료하여 스템 데이터가 존재한다
    When 사용자가 "스템 믹서" 모드로 전환한다
    Then 스템 믹서 패널이 나타난다
    And 4개 스템이 현재 재생 위치에서 재생된다
    And 이전에 설정한 볼륨/뮤트/솔로 상태가 복원된다
```

---

## 8. 품질 게이트 (Quality Gates)

### 8.1 백엔드 품질

| 항목 | 기준 | 검증 방법 |
|------|------|---------|
| 단위 테스트 | 모든 API 엔드포인트 테스트 통과 | pytest |
| Demucs 분리 | htdemucs 모델로 정상 분리 | 수동 검증 + 자동 테스트 |
| SSE 스트리밍 | 진행률 0~100% 정상 전송 | 통합 테스트 |
| 동시 처리 제한 | 3번째 요청이 큐에 대기 | 부하 테스트 |
| 캐싱 | 동일 파일 재요청 시 캐시 히트 | 단위 테스트 |
| 파일 검증 | 지원 포맷만 수락, 500MB 초과 거부 | 단위 테스트 |

### 8.2 프론트엔드 품질

| 항목 | 기준 | 검증 방법 |
|------|------|---------|
| 코드 커버리지 | 85% 이상 | Vitest --coverage |
| StemMixer 엔진 | 4스템 동시 재생 + 개별 볼륨 제어 | 단위 테스트 |
| 솔로/뮤트 로직 | effectiveGain 계산 정확성 | 단위 테스트 |
| 상태 관리 | stemStore 모든 액션 검증 | 단위 테스트 |
| TypeScript | 타입 에러 0개 | tsc --noEmit |

### 8.3 E2E 품질

| 항목 | 기준 | 검증 방법 |
|------|------|---------|
| 전체 시나리오 | 7개 시나리오 모두 통과 | Playwright |
| 볼륨 반영 지연 | 100ms 이내 | 타이밍 검증 |
| 스템 로딩 시간 | 3초 이내 (테스트 fixture 기준) | 타이밍 검증 |
| 오디오 끊김 | 0건 | 오디오 출력 분석 |
| 크로스 브라우저 | Chromium 테스트 통과 | Playwright Chromium |

### 8.4 성능 기준

| 항목 | 기준 |
|------|------|
| 스템 로딩 시간 | 4개 스템 WAV 다운로드 + 디코딩 3초 이내 |
| 볼륨 변경 반응 속도 | 슬라이더 조작 후 100ms 이내 오디오 반영 |
| Seek 반응 속도 | 파형 클릭 후 200ms 이내 모든 스템 위치 이동 |
| 메모리 사용량 | 5분 곡 기준 4스템 로드 시 500MB 미만 |
| 스템 간 동기화 오차 | 10ms 미만 |

---

## 9. 완료 정의 (Definition of Done)

- [ ] 백엔드 Demucs 분리 API 3개 엔드포인트 구현 및 테스트 통과
- [ ] StemMixer 오디오 엔진 구현 (4스템 동시 재생, 개별 볼륨, 솔로/뮤트)
- [ ] 스템 믹서 UI 컴포넌트 구현 (StemMixerPanel, StemTrack, SeparationButton, SeparationProgress)
- [ ] 단일 트랙 <-> 스템 믹서 모드 전환 구현
- [ ] A-B 루프 + 속도/피치 제어가 스템 믹서 모드에서 정상 동작
- [ ] E2E 테스트 7개 시나리오 통과
- [ ] 프론트엔드 코드 커버리지 85% 이상
- [ ] TypeScript 타입 에러 0개
- [ ] ESLint 경고 0개
