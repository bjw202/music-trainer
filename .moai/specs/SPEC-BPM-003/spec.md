---
id: SPEC-BPM-003
title: 비트그리드 전역 재구성 제거 및 감지기 출력 신뢰
version: 1.0.0
status: draft
priority: high
created: 2026-09-05
updated: 2026-09-05
author: jw
phase: "v0.5.0 target"
module: backend/app/services/bpm_service.py
lifecycle: spec-anchored
tags: bpm, beatgrid, drift, madmom, librosa, ddd
related_specs:
  - SPEC-BPM-001
  - SPEC-BPM-002
---

# SPEC-BPM-003: 비트그리드 전역 재구성 제거 및 감지기 출력 신뢰

| 항목 | 내용 |
|------|------|
| SPEC ID | SPEC-BPM-003 |
| 상태 | draft |
| 작성일 | 2026-09-05 |
| 우선순위 | P0 (High) |
| 선행 SPEC | SPEC-BPM-001 (Completed), SPEC-BPM-002 (Completed) |
| 개발 방법론 | DDD (ANALYZE-PRESERVE-IMPROVE) |
| 칸반 카드 | `t1` (class C) |

---

## 목차

1. [개요](#1-개요)
2. [문제 분석](#2-문제-분석)
3. [요구사항 (GEARS)](#3-요구사항-gears)
4. [설계 결정](#4-설계-결정)
5. [파일 영향 분석](#5-파일-영향-분석)
6. [전제 조건 및 검증 환경](#6-전제-조건-및-검증-환경)
7. [카드 전제 중 성립하지 않은 항목](#7-카드-전제-중-성립하지-않은-항목)
8. [비기능 요구사항](#8-비기능-요구사항)
9. [리스크 및 완화](#9-리스크-및-완화)
10. [제약사항](#10-제약사항)
11. [범위 외 (Exclusions)](#11-범위-외-exclusions)

---

## 1. 개요

`backend/app/services/bpm_service.py`의 `_smooth_beats`(120-151행)는 비트 그리드를 **전역 재구성**한다. 첫 비트 위치만 유지하고, 이동 중앙값으로 평활화한 간격을 첫 비트부터 누적 합산하여 이후 모든 비트 위치를 다시 만든다. 작은 간격 오차가 곡 전체에 걸쳐 누적되므로, 비트 그리드가 실제 오디오에서 점진적으로 멀어진다.

본 SPEC은 이 전역 재구성을 제거하고, **감지기(madmom / librosa) 출력을 비트 위치의 단일 진실 공급원(source of truth)으로 삼는다.** 보정은 이웃 비트를 이동시키지 않는 **국소 보정(누락 보간 / 중복 제거)** 만 허용한다. 아울러 결과가 어느 감지기에서 나왔는지 사용자가 확인할 수 있도록 `engine` 필드를 API 응답까지 노출하고, 드리프트를 실제로 재는 측정 스크립트를 신규 작성한다.

### 1.1 검증된 현재 코드 사실 (본 SPEC의 근거)

아래는 워크트리 `.claude/worktrees/t1` (HEAD `15c363b`)에서 직접 확인한 사실이다.

| # | 사실 | 확인 방법 |
|---|------|----------|
| F1 | `bpm_service.py`는 359행. `_smooth_beats`는 120-151행에 정의 | `grep -n`, `wc -l` |
| F2 | `_smooth_beats`의 유일한 호출 지점은 174행, 모듈 레벨 `_detect_with_madmom` 내부. `_detect_with_librosa`는 호출하지 않음 | `grep -n "_smooth_beats"` |
| F3 | 174-181행 호출 순서: `beats = _smooth_beats(beats)` → `bpm = 60.0 / np.median(np.diff(beats))` → `confidence = _calculate_confidence(beats)`. 즉 평활화 제거는 비트 위치뿐 아니라 `bpm`·`confidence` 값도 바꾼다 | 코드 정독 |
| F4 | `BpmResult`(65행 부근)의 필드는 `bpm, beats, confidence, file_hash` 4개이며 `to_dict()`도 정확히 이 4개만 직렬화. `engine` 필드 없음 | 코드 정독 |
| F5 | `BpmService.analyze`에 지역 변수 `algorithm`("madmom" \| "librosa")이 이미 존재하나, 로그에만 쓰이고 폐기됨 | 코드 정독 |
| F6 | `_get_cached_result`는 `data["bpm"]`, `data["beats"]`, `data["confidence"]`를 읽고 `KeyError`를 잡아 `None`을 반환 → 재분석 유도 | 코드 정독 |
| F7 | `_calculate_confidence`는 변동계수(CV) 기반(`1.0 - std/mean`)이므로, 평활화되지 않은 원본 비트는 현재보다 **낮은** 신뢰도를 받는다 | 코드 정독 |
| F8 | `confidence`를 소비하는 코드는 `MetronomePanel.tsx:72`의 표시(`Math.round(confidence * 100)%`)뿐이며, 임계값으로 분기하는 코드는 없다 | `grep -rn confidence src backend/app` |
| F9 | `engine`이 UI까지 도달하려면 `backend/app/models/schemas.py:109 BpmAnalysisResponse`와 `src/api/bpm.ts`의 `BpmAnalysisResponse` 두 계층도 함께 확장해야 한다 | 코드 정독 |
| F10 | `bpm_service.py` 23-33행에 Python 3.13 / NumPy 2.x용 madmom 호환 shim이 이미 존재한다 (과거에 3.13을 겨냥한 흔적) | 코드 정독 |

---

## 2. 문제 분석

### 2.1 근본 원인: 국소 필터가 아니라 전역 재구성

`_smooth_beats`의 마지막 블록이 문제의 핵심이다.

```python
smoothed_beats[0] = beats[0]
for i in range(len(smoothed_intervals)):
    smoothed_beats[i + 1] = smoothed_beats[i] + smoothed_intervals[i]
```

`smoothed_intervals[i]`의 오차 `e_i`는 이후 모든 비트에 그대로 더해진다. 즉 `n`번째 비트의 오차는 `Σ(e_0..e_{n-1})`로 **누적**된다. 이동 중앙값이 각 간격을 평균적으로 잘 맞추더라도, 편향(bias)이 조금이라도 있으면 곡 길이에 비례해 드리프트가 커진다. 관찰된 값은 마지막 박에서 약 640ms이다(카드 기재값, 본 SPEC에서 재측정 대상 — 7절 P3 참조).

### 2.2 영향 범위

- **비트 위치**: 곡 후반부로 갈수록 오디오와 어긋난다. 메트로놈은 SPEC-BPM-002에서 프론트엔드 동기화를 정밀화했으나, 입력 그리드 자체가 틀리면 그 정밀도는 의미가 없다.
- **BPM 값**: `np.median(np.diff(beats))`가 평활화된 간격 위에서 계산되므로 값이 달라진다. 중앙값은 이상치에 강건하므로 변화량은 작을 것으로 예상되나 0은 아니다.
- **confidence 값**: F7에 따라 낮아진다. 이는 결함이 아니라 **원래 감지 품질을 정직하게 반영하게 되는 것**이다.

---

## 3. 요구사항 (GEARS)

### REQ-BPM-001: 전역 재구성 제거

**Where** madmom 경로가 사용되는 경우, the BPM 서비스 shall `_smooth_beats`를 호출하지 않고, 감지기가 반환한 비트 타임스탬프를 그대로 결과 비트 그리드의 기준으로 사용한다.

- `_smooth_beats` 함수 정의(120-151행)를 삭제한다.
- 174행의 호출을 제거한다.
- 간격의 누적 합산으로 비트 위치를 재생성하는 코드는 어떤 형태로도 남기지 않는다.

### REQ-BPM-002: 국소 보정만 허용

the BPM 서비스 shall 비트 그리드 보정을 국소 보정으로 한정하며, 보정 대상이 아닌 비트의 타임스탬프를 이동시키지 않는다.

허용되는 국소 보정은 정확히 두 가지다.

| 보정 | 조건 | 동작 |
|------|------|------|
| 누락 보간 | 간격 `d_i`가 국소 중앙값 `m_i`의 `1.75`배 이상 | 해당 간격 안에 `round(d_i / m_i) - 1`개의 비트를 등간격으로 삽입 |
| 중복 제거 | 간격 `d_i`가 국소 중앙값 `m_i`의 `0.5`배 이하 | 뒤쪽 비트 하나를 제거 |

**불변식 (REQ-BPM-002-INV):** 보정 후 비트 배열은, 중복 제거로 삭제된 비트를 제외하면 감지기 원본 비트의 **상위집합(superset)** 이며, 살아남은 원본 비트의 타임스탬프는 반올림 오차를 넘어 변하지 않는다.

국소 중앙값 `m_i`는 `i`를 중심으로 한 폭 8의 창에서 계산하되, **오직 판정에만 쓰이고 어떤 기존 비트의 위치도 대체하지 않는다.**

### REQ-BPM-003: 감지 엔진 노출

**When** BPM 분석이 완료되면, the BPM 서비스 shall 사용된 감지 엔진 이름(`"madmom"` 또는 `"librosa"`)을 `engine` 필드로 결과에 포함하고, 이를 API 응답 스키마와 프론트엔드 타입까지 전파한다.

- `BpmResult`에 `engine: str` 필드 추가, `to_dict()`에 포함.
- `BpmService.analyze`의 기존 지역 변수 `algorithm`(F5)을 그대로 이 필드의 값으로 사용한다. 새 변수를 만들지 않는다.
- `backend/app/models/schemas.py`의 `BpmAnalysisResponse`에 `engine: str`(필수) 추가.
- `src/api/bpm.ts`의 `BpmAnalysisResponse`에 `engine?: string`(선택) 추가.

### REQ-BPM-004: 캐시 스키마 변경의 안전한 열화

**When** 캐시 파일에 `engine` 키가 없으면, the BPM 서비스 shall `_get_cached_result`에서 `KeyError`를 발생시켜 `None`을 반환하고, 호출자가 재분석을 수행하도록 한다.

- `engine`은 기존 세 키와 동일하게 `data["engine"]` 형태로 읽는다(`.get()` 사용 금지).
- 기존 `except (json.JSONDecodeError, KeyError)` 블록이 이를 잡아 경고 로그 후 `None`을 반환한다.
- 결과적으로 구 스키마 캐시는 1회 재분석으로 신 스키마로 자가 치유된다. 캐시 마이그레이션 스크립트는 작성하지 않는다.

### REQ-BPM-005: 드리프트 측정 스크립트

the 프로젝트 shall `scripts/measure_beatgrid_drift.py`를 제공하여, 임의의 오디오 파일에 대해 방출된 비트 그리드와 감지기 원본 출력 사이의 편차를 측정한다.

측정 정의:

- `emitted[i]` = `BpmService.analyze(path).beats[i]`
- `detector[j]` = 해당 감지 함수가 반환한 원본 비트(보정·평활화 이전)
- 각 `emitted[i]`에 대해 가장 가까운 `detector[j]`를 찾아 절대 편차 `|emitted[i] - detector[j]|`를 ms로 계산
- 보고 항목: `max_drift_ms`, `last_beat_drift_ms`, `mean_drift_ms`, `beat_count`, `engine`

호출 형태:

```bash
python scripts/measure_beatgrid_drift.py <audio-path> [--json]
```

- 기본 출력은 사람이 읽는 표, `--json`은 기계 판독용 JSON을 stdout에 출력한다.
- `max_drift_ms`가 임계값(기본 1.0ms)을 넘으면 exit code 1, 아니면 0.

### REQ-BPM-006: madmom 의존성 선언

the 프로젝트 shall `backend/requirements.txt`에서 madmom을 주석 해제하되, 설치 불가 환경에서 전체 설치가 실패하지 않도록 환경 마커를 부여한다.

```
madmom>=0.16.1; python_version < "3.13"
```

- Python 3.13 이상에서는 pip가 이 항목을 건너뛰고, 코드는 기존 librosa 폴백을 사용한다.
- 기존 호환성 주석은 마커의 근거를 설명하는 문구로 갱신한다.

### REQ-BPM-007: confidence 공식 동결 (설계 결정)

the BPM 서비스 shall `_calculate_confidence`의 공식과 상한(librosa 0.8)을 본 SPEC에서 변경하지 않는다.

근거는 4.2절에 기술한다. 이는 명시적 설계 결정이며, 구현 세부의 누락이 아니다.

### REQ-BPM-008: 성능 회귀 금지

the BPM 서비스 shall 본 변경 이후 분석 소요 시간이 변경 전 대비 증가하지 않는다.

`_smooth_beats`는 O(n·w) 루프였으므로 제거는 순감이며, 국소 보정도 동일 복잡도 이하다.

---

## 4. 설계 결정

### 4.1 국소 보정을 남길 것인가

**결정: 남긴다. 단, 불변식(REQ-BPM-002-INV)을 만족하는 형태로만.**

madmom의 DBN 비트 트래커는 인트로·브레이크다운 구간에서 비트를 통째로 놓치거나 두 번 찍는 경우가 있다. 이 경우 메트로놈이 한 박을 건너뛰거나 겹쳐 울린다. 이 결함은 전역 재구성 없이도 고칠 수 있으며, 그것이 국소 보정이다. "보정을 아예 하지 않는다"는 선택지도 유효하지만, 그러면 SPEC-BPM-002 구현 노트에서 `_smooth_beats` 도입 동기였던 "인트로 바운싱"이 그대로 되돌아온다.

다만 국소 보정이 실제로 무엇을 고쳤는지 확인 가능해야 하므로, 보정 건수를 로그로 남긴다(REQ-BPM-002 구현 시 `logger.info`).

### 4.2 confidence 재보정 여부

**결정: 공식·상한 모두 변경하지 않는다.**

근거:

1. F8에 따라 `confidence`를 임계값으로 소비하는 코드가 프론트엔드·백엔드 어디에도 없다. 유일한 소비처는 `MetronomePanel.tsx:72`의 퍼센트 표시다. 따라서 값이 낮아져도 동작이 바뀌는 분기가 없다.
2. 현재의 높은 confidence는 **평활화가 만들어낸 인공적 규칙성**의 산물이다. 평활화를 제거하면 CV가 커지고 값이 낮아지는데, 이는 감지 품질을 정직하게 반영하는 방향이다. 지표를 다시 부풀리는 재보정은 이 SPEC의 취지와 정면으로 어긋난다.
3. 재보정은 "얼마가 적정한가"에 대한 근거 데이터가 필요하며, 본 SPEC은 그 데이터를 갖고 있지 않다.

대신 값이 낮아진다는 사실 자체를 수용 기준(AC-BPM-007)으로 관측·기록한다. 향후 UI에서 신뢰도 문구를 조정할 필요가 생기면 별도 SPEC으로 다룬다.

### 4.3 `engine` 필드의 필수/선택 여부

| 계층 | 결정 | 근거 |
|------|------|------|
| `BpmResult` (dataclass) | 필수, 기본값 없음 | 서비스는 항상 어느 엔진을 썼는지 안다. 기본값을 주면 "모름" 상태가 조용히 전파된다 |
| 캐시 JSON | 필수 (`data["engine"]`) | REQ-BPM-004. 구 캐시는 재분석으로 자가 치유 |
| `BpmAnalysisResponse` (Pydantic) | 필수 `engine: str` | 백엔드는 항상 값을 채운다. 선택으로 두면 누락을 감지할 수 없다 |
| `BpmAnalysisResponse` (TypeScript) | 선택 `engine?: string` | 프론트엔드가 구버전 백엔드에 붙는 배포 시차를 견뎌야 한다. 표시 코드는 `undefined`를 처리한다 |

---

## 5. 파일 영향 분석

### 5.1 수정 파일 (DDD)

| 파일 | 변경 내용 | 위험도 | 예상 변경량 |
|------|----------|--------|-----------|
| `backend/app/services/bpm_service.py` | `_smooth_beats` 삭제(120-151), 174행 호출 제거, `_repair_beats` 신설, `BpmResult.engine` 추가, `to_dict()`·`_get_cached_result` 확장 | 높음 | 약 -32 / +45행 |
| `backend/app/models/schemas.py` | `BpmAnalysisResponse.engine: str` 추가 (109행 부근) | 낮음 | +1행 |
| `src/api/bpm.ts` | `BpmAnalysisResponse.engine?: string` 추가 | 낮음 | +1행 |
| `backend/requirements.txt` | madmom 주석 해제 + 환경 마커 | 낮음 | 1행 수정 |

### 5.2 신규 파일

| 파일 | 용도 | 예상 라인 |
|------|------|----------|
| `scripts/measure_beatgrid_drift.py` | 비트그리드 드리프트 측정 (REQ-BPM-005) | 약 120행 |

### 5.3 테스트 파일

| 파일 | 내용 |
|------|------|
| `backend/tests/test_bpm.py` (수정) | 특성화 테스트 추가(6.3절) + `_repair_beats` 불변식 테스트 + `engine` 필드 테스트 + 캐시 열화 테스트 |

### 5.4 명시적 비변경

- `src/stores/bpmStore.ts`, `src/components/Metronome/*` — `engine`을 UI에 표시하는 작업은 범위 외(11절).
- `MetronomeEngine.ts`, `AudioEngine.ts` — SPEC-BPM-002 산출물. 본 SPEC은 백엔드 그리드만 다룬다.

---

## 6. 전제 조건 및 검증 환경

### 6.1 madmom 가용성 (전제, 검증 가능)

madmom 설치 성공 여부는 **본 SPEC이 보장하지 않는 외부 조건**이다. 다음 명령으로 판정한다.

```bash
python -c "import madmom; print(madmom.__version__)"
```

| 분기 | 판정 | 요구 동작 |
|------|------|----------|
| A | exit 0 | madmom 경로에서 REQ-BPM-001~002를 검증한다. 드리프트 측정도 madmom 결과로 수행 |
| B | exit != 0 | 작업은 그대로 완료된다. `_detect_with_librosa`는 애초에 `_smooth_beats`를 호출하지 않았으므로(F2), librosa 경로에서는 드리프트 기준이 **자명하게** 충족된다. 이 경우 REQ-BPM-001·002의 madmom 경로 검증은 `_detect_with_madmom`을 모킹한 단위 테스트로 대체하고, 그 사실을 `progress.md`에 명시 기록한다 |

어느 분기에서도 "설치가 성공했다"를 가정하는 수용 기준은 두지 않는다.

### 6.2 실행 환경 미확정 (기록)

- 이 머신의 기본 인터프리터는 Python 3.9.6이다.
- `backend/.venv`, `backend/venv`, `.venv`, `venv` 어느 것도 존재하지 않는다. 백엔드가 실제로 어떤 런타임에서 도는지 확정되지 않았다.
- 동시에 `bpm_service.py` 23-33행에는 Python 3.13 / NumPy 2.x 대상 호환 shim이 있다(F10). 즉 과거 어느 시점에는 3.13을 겨냥했다. 이 불일치는 실재하며, 본 SPEC에서 해소하지 않고 기록만 한다.
- 따라서 6.1절의 판정 명령은 **실제로 백엔드를 실행하는 인터프리터**에서 돌려야 하며, 실행자는 사용한 인터프리터 경로를 evidence에 함께 남긴다.

### 6.3 특성화 테스트 (DDD PRESERVE 단계)

`backend/tests/test_bpm.py`에서 현재 고정(pin)되어 있는 동작:

| 기존 테스트 | 고정하는 동작 | 본 변경의 영향 |
|------------|-------------|--------------|
| `TestBpmResult::test_bpm_result_creation` / `test_bpm_result_to_dict` | 4개 필드 구성과 `to_dict()` 키 집합 | **깨진다.** `engine` 추가로 갱신 필요 |
| `TestCaching::test_save_and_get_cached_result` / `test_cache_file_format` | 캐시 왕복과 JSON 키 | **깨진다.** `engine` 포함하도록 갱신 필요 |
| `TestMadmomDetection::test_detect_falls_back_to_librosa` | madmom 부재 시 librosa 폴백 | 유지 (`result.engine == "librosa"` 단언 추가) |
| `TestAnalyze::test_analyze_returns_cached_result` | 캐시 히트 경로 | 갱신 필요 |
| `TestAnalyze::test_analyze_no_library_available` | 라이브러리 전무 시 `RuntimeError` | 영향 없음 |
| `TestConfidenceCalculation::*` | CV 기반 신뢰도 공식 | 영향 없음 (REQ-BPM-007로 동결) |

**변경 전에 추가해야 하는 신규 특성화 테스트:**

| ID | 내용 |
|----|------|
| CT-1 | `_smooth_beats`의 누적 재구성 성질을 고정한다. 합성 비트열(등간격 + 인위적 오차)을 입력해, 출력 마지막 비트가 입력 마지막 비트에서 유의미하게 벗어남을 단언 → 제거 후 이 테스트는 삭제되며, 삭제 자체가 결함 제거의 증거가 된다 |
| CT-2 | 현재 `_detect_with_madmom`(모킹된 감지기 출력 사용)이 반환하는 `beats`가 감지기 원본과 **다름**을 단언 → 변경 후 "같음"으로 뒤집히는 테스트로 전환 |
| CT-3 | 현재 `BpmResult.to_dict()`의 키 집합이 정확히 4개임을 단언 → 변경 후 5개로 갱신 |

---

## 7. 카드 전제 중 성립하지 않은 항목

칸반 카드 `t1`이 전제한 네 가지가 확인 결과 성립하지 않았다. 본 SPEC은 이를 상속하지 않고 각각 해소한다.

### P1 — `measure_beatgrid_drift.py`는 존재하지 않는다

`find . -name "measure_beatgrid_drift.py"` 결과 없음. `scripts/`에는 `start.sh`와 `start.bat`만 있다. 카드의 검증 절차가 **아직 만들어지지 않은 도구**를 지목하고 있었다.

**해소:** 스크립트 작성을 본 SPEC의 범위 내 작업으로 승격하고(REQ-BPM-005), 독립된 수용 기준(AC-BPM-005)을 부여한다. 측정 정의와 호출 형태를 REQ-BPM-005에 명문화한다.

### P2 — madmom 주석 해제가 곧 설치 성공은 아니다

`backend/requirements.txt`의 madmom 줄에는 "Python 3.13 비호환 (Cython 빌드 실패)" 주석이 달려 있다. 이 머신의 인터프리터는 3.9.6이고 가상환경은 발견되지 않았으므로, 실제 런타임이 확정되지 않았다.

**해소:** 설치 성공을 가정하지 않는다. 6.1절에 검증 명령과 A/B 두 분기의 요구 동작을 명시하고, REQ-BPM-006에서 환경 마커(`; python_version < "3.13"`)로 전체 설치 실패를 차단한다. F10의 3.13 shim과의 불일치는 6.2절에 기록한다.

### P3 — "640ms → 0ms"는 그대로는 실패할 수 없는 기준이다

제거 후에는 방출 그리드가 곧 감지기 출력이므로, 문제의 값은 **측정이 아니라 구성에 의해** 0이 된다. 그대로 두면 절대 실패하지 않는 기준이 된다.

**해소:** 두 개의 실패 가능한 기준으로 재진술한다.

1. **사전 기준선(AC-BPM-006-BEFORE):** 변경 전 코드에서 드리프트를 측정해 `max_drift_ms ≥ 100`임을 기록한다. 결함이 실재했다는 증거이며, 측정되지 않으면 gap으로 보고한다.
2. **사후 기준(AC-BPM-006-AFTER):** 변경 후 `max_drift_ms ≤ 1.0`. 코드가 비트를 소수점 3자리로 반올림하므로 이론적 상한은 0.5ms이며, 1.0ms 임계는 잔여 변환이 하나라도 남아 있으면 실패한다.

**테스트 오디오 출처:** 리포지터리에 git으로 추적되는 오디오는 `music-source/Deep Purple  Smoke On the Water Official Music Video.mp3` 하나뿐이다. "Hotel California"는 리포지터리 어디에도 없다. 따라서 **기준 픽스처는 Smoke On the Water로 확정**하고, Hotel California는 운영자가 파일을 제공하는 경우에만 보조 측정으로 수행한다(AC-BPM-006-OPT).

### P4 — `development_mode`는 `ddd`가 아니라 `hybrid`다

`.moai/config/sections/quality.yaml` 확인 결과 `constitution.development_mode: hybrid`, `hybrid_settings.legacy_refactoring: ddd`, `hybrid_settings.new_features: tdd`, `hybrid_settings.min_coverage_legacy: 85`.

**해소:** 올바른 전제를 기록한다. 본 카드는 기존 코드 수정이 중심이므로 hybrid의 `legacy_refactoring` 분기가 적용되어 **실효 사이클은 DDD가 맞다**. 다만 신규 파일인 `scripts/measure_beatgrid_drift.py`는 `new_features: tdd` 분기에 해당하므로 테스트 우선으로 작성한다. 커버리지 목표는 85%(`min_coverage_legacy` = `min_coverage_new` = 85).

---

## 8. 비기능 요구사항

| 항목 | 현재 | 목표 |
|------|------|------|
| 마지막 박 드리프트 (madmom 경로) | 약 640ms (카드 기재값, 재측정 대상) | `max_drift_ms ≤ 1.0` |
| BPM 값 변화 | - | 기준 픽스처에서 변경 전후 차이 `≤ 2.0` BPM |
| 분석 소요 시간 | 기준선 측정 | 증가 없음 (REQ-BPM-008) |
| 백엔드 테스트 커버리지 | 측정 필요 | `bpm_service.py` 85% 이상 |
| API 하위 호환성 | - | 기존 4개 필드 이름·타입 불변, `engine`은 추가만 |

---

## 9. 리스크 및 완화

| 리스크 | 확률 | 영향 | 완화 |
|--------|------|------|------|
| 평활화 제거로 인트로 바운싱 재발 | 중간 | 중간 | REQ-BPM-002 국소 보정이 누락/중복을 직접 처리. 보정 건수 로깅으로 실제 발생 여부 관측 |
| confidence 하락이 사용자에게 "품질 저하"로 보임 | 높음 | 낮음 | 4.2절 결정 기록. 표시 문구 조정은 별도 SPEC |
| madmom 설치 실패로 madmom 경로 미검증 | 높음 | 중간 | 6.1절 B분기: 모킹 단위 테스트로 대체하고 progress.md에 명시 기록 |
| 구 스키마 캐시로 인한 재분석 폭증 | 낮음 | 낮음 | 파일당 1회. 검증 절차에서 `/tmp/bpm_cache` 비우기를 선행 |
| 국소 보정이 의도치 않게 원본 비트를 이동 | 중간 | 높음 | REQ-BPM-002-INV 불변식을 단위 테스트(AC-BPM-002)로 기계 검증 |

---

## 10. 제약사항

- `_detect_with_librosa`는 원래 `_smooth_beats`를 호출하지 않으므로(F2), 본 변경은 librosa 경로의 비트 위치를 바꾸지 않는다. 단 `engine` 필드는 양쪽 모두에 추가된다.
- 캐시 경로는 `/tmp/bpm_cache`로 고정되어 있으며 본 SPEC에서 바꾸지 않는다.
- `BpmService.analyze`의 예외 처리 구조(`except Exception` → `RuntimeError` 래핑)는 변경하지 않는다.
- 소스 코드 주석은 한국어(`code_comments: ko`)를 유지한다.

---

## 11. 범위 외 (Exclusions)

본 SPEC에서 **만들지 않는 것**을 명시한다.

### Out of Scope — UI 노출

- `engine` 값을 `bpmStore`에 저장하거나 `MetronomePanel`에 표시하는 작업. 본 SPEC은 타입 계층까지만 전파한다.
- confidence 표시 문구·색상·경고 배지 변경.

### Out of Scope — 감지 알고리즘 교체

- madmom `DBNBeatTrackingProcessor` 파라미터 튜닝(`fps` 등).
- downbeat 감지 재도입 (SPEC-BPM-002 US-5에서 CANCELLED로 결정된 사안).
- librosa `beat_track` 파라미터 변경 또는 대체 라이브러리 도입.

### Out of Scope — 신뢰도 재설계

- `_calculate_confidence` 공식 변경 또는 librosa 상한 0.8 조정 (REQ-BPM-007로 명시 동결).
- 신뢰도 임계 기반의 결과 거부 로직 신설.

### Out of Scope — 캐시 인프라

- 구 스키마 캐시 마이그레이션 스크립트 (REQ-BPM-004의 자가 치유로 대체).
- 캐시 위치 변경, TTL 도입, 캐시 크기 제한.

### Out of Scope — 프론트엔드 동기화 계층

- `MetronomeEngine.ts` / `AudioEngine.ts` 수정. 보간·앵커 로직은 SPEC-BPM-002의 산출물이며 본 SPEC은 백엔드 그리드만 다룬다.

### Out of Scope — 환경 구축

- 백엔드 가상환경 신설, Python 버전 고정, madmom 빌드 문제 해결. 6.2절에 불일치를 기록만 하고 해소하지 않는다.

---

*Generated by MoAI SPEC Builder (manager-spec)*
*SPEC date: 2026-09-05*
*Predecessors: SPEC-BPM-001 (Completed), SPEC-BPM-002 (Completed)*
