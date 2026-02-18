# SPEC-BPM-002 구현 계획: 메트로놈 동기화 재설계

| 항목 | 내용 |
|------|------|
| SPEC ID | SPEC-BPM-002 |
| 관련 SPEC | SPEC-BPM-001 |
| 개발 방법론 | DDD (ANALYZE-PRESERVE-IMPROVE) |

---

## 마일스톤 개요

| 마일스톤 | 우선순위 | 유저 스토리 | 설명 | 상태 |
|----------|---------|-----------|------|------|
| M1: 시간 보간 핵심 구현 | Primary | US-1 | MetronomeEngine 보간 레이어 추가 | **DONE** |
| M2: 속도 변경 즉시 동기화 | Primary | US-2 | AudioEngine 속도 변경 리스너 + MetronomeEngine 연동 | **DONE** |
| M3: 버퍼 크기 최적화 | Secondary | US-3 | SCRIPT_BUFFER_SIZE 2048 실험 | DEFERRED |
| M4: AudioWorklet 설계 | Optional | US-4 | 마이그레이션 PoC 및 설계 문서 | DEFERRED |
| M5: Downbeat 감지 | Optional | US-5 | 백엔드 DBNDownBeatTrackingProcessor 추가 | CANCELLED |

---

## M1: 시간 보간 핵심 구현 (Primary)

### ANALYZE 단계

**기존 동작 파악:**
1. `MetronomeEngine.syncToPlaybackTime(sourceTime, speed)` 분석
   - `sourceTime !== lastSourceTime` 조건으로 기준점 갱신
   - 갱신되지 않는 기간 동안 stale `syncedAcTime` 사용
2. `scheduleTick()`에서 `syncedAcTime` + `currentSourceTime` 기반 스케줄 시간 계산
3. rAF 주기(~16ms) vs sourcePosition 주기(~93ms) 불일치 패턴

**Characterization 테스트 작성:**
- 동일 sourceTime 반복 호출 시 syncedAcTime 변화 없음 확인
- 93ms 간격 sourceTime 변경 시 기준점 갱신 확인
- scheduleTick에서 stale 기준점 사용 시 스케줄 시간 오차 측정

### PRESERVE 단계

기존 테스트 실행 및 통과 확인:
- `tests/unit/MetronomeEngine.test.ts` 전체 통과
- MetronomeEngine 공개 API 유지

### IMPROVE 단계

**Step 1: 상태 변수 리팩토링**
```
변경 전:
  private currentSourceTime = 0
  private syncedAcTime = 0
  private lastSourceTime = -1

변경 후:
  private anchorSourceTime = 0     // sourcePosition 업데이트 시점의 원본 시간
  private anchorAcTime = 0         // sourcePosition 업데이트 시점의 AC 시간
```

**Step 2: getInterpolatedTime() 메서드 추가**
```typescript
private getInterpolatedTime(): number {
  const elapsed = this.audioContext.currentTime - this.anchorAcTime
  return this.anchorSourceTime + elapsed * this.currentSpeed
}
```

**Step 3: syncToPlaybackTime() 리팩토링**
- sourceTime 변경 시: `anchorSourceTime`, `anchorAcTime` 갱신
- sourceTime 동일 시: 기존처럼 갱신 스킵 (보간이 커버)

**Step 4: scheduleTick() 수정**
- `currentSourceTime` 대신 `getInterpolatedTime()` 사용
- `syncedAcTime` 대신 `audioContext.currentTime` 직접 사용

---

## M2: 속도 변경 즉시 동기화 (Primary)

### ANALYZE 단계

**기존 동작 파악:**
1. `AudioEngine.setSpeed()` -> `soundtouch.tempo` 변경
2. MetronomeEngine은 다음 `syncToPlaybackTime()` 호출 시 새 speed 반영
3. 그러나 sourceTime이 변경되지 않으면 앵커 갱신 안됨 -> 보간 오차

### PRESERVE 단계

기존 속도 변경 테스트 통과 확인

### IMPROVE 단계

**Step 1: AudioEngine에 speedChangeListener 추가**
```typescript
private speedChangeListeners: Set<(speed: number, sourceTime: number) => void> = new Set()

addSpeedChangeListener(listener): void
removeSpeedChangeListener(listener): void
```

**Step 2: setSpeed()에서 리스너 호출**
```typescript
setSpeed(speed: number): void {
  // ... 기존 로직 ...
  const currentTime = this.getCurrentTime()
  for (const listener of this.speedChangeListeners) {
    listener(clampedSpeed, currentTime)
  }
}
```

**Step 3: MetronomeEngine에 onSpeedChange 메서드 추가**
```typescript
onSpeedChange(newSpeed: number): void {
  // 현재 보간 위치를 새 앵커로 설정
  this.anchorSourceTime = this.getInterpolatedTime()
  this.anchorAcTime = this.audioContext.currentTime
  this.currentSpeed = newSpeed
  // 기존 스케줄 무효화
  this.scheduledBeats.clear()
  this._updateNextBeatIndex(this.anchorSourceTime)
}
```

**Step 4: useMetronome 훅에서 speedChangeListener 등록**
```typescript
const speedListener = (speed: number) => {
  metronomeRef.current?.onSpeedChange(speed)
}
audioEngine.addSpeedChangeListener(speedListener)
```

---

## M3: 버퍼 크기 최적화 (Secondary)

### 기술적 접근

1. `src/core/AudioEngine.ts`의 `SCRIPT_BUFFER_SIZE` 상수를 2048로 변경
2. 보간 오차 상한: 93ms -> 46ms (50% 개선)
3. CPU 오버헤드: 콜백 빈도 2배 증가 -> CPU 사용률 측정 필요

### 테스트 계획
- Chrome DevTools Performance 패널로 CPU 사용률 측정
- 모바일 Safari에서 글리치 여부 확인
- 10분 이상 연속 재생 안정성 확인
- 글리치 발생 시 4096으로 즉시 롤백

### 롤백 전략
- 상수 하나 변경이므로 즉시 롤백 가능
- feature flag 불필요 (단순 상수)

---

## M4: AudioWorklet 설계 (Optional)

### 조사 항목
1. soundtouchjs의 AudioWorklet 호환성 조사
2. AudioWorkletProcessor에서 SoundTouch wasm 사용 가능성
3. sourcePosition 전달 방식 (MessagePort)
4. 기존 AudioEngine API 호환성 설계

### 예상 산출물
- 설계 문서 (`.moai/docs/audioworklet-migration.md`)
- PoC 코드 (별도 브랜치)
- 마이그레이션 단계 계획

### 판단 기준
- soundtouchjs가 AudioWorklet에서 동작하지 않으면 wasm 포팅 필요 -> 범위 대폭 확대
- Safari AudioWorklet 지원 상태 확인 필요

---

## M5: Downbeat 감지 (Optional)

### 기술적 접근

1. `backend/app/services/bpm_service.py`에 DBNDownBeatTrackingProcessor 추가
2. API 응답에 `downbeats` 필드 추가
3. MetronomeEngine에서 downbeat 인덱스 기반 주파수 선택
4. 기존 `% 4` 하드코딩 폴백 유지

### API 변경
```json
{
  "bpm": 120.0,
  "beats": [0.52, 1.02, 1.52, 2.02, ...],
  "downbeats": [0.52, 2.52, 4.52, ...],
  "confidence": 0.95,
  "file_hash": "sha256hex..."
}
```

### 하위 호환성
- `downbeats` 필드는 선택적 (없으면 기존 `% 4` 로직)
- 프론트엔드 bpmStore에 `downbeats: number[]` 추가
- MetronomeEngine `setBeats(beats, downbeats?)` 시그니처 확장

---

## 구현 순서 및 의존성

```
M1 (시간 보간) ──────────┐
                          ├── Primary 목표 (동시 진행 가능)
M2 (속도 변경 동기화) ────┘
         |
         v
M3 (버퍼 크기) ← M1 완료 후 (효과 측정 비교 필요)
         |
         v
M4 (AudioWorklet 설계) ← M1, M3 효과 확인 후 필요성 재평가
         |
M5 (Downbeat 감지) ← 독립적, 언제든 구현 가능
```

---

## 기술적 접근 요약

### 핵심 원칙
1. **최소 변경 원칙**: 기존 Lookahead Scheduler, OscillatorNode, Worker 패턴은 변경하지 않음
2. **보간 레이어 삽입**: 기존 동기화 흐름에 보간 계산만 추가
3. **이벤트 기반 전파**: 속도 변경을 리스너 패턴으로 전파 (기존 timeListener/seekListener와 일관)
4. **점진적 개선**: 보간 -> 버퍼 최적화 -> AudioWorklet 순서로 단계적 개선

### 아키텍처 설계 방향

현재 동기화 경로:
```
rAF(16ms) -> AudioEngine.getCurrentTime() -> sourcePosition/sampleRate (93ms 계단)
  -> MetronomeEngine.syncToPlaybackTime() -> scheduleTick()
```

개선 동기화 경로:
```
rAF(16ms) -> AudioEngine.getCurrentTime() -> sourcePosition/sampleRate (93ms 계단)
  -> MetronomeEngine.syncToPlaybackTime() -> 앵커 갱신 (sourceTime 변경 시)
  -> scheduleTick() -> getInterpolatedTime() -> 연속적 시간 추정
```

속도 변경 경로 (신규):
```
AudioEngine.setSpeed() -> speedChangeListeners
  -> MetronomeEngine.onSpeedChange() -> 앵커 즉시 갱신 + scheduledBeats 초기화
```

---

## 전문가 상담 권장

### expert-frontend 상담 권장
- Web Audio API 시간 보간 패턴의 정확도 검증
- AudioWorklet 마이그레이션 실현 가능성 평가
- ScriptProcessorNode 버퍼 크기 변경의 크로스 브라우저 영향

### expert-backend 상담 권장 (US-5 구현 시)
- madmom DBNDownBeatTrackingProcessor 설정 및 정확도
- API 응답 스키마 하위 호환성 전략

---

*Generated by MoAI SPEC Builder (manager-spec)*
*Plan date: 2026-02-17*
*Updated: 2026-02-18 (M1/M2 완료, M3/M4 보류, M5 취소 반영)*
