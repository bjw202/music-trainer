# SPEC-MVP-001: Acceptance Criteria

## Layer 1-3: 단일 기능 검증

### Scenario 1: 오디오 파일 로딩 성공

**Given** 사용자가 Music Trainer 앱을 열었을 때
**When** 사용자가 유효한 MP3 파일을 드래그 앤 드롭하면
**Then** 시스템은:
- 파일을 검증하고 AudioBuffer로 로드한다
- 파형을 Canvas에 렌더링한다
- 전체 길이를 mm:ss 형식으로 표시한다
- Play 버튼을 활성화한다

**Acceptance**:
- 파일 로드 완료 시간 < 5초 (30초 MP3 기준)
- 파형 Canvas에 비어있지 않은 픽셀 존재
- 전체 길이 표시 정확도 +-1초

---

### Scenario 2: 기본 재생 제어

**Given** 오디오 파일이 로드되어 있을 때
**When** 사용자가 Play 버튼을 클릭하면
**Then** 시스템은:
- 재생 상태를 playing으로 전환한다
- 현재 시간을 실시간으로 업데이트한다
- 파형에 재생 헤드를 표시한다

**And When** 사용자가 Pause 버튼을 클릭하면
**Then** 시스템은:
- 재생 상태를 paused로 전환한다
- 현재 재생 위치를 유지한다
- 재생 헤드를 현재 위치에 고정한다

**Acceptance**:
- Play 클릭 후 1초 내 currentTime 증가 확인
- Pause 클릭 후 1초간 currentTime 변화 없음 확인

---

### Scenario 3: 파형 Seek

**Given** 오디오 파일이 재생 중일 때
**When** 사용자가 파형의 50% 위치를 클릭하면
**Then** 시스템은:
- 재생 위치를 전체 길이의 50% 지점으로 이동한다
- 재생 상태를 유지한다

**Acceptance**:
- Seek 정확도 +-1%
- Seek 후 재생 지연 < 100ms

---

### Scenario 4: A-B 루프 재생

**Given** 오디오 파일이 로드되어 있을 때
**When** 사용자가 10초 위치에서 'I' 키로 A 지점 설정하고
**And** 20초 위치에서 'O' 키로 B 지점 설정하고
**And** 루프 토글을 활성화하면
**Then** 시스템은:
- 파형에 10초~20초 구간을 반투명 색상으로 강조 표시한다
- 재생 위치가 20초에 도달하면 즉시 10초로 되돌아간다
- 루프를 계속 반복한다

**And When** 사용자가 루프 토글을 비활성화하면
**Then** 시스템은 B 지점(20초)을 넘어 계속 재생한다

**Acceptance**:
- 루프 백 정확도 +-50ms
- 루프 비활성화 시 B 지점 통과 확인

---

### Scenario 5: 볼륨 제어 및 뮤트

**Given** 오디오 파일이 재생 중일 때
**When** 사용자가 볼륨 슬라이더를 50%로 드래그하면
**Then** GainNode.gain.value === 0.5

**And When** 사용자가 'M' 키로 뮤트하면
**Then** GainNode.gain.value === 0, 이전 볼륨(50%) 저장

**And When** 사용자가 다시 'M' 키로 언뮤트하면
**Then** GainNode.gain.value === 0.5 복원

**Acceptance**:
- 볼륨 변경 지연 < 50ms
- 뮤트/언뮤트 시 이전 볼륨 100% 정확 복원

---

### Scenario 6: 키보드 단축키

**Given** 오디오 파일이 로드되어 있을 때

| 키 | 동작 | 검증 |
|----|------|------|
| Space | 재생/일시정지 토글 | 상태 전환 확인 |
| Arrow Right | +5초 이동 | currentTime += 5 확인 |
| Arrow Left | -5초 이동 | currentTime -= 5 확인 (최소 0초) |
| I | A 지점 설정 | loopA === currentTime |
| O | B 지점 설정 | loopB === currentTime |
| A | A 지점으로 이동 (루프 활성 시) | currentTime === loopA, 재생 상태 유지 |
| M | 뮤트 토글 | GainNode 값 확인 |

**Acceptance**:
- 모든 단축키 응답 시간 < 100ms

---

### Scenario 7: A 키 루프 A 지점 이동

**Given** A-B 루프가 활성화되어 있을 때 (loopA=10초, loopB=30초, loopEnabled=true)
**And** 현재 재생 위치가 25초일 때

**When** 사용자가 'A' 키를 누르면
**Then** 시스템은:
- 재생 위치를 A 지점(10초)으로 즉시 이동한다
- 현재 재생 상태(playing/paused)를 유지한다

**Given** A-B 루프가 비활성화되어 있을 때
**When** 사용자가 'A' 키를 누르면
**Then** 시스템은 아무 동작도 하지 않는다 (currentTime 변화 없음)

**Acceptance**:
- A 지점 이동 정확도: currentTime === loopA (오차 +-50ms)
- 재생 중 이동 시 재생 상태 유지
- 루프 비활성 시 무반응 확인

---

## Layer 3.5: 복합 독립성 테스트 (Compound Independence Tests)

### 핵심 원칙
각 기능은 다른 기능이 사용되어도 **독립적으로** 동작해야 한다.
단일 기능 테스트를 통과하더라도, 복합 사용 시 상호 간섭이 발생할 수 있다.

---

### Category 1: 쌍별 독립성 (Pairwise Independence)

#### Test 1.1: Volume + Seek [CRITICAL]

**Setup**: Volume = 50%, Play 상태
**Actions**:
1. GainNode.gain.value === 0.5 확인
2. 파형 클릭으로 Seek to 30초
3. GainNode.gain.value 재확인

**Assertions**:
- GainNode.gain.value === 0.5 (Volume 유지)
- currentTime === 30초 (Seek 성공)
- controlStore.volume === 50 (상태 저장소 일치)

**잡는 버그**: Seek 로직이 GainNode를 재설정하거나 AudioContext를 재초기화하면 Volume이 초기화됨

---

#### Test 1.2: Mute + Seek [CRITICAL]

**Setup**: Volume = 70%, Mute 활성화
**Actions**:
1. Mute 상태, GainNode === 0 확인
2. Seek to 40초
3. Mute 상태 재확인

**Assertions**:
- controlStore.muted === true (Mute 유지)
- GainNode.gain.value === 0 (음소거 유지)
- controlStore.volume === 70 (이전 볼륨 보존)
- currentTime === 40초

**잡는 버그**: Seek 로직이 GainNode를 controlStore.volume으로 복원하면서 Mute 무시

---

#### Test 1.3: Play/Pause + Volume [HIGH]

**Setup**: Play 상태, currentTime = 10초
**Actions**:
1. playerStore.playing === true 확인
2. Volume을 30%로 변경
3. 재생 상태 재확인, 0.5초 후 currentTime 증가 확인

**Assertions**:
- playerStore.playing === true (재생 유지)
- GainNode.gain.value === 0.3
- currentTime > 10초 (재생 진행 중)

**잡는 버그**: Volume 변경이 AudioContext를 중단하거나 BufferSource를 재생성하면 재생이 멈춤

---

#### Test 1.4: A-B Loop + Volume [HIGH]

**Setup**: loopA=10초, loopB=20초, loopEnabled=true, Play 상태
**Actions**:
1. loopStore 상태 확인
2. Volume을 80%로 변경
3. currentTime이 20초 도달 시 10초로 되돌아가는지 확인

**Assertions**:
- Loop 동작 정상 (20초 -> 10초)
- GainNode.gain.value === 0.8
- loopStore 상태 유지

**잡는 버그**: Volume 변경이 Loop 이벤트 리스너를 제거하거나 currentTime 업데이트를 중단

---

#### Test 1.5: Keyboard Seek + A-B Loop [CRITICAL]

**Setup**: loopA=10초, loopB=30초, loopEnabled=true, currentTime=15초
**Actions**:
1. Arrow Right (+5초) -> currentTime = 20초
2. loopStore 상태 확인
3. Arrow Left (-5초) -> currentTime = 15초
4. loopStore 상태 재확인

**Assertions**:
- loopStore.loopEnabled === true (모든 Seek 후에도 유지)
- loopA, loopB 값 변경 없음
- currentTime 정확도

**잡는 버그**: Keyboard Seek가 currentTime을 직접 설정하면서 Loop 이벤트 리스너를 무시하거나 제거

---

#### Test 1.6: Mute + A-B Loop [HIGH]

**Setup**: Volume=60%, Mute=true, loopA=5초, loopB=15초, loopEnabled=true
**Actions**:
1. Play 시작 (5초부터)
2. GainNode === 0 확인
3. Loop가 15초 -> 5초로 되돌아감 확인
4. Mute 상태 재확인

**Assertions**:
- controlStore.muted === true
- GainNode.gain.value === 0
- controlStore.volume === 60 (보존)
- Loop 동작 정상

**잡는 버그**: Loop 진입/탈출 시 GainNode를 재설정하면 Mute 상태 손실

---

### Category 2: 순서 무관성 (Sequential Operation)

#### Test 2.1: Volume -> Seek -> Loop vs 역순 [HIGH]

**Setup A**: Volume(50%) -> Seek(20초) -> Loop(10~30초)
**Setup B**: Loop(10~30초) -> Volume(50%) -> Seek(20초)

**Assertions**:
- 두 경우 모두 동일한 최종 상태:
  - GainNode.gain.value === 0.5
  - currentTime === 20초
  - loopA === 10, loopB === 30, loopEnabled === true

**잡는 버그**: 기능 간 순서 의존성이 있으면 사용자 경험이 예측 불가능

---

#### Test 2.2: Mute -> Play -> Seek vs 역순 [CRITICAL]

**Setup A**: Mute -> Play -> Seek(15초)
**Setup B**: Seek(15초) -> Mute -> Play

**Assertions**:
- 두 경우 모두:
  - playerStore.playing === true
  - controlStore.muted === true
  - GainNode.gain.value === 0
  - currentTime === 15초

---

### Category 3: 상호작용 중 상태 유지 (State Persistence)

#### Test 3.1: Playing + Volume 50% -> Seek -> Volume 유지 [CRITICAL]

**Setup**: Play 상태, Volume=50%, currentTime=10초
**Actions**:
1. 재생 상태 확인
2. Waveform Click Seek to 25초
3. 모든 상태 재확인

**Assertions**:
- playerStore.playing === true
- GainNode.gain.value === 0.5
- currentTime === 25초
- 재생 진행 중 (currentTime 계속 증가)

---

#### Test 3.2: A-B Loop Active -> Volume Change -> Loop 유지 [CRITICAL]

**Setup**: loopA=8초, loopB=18초, loopEnabled=true, Play 상태, currentTime=12초
**Actions**:
1. Volume을 25%로 변경
2. currentTime이 18초 도달 시 8초로 되돌아가는지 확인

**Assertions**:
- Loop 동작 정상 (18초 -> 8초)
- GainNode.gain.value === 0.25
- loopStore 상태 유지

---

#### Test 3.3: Muted -> Keyboard Seek -> Still Muted [HIGH]

**Setup**: Mute=true, Volume=65%, currentTime=20초
**Actions**:
1. Arrow Right (+5초) 3회 연속
2. Arrow Left (-5초) 2회 연속
3. Mute 상태 확인

**Assertions**:
- controlStore.muted === true
- GainNode.gain.value === 0
- controlStore.volume === 65
- currentTime === 25초 (20 + 15 - 10)

---

### Category 4: 빠른 연속 조작 - Stress (Rapid Successive Operations)

#### Test 4.1: Rapid Volume + Seek [MEDIUM]

**Setup**: Volume=50%, currentTime=0
**Actions**: 100ms 간격으로 10회 반복:
- Volume 증가 (+10%)
- Seek (+2초)

**Assertions**:
- 최종 Volume === 100% (또는 capped 값)
- 최종 currentTime === 20초 (범위 내)
- GainNode.gain.value === controlStore.volume / 100
- 에러 발생 없음

---

#### Test 4.2: Rapid Mute Toggle + Loop [MEDIUM]

**Setup**: loopA=5초, loopB=10초, Volume=70%, Play 상태
**Actions**: 200ms 간격으로 Mute 토글 5회, Loop 재진입 확인

**Assertions**:
- 최종 Mute 상태 정확 (홀수 토글 시 true)
- Loop 동작 유지
- controlStore.volume === 70 보존
- 에러 없음

---

#### Test 4.3: Rapid Keyboard + Loop [HIGH]

**Setup**: loopA=10초, loopB=40초, currentTime=20초
**Actions**: 50ms 간격으로 Arrow Right 10회 연타 (+50초 의도)

**Assertions**:
- currentTime <= 40초 (loopB 초과 방지)
- loopStore.loopEnabled === true
- 에러 없음

**잡는 버그**: 빠른 Keyboard 연타 시 경쟁 조건으로 Loop 범위 초과

---

#### Test 4.4: A 키 이동 + Volume + Mute 독립성 [CRITICAL]

**Setup**: loopA=10초, loopB=30초, loopEnabled=true, Volume=40%, Mute=false, currentTime=25초, Play 상태
**Actions**:
1. 'A' 키 누름 (A 지점으로 이동)
2. 모든 상태 확인

**Assertions**:
- currentTime === 10초 (A 지점 이동 성공)
- playerStore.playing === true (재생 상태 유지)
- GainNode.gain.value === 0.4 (Volume 유지)
- controlStore.muted === false (Mute 상태 유지)
- loopStore.loopEnabled === true (Loop 유지)

**잡는 버그**: A 키 이동 로직이 Seek와 동일한 코드 경로를 타면서 GainNode를 재설정하거나 재생 상태를 변경

---

#### Test 4.5: A 키 이동 + Muted 상태 유지 [HIGH]

**Setup**: loopA=5초, loopB=20초, loopEnabled=true, Volume=70%, Mute=true, currentTime=15초
**Actions**:
1. 'A' 키 누름
2. Mute 상태 및 이전 Volume 확인

**Assertions**:
- currentTime === 5초
- controlStore.muted === true (Mute 유지)
- GainNode.gain.value === 0 (음소거 유지)
- controlStore.volume === 70 (이전 볼륨 보존)

---

## 복합 독립성 테스트 조합 매트릭스

```
         | Volume | Mute  | Play  | WSeek | KSeek | Loop  |
---------|--------|-------|-------|-------|-------|-------|
Volume   |   -    | 1.2   | 1.3   | 1.1*  | 4.1   | 1.4   |
Mute     |        |   -   | 2.2*  | 1.2*  | 3.3   | 1.6   |
Play     |        |       |   -   | 3.1*  | 3.1*  | 3.2*  |
WSeek    |        |       |       |   -   | -     | 2.1   |
KSeek    |        |       |       |       |   -   | 1.5*  |
Loop     |        |       |       |       |       |   -   |

* = CRITICAL test
```

---

## 우선순위 요약

| 우선순위 | 테스트 수 | 테스트 번호 |
|---------|----------|-----------|
| CRITICAL | 8개 | 1.1, 1.2, 1.5, 2.2, 3.1, 3.2, 4.3, 4.4 |
| HIGH | 6개 | 1.3, 1.4, 1.6, 2.1, 3.3, 4.5 |
| MEDIUM | 2개 | 4.1, 4.2 |

**CRITICAL 8개 테스트 전부 통과 필수**

---

## Layer 4: 시각적 회귀 테스트

### VR-001: 파형 렌더링 일관성
- 동일 오디오 파일 로드 시 파형 스크린샷 비교
- 허용 오차: 1% 미만 픽셀 차이

### VR-002: 재생 헤드 위치 정확도
- currentTime = 10초일 때 재생 헤드 위치 스크린샷 비교

### VR-003: A-B 루프 강조 표시
- A=5초, B=15초 설정 시 강조 영역 스크린샷 비교

---

## Phase 1 MVP 완료 조건 (Definition of Done)

- [ ] 단위 테스트 커버리지 85%+
- [ ] 컴포넌트 테스트 커버리지 80%+
- [ ] E2E 단일 기능 테스트 7개 시나리오 전부 통과
- [ ] E2E 복합 독립성 CRITICAL 8개 전부 통과
- [ ] E2E 복합 독립성 HIGH 6개 전부 통과
- [ ] 시각적 회귀 테스트 3개 통과
- [ ] Pencil 디자인 산출물 3개 완료
- [ ] 파형 렌더링 60fps 달성
- [ ] 페이지 로드 < 2초
- [ ] A-B 루프 레이턴시 < 50ms
- [ ] 1시간 세션 메모리 누수 0%
- [ ] WCAG 2.1 AA 접근성 준수
- [ ] TypeScript strict mode 에러 0개
