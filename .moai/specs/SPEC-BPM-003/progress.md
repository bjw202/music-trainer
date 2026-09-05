---
id: SPEC-BPM-003
status: in-progress
updated: 2026-09-05
---

# SPEC-BPM-003 진행 기록

칸반 카드 `t1` / 브랜치 `WT-remove-smooth-beats` / 워크트리 `.claude/worktrees/t1`

---

## M1: 데이터 모델 및 스키마 확장

담당: manager-develop (cycle_type=ddd) · 상태: 완료

### 실행 환경

| 항목 | 값 |
|------|-----|
| 인터프리터 | `/Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/backend/.venv/bin/python` |
| `sys.version` | `3.13.11 (main, Dec 17 2025, 20:55:16) [Clang 21.1.4 ]` |
| Python 명령 `pwd` | `/Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/.claude/worktrees/t1/backend` |
| grep / tsc 명령 `pwd` | `/Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/.claude/worktrees/t1` |

주 체크아웃의 인터프리터를 절대 경로로 호출하되 cwd는 워크트리 안이다. 모듈이 실제로 워크트리 파일을 읽는지 확인했다.

```
$ cd backend && .../backend/.venv/bin/python -c "import sys; sys.path.insert(0,'.'); from app.services import bpm_service as b; print('module file =', b.__file__); print('MADMOM_AVAILABLE =', b._MADMOM_AVAILABLE); print('LIBROSA_AVAILABLE =', b._LIBROSA_AVAILABLE)"
module file = /Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/.claude/worktrees/t1/backend/app/services/bpm_service.py
MADMOM_AVAILABLE = True
LIBROSA_AVAILABLE = True
```

PRE-2 분기 A(madmom 실제 동작)가 이 워크트리 실행 형태에서도 성립한다.

### PRESERVE — 변경 전 기준선

```
$ cd backend && .../backend/.venv/bin/python -m pytest tests/test_bpm.py -q
16 passed, 7 warnings in 0.02s
```

### 변경 파일

| 파일 | 변경 |
|------|------|
| `backend/app/services/bpm_service.py` | `BpmResult.engine: str` 추가(`file_hash` 다음, 기본값 없음), `to_dict()`에 `"engine"` 추가, `_get_cached_result`에 `engine=data["engine"]`(직접 첨자 — `.get()` 미사용), `analyze()`의 `BpmResult(...)`에 `engine=algorithm`(기존 지역 변수 재사용) |
| `backend/app/models/schemas.py` | `BpmAnalysisResponse.engine: str` (필수) |
| `src/api/bpm.ts` | `BpmAnalysisResponse.engine?: string` (선택) |
| `backend/app/routes/bpm.py` | **연쇄 변경 1행** — `BpmAnalysisResponse(engine=result.engine, ...)`. 아래 「범위 관련 보고」 참조 |
| `backend/tests/test_bpm.py` | 기존 6개 테스트 갱신 + 신규 5개 추가 |

테스트 변경 내역:

- 갱신: `test_bpm_result_creation`, `test_bpm_result_to_dict`, `test_save_and_get_cached_result`, `test_cache_file_format`, `test_analyze_returns_cached_result`, `test_detect_falls_back_to_librosa`(`result.engine == "librosa"` 단언 추가)
- 신규: `test_bpm_result_to_dict_includes_engine`, `test_analyze_sets_engine_librosa`, `test_analyze_sets_engine_madmom`, `test_legacy_cache_without_engine_returns_none`, `test_new_cache_with_engine_roundtrips`
- 무변경 확인: `TestConfidenceCalculation::*` 2건 — 손대지 않았고 그대로 통과한다

### 검증 명령과 관측 출력

**(1) engine 테스트 — AC-BPM-003 (a)**

```
$ cd backend && .../backend/.venv/bin/python -m pytest tests/test_bpm.py -k "engine" -v
collected 21 items / 16 deselected / 5 selected

tests/test_bpm.py::TestBpmResult::test_bpm_result_to_dict_includes_engine PASSED [ 20%]
tests/test_bpm.py::TestCaching::test_legacy_cache_without_engine_returns_none PASSED [ 40%]
tests/test_bpm.py::TestCaching::test_new_cache_with_engine_roundtrips PASSED [ 60%]
tests/test_bpm.py::TestAnalyze::test_analyze_sets_engine_librosa PASSED  [ 80%]
tests/test_bpm.py::TestAnalyze::test_analyze_sets_engine_madmom PASSED   [100%]

5 passed, 16 deselected in 0.02s
```

**(2) cache 테스트 — AC-BPM-004**

```
$ cd backend && .../backend/.venv/bin/python -m pytest tests/test_bpm.py -k "cache" -v
collected 21 items / 13 deselected / 8 selected

tests/test_bpm.py::TestBpmServiceInit::test_init_creates_cache_dir PASSED [ 12%]
tests/test_bpm.py::TestBpmServiceInit::test_init_with_existing_cache_dir PASSED [ 25%]
tests/test_bpm.py::TestCaching::test_get_cached_result_none_when_no_cache PASSED [ 37%]
tests/test_bpm.py::TestCaching::test_save_and_get_cached_result PASSED   [ 50%]
tests/test_bpm.py::TestCaching::test_cache_file_format PASSED            [ 62%]
tests/test_bpm.py::TestCaching::test_legacy_cache_without_engine_returns_none PASSED [ 75%]
tests/test_bpm.py::TestCaching::test_new_cache_with_engine_roundtrips PASSED [ 87%]
tests/test_bpm.py::TestAnalyze::test_analyze_returns_cached_result PASSED [100%]

8 passed, 13 deselected in 0.01s
```

**(3) 전체 파일 — 회귀 없음**

```
$ cd backend && .../backend/.venv/bin/python -m pytest tests/test_bpm.py -v
collected 21 items

tests/test_bpm.py::TestBpmResult::test_bpm_result_creation PASSED        [  4%]
tests/test_bpm.py::TestBpmResult::test_bpm_result_to_dict PASSED         [  9%]
tests/test_bpm.py::TestBpmResult::test_bpm_result_to_dict_includes_engine PASSED [ 14%]
tests/test_bpm.py::TestBpmServiceInit::test_init_creates_cache_dir PASSED [ 19%]
tests/test_bpm.py::TestBpmServiceInit::test_init_with_existing_cache_dir PASSED [ 23%]
tests/test_bpm.py::TestFileHash::test_get_file_hash PASSED               [ 28%]
tests/test_bpm.py::TestFileHash::test_different_files_different_hashes PASSED [ 33%]
tests/test_bpm.py::TestCaching::test_get_cached_result_none_when_no_cache PASSED [ 38%]
tests/test_bpm.py::TestCaching::test_save_and_get_cached_result PASSED   [ 42%]
tests/test_bpm.py::TestCaching::test_cache_file_format PASSED            [ 47%]
tests/test_bpm.py::TestCaching::test_legacy_cache_without_engine_returns_none PASSED [ 52%]
tests/test_bpm.py::TestCaching::test_new_cache_with_engine_roundtrips PASSED [ 57%]
tests/test_bpm.py::TestMadmomDetection::test_detect_with_madmom_success PASSED [ 61%]
tests/test_bpm.py::TestMadmomDetection::test_detect_falls_back_to_librosa PASSED [ 66%]
tests/test_bpm.py::TestLibrosaFallback::test_detect_with_librosa_success PASSED [ 71%]
tests/test_bpm.py::TestAnalyze::test_analyze_returns_cached_result PASSED [ 76%]
tests/test_bpm.py::TestAnalyze::test_analyze_sets_engine_librosa PASSED  [ 80%]
tests/test_bpm.py::TestAnalyze::test_analyze_sets_engine_madmom PASSED   [ 85%]
tests/test_bpm.py::TestAnalyze::test_analyze_no_library_available PASSED [ 90%]
tests/test_bpm.py::TestConfidenceCalculation::test_calculate_confidence_consistent_tempo PASSED [ 95%]
tests/test_bpm.py::TestConfidenceCalculation::test_calculate_confidence_irregular_tempo PASSED [100%]

21 passed in 0.02s
```

기준선 16건이 전부 살아 있고 신규 5건이 더해져 21건이다. 삭제·스킵된 테스트는 없다.

**(4) 백엔드 전체 스위트 (지시 목록 밖, `routes/bpm.py` 연쇄 변경 때문에 추가 실행)**

```
$ cd backend && .../backend/.venv/bin/python -m pytest tests/ -q
122 passed in 0.53s
```

**(5) `.get()` 미사용 — AC-BPM-004 추가검증**

```
$ grep -n 'data.get("engine"' backend/app/services/bpm_service.py; echo "exit=$?"
exit=1
```

출력 없음 + `exit=1`. `exit=2`(검사 불발)가 아니라 정상 실행 후 매치 없음이다.

**(6) 타입 선언 — AC-BPM-003 (b)**

```
$ grep -n "engine" backend/app/models/schemas.py
116:    engine: str  # 사용된 감지 엔진 ("madmom" | "librosa"). 백엔드는 항상 채우므로 필수

$ grep -n "engine" src/api/bpm.ts
18:  engine?: string
```

필수/선택 비대칭이 spec.md 4.3절대로 유지된다.

**(7) 프론트엔드 타입 체크 — AC-BPM-003 (c)**

```
$ npx tsc --noEmit; echo "exit=$?"
exit=0
```

워크트리 루트에서 실행. `node_modules`는 주 체크아웃으로의 심볼릭 링크다.

### 판정

| 검증 | 결과 |
|------|------|
| (1) `-k engine` 5건 | PASS |
| (2) `-k cache` 8건 | PASS |
| (3) `test_bpm.py` 전체 21건 | PASS |
| (4) 백엔드 전체 122건 | PASS |
| (5) `.get()` 미사용 grep `exit=1` | PASS |
| (6) `schemas.py` / `bpm.ts` 선언 | PASS |
| (7) `npx tsc --noEmit` `exit=0` | PASS |

GAP 없음.

### 범위 관련 보고 — `routes/bpm.py` 1행 연쇄 변경

지시받은 파일 목록에는 없었으나 **`backend/app/routes/bpm.py:90`의 `BpmAnalysisResponse(...)` 생성부에 `engine=result.engine` 한 줄을 추가했다.**

이유: `schemas.py`의 `engine: str`을 필수로 만드는 순간, 이 생성부는 필수 필드를 채우지 않게 되어 `/bpm/analyze` 엔드포인트가 요청마다 Pydantic `ValidationError`로 실패한다. M1이 강제한 회귀이고, REQ-BPM-003이 요구하는 "API 응답 스키마까지 전파"의 생산자 쪽이다. 이 파일을 덮는 테스트는 없어서(`grep -rn "engine\|BpmAnalysisResponse" backend/tests/` → 출력 없음) 테스트만으로는 드러나지 않는 종류의 회귀였다.

리드 판단 대상으로 보고한다. 되돌리기를 원하면 해당 1행만 되돌리면 되며, 그 경우 엔드포인트는 M1 상태에서 깨진 채로 남는다.

### 다음 마일스톤으로 남긴 것 (의도적 미수행)

- `_smooth_beats` 제거 (M5), `_repair_beats` 신설 (M2)
- 드리프트 측정 스크립트 포팅 (M3)
- CT-1 / CT-2 / CT-3 특성화 테스트 (M4)
- `requirements.txt` 의존성 선언 (`madmom`, `pytest-cov`) 및 성능 측정 (M6)
- 커버리지 측정 — `pytest-cov`가 아직 선언·설치되지 않아 PRE-4가 미충족이므로 M1에서는 시도하지 않았다

---

## M3: 드리프트 측정 스크립트 포팅 (완료)

카드 `t1` · 브랜치 `WT-remove-smooth-beats` · 실행 순서상 M1 다음, M2 앞.

### 실행 환경 (모든 명령 공통)

| 항목 | 값 |
|------|-----|
| 작업 디렉터리 | `/Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/.claude/worktrees/t1` (워크트리) |
| 인터프리터 | `/Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/backend/.venv/bin/python` (절대 경로로 호출) |
| `sys.version` | `3.13.11 (main, Dec 17 2025, 20:55:16) [Clang 21.1.4 ]` |
| 시작 HEAD | `1073c11` |

주 체크아웃의 인터프리터를 절대 경로로 호출하되 **모든 쓰기는 워크트리 안에서만** 이루어졌다. 이 인터프리터로 워크트리에서 `app.services.bpm_service`를 import하면 워크트리의 코드가 로드된다(`repo_root()`가 스크립트 자신의 위치에서 유도하므로).

### 변경한 파일

| 파일 | 종류 | 내용 |
|------|------|------|
| `scripts/measure_beatgrid_drift.py` | 신규(포팅) | 원본 235행의 측정 코어 포팅 + 정규화 (a)(b)(c) + 신규 CLI 계약 |
| `backend/tests/test_beatgrid_drift.py` | 신규 | DDD 코어 1·2·5·6·7 + TDD 3·4·8·9 + 골든 대조 = 17 테스트 |
| `backend/tests/fixtures/drift_baseline_smoke_on_the_water.json` | 신규 | PRESERVE 골든 픽스처 |

`_smooth_beats`, `_repair_beats`, `requirements.txt`, CT-1~CT-3, SPEC 본문은 손대지 않았다(M2·M4·M5·M6 소관).

### PRESERVE — 골든 픽스처 출처 기록 (provenance)

원본을 기준 픽스처에 대해 **1회** 실행해 얻은 값이다.

```bash
# 실행 시각 (UTC): 2026-09-05T13:29:04Z
APP_DIR=/Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/.claude/worktrees/t1 \
SONGS="/Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/.claude/worktrees/t1/music-source/Deep Purple  Smoke On the Water Official Music Video.mp3" \
/Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/backend/.venv/bin/python \
  /Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/metronome-update-plan-docs/tools/measure_beatgrid_drift.py
# exit=0
```

`APP_DIR`을 워크트리 루트로 지정했으므로 원본이 import한 평활화 함수는 **워크트리 코드의 것**이다(원본 출력 2행 `_smooth_beats: 대상 앱의 실제 함수`). 관측 출력에서 뽑은 골든 값:

```
  길이 374.1s · 비트 721개
    최대 이탈       :    360.0 ms  (@ 202.7s)
    마지막 비트 이탈:   -240.0 ms
    30ms 초과 비트 : 682/721 = 94.6%
```

→ `beat_count=721`, `max_drift_ms=360.0`, `last_beat_drift_ms=240.0`(절대값; 원본이 인쇄한 부호 있는 값 `-240.0`도 픽스처에 함께 보존). 허용 오차는 픽스처에 미리 못 박혀 있다: `beat_count` 정확 일치, 최대/마지막 이탈 각 ≤ 0.5ms. 면제 조항 없음.

### RED 증거 (TDD 케이스 3·4·8·9는 구현 전에 작성)

테스트 파일을 먼저 쓰고 스크립트가 없는 상태에서 실행한 출력:

```
ImportError while importing test module '.../backend/tests/test_beatgrid_drift.py'.
E   ModuleNotFoundError: No module named 'measure_beatgrid_drift'
=========================== short test summary info ============================
ERROR tests/test_beatgrid_drift.py
!!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
========================= 7 warnings, 1 error in 0.04s =========================
```

### 검증 명령과 관측 출력

**(1) 파일 존재 + git 추적** (`pwd` = 워크트리 루트)

```
$ test -f scripts/measure_beatgrid_drift.py && echo FILE_OK || echo MISSING
FILE_OK
```

`git ls-files` 추적 확인은 커밋 이후에 수행했다(아래 「커밋 후 추적 확인」).

**(2) 정규화 (a) — 머신 고유 절대 경로 부재**

```
$ grep -nE "Dev/my-project-01|Path\.home\(\)|/Users/" scripts/measure_beatgrid_drift.py; echo "exit=$?"
exit=1
```

**(3) 정규화 (b) — 인터프리터 하드코딩 부재**

```
$ grep -nE "\.venv/bin/python|/venv/bin/python" scripts/measure_beatgrid_drift.py; echo "exit=$?"
exit=1
```

**(4) [HARD] 평활화 함수 import 부재**

```
$ grep -n "_smooth_beats" scripts/measure_beatgrid_drift.py; echo "exit=$?"
exit=1
```

세 grep 모두 `exit=1`(매치 없음)이다. `exit=2`(검사 불발)는 하나도 나오지 않았다.

**(5) 단위 테스트 17건 전수** (`pwd` = `<워크트리>/backend`)

```
$ .../backend/.venv/bin/python -m pytest tests/test_beatgrid_drift.py -v
tests/test_beatgrid_drift.py::test_case3_json_output_contains_contract_keys PASSED [  5%]
tests/test_beatgrid_drift.py::test_case3_exit_1_when_threshold_exceeded PASSED [ 11%]
tests/test_beatgrid_drift.py::test_case3_inserted_beats_do_not_affect_exit_code PASSED [ 17%]
tests/test_beatgrid_drift.py::test_case4_missing_input_file_exits_nonzero_with_clean_stdout PASSED [ 23%]
tests/test_beatgrid_drift.py::test_case8_tolerance_invariant_aborts_before_measuring[5.0] PASSED [ 29%]
tests/test_beatgrid_drift.py::test_case8_tolerance_invariant_aborts_before_measuring[9.0] PASSED [ 35%]
tests/test_beatgrid_drift.py::test_case8_default_threshold_satisfies_invariant PASSED [ 41%]
tests/test_beatgrid_drift.py::test_case9_cross_check_mismatch_reports_then_exits_nonzero PASSED [ 47%]
tests/test_beatgrid_drift.py::test_case9_cross_check_agreement_passes PASSED [ 52%]
tests/test_beatgrid_drift.py::test_case9_missing_service_interface_fails_loudly PASSED [ 58%]
tests/test_beatgrid_drift.py::test_case1_identical_grids_have_zero_drift PASSED [ 64%]
tests/test_beatgrid_drift.py::test_case2_accumulated_drift_measured_by_legacy_index_diff PASSED [ 70%]
tests/test_beatgrid_drift.py::test_case2_drifted_beats_are_reclassified_as_inserted_by_nearest_match PASSED [ 76%]
tests/test_beatgrid_drift.py::test_case5_repo_root_resolves_without_app_dir PASSED [ 82%]
tests/test_beatgrid_drift.py::test_case6_inserted_beat_excluded_from_drift_statistics PASSED [ 88%]
tests/test_beatgrid_drift.py::test_case7_dropped_beat_reported_without_affecting_drift PASSED [ 94%]
tests/test_beatgrid_drift.py::test_ported_matches_original_golden PASSED [100%]
======================= 17 passed, 7 warnings in 37.09s ========================
```

**(6) 회귀 없음 — 백엔드 전체 스위트** (`pwd` = `<워크트리>/backend`)

```
$ .../backend/.venv/bin/python -m pytest tests/ -q
139 passed, 8 warnings in 37.48s
```

기존 122건 + 신규 17건 = 139건. 실패·에러 0건.

**(7) 오류 경로 — 존재하지 않는 입력** (`pwd` = 워크트리 루트)

```
$ .../backend/.venv/bin/python scripts/measure_beatgrid_drift.py /nonexistent/file.mp3 \
    >/tmp/drift-out.txt 2>/tmp/drift-err.txt; echo "exit=$?"
exit=4
$ test -s /tmp/drift-err.txt && echo STDERR_HAS_MESSAGE || echo STDERR_EMPTY
STDERR_HAS_MESSAGE
$ test -s /tmp/drift-out.txt && echo STDOUT_POLLUTED || echo STDOUT_EMPTY
STDOUT_EMPTY
$ cat /tmp/drift-err.txt
오디오 파일을 찾을 수 없다: /nonexistent/file.mp3
```

**(8) 포팅 무결성 — 실제 오디오에서 골든 재현** (`--legacy-index-diff`, `pwd` = 워크트리 루트)

```
$ .../backend/.venv/bin/python scripts/measure_beatgrid_drift.py \
    "music-source/Deep Purple  Smoke On the Water Official Music Video.mp3" \
    --no-cache --legacy-index-diff; echo "exit=$?"
============================================================
비트 그리드 드리프트 — madmom · 인덱스 정렬 차분 (legacy)
============================================================
  비트 수            : 721
  감지기 유래 비트   : -
  삽입 비트          : -  (서비스 보고: -)
  제거 비트          : -  (서비스 보고: -)
  최대 이탈          : 360.000 ms
  마지막 비트 이탈   : 240.000 ms
  평균 이탈          : 213.689 ms
  임계               : 1.000 ms
============================================================
exit=1
# stderr: 임계 초과: max_drift_ms=360.000 > threshold_ms=1.000
```

골든(721 / 360.0 / 240.0)과의 차이는 세 항목 모두 **0.000 ms**다. 허용 오차 0.5ms를 크게 밑돈다. `exit=1`은 임계 초과 판정이며 정상 동작이다(측정 자체는 성공).

**(9) `_repair_beats` 부재에서의 소리 내는 실패** (기본 분류 경로, `pwd` = 워크트리 루트)

```
$ .../backend/.venv/bin/python scripts/measure_beatgrid_drift.py \
    "music-source/Deep Purple  Smoke On the Water Official Music Video.mp3" --json --no-cache
exit=4
# stdout: (비어 있음)
# stderr:
#   감지기 원본 획득 중 (madmom RNN + DBN)...
#   캐시를 사용하지 않는다 (--no-cache).
# 측정 중단: BpmResult.repair_counts 가 없다 — 서비스가 국소 보정 건수를 노출하지 않는다.
#   SPEC-BPM-003 REQ-BPM-002의 _repair_beats 가 {"inserted": int, "dropped": int} 를 반환하고
#   BpmService.analyze 가 이를 결과의 repair_counts 로 실어야 자기 대조가 성립한다.
#   건수를 0으로 가정하지 않는다 — 그러면 대조가 아무것도 비교하지 않는다.
```

이것이 **현 시점의 의도된 동작**이다. 아래 「M2 순서 제약」 참조.

### 설계 판단 세 가지 (리드 확인 요망)

**(1) M2 순서 제약 — `service_inserted` / `service_dropped`의 부재를 0으로 채우지 않았다.**

`_repair_beats`는 M2 소관이고 M2는 M3 뒤에 오므로, 현재 서비스는 보정 건수를 노출하지 않는다. 0을 기본값으로 넣으면 `inserted_count == service_inserted`가 `0 == 0`으로 **아무것도 비교하지 않으면서 통과**한다 — spec.md N2가 지목한 실패 불가 기준이 그대로 되살아난다. 그래서 기본 분류 경로는 측정하지 않고 exit 4로 중단한다.

M2가 켜는 방법은 한 가지다: `BpmService.analyze`의 결과가 `repair_counts` 속성으로 `{"inserted": int, "dropped": int}`를 노출하면 된다. 스크립트 쪽 추가 변경은 없다(상수 `SERVICE_REPAIR_ATTR = "repair_counts"` 한 곳이 읽는 이름을 정한다). 형태가 어긋나면 같은 예외로 중단한다.

`--legacy-index-diff`는 분류를 하지 않으므로 이 요구를 받지 않는다. 따라서 **M2 이전인 지금도 골든 대조와 실제 오디오 측정이 가능하다** — 위 (8)이 그 증거다.

**(2) 케이스 2를 `--legacy-index-diff`로 판정했다.**

plan.md M3 DDD 코어 케이스 2는 `last_beat_drift_ms ≈ 640`, `max_drift_ms ≥ 100`을 요구한다. 이 값은 **최근접 대응 경로에서는 구성상 나올 수 없다.** 640ms 밀린 비트는 `MATCH_TOLERANCE_MS`(5.0ms) 밖이므로 최근접 감지기 비트와 만나지 못하고 "삽입"으로 분류되어 `max_drift_ms`에서 빠진다 — spec.md N1이 서술한 성질이 tolerance=5.0 / drift=640 조합에서도 그대로 작동한다.

plan.md가 "1·2는 원본 동작"이라고 적고 있고 원본의 계산 방식이 인덱스 정렬 차분이므로, 케이스 2를 `measure_legacy_index_diff`로 판정하는 것을 **기준 완화가 아니라 원문의 읽기**로 보았다. 다만 판단이 갈릴 수 있으므로 테스트를 둘로 나눠 양쪽을 모두 고정했다.

| 테스트 | 고정하는 것 |
|--------|-----------|
| `test_case2_accumulated_drift_measured_by_legacy_index_diff` | 인덱스 정렬 차분에서 `last ≈ 640ms`, `max ≥ 100ms` |
| `test_case2_drifted_beats_are_reclassified_as_inserted_by_nearest_match` | 같은 입력을 최근접 대응으로 보면 `max ≤ 5.0ms`, `inserted > 0` |

**이 사실은 AC-BPM-006-BEFORE(리드 보류 중)에 직접 걸린다.** 사전 기준선이 요구하는 `max_drift_ms ≥ 100`은 기본(분류) 경로에서 잴 수 없고 `--legacy-index-diff`로 재야 한다. 변경 전 코드의 평활화는 비트 개수를 바꾸지 않으므로 인덱스 대응이 성립하며, 위 (8)이 실제로 `360.0ms ≥ 100`을 관측했다. 판단은 리드 소관이므로 AC-BPM-006-BEFORE 측정 자체는 수행하지 않았다.

**(3) exit code를 원인별로 나눴다.**

`0` 성공 / `1` 임계 초과 / `2` 불변식 위반(미측정) / `3` 대조 실패(측정값은 출력) / `4` 입력 오류·서비스 인터페이스 부재(미측정). AC는 "0이 아닌 exit"만 요구하므로 모두 충족하며, 세분화는 진단을 위한 추가 정보다.

### 수행하지 않은 것 (의도적)

- **AC-BPM-006-BEFORE 사전 기준선 측정** — 리드 판단 보류 대상이라 수행하지 않았다. (8)의 값은 포팅 무결성 증거이지 기준선 기록이 아니다.
- `check_d2_downbeat` 포팅 — 다운비트 감지는 범위 외(spec.md 11절)라 드롭했다.
- `_smooth_beats` 제거(M5), `_repair_beats` 신설(M2), CT-1~CT-3(M4), `requirements.txt`(M6).

### GAP

| 항목 | 상태 | 사유 |
|------|------|------|
| `ruff check` | **GAP** | `backend/.venv`에 ruff가 설치되어 있지 않다. `python -m ruff` → `No module named ruff`. 린트를 실행하지 못했으므로 통과로 적지 않는다 |
| 커버리지 측정 | **GAP** | `pytest-cov` 미설치·미선언(M6 소관). M1과 같은 사유 |
| AC-BPM-005 (b)(e) 기본 경로 `--json` 실행 | **미실행(차단)** | 위 설계 판단 (1) — `_repair_beats`(M2) 이전에는 기본 분류 경로가 의도적으로 중단한다. M2 완료 후 실행 가능해진다 |

### 커밋 후 추적 확인 (`pwd` = 워크트리 루트)

커밋 `f766655` 이후 실행:

```
$ git ls-files --error-unmatch scripts/measure_beatgrid_drift.py; echo "tracked_exit=$?"
scripts/measure_beatgrid_drift.py
tracked_exit=0
$ git ls-files --error-unmatch backend/tests/fixtures/drift_baseline_smoke_on_the_water.json; echo "tracked_exit=$?"
backend/tests/fixtures/drift_baseline_smoke_on_the_water.json
tracked_exit=0
$ git ls-files --error-unmatch backend/tests/test_beatgrid_drift.py; echo "tracked_exit=$?"
backend/tests/test_beatgrid_drift.py
tracked_exit=0
```

명시 pathspec으로만 스테이징했다(`git add -A` 미사용). 커밋 후 남은 untracked는 이 카드의 산출물이 아닌 `.claude/agent-memory/manager-spec/`, `.moai/state/`, `backend/.moai/`, `node_modules` 넷뿐이다.

---

## 리드 결정 — 실행 위치 (A안)

기록 주체: run 레인 (오케스트레이터). 결정 주체: kanban lead 세션.

**(a) 문서와 다른 점.** plan.md:44 [HARD]는 "이 카드의 작업은 주 체크아웃에서 수행한다"고, acceptance.md:50은 그룹 P 명령의 실행 위치를 "주 체크아웃 전용"으로 규정한다. 실제 수행은 **전부 워크트리 `.claude/worktrees/t1`에서** 이루어졌고, Python 계열 그룹 P 명령은 주 체크아웃의 인터프리터를 **절대경로로** 호출해 워크트리 코드를 대상으로 실행했다. `npx tsc` / `npm test`는 워크트리에 건 `node_modules` 심링크로 워크트리에서 수행했다.

**(b) 이유.** 주 체크아웃은 `main` 브랜치이고 카드 브랜치 `WT-remove-smooth-beats`가 체크아웃돼 있지 않다. 거기서 작업하면 카드 커밋이 `main`에 직접 쌓이고, 브랜치를 바꾸려 하면 공유 체크아웃 브랜치 가드에 걸린다. 계획서의 [HARD]는 "실행 위치"만 보고 "어느 브랜치 위인가"를 보지 않았다. 또한 계획서가 "그룹 P는 주 체크아웃 전용"이라고 결론지은 전제 — 워크트리에 `.venv`가 없으므로 그 환경을 쓸 수 없다 — 는 성립하지 않는다. 없는 것은 venv 디렉터리이지 그것을 쓸 능력이 아니다.

**(c) 재현에 쓴 명령과 출력.**

```
$ cd .claude/worktrees/t1/backend && \
  /Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/backend/.venv/bin/python -c \
  "import sys; sys.path.insert(0,'.'); from app.services import bpm_service as b; \
   print('cwd_module =', b.__file__); print('MADMOM_AVAILABLE =', b._MADMOM_AVAILABLE); \
   print('LIBROSA_AVAILABLE =', b._LIBROSA_AVAILABLE); print('interpreter =', sys.executable)"

cwd_module = /Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/.claude/worktrees/t1/backend/app/services/bpm_service.py
MADMOM_AVAILABLE = True
LIBROSA_AVAILABLE = True
interpreter = /Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/backend/.venv/bin/python
```

로드된 모듈이 **워크트리 파일**이고 madmom·librosa가 모두 가용하다. 따라서 증거의 인터프리터 요건(`backend/.venv/bin/python`, Python 3.13.11)은 충족된다.

SPEC 문언 정정은 sync 단계 소관이며, run 단계에서 spec.md / plan.md / acceptance.md 본문을 고치지 않았다.

---

## 리드 결정 — 사전 기준선 측정 모드 (`--legacy-index-diff`)

**(a) 문서와 다른 점.** acceptance.md:448의 AC-BPM-006-BEFORE 측정 명령은 기본(분류) 모드다. 실제 측정은 **`--legacy-index-diff` 모드**로 수행했다. 임계 `max_drift_ms >= 100`은 그대로 두었다 — 모드만 바뀌고 기준은 바뀌지 않았다.

**(b) 이유.** 기본 모드는 `emitted[i]`를 최근접 `detector[j]`와의 거리로 분류하고(`MATCH_TOLERANCE_MS = 5.0`), `max_drift_ms`를 **감지기 유래 비트에만** 적용한다. 그런데 사전 기준선에서 재려는 드리프트는 수백 ms이므로 5ms를 크게 넘고, **드리프트가 큰 비트일수록 전부 "삽입"으로 분류되어 지표에서 빠진다.** 즉 재려는 대상이 측정 규칙에 의해 사라져 기준이 구성상 충족 불가능해진다. spec.md가 `MATCH_TOLERANCE_MS ≤ threshold_ms`에 대해 경고한 현상과 같은 형태가, 실측 드리프트가 tolerance를 크게 넘는 상황에서 반대편으로 일어난 것이다. 또한 변경 전 서비스는 보정 건수를 노출하지 않으므로(그 인터페이스는 M2 산출물) 기본 모드의 `inserted_count == service_inserted` [HARD] 대조가 측정 전 중단시킨다.

`--legacy-index-diff`는 신설이 아니라 SPEC에 이미 있는 설계 요소다(spec.md:469, plan.md:219/230/237/275). 원본의 인덱스 정렬 차분을 그대로 재현하며, 변경 전 `_smooth_beats`는 비트 개수를 바꾸지 않으므로 인덱스 정렬이 성립한다. 분류를 거치지 않으므로 드리프트가 사라지지 않고 서비스 보정 건수도 필요하지 않다. 원본 스크립트 226행의 기대값 360ms도 이 계산의 산물이다.

사후 기준(AC-BPM-006-AFTER)은 문서대로 기본 모드를 쓴다. 변경 없다.

**(c) 실측 출력.** 아래 「AC-BPM-006-BEFORE 실측」 절에 전문을 싣는다.

---

## AC-BPM-006-BEFORE 실측 — 사전 기준선 (M2 IMPROVE 착수 **전**)

작업 디렉터리: `/Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/.claude/worktrees/t1`
인터프리터: `/Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/backend/.venv/bin/python`
`sys.version`: `3.13.11 (main, Dec 17 2025, 20:55:16) [Clang 21.1.4 ]`

### 선행 확인 — 호출이 살아 있는가 [W]

```
$ grep -n "_smooth_beats(beats)" backend/app/services/bpm_service.py; echo "exit=$?"
176:    beats = _smooth_beats(beats)
exit=0
```

**행 번호 차이를 기록한다.** acceptance.md:442의 기대 출력은 `174:    beats = _smooth_beats(beats)`이나 실제 관측은 **176행**이다. M1이 같은 파일에 5행(`engine` 필드 관련)을 추가해 호출 지점이 두 줄 밀렸기 때문이며, 기준의 실질 — 호출이 호출 경로에 살아 있음 — 은 충족된다. 기준을 고치지 않고 차이만 기록한다.

### 착수 시점 SHA

- base_sha: 4ba10a96e820cb68eb9712e6ca952147db97b739

이 값은 plan.md M2 선행 조건 2의 지시대로 **측정 시점의 `git rev-parse HEAD`** 출력이다. 다만 이 시점에는 M1(`1073c11`)과 M3(`f766655`, `4ba10a9`)이 이미 커밋되어 있고 M1은 `bpm_service.py`를 수정했으므로, 이 SHA를 기준으로 한 AC-BPM-007 (a)의 diff는 **M1의 변경을 포함하지 않는다.** 더 강한 기준선은 M1 이전인 `cfd5475`다. AC-BPM-007 (a)는 두 SHA 모두에 대해 실행하고 두 출력을 함께 기록한다 — 기준을 약화하지 않기 위해서다.

### 측정 [P — 워크트리에서 절대경로 인터프리터]

```
$ python -c "import shutil,os; shutil.rmtree('/tmp/bpm_cache', ignore_errors=True); print('cache_exists=', os.path.exists('/tmp/bpm_cache'))"
cache_exists= False

$ <interpreter> scripts/measure_beatgrid_drift.py \
    "music-source/Deep Purple  Smoke On the Water Official Music Video.mp3" \
    --legacy-index-diff --json
{"max_drift_ms": 359.9999999999852, "last_beat_drift_ms": 240.0000000000091, "mean_drift_ms": 213.68932038834927, "beat_count": 721, "matched_count": null, "inserted_count": null, "dropped_count": null, "engine": "madmom", "service_inserted": null, "service_dropped": null}
measure_exit=1

--- stderr ---
  감지기 원본 획득 중 (madmom RNN + DBN)...
  캐시를 사용한다 — 결과가 이전 실행으로 가려질 수 있다. --no-cache 로 우회한다.
임계 초과: max_drift_ms=360.000 > threshold_ms=1.000
```

**판정: PASS.** 기준은 `max_drift_ms >= 100`이며 실측 `359.99999...` (= 360.000ms)이 이를 충족한다. `measure_exit=1`은 스크립트가 기본 임계 1.0ms 초과를 알린 것으로, 변경 전 코드에서는 초과가 **예상된 동작**이다 — 이 기준의 판정 대상은 exit code가 아니라 `max_drift_ms` 값이다.

원본 스크립트 226행의 기대값 `Smoke On the Water : 최대 이탈 360ms`와 **정확히 일치**한다. 포팅이 측정을 바꾸지 않았고 기준 픽스처가 진단 당시와 동일함을 함께 보인다.

`matched_count` / `inserted_count` / `dropped_count` / `service_*`가 `null`인 것은 `--legacy-index-diff`가 분류를 수행하지 않기 때문이며, 값의 부재를 0으로 채우지 않는다는 설계에 따른 것이다.

---

## AC-BPM-008 / AC-BPM-007 (b) — 변경 전 값 (M2 IMPROVE 착수 **전**)

작업 디렉터리: `.../worktrees/t1/backend` · 인터프리터·버전 위와 동일. 매 회차 `/tmp/bpm_cache` 삭제.

```
elapsed_runs=['18.077', '18.148', '18.008', '18.022', '18.232']
elapsed_median=18.077
bpm_runs=['115.4000', '115.4000', '115.4000', '115.4000', '115.4000']
engine=madmom confidence=0.978
```

- **변경 전 분석 시간 중앙값: 18.077초** (5회). AC-BPM-008의 사후 기준은 `중앙값_after <= 18.077 * 1.05 = 18.981초`.
- **변경 전 BPM: 115.4000** (5회 전부 동일). 사후 기준은 `|bpm_after - 115.4| <= 2.0`.
- **변경 전 confidence: 0.978** (AC-BPM-007 (b)의 변경 전 값). 변경 후 낮아지는 것은 예상된 결과이며 실패가 아니다 — 범위 `0.0 <= confidence <= 1.0`만 유지되면 된다.

이 세 값은 M2 IMPROVE가 176행 호출을 교체한 이후에는 존재하지 않는다.

---

## M2: 국소 보정 설계 확정 및 구현 (완료 — 블로커 1건 동반)

### 실행 환경 (모든 M2 명령 공통)

```
pwd        = /Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/.claude/worktrees/t1
executable = /Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/backend/.venv/bin/python
version    = 3.13.11 (main, Dec 17 2025, 20:55:16) [Clang 21.1.4 ]
```

캐시 삭제는 `python -c "import shutil; shutil.rmtree('/tmp/bpm_cache', ignore_errors=True)"`로 수행했다
(리드 결정: 이 환경에서 `rm -rf /tmp/...` 형태는 안전 가드에 걸린다).

### 구현 내용

| 대상 | 변경 |
|------|------|
| `bpm_service.py` 모듈 상수 | `REPAIR_GAP_RATIO = 1.75`, `REPAIR_DUPLICATE_RATIO = 0.50`, `REPAIR_WINDOW_SIZE = 8` 신설 (경험값이므로 후속 SPEC에서 조정 가능하도록 분리) |
| `_repair_beats(beats, window_size=8)` | 신설. `(보정 배열, {"inserted": int, "dropped": int})` 반환. 국소 중앙값은 판정에만 쓰이고 어떤 비트 위치도 대체하지 않는다. 건수는 `logger.info`로도 기록하되, **인터페이스는 반환값이다** (spec.md 4.1절 [HARD]) |
| `_detect_with_madmom` | 176행 `_smooth_beats(beats)` → `_repair_beats(beats)`. 반환이 4-튜플 `(bpm, beats, confidence, repair_counts)`로 확장. 호출 순서(보정 → BPM → confidence)는 그대로 |
| `BpmResult.repair_counts` | `field(default=None, compare=False, repr=False)`로 추가하고 **`to_dict()`에는 넣지 않는다.** 캐시·API 스키마의 키 집합은 5개로 고정이므로(AC-BPM-003 / `test_cache_file_format`) 직렬화하면 이미 통과한 기준이 깨진다 |
| `BpmService.analyze` | madmom 경로는 반환된 건수를 그대로 결과에 싣고, librosa 경로는 보정을 거치지 않으므로 `{"inserted": 0, "dropped": 0}`을 싣는다 (0이 사실이다) |

`_smooth_beats`의 **정의는 그대로 남아 있다** — 삭제는 M5의 몫이다.

### 검증 1 — AC-BPM-002 불변식 테스트 4건

```
$ cd backend && .venv/bin/python -m pytest tests/test_bpm.py -k "repair" -v
4 passed, 21 deselected, 7 warnings in 0.02s
```

**PASS.** `test_repair_preserves_original_beats` / `test_repair_interpolates_gap` /
`test_repair_drops_duplicate` / `test_repair_no_cumulative_shift`.

### 검증 2 — 호출은 사라지고 정의는 남아 있는가

```
$ grep -n "_smooth_beats" backend/app/services/bpm_service.py; echo "exit=$?"
141:    전역 재구성(`_smooth_beats`)과 달리 **살아남은 원본 비트를 이동시키지 않습니다.**
201:def _smooth_beats(beats: np.ndarray, window_size: int = 8) -> np.ndarray:
exit=0
```

**PASS.** 201행에 **정의가 남아 있고**(M5 대상), 141행은 `_repair_beats` 독스트링의 언급이다.
**호출 지점은 없다** — 176행의 `beats = _smooth_beats(beats)`가 `beats, repair_counts = _repair_beats(beats)`로 교체되었다.

### 검증 3 — AC-BPM-006-AFTER (변경 후 처음으로 실행 가능해짐)

캐시 삭제 후, 워크트리 루트에서:

```
$ .venv/bin/python scripts/measure_beatgrid_drift.py "music-source/Deep Purple  Smoke On the Water Official Music Video.mp3" --threshold-ms 1.0; echo "exit=$?"
  비트 수            : 721
  감지기 유래 비트   : 721
  삽입 비트          : 0  (서비스 보고: 0)
  제거 비트          : 0  (서비스 보고: 0)
  최대 이탈          : 0.000 ms
  마지막 비트 이탈   : 0.000 ms
  평균 이탈          : 0.000 ms
  임계               : 1.000 ms
exit=0
```

**PASS.** `max_drift_ms = 0.000` ≤ 1.0. 사전 기준선 360.000ms → 0.000ms.

건수 대조 (`--json` + 단언 3건):

```json
{"max_drift_ms": 0.0, "last_beat_drift_ms": 0.0, "mean_drift_ms": 0.0, "beat_count": 721,
 "matched_count": 721, "inserted_count": 0, "dropped_count": 0, "engine": "madmom",
 "service_inserted": 0, "service_dropped": 0}
```

```
inserted=0 dropped=0 matched=721 beat_count=721 service_inserted=0 service_dropped=0
ALL THREE ASSERTS PASSED
exit=0
```

**PASS.** 세 단언(`matched + inserted == beat_count`, `inserted == service_inserted`,
`dropped == service_dropped`) 전부 통과.

### 검증 4 — `service_inserted = 0`이 실제 관측인가, 기본값인가

`0`이라는 값만으로는 "서비스가 0을 보고했다"와 "스크립트가 0으로 때웠다"가 구별되지 않으므로,
가드가 실제로 살아 있는지 따로 확인했다. 캐시가 남은 상태로 같은 명령을 다시 돌리면
`_get_cached_result`가 복원한 `BpmResult`는 `repair_counts=None`이므로 스크립트가 중단해야 한다.

```
$ .venv/bin/python scripts/measure_beatgrid_drift.py "...Smoke On the Water....mp3" --json
warm_cache_exit=4
(stdout 비어 있음)
측정 중단: BpmResult.repair_counts 가 없다 — 서비스가 국소 보정 건수를 노출하지 않는다. ...
```

**PASS.** 가드가 살아 있으므로 검증 3의 `0`은 서비스가 실제로 보고한 값이다.
부수 효과로 **캐시가 남은 상태에서는 드리프트 측정이 exit 4로 중단된다** — 캐시 히트 실행에서는
보정이 일어나지 않았으므로 건수를 지어내지 않는 것이 옳다는 판단이다(AC의 모든 측정은 PRE-1로 캐시를 비운다).

### 검증 5 — 백엔드 전체 회귀

```
$ cd backend && .venv/bin/python -m pytest tests/ -q
1 failed, 142 passed, 8 warnings in 37.76s
FAILED tests/test_beatgrid_drift.py::test_ported_matches_original_golden
```

139(변경 전 통과) + 4(신규) = 143 중 **142 통과, 1 실패.** 실패 1건은 아래 블로커다.

### [BLOCKER] `test_ported_matches_original_golden` — M2가 골든 대조를 구조적으로 무력화한다

```
E       assert 0.0 == 360.0 ± 0.5
E         Obtained: 0.0
E         Expected: 360.0 ± 0.5
```

M3의 골든 픽스처(`backend/tests/fixtures/drift_baseline_smoke_on_the_water.json`)는
`max_drift_ms = 360.0`을 못 박고 있다. 그런데 이 테스트는 골든을 **저장된 emitted 배열**과
대조하는 것이 아니라, **살아 있는 서비스를 다시 돌려** 나온 값과 대조한다.
`--legacy-index-diff`는 드리프트 **계산 방식**만 원본식으로 되돌릴 뿐, `emitted`를 만드는 주체는
여전히 현재 코드다. 따라서 M2가 `_smooth_beats` 호출을 치운 순간 `max_drift_ms`는 0.0이 되고,
이 테스트는 **`_smooth_beats`가 호출 경로에 살아 있는 동안에만 통과할 수 있다.**

- 사전 기준선(360.000ms)을 죽이는 것이 M2의 호출 교체라는 점은 plan.md가 이미 명시했고, 그 사슬은 지켰다.
- 그러나 **같은 이유로 AC-BPM-005 (g)의 골든 대조도 M2 이후에는 성립할 수 없다**는 점은 어느 문서에도 없다.
- M2 범위 안에서 이 테스트를 통과시킬 방법은 호출 교체를 되돌리는 것뿐이므로, 통과시키지 않았다.
- 임계·골든 값을 완화하거나 SPEC 문서를 고치지 않았다. **판단은 리드의 몫이다.**

선택지는 세 가지로 보인다 — (1) 골든 대조를 저장된 emitted 스냅샷 기반으로 바꿔 서비스 상태와
무관하게 만든다, (2) 이 테스트를 M2 이후 폐기 대상(CT-1과 같은 성격)으로 재분류한다,
(3) 골든을 사후 값으로 갱신한다(다만 그러면 "포팅이 측정을 바꿨는가"를 더는 판정하지 못한다).

### 부수 관측 (판정 아님)

- 변경 후 회귀 실행 로그: `bpm=115.4, beats=721, confidence=0.97, algorithm=madmom`.
  변경 전 값은 `bpm=115.4000 / confidence=0.978`이었다. AC-BPM-008·AC-BPM-007 (b)의 정식 측정
  (5회 반복)은 M2 범위가 아니므로 수행하지 않았다 — 위 값은 판정 근거가 아니라 관측 기록이다.
- Smoke On the Water에서는 보정이 한 건도 발동하지 않았다(`inserted=0, dropped=0`).
  삽입·제거 경로의 검증은 AC-BPM-002의 합성 입력 테스트가 진다.

### 기존 테스트 수정 1건 (불가피)

`TestAnalyze::test_analyze_sets_engine_madmom`의 모킹이 `_detect_with_madmom`을 3-튜플로 대체하고
있었다. spec.md 4.1절 [HARD]가 요구하는 건수 반환 때문에 이 함수는 4-튜플이 되었으므로,
모킹 반환값의 항수를 4로 맞추고 `repair_counts` 단언 한 줄을 덧붙였다. `analyze`에서
`len(detected) > 3` 식의 방어적 언패킹은 **쓰지 않았다** — 그렇게 하면 건수 누락이 조용히 0으로
대체되어, 이 SPEC이 없애려는 "구성상 통과하는 기준"이 그대로 되살아난다.
`TestConfidenceCalculation::*`는 무수정으로 통과했다.

### M2 이후로 남은 것

- M4: CT-1 / CT-2 / CT-3 특성화 테스트
- M5: `_smooth_beats` 정의 삭제 (201행)
- M6: `requirements.txt` (madmom 주석 해제 + `pytest-cov`)
- 위 블로커에 대한 리드 결정
