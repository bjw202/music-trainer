# SPEC-BPM-002 수용 기준: 메트로놈 동기화 재설계

| 항목 | 내용 |
|------|------|
| SPEC ID | SPEC-BPM-002 |
| 형식 | Given-When-Then (Gherkin) |

---

## US-1: 시간 보간으로 연속적 재생 시간 추정

### AC-1.1: 보간 시간 계산 정확성

```gherkin
Scenario: sourcePosition 업데이트 사이에 보간된 시간이 연속적으로 증가한다
  Given MetronomeEngine이 초기화되고 beats가 설정된 상태
  And anchorSourceTime = 5.0, anchorAcTime = 100.0, currentSpeed = 1.0
  When audioContext.currentTime이 100.05 (50ms 경과)
  Then getInterpolatedTime()은 5.05를 반환한다 (5.0 + 0.05 * 1.0)
  And 보간 오차는 5ms 이하이다
```

### AC-1.2: sourcePosition 업데이트 시 앵커 리셋

```gherkin
Scenario: sourcePosition이 변경되면 보간 앵커가 새 값으로 갱신된다
  Given MetronomeEngine이 실행 중이고 anchorSourceTime = 5.0
  When syncToPlaybackTime(5.093, 1.0)이 호출된다 (sourceTime 변경)
  Then anchorSourceTime = 5.093으로 갱신된다
  And anchorAcTime = audioContext.currentTime으로 갱신된다
  And 보간 기준이 새 앵커부터 시작된다
```

### AC-1.3: 보간 시간 클램핑

```gherkin
Scenario: 보간된 시간이 오디오 전체 길이를 초과하지 않는다
  Given 오디오 길이가 180초이고 anchorSourceTime = 179.95
  When 100ms가 경과하여 보간 시간이 180.05가 되려 할 때
  Then getInterpolatedTime()은 180.0 이하의 값을 반환한다
```

### AC-1.4: 보간 기반 스케줄 시간 계산

```gherkin
Scenario: scheduleTick에서 보간된 시간을 기준으로 비트를 스케줄한다
  Given beats = [5.0, 5.5, 6.0]이고 speed = 1.0
  And anchorSourceTime = 4.9, anchorAcTime = 100.0
  When Worker tick이 발생하고 audioContext.currentTime = 100.05
  Then interpolatedTime = 4.95 (4.9 + 0.05 * 1.0)
  And beat 5.0의 scheduleTime = 100.05 + (5.0 - 4.95) / 1.0 = 100.1
  And beat 5.0이 AC 시간 100.1에 스케줄된다
```

### AC-1.5: 메트로놈 지터 측정

```gherkin
Scenario: 60초 이상 연속 재생 시 메트로놈 지터가 5ms 이하이다
  Given 120 BPM 곡이 로드되고 메트로놈이 활성화된 상태
  When 60초간 재생한다
  Then 연속된 클릭 간격의 표준편차가 5ms 이하이다
  And 최대 클릭 간격 편차가 10ms 이하이다
```

---

## US-2: 속도 변경 시 즉시 동기화 기준점 갱신

### AC-2.1: AudioEngine 속도 변경 리스너 전달

```gherkin
Scenario: AudioEngine.setSpeed() 호출 시 등록된 리스너에 알린다
  Given speedChangeListener가 AudioEngine에 등록된 상태
  When AudioEngine.setSpeed(0.8)이 호출된다
  Then 리스너가 (0.8, currentSourceTime) 인수로 호출된다
  And 호출 지연은 1ms 이하이다
```

### AC-2.2: MetronomeEngine 앵커 즉시 갱신

```gherkin
Scenario: 속도 변경 시 MetronomeEngine의 보간 앵커가 즉시 갱신된다
  Given MetronomeEngine이 실행 중이고 currentSpeed = 1.0
  And anchorSourceTime = 10.0, anchorAcTime = 200.0
  And audioContext.currentTime = 200.05
  When onSpeedChange(0.8)이 호출된다
  Then anchorSourceTime = 10.05 (이전 보간 위치: 10.0 + 0.05 * 1.0)
  And anchorAcTime = 200.05 (현재 AC 시간)
  And currentSpeed = 0.8
```

### AC-2.3: 속도 변경 후 다음 tick에서 새 속도 적용

```gherkin
Scenario: 속도 변경 후 첫 Worker tick에서 새 속도로 스케줄링한다
  Given currentSpeed가 1.0에서 0.8로 변경됨
  And 다음 비트가 원본 시간 10.5에 위치
  When Worker tick이 발생한다
  Then scheduleTime 계산에 speed = 0.8이 사용된다
  And deltaOriginal / 0.8로 정확한 AudioContext 시간이 계산된다
```

### AC-2.4: 속도 변경 시 비트 중복 없음

```gherkin
Scenario: 속도 변경 전후로 동일 비트가 두 번 재생되지 않는다
  Given beat index 5가 이미 scheduledBeats에 등록됨
  When 속도가 1.0에서 0.8로 변경된다
  Then scheduledBeats가 초기화된다
  And nextBeatIndex가 현재 보간 위치 이후로 재설정된다
  And 이미 오디오로 출력 중인 비트는 정상 재생된다
```

### AC-2.5: 속도 변경 적응 시간

```gherkin
Scenario: 속도 변경 후 25ms 이내에 새 속도가 메트로놈에 반영된다
  Given 메트로놈이 활성 상태
  When 속도를 1.0에서 1.5로 변경한다
  Then 25ms 이내에 다음 Worker tick이 발생한다
  And 해당 tick에서 speed = 1.5 기반으로 비트가 스케줄된다
```

---

## US-3: 버퍼 크기 최적화

### AC-3.1: 버퍼 크기 변경

```gherkin
Scenario: SCRIPT_BUFFER_SIZE가 2048로 변경된다
  Given AudioEngine의 SCRIPT_BUFFER_SIZE 상수
  When 값을 2048로 변경한다
  Then ScriptProcessorNode가 2048 샘플 버퍼로 생성된다
  And sourcePosition 업데이트 간격이 ~46ms로 단축된다
```

### AC-3.2: 오디오 글리치 없음

```gherkin
Scenario: 버퍼 2048에서 오디오 재생이 정상 동작한다
  Given SCRIPT_BUFFER_SIZE = 2048
  When 5분 길이의 오디오를 1.0x 속도로 재생한다
  Then 오디오 끊김, 팝 노이즈, 글리치가 없다
  And CPU 사용률이 5% 이하이다
```

### AC-3.3: 롤백 경로

```gherkin
Scenario: 글리치 발생 시 4096으로 롤백한다
  Given SCRIPT_BUFFER_SIZE = 2048에서 글리치가 감지됨
  When SCRIPT_BUFFER_SIZE를 4096으로 변경한다
  Then 기존 동작이 완벽히 복원된다
  And 보간 레이어는 4096에서도 정상 동작한다
```

### AC-3.4: 모바일 브라우저 테스트

```gherkin
Scenario: 모바일 Safari에서 2048 버퍼가 정상 동작한다
  Given iOS Safari에서 앱 실행
  And SCRIPT_BUFFER_SIZE = 2048
  When 3분 길이의 오디오를 재생한다
  Then 오디오 글리치 없이 정상 재생된다
  And 메트로놈 동기화가 정확하다
```

---

## US-4: AudioWorklet 마이그레이션 준비

### AC-4.1: 설계 문서 작성

```gherkin
Scenario: AudioWorklet 마이그레이션 설계 문서가 생성된다
  When AudioWorklet 조사가 완료되면
  Then .moai/docs/audioworklet-migration.md가 생성된다
  And 문서에 soundtouchjs 호환성 분석이 포함된다
  And 문서에 마이그레이션 단계 계획이 포함된다
  And 문서에 브라우저 지원 매트릭스가 포함된다
```

### AC-4.5: 폴백 설계

```gherkin
Scenario: AudioWorklet 미지원 브라우저에서 ScriptProcessorNode로 폴백한다
  Given 브라우저가 AudioWorklet을 지원하지 않는 경우
  When AudioEngine이 초기화된다
  Then ScriptProcessorNode 기반 파이프라인이 생성된다
  And 기존 동작과 동일하게 작동한다
```

---

## US-5: Downbeat 감지 개선

### AC-5.1: API 응답 확장

```gherkin
Scenario: BPM 분석 API가 downbeats 정보를 반환한다
  Given madmom DBNDownBeatTrackingProcessor가 활성화된 상태
  When POST /api/v1/bpm/analyze로 오디오를 분석한다
  Then 응답에 "downbeats" 필드가 포함된다
  And downbeats 배열의 모든 시간은 beats 배열에도 존재한다
```

### AC-5.2: 강박/약박 구분

```gherkin
Scenario: 다운비트에서 880Hz, 그 외에서 440Hz를 재생한다
  Given downbeats = [0.52, 2.52, 4.52], beats = [0.52, 1.02, 1.52, 2.02, 2.52, ...]
  When beat 0.52에서 클릭이 스케줄된다
  Then 880Hz (다운비트)로 재생된다
  When beat 1.02에서 클릭이 스케줄된다
  Then 440Hz (업비트)로 재생된다
```

### AC-5.3: % 4 하드코딩 제거

```gherkin
Scenario: downbeats가 있으면 % 4 로직 대신 downbeats 기반으로 판단한다
  Given downbeats 데이터가 제공된 상태
  When isDownbeat 판단 로직이 실행된다
  Then downbeats 배열에 포함 여부로 판단한다
  And nextBeatIndex % 4 === 0 로직은 사용하지 않는다
```

### AC-5.4: Downbeat 미제공 폴백

```gherkin
Scenario: downbeats 데이터가 없으면 기존 % 4 로직으로 폴백한다
  Given API 응답에 downbeats 필드가 없거나 빈 배열인 상태
  When isDownbeat 판단 로직이 실행된다
  Then nextBeatIndex % 4 === 0 로직으로 판단한다
```

---

## 통합 테스트 시나리오

### 장시간 재생 드리프트 테스트

```gherkin
Scenario: 5분 이상 연속 재생에서 메트로놈 드리프트가 감지되지 않는다
  Given 120 BPM 곡이 로드되고 메트로놈이 활성화된 상태
  And speed = 1.0
  When 5분간 연속 재생한다
  Then 마지막 1분의 클릭 타이밍과 처음 1분의 클릭 타이밍의 정확도가 동등하다
  And 누적 드리프트가 10ms 이하이다
```

### 속도 변경 중 동기화 유지 테스트

```gherkin
Scenario: 재생 중 속도를 여러 번 변경해도 동기화가 유지된다
  Given 메트로놈이 활성 상태에서 재생 중
  When 속도를 1.0 -> 0.8 -> 1.2 -> 0.5 -> 1.0으로 순서대로 변경한다
  Then 각 속도 변경 후 25ms 이내에 새 속도로 비트가 스케줄된다
  And 속도 변경 전후로 비트 중복이 없다
  And 각 속도에서 메트로놈 간격이 해당 속도에 맞게 조정된다
```

### Seek + 속도 변경 조합 테스트

```gherkin
Scenario: Seek 후 속도 변경 시 정상 동기화된다
  Given 메트로놈이 활성 상태에서 재생 중
  When 30초 위치로 Seek한다
  And 즉시 속도를 0.7x로 변경한다
  Then Seek 후 50ms 이내에 메트로놈이 30초 이후 첫 비트에 동기화된다
  And 속도 0.7x에 맞는 간격으로 클릭이 재생된다
```

### A-B 루프 + 보간 테스트

```gherkin
Scenario: A-B 루프 경계에서 보간이 정확히 리셋된다
  Given A = 10.0, B = 20.0 루프가 설정된 상태
  And 메트로놈이 활성 상태
  When currentTime이 20.0에 도달하여 루프백이 발생한다
  Then MetronomeEngine.seekTo(10.0, speed)가 호출된다
  And anchorSourceTime = 10.0으로 리셋된다
  And 10.0 이후 첫 비트부터 정확히 클릭이 재생된다
```

---

## Definition of Done

- [x] M1 (시간 보간): MetronomeEngine에 보간 레이어 구현 완료 (anchorSourceTime/anchorAcTime + getInterpolatedTime())
- [x] M1 (시간 보간): 지터 < 5ms 측정 확인 (One-Time Anchor 패턴으로 추가 개선)
- [x] M2 (속도 동기화): speedChangeListener 패턴 구현 완료 (AudioEngine + MetronomeEngine.onSpeedChange())
- [x] M2 (속도 동기화): 속도 변경 적응 < 25ms 확인
- [ ] 기존 MetronomeEngine 단위 테스트 전체 통과
- [ ] 새 보간/속도 동기화 테스트 추가 및 통과
- [ ] 5분 이상 연속 재생 드리프트 테스트 통과
- [ ] 기존 API 하위 호환성 100% 유지 확인
- [ ] E2E 메트로놈 시나리오 통과

### 선택적 완료 기준
- [ ] M3 (버퍼 2048): DEFERRED - 보간으로 충분하여 4096 유지
- [ ] M4 (AudioWorklet): DEFERRED - 장기 목표로 유지
- [x] M5 (Downbeat): CANCELLED - madmom이 마디 시작을 신뢰성 있게 감지하지 못하므로 강박/약박 구분 자체를 제거. 모든 비트에 동일한 440Hz 클릭음 사용.

---

## US-5 취소 사유

US-5 (Downbeat 감지 개선)는 구현 대신 취소(CANCELLED)로 결정되었다.

**배경:**
- madmom `DBNDownBeatTrackingProcessor`의 downbeat 감지 정확도가 곡 장르/구조에 따라 불안정
- 부정확한 강박 표시가 오히려 연습에 방해가 됨
- 해결 방향: 강박/약박 구분을 제거하고, 모든 비트에 동일한 클릭음(440Hz) 사용

**적용된 변경:**
- `MetronomeEngine.ts`: `nextBeatIndex % 4 === 0` 분기 로직 제거
- 모든 비트에 `clickFrequencyUpbeat` (440Hz) 통일
- 관련 커밋: e837ba5 (2026-02-18)

---

*Generated by MoAI SPEC Builder (manager-spec)*
*Acceptance criteria date: 2026-02-17*
*Updated: 2026-02-18 (M1/M2 완료, M5 취소 반영)*
