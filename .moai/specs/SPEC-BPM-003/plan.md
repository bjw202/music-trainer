---
id: SPEC-BPM-003
title: 비트그리드 전역 재구성 제거 및 감지기 출력 신뢰 — 구현 계획
version: 1.0.0
status: draft
priority: high
created: 2026-09-05
updated: 2026-09-05
author: jw
phase: "v0.5.0 target"
module: backend/app/services/bpm_service.py
lifecycle: spec-anchored
tags: bpm, beatgrid, drift, ddd, plan
---

# SPEC-BPM-003 구현 계획

| 항목 | 내용 |
|------|------|
| SPEC ID | SPEC-BPM-003 |
| 개발 방법론 | Hybrid → 기존 코드 수정은 DDD(ANALYZE-PRESERVE-IMPROVE), 신규 스크립트는 TDD |
| 커버리지 목표 | 85% (`hybrid_settings.min_coverage_legacy` = `min_coverage_new` = 85) |
| 칸반 카드 | `t1` (class C) |

> 전제 정정: 디스패치는 `development_mode: ddd`라고 했으나 실제 설정은 `hybrid`다. 기존 코드를 고치는 작업이므로 `hybrid_settings.legacy_refactoring: ddd`가 적용되어 **실효 사이클은 DDD**이며, 신규 파일 `scripts/measure_beatgrid_drift.py`만 `new_features: tdd` 분기를 따른다.

---

## 마일스톤 개요

되돌리기 어려운 결정을 앞에, 기계적 작업을 뒤에 배치했다. M1~M3은 사람이 검토해야 할 판단이 들어 있고, M4~M6은 앞의 결정이 확정되면 기계적으로 따라온다.

| 마일스톤 | 우선순위 | 요구사항 | 성격 |
|----------|---------|---------|------|
| M1: 데이터 모델 및 스키마 확장 (`engine`) | Primary | REQ-BPM-003, REQ-BPM-004 | 데이터 모델 변경 — 되돌리기 비쌈 |
| M2: 국소 보정 설계 확정 및 구현 | Primary | REQ-BPM-002 | 알고리즘 판단 — 되돌리기 비쌈 |
| M3: 드리프트 측정 스크립트 (TDD) | Primary | REQ-BPM-005 | 신규 계약 — 검증 도구 자체 |
| M4: 특성화 테스트 보강 (PRESERVE) | Primary | 6.3절 CT-1~CT-3 | 안전망 — M5의 선행 조건 |
| M5: `_smooth_beats` 제거 (IMPROVE) | Primary | REQ-BPM-001 | 기계적 삭제 |
| M6: 의존성 선언 및 성능 확인 | Secondary | REQ-BPM-006, REQ-BPM-008 | 기계적 |

의존 관계:

```
M1 (engine 필드) ─┐
M2 (국소 보정)   ─┼─→ M4 (특성화) ──→ M5 (_smooth_beats 제거) ──→ M6
M3 (측정 스크립트)─┘                        ↑
                          M3의 사전 기준선 측정은 M5 이전에 수행
```

---

## M1: 데이터 모델 및 스키마 확장 (Primary)

가장 먼저 정하는 이유는, `engine`이 **네 계층(dataclass → 캐시 JSON → Pydantic → TypeScript)** 을 관통하고 각 계층의 필수/선택 선택이 서로 물려 있기 때문이다. 나중에 뒤집으면 캐시가 한 번 더 무효화된다.

### ANALYZE

- `BpmResult`는 `bpm, beats, confidence, file_hash` 4개 필드, `to_dict()`도 정확히 이 4개(spec.md F4).
- `BpmService.analyze`에 지역 변수 `algorithm`이 이미 있고 로그에만 쓰인다(F5). 이 값을 그대로 쓴다 — 새 변수를 만들지 않는다.
- `_get_cached_result`는 `data["키"]` 직접 접근 + `KeyError` 포획 패턴(F6).

### PRESERVE

- 기존 `TestBpmResult`, `TestCaching` 실행 → 현재 통과 상태 확인(변경 후 갱신 대상임을 사전 인지).

### IMPROVE

1. `BpmResult`에 `engine: str` 추가 (기본값 없음). 필드 순서는 `file_hash` 다음.
2. `to_dict()`에 `"engine": self.engine` 추가.
3. `_get_cached_result`에 `engine=data["engine"]` 추가 — `.get()` 금지. 구 캐시는 `KeyError` → `None` → 재분석으로 자가 치유.
4. `analyze()`의 `BpmResult(...)` 생성부에 `engine=algorithm` 전달.
5. `backend/app/models/schemas.py` `BpmAnalysisResponse`에 `engine: str` (필수).
6. `src/api/bpm.ts` `BpmAnalysisResponse`에 `engine?: string` (선택 — 배포 시차 대비).

**결정 근거**는 spec.md 4.3절 표에 있다.

---

## M2: 국소 보정 설계 확정 및 구현 (Primary)

`_smooth_beats`를 그냥 지우면 인트로 바운싱이 되돌아온다(SPEC-BPM-002 구현 노트가 밝힌 도입 동기). 대체물을 먼저 확정해야 M5가 안전해진다.

### ANALYZE

- `_smooth_beats`의 실제 결함은 필터가 아니라 **마지막 누적 합산 블록**이다:
  ```python
  smoothed_beats[i + 1] = smoothed_beats[i] + smoothed_intervals[i]
  ```
- 국소 중앙값 계산 자체는 유용하다. 문제는 그것으로 **모든 비트를 다시 만든다는 점**이다.

### IMPROVE

`_repair_beats(beats: np.ndarray, window_size: int = 8) -> np.ndarray` 신설:

```
1. 간격 d = np.diff(beats)
2. 각 i에 대해 폭 window_size 창의 중앙값 m_i 계산  ← 판정 전용
3. 결과 리스트를 beats[0]부터 순회하며 구성:
   - d_i >= 1.75 * m_i  → beats[i]와 beats[i+1] 사이에 k = round(d_i/m_i) - 1 개를 등간격 삽입
   - d_i <= 0.50 * m_i  → beats[i+1]을 결과에 넣지 않음 (뒤쪽 제거)
   - 그 외              → beats[i+1]을 그대로 넣음
4. 보정 건수(삽입 n건 / 제거 m건)를 logger.info로 기록
```

**불변식 (REQ-BPM-002-INV):** 제거된 비트를 제외한 모든 원본 비트가 결과에 **값 그대로** 존재한다. 어떤 원본 비트도 이웃의 보정 때문에 이동하지 않는다.

`_detect_with_madmom` 174행의 `_smooth_beats(beats)` 자리에 `_repair_beats(beats)`가 들어간다. 호출 순서(보정 → BPM 계산 → confidence 계산)는 유지한다.

### 대안 평가

| 선택지 | 장점 | 단점 | 판단 |
|--------|------|------|------|
| 보정 완전 제거 | 가장 단순, 감지기 출력 100% 신뢰 | 인트로 바운싱 재발 | 채택 안 함 |
| **국소 보정 (채택)** | 드리프트 0, 누락/중복은 해결 | 임계값 1.75 / 0.50이 경험값 | **채택** |
| 국소 중앙값으로 위치 대체 | 부드러움 | 원본 이동 = 전역 재구성의 축소판 | 채택 안 함 |

임계값 1.75와 0.50은 경험값이므로 모듈 상수로 분리해 조정 가능하게 둔다.

---

## M3: 드리프트 측정 스크립트 (Primary, TDD)

신규 파일이므로 `hybrid_settings.new_features: tdd`가 적용된다. 테스트를 먼저 쓴다.

### RED

`backend/tests/test_beatgrid_drift.py`:

1. 합성 입력 — 방출 그리드 == 감지기 출력 → `max_drift_ms == 0.0`, exit 0
2. 합성 입력 — 방출 그리드가 마지막에서 0.64초 밀림 → `last_beat_drift_ms ≈ 640`, `max_drift_ms ≥ 100`, exit 1
3. `--json` 출력이 유효한 JSON이고 5개 키(`max_drift_ms`, `last_beat_drift_ms`, `mean_drift_ms`, `beat_count`, `engine`)를 모두 포함
4. 존재하지 않는 파일 경로 → 0이 아닌 exit code + stderr 메시지

### GREEN

`scripts/measure_beatgrid_drift.py`:

```
usage: python scripts/measure_beatgrid_drift.py <audio-path> [--json] [--threshold-ms 1.0] [--no-cache]

동작:
  1. 감지기 원본 출력 획득 (madmom 가용 시 madmom 감지 단계, 아니면 librosa) — 보정 이전 배열
  2. BpmService.analyze(path).beats 로 방출 그리드 획득
  3. emitted[i] 각각에 대해 가장 가까운 detector[j] 탐색 → |차이| * 1000 (ms)
  4. max / last / mean / count / engine 산출
  5. 표 또는 JSON 출력, max > threshold 면 exit 1
```

캐시가 결과를 가리지 않도록 시작 시 대상 해시의 캐시 파일 유무를 알리고, `--no-cache`로 우회할 수 있게 한다.

### REFACTOR

감지기 원본 획득 로직을 `bpm_service`에 중복 구현하지 않고 재사용 가능한 최소 진입점으로 정리한다.

---

## M4: 특성화 테스트 보강 (Primary, PRESERVE)

DDD는 변경 **전에** 현재 동작을 고정할 것을 요구한다. M5로 넘어가기 전 반드시 완료한다.

`backend/tests/test_bpm.py`에 추가:

| ID | 내용 | M5 이후 운명 |
|----|------|------------|
| CT-1 | `_smooth_beats`의 누적 재구성 성질 고정 — 합성 비트열 입력 시 출력 마지막 비트가 입력 마지막 비트에서 유의미하게 벗어남을 단언 | **삭제** (함수 소멸). 삭제 자체가 결함 제거의 증거 |
| CT-2 | 모킹된 감지기 출력에 대해 현재 `_detect_with_madmom`의 반환 `beats`가 원본과 **다름**을 단언 | **반전** — "원본과 같다(국소 보정 대상 없는 입력에서)"로 전환 |
| CT-3 | `BpmResult.to_dict()` 키 집합이 정확히 4개임을 단언 | **갱신** — 5개(`engine` 포함)로 |

기존 테스트 중 M1으로 깨질 것들(사전 인지, spec.md 6.3절 표):
`TestBpmResult::test_bpm_result_creation`, `test_bpm_result_to_dict`, `TestCaching::test_save_and_get_cached_result`, `test_cache_file_format`, `TestAnalyze::test_analyze_returns_cached_result`.

`TestConfidenceCalculation::*`는 REQ-BPM-007(공식 동결)에 의해 **변경 없이 통과해야 한다.** 이 테스트가 깨지면 범위를 벗어난 변경이 들어간 것이다.

---

## M5: `_smooth_beats` 제거 (Primary, IMPROVE)

M2와 M4가 끝난 뒤의 기계적 작업이다.

### 사전 기준선 측정 (반드시 M5 삭제 전에)

```bash
rm -rf /tmp/bpm_cache
python scripts/measure_beatgrid_drift.py "music-source/Deep Purple  Smoke On the Water Official Music Video.mp3" --json
```

출력의 `max_drift_ms`를 `progress.md`에 verbatim 기록한다. 이것이 AC-BPM-006-BEFORE의 증거이며, 측정하지 못하면 gap으로 보고한다(추정값 기입 금지).

### 삭제 절차

1. `bpm_service.py` 120-151행 `_smooth_beats` 함수 정의 삭제.
2. 174행 `beats = _smooth_beats(beats)` → `beats = _repair_beats(beats)` (M2에서 이미 도입된 경우 확인만).
3. `grep -rn "_smooth_beats" backend/` 결과가 비어 있는지 확인.
4. CT-1 테스트 삭제, CT-2 반전.

### 사후 측정

캐시를 비우고 동일 명령을 재실행해 `max_drift_ms ≤ 1.0`을 확인한다.

---

## M6: 의존성 선언 및 성능 확인 (Secondary)

1. `backend/requirements.txt`:
   ```
   # madmom>=0.16.1  # Python 3.13 비호환 (Cython 빌드 실패) - librosa fallback 사용
   ```
   →
   ```
   # madmom: Python 3.13 이상에서 Cython 빌드 실패 → 환경 마커로 스킵, librosa 폴백 사용
   madmom>=0.16.1; python_version < "3.13"
   ```
2. 백엔드 실행 인터프리터에서 `python -c "import madmom; print(madmom.__version__)"` 판정 → A/B 분기 기록(spec.md 6.1절). 사용한 인터프리터 경로도 함께 남긴다.
3. 분석 소요 시간 변경 전/후 비교 (REQ-BPM-008). 동일 파일, 캐시 비운 상태에서 각 1회 이상.

---

## 위험 관리

| 위험 | 대응 |
|------|------|
| madmom 미설치로 실제 madmom 경로를 못 밟음 | spec.md 6.1 B분기 — 모킹 단위 테스트로 대체하고 progress.md에 명시. "성공했다"고 쓰지 않는다 |
| Hotel California 픽스처 부재 | Smoke On the Water로 기준 픽스처 확정. Hotel은 운영자 제공 시 보조 측정(AC-BPM-006-OPT) |
| 사전 기준선을 측정하지 못함 | 추정값 기입 금지. gap으로 보고하고 사후 기준(AC-BPM-006-AFTER)만 근거로 삼는다 |
| 국소 보정 임계값이 곡마다 부적절 | 상수 분리 + 보정 건수 로깅. 조정은 후속 SPEC |

---

## 안티패턴 (하지 말 것)

- `_smooth_beats`를 지우면서 "대신 조금만 평활화"하는 축소판을 남기는 것 — 누적 합산이 한 줄이라도 남으면 결함은 그대로다.
- `data.get("engine", "unknown")` 으로 캐시를 읽는 것 — 구 스키마가 조용히 살아남아 `engine`이 거짓말을 한다. REQ-BPM-004는 `KeyError` 경로를 명시적으로 요구한다.
- confidence가 낮아졌다고 공식을 손보는 것 — REQ-BPM-007로 동결. 낮아진 값이 정직한 값이다.
- 프론트엔드에 `engine` 표시 UI를 "간 김에" 추가하는 것 — spec.md 11절 범위 외.
- 드리프트 측정을 스크립트 없이 눈대중으로 대신하는 것 — AC-BPM-005는 스크립트의 실제 출력을 요구한다.

---

## 상호 참조

- `.moai/specs/SPEC-BPM-003/spec.md` — 요구사항 및 설계 결정
- `.moai/specs/SPEC-BPM-003/acceptance.md` — 수용 기준
- `.moai/specs/SPEC-BPM-002/spec.md` — `_smooth_beats` 도입 경위 (구현 노트)
- `.moai/config/sections/quality.yaml` — hybrid 모드 및 커버리지 설정

---

*Generated by MoAI SPEC Builder (manager-spec)*
*Plan date: 2026-09-05*
