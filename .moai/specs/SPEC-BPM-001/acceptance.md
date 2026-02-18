---
spec_id: SPEC-BPM-001
title: 자동 BPM 감지 및 메트로놈 기능 - 수락 기준
version: 1.0.0
status: draft
created: 2026-02-17
updated: 2026-02-17
author: jw
tags: bpm, metronome, beat-tracking, lookahead-scheduler, madmom, web-audio
---

# SPEC-BPM-001: 수락 기준

## 1. 시나리오 1: 오디오 로드 시 자동 BPM 분석

### Given-When-Then

```gherkin
Feature: 오디오 로드 시 자동 BPM 분석

  Scenario: 사용자가 오디오 파일을 로드하면 BPM이 자동 분석된다
    Given 사용자가 Music Trainer 앱을 열고 있다
    When 사용자가 오디오 파일(MP3/WAV/FLAC)을 로드한다
    Then 파일이 백엔드 POST /api/v1/bpm/analyze 엔드포인트로 전송된다
    And "Analyzing BPM..." 로딩 표시가 나타난다
    And 분석 완료 후 BPM 값이 MetronomePanel에 표시된다
    And 비트 타임스탬프 배열이 bpmStore에 저장된다
    And 신뢰도 점수(0-1)가 함께 표시된다

  Scenario: BPM 분석이 실패한다
    Given 사용자가 오디오 파일을 로드한 상태이다
    When BPM 분석 요청이 네트워크 오류 또는 서버 오류로 실패한다
    Then 에러 메시지가 MetronomePanel에 표시된다
    And "재분석" 버튼이 제공된다
    And 메트로놈 토글은 비활성 상태로 유지된다
    And 기존 오디오 재생 기능은 정상 동작한다

  Scenario: 이전에 분석된 파일을 재로드한다
    Given 이전에 동일한 오디오 파일의 BPM을 분석한 적이 있다
    When 사용자가 같은 파일을 다시 로드한다
    Then 백엔드 캐시(SHA256 해시)에서 즉시 결과를 반환한다
    And 로딩 시간이 1초 미만이다
```

---

## 2. 시나리오 2: 메트로놈 토글 및 클릭 재생

### Given-When-Then

```gherkin
Feature: 메트로놈 토글 및 클릭 재생

  Scenario: 메트로놈을 활성화하고 오디오를 재생한다
    Given BPM 분석이 완료되어 비트 타임스탬프가 저장된 상태이다
    And 메트로놈이 비활성 상태이다
    When 사용자가 메트로놈 토글을 활성화한다
    And 사용자가 오디오를 재생한다
    Then 감지된 비트 위치에 동기화된 클릭 사운드가 재생된다
    And 모든 비트에 동일한 클릭음(440Hz)이 재생된다
    And 클릭 사운드 지속 시간은 30ms이다
    And 클릭이 SoundTouch 파이프라인을 우회하여 재생된다

  Scenario: 재생 중 메트로놈을 비활성화한다
    Given 메트로놈이 활성화된 상태에서 오디오가 재생 중이다
    When 사용자가 메트로놈 토글을 비활성화한다
    Then 모든 스케줄된 클릭 사운드가 즉시 중단된다
    And Web Worker 타이머가 중지된다
    And 오디오 재생은 영향 없이 계속된다

  Scenario: BPM 데이터 없이 메트로놈을 활성화한다
    Given BPM 분석이 아직 완료되지 않았거나 실패한 상태이다
    When 사용자가 메트로놈 토글을 시도한다
    Then 메트로놈이 활성화되지 않는다
    And "BPM 분석이 필요합니다" 안내 메시지가 표시된다

  Scenario: 오디오가 일시정지 상태에서 메트로놈이 활성이다
    Given 메트로놈이 활성화된 상태이다
    And 오디오가 일시정지 중이다
    Then 메트로놈 클릭이 재생되지 않는다
    When 사용자가 재생을 재개한다
    Then 현재 위치의 다음 비트부터 클릭이 다시 재생된다
```

---

## 3. 시나리오 3: 속도 변경 시 메트로놈 자동 조정

### Given-When-Then

```gherkin
Feature: 속도 변경 시 메트로놈 자동 조정

  Scenario: 속도를 0.8x로 변경한다
    Given 메트로놈이 활성화된 상태에서 오디오가 재생 중이다
    And 원본 BPM이 120.0이다
    When 사용자가 재생 속도를 0.8x로 변경한다
    Then 메트로놈 클릭 간격이 자동으로 조정된다
    And 유효 BPM이 96.0 (120.0 * 0.8)으로 표시된다
    And 비트 타임스탬프 배열은 재계산되지 않는다
    And 속도 변경 후 25ms 이내에 새 타이밍이 적용된다

  Scenario: 속도를 1.5x로 변경한다
    Given 메트로놈이 활성화된 상태에서 오디오가 재생 중이다
    And 원본 BPM이 120.0이다
    When 사용자가 재생 속도를 1.5x로 변경한다
    Then 유효 BPM이 180.0 (120.0 * 1.5)으로 표시된다
    And 클릭이 비트 위치와 정확히 동기화된다

  Scenario: 재생 중 속도를 여러 번 변경한다
    Given 메트로놈이 활성화된 상태에서 오디오가 재생 중이다
    When 사용자가 속도를 1.0x -> 0.7x -> 1.2x -> 0.5x로 빠르게 변경한다
    Then 각 변경 후 메트로놈이 정확히 동기화를 유지한다
    And 오디오 글리치나 더블 클릭이 발생하지 않는다
```

---

## 4. 시나리오 4: Seek 시 메트로놈 재동기화

### Given-When-Then

```gherkin
Feature: Seek 시 메트로놈 재동기화

  Scenario: 파형 클릭으로 새 위치로 이동한다
    Given 메트로놈이 활성화된 상태에서 오디오가 재생 중이다
    When 사용자가 파형의 1분 30초 지점을 클릭한다
    Then 모든 대기 중인 스케줄된 클릭이 취소된다
    And 1분 30초 이후 가장 가까운 다음 비트부터 클릭이 재개된다
    And Seek 후 더블 클릭이 발생하지 않는다

  Scenario: 키보드로 5초 앞으로 이동한다
    Given 메트로놈이 활성화된 상태에서 30초 지점에서 재생 중이다
    When 사용자가 오른쪽 방향키를 눌러 5초 앞으로 이동한다
    Then 35초 이후 가장 가까운 다음 비트부터 클릭이 재개된다
    And 이동 사이 메트로놈 지연이 100ms 이내이다
```

---

## 5. 시나리오 5: A-B 루프와 메트로놈

### Given-When-Then

```gherkin
Feature: A-B 루프와 메트로놈

  Scenario: A-B 루프 구간에서 메트로놈이 동작한다
    Given 메트로놈이 활성화된 상태이다
    And A 지점이 10초, B 지점이 20초로 설정되어 있다
    When 오디오가 재생되어 B 지점(20초)에 도달한다
    Then 재생이 A 지점(10초)으로 돌아간다
    And 메트로놈이 10초 이후 첫 번째 비트부터 다시 클릭을 시작한다
    And [10초, 20초) 범위 밖의 비트는 스케줄되지 않는다

  Scenario: A-B 루프를 반복 재생한다
    Given A-B 루프가 설정되고 메트로놈이 활성화된 상태에서 재생 중이다
    When 루프가 3회 반복된다
    Then 매 루프마다 동일한 비트 위치에서 정확히 클릭이 재생된다
    And 루프 간 전환 시 클릭 누락이나 더블 클릭이 없다

  Scenario: A-B 루프를 비활성화한다
    Given A-B 루프가 설정되고 메트로놈이 활성화된 상태에서 재생 중이다
    When 사용자가 A-B 루프를 비활성화한다
    Then 메트로놈이 전체 비트 배열을 사용하여 클릭을 스케줄한다
    And 현재 위치에서 가장 가까운 다음 비트부터 계속 재생된다
```

---

## 6. 시나리오 6: 독립 메트로놈 볼륨

### Given-When-Then

```gherkin
Feature: 독립 메트로놈 볼륨

  Scenario: 메트로놈 볼륨을 50%로 변경한다
    Given 메트로놈이 활성화된 상태에서 재생 중이다
    And 메트로놈 볼륨이 100%이다
    When 사용자가 메트로놈 볼륨 슬라이더를 50%로 변경한다
    Then 메트로놈 GainNode 값이 0.5로 설정된다
    And 클릭 사운드 크기가 절반으로 감소한다
    And 오디오(마스터) 볼륨은 변경 없이 유지된다

  Scenario: 마스터 볼륨을 변경해도 메트로놈 볼륨은 유지된다
    Given 메트로놈 볼륨이 80%로 설정되어 있다
    When 사용자가 마스터 볼륨을 30%로 변경한다
    Then 오디오 출력 볼륨이 30%로 감소한다
    And 메트로놈 클릭 볼륨은 80%로 유지된다

  Scenario: 마스터 뮤트를 해도 메트로놈은 들린다
    Given 메트로놈이 활성화된 상태에서 재생 중이다
    When 사용자가 마스터 뮤트를 활성화한다
    Then 오디오 출력이 음소거된다
    And 메트로놈 클릭은 계속 재생된다 (별도 GainNode 경로)

  Scenario: 메트로놈 볼륨을 0%로 변경한다
    Given 메트로놈이 활성화된 상태에서 재생 중이다
    When 사용자가 메트로놈 볼륨을 0%로 변경한다
    Then 메트로놈 GainNode 값이 0.0으로 설정된다
    And 클릭 사운드가 들리지 않는다
    And 메트로놈 토글은 여전히 활성 상태이다 (볼륨만 0)
```

---

## 7. 시나리오 7: 스템 믹서 모드와 메트로놈

### Given-When-Then

```gherkin
Feature: 스템 믹서 모드와 메트로놈

  Scenario: 스템 믹서 모드에서 메트로놈이 동작한다
    Given 스템 분리가 완료되어 스템 믹서 모드에서 재생 중이다
    And BPM 분석이 완료된 상태이다
    When 사용자가 메트로놈을 활성화한다
    Then 메트로놈 클릭이 비트 위치에 맞게 재생된다
    And 동일 AudioContext를 공유하여 동기화가 유지된다
    And 스템 볼륨/솔로/뮤트 변경이 메트로놈에 영향을 주지 않는다

  Scenario: 단일 트랙에서 스템 믹서로 전환 시 메트로놈이 유지된다
    Given 단일 트랙 모드에서 메트로놈이 활성화된 상태이다
    When 사용자가 스템 믹서 모드로 전환한다
    Then 메트로놈 활성 상태가 유지된다
    And BPM 데이터와 메트로놈 볼륨이 보존된다
    And 전환 후 재생 시 메트로놈이 계속 동작한다
```

---

## 8. 시나리오 8: 백엔드 BPM API

### Given-When-Then

```gherkin
Feature: 백엔드 BPM 분석 API

  Scenario: 정상적인 MP3 파일로 BPM을 분석한다
    Given 백엔드 서버가 실행 중이다
    When POST /api/v1/bpm/analyze에 MP3 파일을 FormData로 전송한다
    Then 200 OK와 함께 bpm, beats[], confidence, file_hash가 반환된다
    And bpm 값은 양의 실수이다
    And beats 배열은 오름차순 정렬된 초 단위 타임스탬프이다
    And confidence 값은 0-1 범위이다

  Scenario: 지원하지 않는 파일 형식을 전송한다
    Given 백엔드 서버가 실행 중이다
    When POST /api/v1/bpm/analyze에 PNG 이미지 파일을 전송한다
    Then 400 Bad Request 에러가 반환된다
    And 에러 메시지에 지원 형식 목록이 포함된다

  Scenario: madmom이 실패하고 librosa로 폴백한다
    Given madmom 라이브러리가 설치되지 않았거나 처리 중 오류가 발생한다
    When BPM 분석 요청이 들어온다
    Then librosa로 자동 폴백하여 분석을 완료한다
    And 정상적인 bpm, beats[], confidence를 반환한다

  Scenario: 동일 파일을 재요청한다 (캐시)
    Given 이전에 동일 파일의 BPM을 분석하여 캐시에 저장되어 있다
    When 같은 SHA256 해시를 가진 파일로 다시 요청한다
    Then 캐시된 결과를 반환한다
    And 응답 시간이 1초 미만이다
```

---

## 9. 품질 게이트 (Quality Gates)

### 9.1 백엔드 품질

| 항목 | 기준 | 검증 방법 |
|------|------|---------|
| 단위 테스트 | BPM API 엔드포인트 테스트 통과 | pytest |
| madmom 분석 | 테스트 오디오 파일 BPM 검출 | pytest + fixture |
| librosa 폴백 | madmom 실패 시 자동 전환 | pytest mock |
| 캐싱 | 동일 해시 재요청 시 캐시 히트 | pytest |
| 파일 검증 | 지원 포맷만 수락 | pytest |
| 비동기 처리 | run_in_executor로 이벤트 루프 비차단 | pytest |

### 9.2 프론트엔드 품질

| 항목 | 기준 | 검증 방법 |
|------|------|---------|
| 코드 커버리지 | 85% 이상 | Vitest --coverage |
| MetronomeEngine | 스케줄링 로직, 이진 검색, 속도 조정 | Vitest (Mock AudioContext) |
| bpmStore | 모든 액션 및 상태 전이 검증 | Vitest |
| API 클라이언트 | FormData 구성, 에러 핸들링 | Vitest (Mock fetch) |
| TypeScript | 타입 에러 0개 | tsc --noEmit |

### 9.3 E2E 품질

| 항목 | 기준 | 검증 방법 |
|------|------|---------|
| BPM 분석 플로우 | 파일 로드 -> 분석 -> BPM 표시 | Playwright |
| 메트로놈 토글 | 토글 활성화 -> UI 상태 변경 | Playwright |
| 메트로놈 볼륨 | 슬라이더 조작 -> UI 반영 | Playwright |
| 속도 변경 | 속도 변경 -> 유효 BPM 표시 업데이트 | Playwright |

### 9.4 성능 기준

| 항목 | 기준 |
|------|------|
| BPM 분석 시간 | 5분 곡 기준 10초 이내 |
| 메트로놈 타이밍 정밀도 | 5ms 이내 지터 |
| 메트로놈 CPU 사용 | 2% 미만 |
| 볼륨 변경 반응 | 슬라이더 조작 후 100ms 이내 반영 |
| Seek 재동기화 | 100ms 이내 |

---

## 10. 완료 정의 (Definition of Done)

- [ ] 백엔드 POST /api/v1/bpm/analyze 엔드포인트 구현 및 테스트 통과
- [ ] madmom primary + librosa fallback BPM 서비스 구현
- [ ] SHA256 파일 해시 기반 캐싱 구현
- [ ] MetronomeEngine (Lookahead Scheduler + Web Worker) 구현 및 테스트 통과
- [ ] bpmStore (Zustand) 구현 및 테스트 통과
- [ ] useMetronome 훅 구현 (AudioEngine 연동)
- [ ] MetronomePanel UI 구현 (Logic Pro 다크 테마)
- [ ] 속도 변경 / Seek / A-B 루프 동기화 구현 및 테스트 통과
- [ ] 독립 메트로놈 볼륨 제어 구현
- [ ] E2E 테스트 8개 시나리오 통과
- [ ] 프론트엔드 코드 커버리지 85% 이상
- [ ] TypeScript 타입 에러 0개
- [ ] ESLint 경고 0개
