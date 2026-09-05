---
id: SPEC-BPM-003
title: 비트그리드 전역 재구성 제거 및 감지기 출력 신뢰 — 구현 계획
version: 1.1.0
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
| 개발 방법론 | Hybrid → 기존 코드 수정은 DDD(ANALYZE-PRESERVE-IMPROVE), 원본에 없던 신규 CLI 계약만 TDD |
| 커버리지 목표 | 85% (`hybrid_settings.min_coverage_legacy` = `min_coverage_new` = 85) |
| 칸반 카드 | `t1` (class C) |
| 계획 버전 | 1.1.0 (spec.md 0절 전제 정정 반영) |

> 전제 정정 (1): 디스패치는 `development_mode: ddd`라고 했으나 실제 설정은 `hybrid`다. 기존 코드를 고치는 작업이므로 `hybrid_settings.legacy_refactoring: ddd`가 적용되어 **실효 사이클은 DDD**다.
>
> 전제 정정 (2, 1.1.0): `scripts/measure_beatgrid_drift.py`는 신규 파일이 **아니다.** `metronome-update-plan-docs/tools/measure_beatgrid_drift.py`에 235행짜리 동작하는 원본이 이미 있으며(git untracked이라 워크트리에서 보이지 않았을 뿐이다), 본 작업은 **포팅 + git 등록 + 경로/환경 가정 정규화**다. 따라서 측정 코어는 DDD, 원본에 없던 CLI 계약(`--json` / `--threshold-ms` / 임계 exit)만 TDD로 간다. 근거와 분기표는 spec.md 7절 P4.
>
> 전제 정정 (3, 1.1.0): madmom은 `backend/.venv`(Python 3.13.11)에서 **설치되어 정상 동작한다**(`_MADMOM_AVAILABLE = True`). 환경 마커 제안은 철회되었고, madmom 경로는 실제 실행으로 검증한다.
>
> 이 세 정정의 공통 원인은 하나다 — 1.0.0의 조사가 워크트리 안에서만 이루어져 git untracked 파일(`backend/.venv`, 원본 스크립트)을 볼 수 없었다. spec.md 0절 참조.
>
> **독립 감사(plan-audit)는 본 SPEC의 흐름 안에서 수행하지 않는다.** 칸반 lead 세션이 별도로 진행한다.

---

## 마일스톤 개요

되돌리기 어려운 결정을 앞에, 기계적 작업을 뒤에 배치했다. M1~M3은 사람이 검토해야 할 판단이 들어 있고, M4~M6은 앞의 결정이 확정되면 기계적으로 따라온다.

| 마일스톤 | 우선순위 | 요구사항 | 성격 |
|----------|---------|---------|------|
| M1: 데이터 모델 및 스키마 확장 (`engine`) | Primary | REQ-BPM-003, REQ-BPM-004 | 데이터 모델 변경 — 되돌리기 비쌈 |
| M2: 국소 보정 설계 확정 및 구현 | Primary | REQ-BPM-002 | 알고리즘 판단 — 되돌리기 비쌈 |
| M3: 드리프트 측정 스크립트 포팅 (DDD 코어 + TDD CLI) | Primary | REQ-BPM-005 | 기존 도구 이식 + 신규 계약 — 검증 도구 자체 |
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

## M3: 드리프트 측정 스크립트 포팅 (Primary, DDD 코어 + TDD CLI)

**신규 작성이 아니라 포팅이다.** 원본은 `metronome-update-plan-docs/tools/measure_beatgrid_drift.py` (235행 / 8568바이트, git untracked). 목적지는 `scripts/measure_beatgrid_drift.py`이며, git에 등록되어야 한다.

### ANALYZE — 원본이 이미 하는 일

| 원본 위치 | 동작 | 포팅 시 |
|----------|------|--------|
| `_patch_numpy_for_madmom()` (37행), `_load_smooth_beats()` (58행) | `sys.path`에 `APP_DIR/backend`를 넣고 대상 앱의 `_smooth_beats`를 실제로 가져온다(없으면 동등 사본) | 유지. 단 경로 유도 방식은 정규화 (a) |
| `measure_d1_d5()` (107행) | madmom `RNNBeatProcessor` + `DBNBeatTrackingProcessor(fps=100)`로 원본 비트를 얻고, `smoothed - raw` 차분에서 최대 이탈·마지막 비트 이탈·구간별 이탈을 ms로 출력 | **측정 코어. 보존 대상** |
| `check_d2_downbeat()` (161행) | 다운비트 점검 | 본 SPEC 범위 밖(spec.md 11절). 포팅 시 제외 가능 |
| `main() -> int` (194행) | 곡을 자동 탐색해 순회 | 인자로 받은 단일 경로 우선으로 변경 |

원본에 **없는** 것: `argparse`, JSON 출력, `--threshold-ms`, 임계 초과 시 exit 1. 이 넷이 신규 계약이며 TDD 대상이다.

### PRESERVE — 옮기기 전에 고정할 것

원본을 그대로 실행해 기준 픽스처에 대한 출력(최대 이탈 ms, 마지막 비트 이탈 ms, 비트 수)을 `progress.md`에 verbatim 기록한다. 포팅 후 같은 입력에서 같은 값이 나오는지 대조하는 것이 이 마일스톤의 안전망이다. **기록 없이 옮기면 측정값이 달라져도 아무도 알아채지 못한다.**

### IMPROVE — 정규화 두 곳 (REQ-BPM-005)

1. **(a) `APP_DIR` 정규화.** 29-30행의 머신 고유 절대 경로 기본값(`Path.home() / "Dev/my-project-01/guitar-mp3-trainer-v2"`)을 버리고, `Path(__file__).resolve().parent.parent`처럼 스크립트 자신의 위치에서 리포 루트를 유도한다. `APP_DIR` 환경 변수 없이 실행해도 동작해야 한다(AC-BPM-005 (e)).
2. **(b) 인터프리터 하드코딩 제거.** 12행·204행 사용법 문구의 `~/Dev/.../backend/.venv/bin/python`을 리포 상대 안내로 대체한다.

추가로, 측정 정의를 유지하기 위한 필수 일반화가 하나 있다. 원본은 `smoothed - raw`의 **인덱스 정렬 차분**을 쓰는데, 이는 `_smooth_beats`가 비트 개수를 바꾸지 않기에 성립했다. `_repair_beats`는 삽입·제거로 개수를 바꾸므로 **최근접 대응**으로 바꾼다(spec.md REQ-BPM-005).

### RED — 신규 CLI 계약 (TDD)

`backend/tests/test_beatgrid_drift.py`:

1. 합성 입력 — 방출 그리드 == 감지기 출력 → `max_drift_ms == 0.0`, exit 0
2. 합성 입력 — 방출 그리드가 마지막에서 0.64초 밀림 → `last_beat_drift_ms ≈ 640`, `max_drift_ms ≥ 100`, exit 1
3. `--json` 출력이 유효한 JSON이고 5개 키(`max_drift_ms`, `last_beat_drift_ms`, `mean_drift_ms`, `beat_count`, `engine`)를 모두 포함
4. 존재하지 않는 파일 경로 → 0이 아닌 exit code + stderr 메시지
5. `APP_DIR` 환경 변수를 지운 상태에서 실행해도 리포 루트를 찾아 정상 동작 (정규화 (a) 검증)

### GREEN

`scripts/measure_beatgrid_drift.py` (포팅 결과):

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

감지기 원본 획득 로직을 `bpm_service`에 중복 구현하지 않고 재사용 가능한 최소 진입점으로 정리한다. 원본 스크립트의 `_load_smooth_beats()`가 이미 "대상 앱의 실제 함수를 import하고 실패 시 사본으로 폴백"하는 형태이므로, 그 의도를 유지하되 리포 안으로 들어온 만큼 폴백 사본은 걷어낸다.

### 완료 조건

- `git ls-files scripts/measure_beatgrid_drift.py`가 파일을 찾는다 (원본이 untracked였던 것이 오판의 원인이었다).
- `APP_DIR` 없이 실행해도 동작한다.
- 원본 실행 출력(PRESERVE 단계 기록)과 포팅본 출력이 기준 픽스처에서 일치한다. 최근접 대응 일반화로 인한 차이는 예외이며, 그 사실을 기록한다.

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
backend/.venv/bin/python scripts/measure_beatgrid_drift.py "music-source/Deep Purple  Smoke On the Water Official Music Video.mp3" --json
```

인터프리터는 백엔드 런타임(`backend/.venv/bin/python`, Python 3.13.11)을 쓴다. madmom이 그 환경에서만 동작하므로, 다른 인터프리터로 측정하면 librosa 경로로 빠져 madmom 드리프트를 재지 못한다.

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

1. `backend/requirements.txt` 25행:
   ```
   # madmom>=0.16.1  # Python 3.13 비호환 (Cython 빌드 실패) - librosa fallback 사용
   ```
   →
   ```
   # madmom: bpm_service.py 의 3.13/NumPy 2.x 호환 shim 을 거쳐 import 됨
   madmom>=0.16.1
   ```
   **환경 마커를 붙이지 않는다.** 백엔드 런타임은 Python 3.13.11이고 그 위에서 madmom이 실제로 동작하므로, `; python_version < "3.13"`은 madmom이 작동하는 바로 그 인터프리터에서 설치를 건너뛰게 만든다. 낡은 "3.13 비호환" 주석도 함께 정리한다 — 그대로 두면 다음 독자가 같은 오판을 반복한다.
2. 백엔드 실행 인터프리터에서 madmom 가용성 판정 → 결과와 인터프리터 경로 기록(spec.md 6.1절, acceptance.md PRE-2):
   ```bash
   cd backend && .venv/bin/python -c "import sys; sys.path.insert(0,'.'); from app.services import bpm_service as b; print('MADMOM_AVAILABLE =', b._MADMOM_AVAILABLE)"
   ```
   **맨 `python -c "import madmom"`을 쓰지 않는다.** shim을 거치지 않은 import는 3.13에서 항상 실패하므로, madmom이 동작하는 머신에서도 "없음"으로 오판한다.
3. 분석 소요 시간 변경 전/후 비교 (REQ-BPM-008). 동일 파일, 캐시 비운 상태에서 각 1회 이상.

---

## 위험 관리

| 위험 | 대응 |
|------|------|
| madmom 경로를 못 밟음 | 가능성 낮음 — madmom 가용성은 확인되었다(`_MADMOM_AVAILABLE = True`). 실제 실행으로 검증한다. 다른 머신에서 False가 나오는 경우에만 spec.md 6.1 B분기로 대체하고 progress.md에 명시한다 |
| 판정 명령을 맨 `import madmom`으로 써서 오판 | shim 경로(`bpm_service._MADMOM_AVAILABLE`)로만 판정한다. 맨 import는 3.13에서 항상 실패한다 |
| 포팅 중 측정 로직이 조용히 달라짐 | M3 PRESERVE — 원본 출력을 먼저 verbatim 기록하고 포팅본과 대조한다 |
| 포팅본을 git에 등록하지 않음 | 원본이 untracked였던 것이 1.0.0 오판의 직접 원인이다. `git ls-files`로 확인하는 것을 완료 조건에 넣었다 |
| Hotel California 픽스처 부재 | Smoke On the Water로 기준 픽스처 확정. Hotel은 운영자 제공 시 보조 측정(AC-BPM-006-OPT). ×2 오검출 검증은 카드 `t10`으로 이관 |
| 사전 기준선을 측정하지 못함 | 추정값 기입 금지. gap으로 보고하고 사후 기준(AC-BPM-006-AFTER)만 근거로 삼는다 |
| 국소 보정 임계값이 곡마다 부적절 | 상수 분리 + 보정 건수 로깅. 조정은 후속 SPEC |

---

## 안티패턴 (하지 말 것)

- `_smooth_beats`를 지우면서 "대신 조금만 평활화"하는 축소판을 남기는 것 — 누적 합산이 한 줄이라도 남으면 결함은 그대로다.
- `data.get("engine", "unknown")` 으로 캐시를 읽는 것 — 구 스키마가 조용히 살아남아 `engine`이 거짓말을 한다. REQ-BPM-004는 `KeyError` 경로를 명시적으로 요구한다.
- confidence가 낮아졌다고 공식을 손보는 것 — REQ-BPM-007로 동결. 낮아진 값이 정직한 값이다.
- 프론트엔드에 `engine` 표시 UI를 "간 김에" 추가하는 것 — spec.md 11절 범위 외.
- 드리프트 측정을 스크립트 없이 눈대중으로 대신하는 것 — AC-BPM-005는 스크립트의 실제 출력을 요구한다.
- 이미 있는 측정 스크립트를 무시하고 백지에서 다시 쓰는 것 — 235행짜리 동작하는 원본이 있다. 다시 쓰면 검증된 측정 정의를 잃는다.
- madmom에 환경 마커를 붙이는 것 — 3.13.11에서 실제로 동작하므로 마커는 설치를 건너뛰게 만든다. 1.0.0의 지시였고 철회되었다.
- 맨 `python -c "import madmom"`으로 가용성을 판정하는 것 — shim 없이는 3.13에서 항상 실패한다. 이 명령의 실패를 "madmom 없음"으로 읽으면 분기 B로 잘못 빠진다.
- 파일이 없다고 단정하기 전에 주 체크아웃을 확인하지 않는 것 — 워크트리에는 untracked 파일이 복제되지 않는다. 1.0.0의 네 오판이 전부 여기서 나왔다.

---

## 상호 참조

- `.moai/specs/SPEC-BPM-003/spec.md` — 요구사항 및 설계 결정
- `.moai/specs/SPEC-BPM-003/acceptance.md` — 수용 기준
- `.moai/specs/SPEC-BPM-002/spec.md` — `_smooth_beats` 도입 경위 (구현 노트)
- `.moai/config/sections/quality.yaml` — hybrid 모드 및 커버리지 설정

---

*Generated by MoAI SPEC Builder (manager-spec)*
*Plan date: 2026-09-05*
