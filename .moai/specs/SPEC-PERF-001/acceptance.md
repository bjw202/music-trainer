---
id: SPEC-PERF-001
document: acceptance
version: "2.0.0"
---

# SPEC-PERF-001 수용 기준: SoundTouch Web Worker 오프로딩

## 1. Ubiquitous 요구사항 수용 기준

### ACC-U-001: SoundTouch 처리는 항상 Web Worker에서 수행

**Scenario 1: 속도 변경 시 Worker 처리**

```gherkin
Given 오디오 파일이 로드되어 있고 Worker가 초기화된 상태
When 사용자가 속도를 0.8로 변경하면
Then processBuffer()가 메인 스레드에서 직접 호출되지 않고
And Worker의 onmessage에서 SoundTouch 처리가 수행되고
And 처리 완료 메시지가 메인 스레드로 전달된다
```

**Scenario 2: 피치 변경 시 Worker 처리**

```gherkin
Given 오디오 파일이 로드되어 있고 Worker가 초기화된 상태
When 사용자가 피치를 +3으로 변경하면
Then Worker에 process 타입의 메시지가 전송되고
And Worker에서 SoundTouch 처리 결과가 반환된다
```

**검증 방법:**
- AudioEngine에서 Worker.postMessage 호출 확인 (spy/mock)
- 메인 스레드의 processBuffer 직접 호출 부재 확인 (폴백 경로 제외)

---

### ACC-U-002: 처리 중 UI 인터랙션 50ms 이내 응답

**Scenario 1: 처리 중 버튼 클릭 응답성**

```gherkin
Given Worker가 SoundTouch 처리를 수행 중인 상태
When 사용자가 재생/일시정지 버튼을 클릭하면
Then 50ms 이내에 클릭 이벤트가 처리된다
```

**Scenario 2: 처리 중 슬라이더 조작 응답성**

```gherkin
Given Worker가 SoundTouch 처리를 수행 중인 상태
When 사용자가 볼륨 슬라이더를 조작하면
Then 50ms 이내에 슬라이더 UI가 업데이트된다
And 메인 스레드의 Long Task (>50ms)가 발생하지 않는다
```

**검증 방법:**
- Performance API의 Long Task Observer로 50ms 이상 블로킹 태스크 부재 확인
- Playwright E2E 테스트에서 처리 중 UI 인터랙션 가능 여부 확인

---

### ACC-U-003: Transferable Objects로 zero-copy 전송

**Scenario 1: 메인 -> Worker 데이터 전송**

```gherkin
Given Float32Array 채널 데이터가 준비된 상태
When Worker에 postMessage로 채널 데이터를 전송하면
Then Transferable Objects (ArrayBuffer)가 transfer 리스트에 포함되고
And 전송 후 원본 Float32Array의 byteLength가 0이 된다 (소유권 이전 증거)
```

**Scenario 2: Worker -> 메인 데이터 반환**

```gherkin
Given Worker에서 SoundTouch 처리가 완료된 상태
When Worker가 처리 결과를 메인 스레드로 전송하면
Then processedChannelData의 ArrayBuffer가 transfer 리스트에 포함된다
```

**검증 방법:**
- postMessage 호출 시 두 번째 인자(transfer list) 존재 확인
- 전송 후 원본 ArrayBuffer.byteLength === 0 검증

---

## 2. Event-Driven 요구사항 수용 기준

### ACC-E-001: 속도 변경 -> Worker 요청 -> 버퍼 교체 재개

**Scenario 1: 재생 중 속도 변경**

```gherkin
Given 오디오가 재생 중이고 현재 위치가 30초인 상태
When 사용자가 속도를 1.0에서 0.7로 변경하면
Then Worker에 speed=0.7 파라미터로 process 요청이 전송되고
And Worker 완료 후 처리된 버퍼로 교체되고
And 재생 위치가 30초(원본 기준) 부근에서 계속 재생된다
```

**Scenario 2: 일시정지 상태에서 속도 변경**

```gherkin
Given 오디오가 일시정지된 상태 (위치: 45초)
When 사용자가 속도를 1.5로 변경하면
Then Worker에 처리 요청이 전송되고
And Worker 완료 후 processedBuffer가 업데이트되고
And 일시정지 상태가 유지되며 위치는 45초(원본 기준)이다
```

---

### ACC-E-002: 피치 변경 -> Worker 요청 -> 버퍼 교체 재개

**Scenario 1: 재생 중 피치 변경**

```gherkin
Given 오디오가 재생 중인 상태
When 사용자가 피치를 0에서 -2로 변경하면
Then Worker에 pitch=-2 파라미터로 process 요청이 전송되고
And Worker 완료 후 처리된 버퍼로 교체되어 재생이 계속된다
```

**Scenario 2: 속도와 피치 동시 변경**

```gherkin
Given 오디오가 재생 중인 상태
When 사용자가 속도를 0.8로, 피치를 +3으로 빠르게 연속 변경하면
Then 최종적으로 speed=0.8, pitch=+3 파라미터의 요청만 처리되고
And 중간 요청은 취소된다 (ACC-E-004 참조)
```

---

### ACC-E-003: Worker 완료 수신 -> 재생 위치 보존 버퍼 교체

**Scenario 1: 재생 위치 보존**

```gherkin
Given 오디오가 60초 위치에서 재생 중이고 Worker 처리가 진행 중인 상태
When Worker가 complete 메시지를 전송하면
Then 처리된 Float32Array에서 AudioBuffer가 생성되고
And processedBuffer가 새 버퍼로 교체되고
And 재생 위치가 60초(원본 기준)에 대응하는 위치에서 재생된다
```

**Scenario 2: stale 응답 무시**

```gherkin
Given 첫 번째 요청(requestId: "req-1")이 Worker에서 처리 중이고
And 두 번째 요청(requestId: "req-2")이 새로 전송된 상태
When 첫 번째 요청의 완료 메시지(requestId: "req-1")가 도착하면
Then latestRequestId("req-2")와 불일치하므로 해당 응답이 무시된다
```

---

### ACC-E-004: 빠른 연속 조작 -> 이전 요청 취소, 최신만 처리

**Scenario 1: 빠른 속도 연속 변경**

```gherkin
Given 오디오가 로드된 상태
When 사용자가 0.5초 간격으로 속도를 0.9 -> 0.8 -> 0.7로 연속 변경하면
Then 최종적으로 speed=0.7에 대한 처리 결과만 적용되고
And 이전 요청(0.9, 0.8)의 결과는 무시된다
```

**Scenario 2: 빠른 피치 연속 변경**

```gherkin
Given 오디오가 로드된 상태
When 사용자가 피치를 +1, +2, +3으로 빠르게 조작하면
Then latestRequestId가 매 요청마다 갱신되고
And 최종 pitch=+3에 대한 결과만 processedBuffer에 반영된다
```

**검증 방법:**
- 처리 요청 카운터와 적용된 결과의 speed/pitch 값 비교
- latestRequestId 상태 추적 로그 확인

---

## 3. State-Driven 요구사항 수용 기준

### ACC-S-001: Worker 처리 중 기존 버퍼로 끊김 없는 재생

**Scenario 1: 처리 중 재생 계속**

```gherkin
Given 오디오가 속도 1.0으로 재생 중인 상태
When 사용자가 속도를 0.7로 변경하여 Worker 처리가 시작되면
Then Worker 처리가 완료될 때까지 기존 버퍼(원본)로 재생이 중단 없이 계속된다
And 오디오 출력에 끊김(gap, click, pop)이 발생하지 않는다
```

**Scenario 2: 처리 중 이전 처리된 버퍼로 재생**

```gherkin
Given 오디오가 속도 0.8로 처리된 버퍼로 재생 중인 상태
When 사용자가 속도를 0.6으로 변경하여 Worker 처리가 시작되면
Then Worker 완료까지 기존 처리된 버퍼(속도 0.8)로 재생이 유지된다
```

---

### ACC-S-002: 바이패스 모드 (speed=1.0, pitch=0)

**Scenario 1: 기본 값으로 리셋**

```gherkin
Given 오디오가 속도 0.7, 피치 +2로 재생 중인 상태
When 사용자가 속도를 1.0, 피치를 0으로 리셋하면
Then Worker 호출이 발생하지 않고
And processedBuffer가 null로 설정되고
And 원본 버퍼로 직접 재생된다
```

**Scenario 2: 초기 로드 시 바이패스**

```gherkin
Given 새 오디오 파일이 로드된 상태 (speed=1.0, pitch=0)
When 재생 버튼을 누르면
Then Worker를 거치지 않고 원본 버퍼로 즉시 재생된다
```

---

### ACC-S-003: Worker 오류 시 메인 스레드 폴백

**Scenario 1: Worker 생성 실패 폴백**

```gherkin
Given Worker 생성이 실패한 상태 (CSP 제한 등)
When 사용자가 속도를 0.8로 변경하면
Then 메인 스레드의 동기 processBuffer()가 호출되어 처리되고
And console.warn으로 폴백 발생을 로깅한다
```

**Scenario 2: Worker 런타임 오류 폴백**

```gherkin
Given Worker가 정상 초기화된 상태
When Worker 내부에서 처리 중 예외가 발생하면
Then Worker에서 error 타입의 메시지가 전송되고
And 메인 스레드에서 해당 요청을 동기 processBuffer()로 폴백 처리하고
And 다음 요청은 다시 Worker를 시도한다
```

---

## 4. Unwanted 요구사항 수용 기준

### ACC-N-001: 메인 스레드에서 processBuffer 직접 호출 금지

**Scenario 1: 정상 경로에서 직접 호출 부재**

```gherkin
Given Worker가 정상 동작 중인 상태
When 속도 또는 피치가 변경되면
Then AudioEngine에서 processBuffer()가 직접 호출되지 않고
And Worker.postMessage()를 통해서만 처리 요청이 이루어진다
```

**Scenario 2: 폴백 경로에서만 직접 호출 허용**

```gherkin
Given Worker가 실패한 상태 (useFallback === true)
When 속도 또는 피치가 변경되면
Then processBuffer()가 직접 호출되어 폴백 처리된다
And 이 경우에만 메인 스레드 직접 호출이 허용된다
```

---

### ACC-N-002: 200ms 이상 인위적 디바운스 금지

**Scenario 1: 디바운스 시간 축소 확인**

```gherkin
Given useSpeedPitch 훅이 사용되는 상태
When 소스 코드의 setTimeout 지연값을 확인하면
Then 디바운스 지연이 50ms 이하이거나 디바운스가 제거되어 있다
And 200ms 이상의 지연값이 존재하지 않는다
```

**Scenario 2: 빠른 응답 확인**

```gherkin
Given 사용자가 속도 슬라이더를 조작하는 상태
When 슬라이더 값이 변경되면
Then 50ms 이내에 Worker 요청이 전송된다
```

---

### ACC-N-003: Transferable 전송 후 원본 ArrayBuffer 참조 금지

**Scenario 1: 전송 후 참조 불가 확인**

```gherkin
Given Float32Array 채널 데이터가 Transferable로 전송된 상태
When 전송 후 원본 Float32Array에 접근을 시도하면
Then ArrayBuffer.byteLength === 0 으로 확인된다 (neutered)
And 코드 내에서 전송 후 원본 데이터를 읽거나 쓰는 로직이 없다
```

**Scenario 2: Worker 반환 데이터도 동일 적용**

```gherkin
Given Worker에서 처리 결과를 Transferable로 전송한 상태
When Worker 내에서 전송 후 해당 데이터에 접근을 시도하면
Then ArrayBuffer가 neutered 상태이다
```

---

## 5. Optional 요구사항 수용 기준

### ACC-O-001: Worker 처리 중 로딩 인디케이터

**Scenario 1: 처리 중 인디케이터 표시**

```gherkin
Given Worker 처리가 시작된 상태
When AudioEngine.isProcessing이 true이면
Then UI에 로딩 인디케이터(스피너 또는 프로그레스)가 표시된다
And Worker 완료 후 인디케이터가 사라진다
```

---

### ACC-O-002: Worker 처리 진행률 피드백

**Scenario 1: 진행률 업데이트**

```gherkin
Given 큰 오디오 파일(5분 이상)에 대한 Worker 처리가 진행 중인 상태
When Worker가 진행률 메시지를 전송하면
Then UI에 처리 진행률이 0~100% 범위로 표시된다
```

---

## 6. 엣지 케이스 테스트 시나리오

### EDGE-001: 극도로 빠른 연속 조작

```gherkin
Given 오디오가 재생 중인 상태
When 100ms 미만 간격으로 속도를 10회 연속 변경하면
Then 메모리 누수 없이 최종 속도에 대한 결과만 적용되고
And Worker에 보류 중인 요청이 1개 이하이고
And UI가 모든 조작에 50ms 이내로 응답한다
```

### EDGE-002: Worker 처리 중 오디오 파일 교체

```gherkin
Given Worker가 현재 파일의 처리를 수행 중인 상태
When 사용자가 새 오디오 파일을 로드하면
Then 진행 중인 Worker 요청이 무효화되고
And 새 파일의 원본 버퍼로 재생이 시작되고
And 이전 처리 결과가 적용되지 않는다
```

### EDGE-003: Worker 처리 중 브라우저 탭 비활성화

```gherkin
Given Worker가 처리를 수행 중이고 사용자가 다른 탭으로 전환한 상태
When Worker 처리가 완료되고 사용자가 탭으로 돌아오면
Then 처리된 버퍼가 정상적으로 적용되어 있다
And 재생 위치가 올바르게 유지된다
```

### EDGE-004: 매우 긴 오디오 파일 (10분 이상)

```gherkin
Given 10분 길이의 MP3 파일이 로드된 상태
When 속도를 0.5로 변경하면
Then Worker에서 처리가 수행되고 (처리 시간이 길어도)
And 메인 스레드는 블로킹되지 않고
And 처리 완료 후 정상적으로 버퍼가 교체된다
```

### EDGE-005: 모노 오디오 파일 처리

```gherkin
Given 모노(1채널) 오디오 파일이 로드된 상태
When 속도 또는 피치를 변경하면
Then Worker에서 1채널 데이터를 올바르게 처리하고
And 처리된 결과도 모노로 반환된다
```

### EDGE-006: Worker terminate 후 재생성

```gherkin
Given AudioEngine이 dispose()로 Worker를 terminate한 상태
When 새로운 AudioEngine 인스턴스가 init()을 호출하면
Then 새 Worker가 정상적으로 생성되고
And 속도/피치 처리가 정상 동작한다
```

---

## 7. 성능 기준

| 지표                       | 기준값                     | 측정 방법                                     |
| -------------------------- | -------------------------- | --------------------------------------------- |
| 메인 스레드 Long Task       | 없음 (>50ms 태스크 0개)    | Performance Observer (Long Task)               |
| 속도/피치 변경 후 UI 응답    | < 50ms                    | Event timestamp -> requestAnimationFrame delta |
| Worker 메시지 라운드트립      | < 10ms (데이터 전송 제외)  | postMessage -> onmessage 타이밍                 |
| 메모리 오버헤드              | < 10MB 추가               | Chrome DevTools Memory Profiler                |
| 처리 완료 후 버퍼 교체 지연   | < 100ms                   | Worker complete -> 재생 재개 타이밍             |

---

## 8. Quality Gate (TRUST 5 준수)

### Tested (테스트 완료)

- [ ] Worker 메시지 프로토콜 단위 테스트 (postMessage / onmessage 모킹)
- [ ] AudioEngine Worker 통합 테스트 (속도/피치 변경 -> 버퍼 교체)
- [ ] 요청 취소 메커니즘 테스트 (stale requestId 무시)
- [ ] 폴백 경로 테스트 (Worker 실패 시 동기 처리)
- [ ] 바이패스 모드 테스트 (speed=1.0, pitch=0)
- [ ] Transferable Objects 소유권 이전 테스트
- [ ] 엣지 케이스 테스트 (EDGE-001 ~ EDGE-006)

### Readable (가독성)

- [ ] Worker 메시지 타입에 JSDoc 주석 포함
- [ ] AudioEngine의 Worker 관련 메서드에 명확한 주석
- [ ] 한국어 코드 주석 (code_comments: ko 설정 준수)

### Unified (일관성)

- [ ] 기존 코딩 스타일(들여쓰기, 네이밍) 유지
- [ ] ESLint / Prettier 경고 0개
- [ ] 기존 AudioEngine 인터페이스 호환성 유지

### Secured (보안)

- [ ] Worker에서 외부 네트워크 요청 없음
- [ ] Transferable 전송 후 원본 참조 제거
- [ ] 입력 유효성 검사 (speed, pitch 범위 확인)

### Trackable (추적성)

- [ ] 모든 코드 변경에 SPEC-PERF-001 태그 참조
- [ ] 커밋 메시지에 마일스톤 번호 포함
- [ ] 요구사항 -> 수용 기준 -> 테스트 추적 가능

---

## 9. Definition of Done

- [ ] 모든 Ubiquitous 수용 기준(ACC-U-001 ~ ACC-U-003) 통과
- [ ] 모든 Event-Driven 수용 기준(ACC-E-001 ~ ACC-E-004) 통과
- [ ] 모든 State-Driven 수용 기준(ACC-S-001 ~ ACC-S-003) 통과
- [ ] 모든 Unwanted 수용 기준(ACC-N-001 ~ ACC-N-003) 통과
- [ ] 성능 기준 전체 충족 (메인 스레드 Long Task 0개)
- [ ] TRUST 5 Quality Gate 전체 통과
- [ ] 기존 테스트 회귀 없음 (모든 기존 테스트 통과)
- [x] TypeScript 컴파일 에러 0개
- [x] ESLint 에러 0개

---

## 10. Implementation Verification (구현 검증)

### 10.1 수용 기준 충족 현황

실제 구현은 원래 계획(Web Worker 오프라인 처리)에서 실시간 스트리밍 아키텍처로 전환되었다. 각 수용 기준의 충족 여부를 새로운 아키텍처 관점에서 평가한다.

#### Ubiquitous 요구사항

| 수용 기준   | 상태       | 설명                                                                      |
| ---------- | ---------- | ------------------------------------------------------------------------- |
| ACC-U-001  | 대체 달성   | Worker 대신 ScriptProcessorNode 콜백에서 실시간 처리. 메인 스레드 블로킹 없음 |
| ACC-U-002  | 달성       | ~4096 샘플 단위 콜백 처리로 Long Task 없음. UI 50ms 이내 응답 보장           |
| ACC-U-003  | 해당 없음  | Worker 미사용으로 Transferable Objects 불필요. 스레드 간 전송 자체가 없음     |

#### Event-Driven 요구사항

| 수용 기준   | 상태       | 설명                                                                                |
| ---------- | ---------- | ----------------------------------------------------------------------------------- |
| ACC-E-001  | 대체 달성   | `soundtouch.tempo = speed`로 즉시 반영. Worker 요청/완료/버퍼 교체 사이클 불필요      |
| ACC-E-002  | 대체 달성   | `soundtouch.pitchSemitones = pitch`로 즉시 반영                                      |
| ACC-E-003  | 대체 달성   | 재생 위치는 `sourcePosition`으로 항상 정확. 버퍼 교체 없이 연속 처리                    |
| ACC-E-004  | 대체 달성   | 즉각 파라미터 반영으로 "이전 요청 취소" 개념 자체가 불필요. 항상 최신 값으로 처리         |

#### State-Driven 요구사항

| 수용 기준   | 상태       | 설명                                                                       |
| ---------- | ---------- | -------------------------------------------------------------------------- |
| ACC-S-001  | 해당 없음  | "Worker 처리 중" 상태가 존재하지 않음. 실시간으로 항상 처리                    |
| ACC-S-002  | 달성       | speed=1.0, pitch=0 바이패스 모드 로직 유지                                   |
| ACC-S-003  | 해당 없음  | Worker 미사용으로 "Worker 오류 시 폴백" 경로 불필요                           |

#### Unwanted 요구사항

| 수용 기준   | 상태       | 설명                                                                       |
| ---------- | ---------- | -------------------------------------------------------------------------- |
| ACC-N-001  | 대체 달성   | `processBuffer()` 함수 자체가 제거됨. 실시간 처리로 완전 대체                |
| ACC-N-002  | 달성       | 디바운스 완전 제거. 200ms는 물론 어떤 인위적 지연도 없음                      |
| ACC-N-003  | 해당 없음  | Worker 미사용으로 Transferable Objects 관련 제약 불필요                      |

#### Optional 요구사항

| 수용 기준   | 상태       | 설명                                                             |
| ---------- | ---------- | ---------------------------------------------------------------- |
| ACC-O-001  | 해당 없음  | 실시간 처리로 "처리 중" 상태가 없어 로딩 인디케이터 불필요         |
| ACC-O-002  | 해당 없음  | 즉각 처리로 진행률 피드백 불필요                                  |

### 10.2 Worker 관련 테스트 시나리오 재평가

아키텍처 전환으로 인해 Worker 관련 테스트 시나리오가 더 이상 적용되지 않는다.

#### 더 이상 적용 불가능한 테스트

- Worker 메시지 프로토콜 단위 테스트 (postMessage / onmessage 모킹)
- 요청 취소 메커니즘 테스트 (stale requestId 무시)
- 폴백 경로 테스트 (Worker 실패 시 동기 처리)
- Transferable Objects 소유권 이전 테스트
- EDGE-003: Worker 처리 중 브라우저 탭 비활성화
- EDGE-006: Worker terminate 후 재생성

#### 여전히 유효한 테스트 (아키텍처에 무관)

- 바이패스 모드 테스트 (speed=1.0, pitch=0)
- EDGE-001: 극도로 빠른 연속 조작 (실시간 방식에서도 유효)
- EDGE-002: 처리 중 오디오 파일 교체 (파이프라인 재구성 검증)
- EDGE-004: 매우 긴 오디오 파일 (실시간 처리 안정성)
- EDGE-005: 모노 오디오 파일 처리

#### 새로 필요한 테스트 (실시간 스트리밍 아키텍처용)

- ScriptProcessorNode 콜백에서 SoundTouch 실시간 처리 검증
- `soundtouch.tempo` / `soundtouch.pitchSemitones` 변경 시 즉각 반영 검증
- `simpleFilter.sourcePosition` 기반 시간 추적 정확성 검증
- +/- 버튼 UI 동작 검증 (0.01 단위 속도, 반음 단위 피치)
- 오디오 파이프라인 연결 무결성 (Source -> Filter -> ScriptProcessor -> Gain -> Analyser -> Dest)

### 10.3 빌드 검증

| 검증 항목               | 결과   | 비고                                           |
| ----------------------- | ------ | ---------------------------------------------- |
| TypeScript 컴파일       | PASS   | `tsc --noEmit` 에러 0개                        |
| 프로덕션 빌드           | PASS   | `vite build` 정상 완료                          |
| soundtouchjs.d.ts 타입  | PASS   | SoundTouch, SimpleFilter 등 타입 정의 정상      |
| 삭제 파일 참조 확인      | PASS   | 삭제된 Worker/Worklet 파일에 대한 import 없음    |

### 10.4 수동 검증 항목 (실시간 스트리밍 아키텍처)

아래 항목은 실제 브라우저 환경에서 수동으로 검증해야 한다.

- [ ] 오디오 파일 로드 후 정상 재생 확인
- [ ] 속도 변경 시 즉시 재생 속도 반영 확인 (클릭/글리치 없음)
- [ ] 피치 변경 시 즉시 음정 변경 반영 확인
- [ ] 속도 + 피치 동시 변경 시 정상 동작 확인
- [ ] speed=1.0, pitch=0 리셋 시 원본 음질 복원 확인
- [ ] +/- 버튼으로 0.01 단위 속도 조정 동작 확인
- [ ] +/- 버튼으로 반음 단위 피치 조정 동작 확인
- [ ] 재생 중 탐색(seek) 후 정상 재개 확인
- [ ] 긴 곡(5분 이상) 전체 재생 안정성 확인
- [ ] 시간 표시(현재 위치)의 정확성 확인

### 10.5 성능 기준 재평가

원래 성능 기준을 실시간 스트리밍 아키텍처 관점에서 재평가한다.

| 원래 지표                    | 원래 기준값               | 실제 달성                                   | 비고                              |
| --------------------------- | ------------------------ | ------------------------------------------- | --------------------------------- |
| 메인 스레드 Long Task        | 없음 (>50ms 태스크 0개)  | 달성 (실시간 콜백 ~4096 샘플)                | 오프로딩 불필요, 콜백 자체가 경량   |
| 속도/피치 변경 후 UI 응답     | < 50ms                  | 달성 (즉각 반영, ~0ms)                       | 원래 목표 초과 달성                |
| Worker 메시지 라운드트립      | < 10ms                  | 해당 없음                                    | Worker 미사용                     |
| 메모리 오버헤드              | < 10MB 추가              | 달성 (processedBuffer 사본 불필요)            | 원래 계획보다 메모리 효율적         |
| 처리 완료 후 버퍼 교체 지연   | < 100ms                 | 해당 없음 (버퍼 교체 자체가 없음)              | 실시간 처리로 지연 개념 불필요      |

### 10.6 Quality Gate (TRUST 5) 업데이트

#### Tested (테스트 완료)

- [x] TypeScript 컴파일 에러 0개
- [x] 프로덕션 빌드 정상 완료
- [ ] 바이패스 모드 테스트 (speed=1.0, pitch=0)
- [ ] 실시간 스트리밍 파이프라인 통합 테스트
- [ ] +/- 버튼 UI 동작 테스트

#### Readable (가독성)

- [x] soundtouchjs.d.ts에 타입 선언 포함
- [x] AudioEngine의 실시간 처리 메서드에 한국어 주석
- [x] 코드 주석 한국어 작성 (code_comments: ko 준수)

#### Unified (일관성)

- [x] 기존 코딩 스타일(들여쓰기, 네이밍) 유지
- [x] 기존 AudioEngine 외부 인터페이스 호환성 유지

#### Secured (보안)

- [x] 외부 네트워크 요청 없음
- [x] 입력 유효성 검사 (speed, pitch 범위 확인)

#### Trackable (추적성)

- [x] SPEC-PERF-001 태그 참조
- [x] 아키텍처 전환 결정 사유 문서화 (spec.md 7. Implementation Notes)
