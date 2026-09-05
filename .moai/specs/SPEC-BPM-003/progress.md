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

---

## M4: 특성화 테스트 보강 (PRESERVE)

카드 `t1` / SPEC-BPM-003 / spec.md 6.3절 CT-1~CT-3.

### 실행 환경

| 항목 | 값 |
|------|-----|
| 인터프리터 | `/Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/backend/.venv/bin/python` |
| `sys.version` | `3.13.11 (main, Dec 17 2025, 20:55:16) [Clang 21.1.4 ]` |
| `pwd` | `/Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/.claude/worktrees/t1` |
| 캐시 | 측정 전 `shutil.rmtree('/tmp/bpm_cache', ignore_errors=True)`로 비움 |

### 추가·표기한 테스트 3건

| ID | 위치 | 형태 | M5 이후 운명 |
|----|------|------|------------|
| CT-1 | `TestCharacterization::test_ct1_smooth_beats_cumulative_reconstruction` | 신규 | **삭제** — `_smooth_beats` 소멸과 함께. 삭제 자체가 결함 제거의 증거이며 회귀가 아니다 (테스트 docstring 첫 줄에 `[M5에서 삭제될 테스트]`로 표시) |
| CT-2 | `TestCharacterization::test_ct2_detect_with_madmom_returns_detector_output` | 신규 | **유지** |
| CT-3 | `TestBpmResult::test_bpm_result_to_dict_includes_engine` | 기존 테스트에 CT-3 표기 추가 | **유지** |

**CT-1의 합성 입력.** 0.5초 등간격 40구간에 5개마다 0.9초의 간격 오차를 넣었다. 이동 중앙값이
소수파인 0.9를 0.5로 눌러 버리고, 눌린 차이 0.4초가 첫 비트부터의 누적 합산으로 이후 전 비트에
더해진다. 단언은 (a) 첫 비트 불변, (b) 마지막 비트 편차 > 1.0초, (c) 마지막 편차 > 중간 편차
(누적의 정의) 셋이다.

**CT-2를 사후 형태로 썼다 — 사전 단언을 지어내지 않았다.** spec.md 6.3절 CT-2는 변경 전
"감지기 원본과 다름" → 변경 후 "국소 보정 대상이 없는 입력에서 같음"으로 뒤집히는 테스트로
규정한다. 그런데 M2(`1cfd6ab`)가 이미 `_smooth_beats` 호출을 `_repair_beats`로 교체했으므로,
M4 시점에 참인 명제는 **사후 형태인 "같음"** 이다. 성립하지 않는 사전 단언을 작성하는 것은
"실패할 수 없는 기준"의 거울상 — 사실이 아닌 기준 — 이므로 하지 않았다. 이 사실은 테스트
docstring에도 남겼다.

**CT-3은 신규 작성이 아니라 표기다.** 사전 형태(키 4개)는 M1(`1073c11`)이 `engine`을 추가하며
이미 갱신되었고, 현재 5개 키를 고정하는 테스트가 그 자리에 존재한다. 같은 단언을 한 벌 더 쓰는
대신 기존 테스트의 docstring에 `CT-3` 식별자와 사후 형태임을 명시했다 — `grep -n "CT-3"`로
조회된다.

### CT-2 모킹 계층 (spec.md D15) — 준수 증거

패치 대상은 `app.services.bpm_service.RNNBeatProcessor` / `.DBNBeatTrackingProcessor` 둘뿐이며,
`_detect_with_madmom`은 **실제 코드 그대로 실행된다.** 테스트 본문 안에 자체 확인 단언 3줄을
두었다.

```python
assert not isinstance(bpm_service._detect_with_madmom, MagicMock)
assert isinstance(bpm_service.RNNBeatProcessor, MagicMock)
assert isinstance(bpm_service.DBNBeatTrackingProcessor, MagicMock)
```

`create=True`는 madmom 미설치 머신에서도 함수 본문이 실행되게 하려는 것이며, 이 머신에서는
madmom이 실제로 설치되어 있으므로 우회 경로가 아니다.

**뮤테이션 확인 (일회용 스크립트, 커밋하지 않음).** 모킹 계층이 실제 판정력을 갖는지를 단언
문구가 아니라 실행으로 확인했다. `_repair_beats`를 "모든 비트를 0.1초 미는" 결함 버전으로
바꾸고 CT-2를 호출했다.

```
MUTATION DETECTED (expected): CT-2 failed under broken _repair_beats
```

CT-2가 실패했다 = `_detect_with_madmom` 본문이 실제로 실행되고 있다. 함수 자체가 패치돼
있었다면 결함이 관측되지 않고 그대로 통과했을 것이다(기존 `test_detect_with_madmom_success`가
바로 그 상태다). 확인 후 스크립트는 삭제했다.

### 검증 (관측한 출력)

```
$ cd backend && <interp> -m pytest tests/test_bpm.py -v
27 passed, 7 warnings in 0.03s
  ...
  tests/test_bpm.py::TestCharacterization::test_ct1_smooth_beats_cumulative_reconstruction PASSED [ 96%]
  tests/test_bpm.py::TestCharacterization::test_ct2_detect_with_madmom_returns_detector_output PASSED [100%]

$ cd backend && <interp> -m pytest tests/ -q
1 failed, 144 passed, 8 warnings in 37.16s
FAILED tests/test_beatgrid_drift.py::test_ported_matches_original_golden
```

- `test_bpm.py` 27건 전건 통과. `TestConfidenceCalculation::*`는 **무수정 통과**(REQ-BPM-007 동결).
- 전체 스위트는 M4 직전 기준선 142 passed에서 **144 passed**로 늘었다(신규 2건과 정확히 일치).
- `1 failed`는 M4 착수 전부터 있던 기존 실패이며 **M4의 산물이 아니다.** 골든 픽스처를 라이브
  서비스 재실행과 대조하는 구조라 M2의 호출 교체로 불성립이 된 건이다. 리드 결정 대기 중인
  블로커이므로 손대지 않았다(수정·삭제·xfail 전부 하지 않음).

### 범위 준수

`_smooth_beats` 정의(201행)는 그대로 있다(M5). `requirements.txt`(M6),
`scripts/measure_beatgrid_drift.py`, `backend/tests/test_beatgrid_drift.py`, spec/plan/acceptance
본문은 손대지 않았다. M4가 건드린 파일은 `backend/tests/test_bpm.py` 하나와 이 `progress.md`다.

---

## 리드 결정 — 골든 대조 방식

M4 완료 시점에 남아 있던 유일한 실패
(`tests/test_beatgrid_drift.py::test_ported_matches_original_golden`, `assert 0.0 == 360.0 ± 0.5`)를
리드 승인 아래 **실오디오 재실행 방식에서 고정 배열 대조 방식으로 전환**해 해소했다.

### (a) acceptance.md AC-BPM-005 (g) 문면과 달라진 점

AC-BPM-005 (g)는 골든 대조를 "기준 픽스처 오디오에 대해 포팅본을 실행해 원본 값을 재현"하는
것으로 적었다. 실제 구현은 **오디오를 실행하지 않는다.** 대신 원본 실행의 *입력*이었던 두 배열을
픽스처로 고정하고, 순수 함수 `measure_legacy_index_diff` 에만 대조를 건다.

| 항목 | AC 문면 | 실제 |
|---|---|---|
| 입력 | 기준 오디오 파일 | 고정 배열 픽스처 2종 (`detector`, `emitted_before`) |
| 실행 경로 | `mbd.main(... --legacy-index-diff)` → 라이브 서비스 | `mbd.measure_legacy_index_diff(emitted, detector)` |
| 의존성 | madmom + 오디오 파일 + `BpmService` | 없음 (JSON 두 개) |
| 골든 값·허용 오차 | 721 / 360.0±0.5 / 240.0±0.5 | **동일 (변경 없음)** |

골든 값과 허용 오차는 한 자리도 조정하지 않았다.

### (b) 왜 바꾸었나

원 테스트는 골든 픽스처를 **라이브 서비스 재실행 결과**와 비교했다. M2가
`_smooth_beats` 호출을 `_repair_beats` 로 교체하면서 방출 그리드가 감지기 출력 자체가 되었고,
인덱스 정렬 차분은 구조적으로 0이 된다. 즉 이 기준은 M2 이후 **원리적으로 만족될 수 없다** —
360ms를 다시 만들려면 삭제 대상인 전역 재구성을 되살려야 하기 때문이다.

한편 이 테스트가 답하려던 질문 — "포팅이 측정값을 바꾸었는가" — 은 M3에서 이미 답이 났다
(원본과 포팅본의 차이 0.000ms, 위 M3 절 기록). 남은 문제는 그 답을 **재현 가능한 형태로
보존**하는 것이었고, 그 입력은 변경 전 코드에만 존재하므로 배열로 박제하는 것 외에 방법이 없다.

시점이 중요했다: `_smooth_beats` 는 M5에서 삭제된다. 캡처는 그 전에만 가능하다.

### (c) 캡처 — 반올림 처리

`BpmService.analyze` 는 `beats=[round(float(b), 3) for b in beats.tolist()]` 로 방출한다(428행).
드리프트 스크립트의 `collect_drift_input` 은 감지기 배열을 반올림하지 않는다(247행).
그래서 픽스처도 **비대칭**으로 캡처했다.

- `detector` — `RNNBeatProcessor()` → `DBNBeatTrackingProcessor(fps=100)` 원출력, 반올림 없음
- `emitted_before` — `_smooth_beats(detector_raw)` 에 `round(b, 3)` 적용

이 조합이 맞다는 것은 추정이 아니라 **재현으로 확인**했다. 캡처 직후 두 배열에
`measure_legacy_index_diff` 를 걸어 얻은 값:

```
{"max_drift_ms": 359.9999999999852, "last_beat_drift_ms": 240.0000000000091,
 "mean_drift_ms": 213.68932038834927, "beat_count": 721, ...}
```

M3에 기록된 원본 1회 실행 값(721 / 360.0 / 240.0)과 허용 오차 안에서 일치한다. 반올림을
다르게 잡았다면 이 값이 나오지 않는다.

신규 픽스처: `backend/tests/fixtures/drift_golden_arrays_smoke_on_the_water.json` (721×2 배열 +
프로버넌스: 명령·인터프리터 경로·`sys.version`·HEAD·UTC 시각·M5 이전 캡처임을 명시). git 추적 확인:

```
$ git ls-files --error-unmatch backend/tests/fixtures/drift_golden_arrays_smoke_on_the_water.json
backend/tests/fixtures/drift_golden_arrays_smoke_on_the_water.json
tracked_exit=0
```

기존 `drift_baseline_smoke_on_the_water.json` 은 원본 실행의 프로버넌스 기록으로 **그대로 둔다**
(삭제·수정 없음). 새 테스트는 두 픽스처를 함께 읽어 `fixture_audio` 가 같은 곡인지도 확인한다.

### (d) 새 테스트 실행 결과

```
$ cd backend && <interp> -m pytest tests/test_beatgrid_drift.py -v
collected 17 items
... (16건 생략, 전건 PASSED)
tests/test_beatgrid_drift.py::test_ported_matches_original_golden_from_arrays PASSED [100%]
============================== 17 passed in 0.02s ==============================

$ cd backend && <interp> -m pytest tests/ -q
145 passed in 0.43s
```

144 passed + 기존 실패 1건 해소 = **145 passed, 0 failed.** 파일 전체 실행 시간은 madmom 추론
~37s에서 **0.02s** 로 내려갔다.

### (e) 독립성 증명 — madmom 차단 실행

"madmom·오디오에 더 이상 의존하지 않는다"는 주장을 가정하지 않고 실측했다. `sys.meta_path` 에
`madmom` 및 하위 모듈에 대해 `ImportError` 를 던지는 finder를 심은 뒤 같은 테스트를 실행:

```
[block-check] madmom import raises: madmom is blocked for this run: madmom
collected 1 item
tests/test_beatgrid_drift.py::test_ported_matches_original_golden_from_arrays PASSED [100%]
============================== 1 passed in 0.01s ===============================
```

madmom이 import 불가능한 상태에서도 통과한다. 측정 소요는 0.005s 미만이다.

### (f) 통과가 공허하지 않다는 증명 — 변이 검사

통과 자체는 증거가 아니므로, `measure_legacy_index_diff` 를 변이시킨 사본으로 갈아 끼우고 테스트가
**실패하는지** 확인했다. 네 변이 전부 잡혔다(생존자 0):

```
baseline (unmutated): PASSED
mut_no_ms_scale        -> test FAILED (killed)     # 초→ms 환산 누락
mut_signed             -> test FAILED (killed)     # 절대값 대신 부호 있는 차분
mut_off_by_one         -> test FAILED (killed)     # 인덱스 정렬 1비트 밀림
mut_compare_to_self    -> test FAILED (killed)     # emitted 를 자기 자신과 비교

survivors: none — every mutant was killed
mutation_exit=0
```

특히 `mut_compare_to_self` 는 "아무것도 비교하지 않으면서 통과하는" 전형적 공허 통과 형태인데,
이 테스트는 그 상태에서 실패한다. 즉 통과는 계산이 맞아서 나온 것이다.

변이 검사 하네스와 캡처 하네스는 실행 후 삭제했다(커밋하지 않음).

### (g) 남은 위험

- 배열 픽스처는 내가 캡처했다. 캡처가 원본과 같은 방식으로 틀렸다면 대조도 같이 틀린다. 이를
  막는 것은 **골든 값의 출처가 다르다는 사실**이다 — 360.0/240.0 은 M3에서 *원본 스크립트 자신의
  실행*으로 기록된 값이고, 내 캡처는 그 값을 독립적으로 재현했다. 두 경로가 같은 오류를 공유할
  가능성은 남지만 관측된 증거로는 배제된다.
- 이 테스트는 이제 오디오 디코딩·madmom 추론·`BpmService` 조립 경로를 밟지 않는다. 그 경로의
  회귀는 다른 테스트가 잡아야 하며, 이 테스트가 잡아 준다고 주장하지 않는다.

### 범위 준수

`_smooth_beats` 정의(`backend/app/services/bpm_service.py:201`)는 **그대로 있다 — M5는 실행하지
않았다.** `requirements.txt`(M6), `scripts/measure_beatgrid_drift.py`(순수 함수가 이미 노출되어
있어 수정이 필요 없었다), spec/plan/acceptance 본문은 손대지 않았다. 이 작업이 건드린 파일은
`backend/tests/test_beatgrid_drift.py`, 신규 픽스처 1개, 이 `progress.md` 셋이다.

---

## run 레인 독립 검증 — AC-BPM-005 (b)(d)(e), AC-BPM-006-AFTER

담당 에이전트의 보고를 신뢰하지 않고 오케스트레이터(run 레인)가 직접 재실행한 결과다.
작업 디렉터리 `/Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/.claude/worktrees/t1`,
인터프리터 `/Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/backend/.venv/bin/python`
(`sys.version` 3.13.11). 매 측정 전 `/tmp/bpm_cache`를 `shutil.rmtree`로 비웠다.

### AC-BPM-005 (b) — JSON 10키 계약 + stdout 오염 검사 [P]

```
run_exit=0
STDOUT CLEAN (단일 JSON 문서로 파싱됨)
KEYS OK {"max_drift_ms": 0.0, "last_beat_drift_ms": 0.0, "mean_drift_ms": 0.0,
         "beat_count": 721, "matched_count": 721, "inserted_count": 0, "dropped_count": 0,
         "engine": "madmom", "service_inserted": 0, "service_dropped": 0}
keys_exit=0

--- stderr ---
  감지기 원본 획득 중 (madmom RNN + DBN)...
  캐시를 사용한다 — 결과가 이전 실행으로 가려질 수 있다. --no-cache 로 우회한다.
```

**PASS.** 계약 키 10개가 모두 존재하고, stdout은 JSON 문서 하나만 담았다(안내 문구가 섞였다면 `json.loads`가 `JSONDecodeError`로 실패한다). 진행 안내는 전부 stderr로 갔다.

### AC-BPM-005 (e) — `APP_DIR` 비의존 [P]

```
$ unset APP_DIR && <interpreter> scripts/measure_beatgrid_drift.py "<기준 픽스처>" --json > /tmp/t1-noappdir.json
exit=0
STDOUT CLEAN (단일 JSON 문서로 파싱됨)
```

**PASS.** 정규화 (a)가 실제로 이루어졌다.

### AC-BPM-005 (d) — 오류 경로 [P]

```
$ <interpreter> scripts/measure_beatgrid_drift.py /nonexistent/file.mp3
exit=4
STDERR_HAS_MESSAGE
STDOUT_EMPTY
```

**PASS.** 0이 아닌 exit, 메시지는 stderr, stdout은 비어 있다.

### AC-BPM-006-AFTER — 사후 기준 [P]

```
$ <interpreter> scripts/measure_beatgrid_drift.py "<기준 픽스처>" --threshold-ms 1.0
after_exit=0

  감지기 유래 비트   : 721
  삽입 비트          : 0  (서비스 보고: 0)
  제거 비트          : 0  (서비스 보고: 0)
  최대 이탈          : 0.000 ms
  마지막 비트 이탈   : 0.000 ms
  평균 이탈          : 0.000 ms
  임계               : 1.000 ms
```

**PASS.** 스크립트의 임계 판정 자체가 exit code이며 `0`이다. 사전 기준선 360.000ms → 사후 0.000ms.

삽입·제거가 0인 것은 이 곡에서 국소 보정이 한 번도 발동하지 않았다는 뜻이다. 그 값이 서비스가 실제로 보고한 것임은 표의 "(서비스 보고: 0)" 병기와, 인터페이스가 없을 때 스크립트가 `exit 4`로 중단한다는 사실로 뒷받침된다 — 스크립트가 0으로 때운 것이 아니다. 삽입·제거 경로 자체의 검증은 AC-BPM-002의 합성 입력 테스트가 담당한다.

### 전체 스위트 (A안 이후)

```
$ cd backend && <interpreter> -m pytest tests/ -q
145 passed, 8 warnings in 0.53s
```

이전 37초에서 0.53초로 줄었다. 골든 대조가 실오디오·madmom 추론을 더 이상 타지 않는다는 A안의 근거가 실행 시간으로도 관측된다.

---

## M5 — `_smooth_beats` 제거 (IMPROVE)

**실행 환경.** 워크트리 `/Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/.claude/worktrees/t1` (브랜치 `WT-remove-smooth-beats`), 인터프리터 `backend/.venv/bin/python`, `sys.version = 3.13.11 (main, Dec 17 2025, 20:55:16) [Clang 21.1.4 ]`. 아래 모든 명령의 `pwd`는 워크트리 루트이며, `cd backend`가 붙은 것은 그 하위 상대 경로다.

### 삭제한 것

| # | 대상 | 위치 | 근거 |
|---|------|------|------|
| 1 | `_smooth_beats` 함수 정의 (34행) | `backend/app/services/bpm_service.py` 201-234행 | plan.md M5 삭제 절차 1 |
| 2 | `TestCharacterization::test_ct1_smooth_beats_cumulative_reconstruction` (34행) | `backend/tests/test_bpm.py` 458-491행 | plan.md M5 절차 4, spec.md 6.3절 CT-1. **삭제 자체가 결함 제거의 증거이며 회귀가 아니다** |

호출부 교체는 M2(`1cfd6ab`)에서 이미 끝나 있었으므로 이 마일스톤에서 건드리지 않았다(plan.md M5 절차 2).

### 문구 정리 — 남아 있던 식별자 참조 4곳

AC-BPM-001의 `grep -rn "_smooth_beats" backend/`는 코드뿐 아니라 주석·docstring·픽스처 메타데이터까지 전수 검색한다. 정의를 지운 뒤에도 다음 4곳이 남아 있어 `exit=0`이었다.

| 파일 | 위치 | 처리 |
|------|------|------|
| `backend/app/services/bpm_service.py` | `_repair_beats` docstring | "전역 재구성(`_smooth_beats`)과 달리" → "비트 위치를 간격의 누적 합산으로 다시 쌓던 이전의 전역 재구성 방식과 달리" |
| `backend/tests/test_bpm.py` | CT-2 docstring | "`_smooth_beats` 호출을" → "전역 재구성 호출을" |
| `backend/tests/test_beatgrid_drift.py` | 골든 대조 테스트 docstring 2곳 | "M5(`_smooth_beats` 삭제) 직전" → "M5(전역 재구성 함수 삭제) 직전", "(`_smooth_beats` 적용 후 …)" → "(전역 재구성 적용 후 …)" |
| `backend/tests/fixtures/drift_golden_arrays_smoke_on_the_water.json` | `_comment` 1곳, `provenance.command` / `provenance.code_state` 2곳 | 같은 방식으로 함수명을 동작 서술로 교체 |

**의미는 보존했고, 출처 기록의 정밀도는 한 단계 낮아졌다.** 픽스처의 `provenance.command`는 골든 배열을 캡처한 파이프라인을 적은 칸인데, 그 파이프라인의 한 단계 이름이 이제 코드에 없는 식별자다. 식별자 대신 그 단계가 한 일(이동 중앙값 + 누적 합산)을 적었다. 함수명을 그대로 두는 편이 출처로서는 더 정확하지만, AC-BPM-001은 `backend/` 전수 검색으로 진술되어 있고 픽스처는 그 아래에 있다. **둘을 동시에 만족시킬 수는 없으므로 수용 기준 쪽을 택했고, 그 대가를 여기 적는다.** 배열 값 자체는 손대지 않았다(아래 골든 대조 테스트 통과가 그 증거다).

### AC-BPM-001 — `grep -rn` 부재 검사 [W]

```
$ pwd
/Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/.claude/worktrees/t1
$ grep -rn "_smooth_beats" backend/ ; echo "exit=$?"
exit=1
```

**PASS.** 출력 없음, `exit=1`(매치 없음). `exit=2`(검사 불발)가 아님을 확인했다.

### AC-BPM-001 — 변수명 비의존 누적 합산 패턴 검사 [W]

```
$ grep -rnP '(\w+)\[\s*i\s*\+\s*1\s*\]\s*=\s*\1\[\s*i\s*\]' backend/app/services/bpm_service.py; echo "exit=$?"
exit=1
```

**PASS.** `-P`(PCRE)로 실행했다 — 역참조 `\1`은 POSIX ERE에 없어 `-E`는 이 머신에서 `exit=2`를 내며, 그 0건 출력은 "매치 없음"과 구별되지 않는다. `exit=1`이므로 검사가 실제로 수행되었고 매치가 없다.

### 회귀 — 백엔드 전체 스위트 [P]

```
$ cd backend && <interpreter> -m pytest tests/ -q
144 passed, 8 warnings in 0.44s
exit=0
```

**PASS.** 145 → 144는 CT-1 삭제 1건에 정확히 대응한다. 실패·에러 0건.

### AC-BPM-006-AFTER 재측정 (M5 이후) [P]

```
$ <interpreter> scripts/measure_beatgrid_drift.py "music-source/Deep Purple  Smoke On the Water Official Music Video.mp3" --threshold-ms 1.0 --no-cache
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

**PASS.** 함수 정의 삭제 후에도 값이 그대로다 — M2의 호출 교체가 이미 드리프트를 없앴고 M5는 죽은 코드를 걷어낸 것이므로, 이 동일성이 예상된 결과다. 캐시는 `--no-cache`로 우회했다(`/tmp/bpm_cache`를 지우는 형태는 이 세션의 명령 가드가 거부한다).

---

## AC-BPM-007 (a-2) — pinned 테스트 3건

**계획서에 배정되지 않은 항목이었다.** acceptance.md AC-BPM-007 (a-2)가 이 세 테스트를 요구하고 Definition of Done에도 올라 있으나, plan.md의 어느 마일스톤도 이를 자기 작업으로 적지 않았다. M5 착수 시점에 세 건 모두 미작성 상태였으므로 여기서 채운다.

**왜 필요한가.** 기존 `TestConfidenceCalculation`은 `> 0.9` / `< 0.9` 두 부등호 단언뿐이라(`test_bpm.py:438,449`) 공식을 `1.0 - cv*0.5`로 바꾸거나 librosa 상한을 `0.9`로 올려도 그대로 통과한다. AC-BPM-007 (a)의 diff 검사는 파일 이동·커밋 재작성에 무력하다. 즉 REQ-BPM-007의 동결을 실제로 강제하는 장치가 없었다.

추가 위치: `backend/tests/test_bpm.py`의 신설 클래스 `TestConfidenceFormulaPinned`.

| 테스트 | 고정 대상 | 방식 |
|--------|----------|------|
| `test_confidence_formula_pinned` | `_calculate_confidence`의 `1.0 - cv` | 배열 `[0.0, 0.5, 1.1, 1.5, 2.1, 2.5]`에 대해 `1.0 - std/mean`을 **테스트 안에서 다시 계산**해 `abs(actual - expected) <= 1e-12` 비교. 기대값을 상수로 적지 않았다 — 상수는 "공식이 바뀌면 테스트 숫자를 고쳐 통과"하는 경로를 연다 |
| `test_confidence_formula_pinned_boundaries` | `max(0.0, min(1.0, ...))` 클램프 양 끝 | 완전 등간격 → 정확히 `1.0`, 표준편차가 평균을 넘는 배열(간격 `[0.001, 0.001, 0.001, 4.0]`) → 정확히 `0.0`. 입력이 실제로 하한을 건드리는지 테스트가 스스로 단언한다 |
| `test_librosa_confidence_cap_pinned` | `_detect_with_librosa`의 `min(confidence, 0.8)` | `app.services.bpm_service.librosa`만 `MagicMock`으로 교체하고 `_detect_with_librosa`는 **실제로 실행**. 등간격 비트를 돌려주므로 상한이 없으면 1.0이 나오며, 반환값이 정확히 `0.8`임을 단언 |

`test_librosa_confidence_cap_pinned`은 **`_detect_with_librosa`를 패치하지 않는다.** 패치하면 상한 줄이 실행되지 않아 아무것도 고정하지 못한다(spec.md D15 CT-2의 모킹 계층 원칙과 동일). 테스트가 상한의 존재에 의존한다는 사실은 같은 테스트 안의 `_calculate_confidence(uniform) == 1.0` 단언이 보인다 — 상한이 없다면 1.0이 반환될 입력이다.

### 실행 [P] — `pwd = <worktree>/backend`

```
$ <interpreter> -m pytest tests/test_bpm.py -k "pinned" -v
collected 29 items / 26 deselected / 3 selected
tests/test_bpm.py::TestConfidenceFormulaPinned::test_confidence_formula_pinned PASSED
tests/test_bpm.py::TestConfidenceFormulaPinned::test_confidence_formula_pinned_boundaries PASSED
tests/test_bpm.py::TestConfidenceFormulaPinned::test_librosa_confidence_cap_pinned PASSED
3 passed, 26 deselected, 7 warnings in 0.02s
exit=0
```

```
$ <interpreter> -m pytest tests/test_bpm.py::TestConfidenceCalculation -v
collected 2 items
test_calculate_confidence_consistent_tempo PASSED
test_calculate_confidence_irregular_tempo PASSED
2 passed, 7 warnings in 0.01s
exit=0
```

**무수정 확인:** `git diff cfd5475..HEAD -- backend/tests/test_bpm.py | grep -c "test_calculate_confidence"` → `0`. 이 SPEC의 어떤 커밋도 `TestConfidenceCalculation`의 두 테스트를 건드리지 않았다(REQ-BPM-007 동결).

### 변이 검증 — 이 테스트들이 실제로 물어뜯는가 [P]

**추가한 테스트가 통과한다는 사실만으로는 동결을 강제한다는 증거가 되지 않는다.** 동결 대상을 실제로 바꿔 보고 실패하는지 확인했다. 변이는 임시로만 적용했고, 매회 `git checkout -- backend/app/services/bpm_service.py`로 되돌린 뒤 `git diff --stat`이 비어 있음을 확인했다. 커밋된 트리에는 변이가 남아 있지 않다.

| 변이 | 위치 | 결과 |
|------|------|------|
| `1.0 - cv` → `1.0 - cv * 0.5` | `_calculate_confidence` 124행 | `2 failed, 1 passed` — `test_confidence_formula_pinned`, `test_confidence_formula_pinned_boundaries` **FAILED** (exit=1) |
| `min(confidence, 0.8)` → `min(confidence, 0.9)` | `_detect_with_librosa` 260행 | `1 failed, 2 passed` — `test_librosa_confidence_cap_pinned` **FAILED** (exit=1) |

두 변이가 세 테스트를 모두 덮는다. 첫 변이에서 `test_librosa_confidence_cap_pinned`이 통과한 것은 정상이다 — 등간격 입력에서는 `cv == 0`이라 공식 변형이 값을 바꾸지 않고, 상한 `0.8`은 그대로이기 때문이다. 그 테스트의 담당 지점은 두 번째 변이가 판정한다.

### 전체 스위트 [P]

```
$ <interpreter> -m pytest tests/ -q
147 passed, 8 warnings in 0.53s
exit=0
```

144 → 147은 신설 3건에 정확히 대응한다.

---

## M6 — 의존성 선언 및 성능 확인

**실행 환경.** 워크트리 `<worktree> = /Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/.claude/worktrees/t1`, 브랜치 `WT-remove-smooth-beats`. 인터프리터 `/Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/backend/.venv/bin/python`, `sys.version = 3.13.11 (main, Dec 17 2025, 20:55:16) [Clang 21.1.4 ]`. 아래 각 명령 블록에 `pwd`를 함께 적었다.

### requirements.txt 변경

```diff
  # Test dependencies
  pytest>=8.3
  pytest-asyncio>=0.25
+ pytest-cov>=5.0

  # BPM detection dependencies
  numpy>=1.24.0
- # madmom>=0.16.1  # Python 3.13 비호환 (Cython 빌드 실패) - librosa fallback 사용
+ # madmom: bpm_service.py 의 3.13/NumPy 2.x 호환 shim 을 거쳐 import 됨
+ madmom>=0.16.1
  librosa>=0.10.0
```

환경 마커를 붙이지 않았다 — 백엔드 런타임이 Python 3.13.11이고 그 위에서 madmom이 실제로 동작하므로, `; python_version < "3.13"`은 madmom이 작동하는 바로 그 인터프리터에서 설치를 건너뛰게 만든다(spec.md 0절 정정 3). 낡은 "3.13 비호환 (Cython 빌드 실패)" 주석은 아래 PRE-2 출력과 정면으로 모순되므로 삭제했다.

### 설치 [P] — `pwd = <worktree>`

```
$ <interpreter> -m pip install -r backend/requirements.txt
Requirement already satisfied: madmom>=0.16.1 in .../site-packages (from -r backend/requirements.txt (line 27)) (0.16.1)
Downloading pytest_cov-7.1.0-py3-none-any.whl (22 kB)
Downloading coverage-7.16.0-cp313-cp313-macosx_11_0_arm64.whl (223 kB)
Installing collected packages: coverage, pytest-cov
Successfully installed coverage-7.16.0 pytest-cov-7.1.0
exit=0
```

pip이 실제로 한 일은 **`pytest-cov` 7.1.0과 그 의존성 `coverage` 7.16.0 설치 두 건뿐**이다. madmom을 포함한 나머지는 모두 already satisfied였다 — 즉 madmom은 주석 해제 이전부터 이 환경에 설치되어 있었고, 선언이 실제 상태를 뒤늦게 따라간 것이다.

### PRE-2 / AC-BPM-009 (d) — madmom 가용성 [P] — `pwd = <worktree>/backend`

```
$ <interpreter> -c "import sys; sys.path.insert(0,'.'); from app.services import bpm_service as b; ..."
MADMOM_AVAILABLE = True
LIBROSA_AVAILABLE = True
interpreter = /Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/backend/.venv/bin/python
version = 3.13.11 (main, Dec 17 2025, 20:55:16) [Clang 21.1.4 ]
exit=0
```

**분기 A.** 선언(`madmom>=0.16.1`, 마커 없음)과 런타임 상태가 일치한다.

### PRE-4 — `pytest-cov` 선언·설치·인자 수용

```
(a) [W] pwd=<worktree>
$ grep -n "^pytest-cov" backend/requirements.txt; echo "exit=$?"
14:pytest-cov>=5.0
exit=0

(b) [P] pwd=<worktree>
$ <interpreter> -c "import pytest_cov; print('pytest_cov', pytest_cov.__version__)"; echo "exit=$?"
pytest_cov 7.1.0
exit=0

(c) [P] pwd=<worktree>/backend
$ <interpreter> -m pytest --cov=app/services/bpm_service --collect-only -q tests/test_bpm.py > /dev/null; echo "exit=$?"
29 tests collected in 0.01s
exit=0
```

**세 항목 모두 PASS.** 다만 (c)가 통과했다는 사실이 "이 인자로 커버리지가 측정된다"를 뜻하지 않는다는 점이 AC-BPM-010에서 드러난다 — 아래 참조.

### AC-BPM-009 — 의존성 선언 [W] — `pwd = <worktree>`

```
$ grep -n "^madmom" backend/requirements.txt; echo "exit=$?"
27:madmom>=0.16.1
exit=0

$ grep -n 'python_version' backend/requirements.txt; echo "exit=$?"
exit=1

$ grep -n "3.13 비호환\|Cython 빌드 실패" backend/requirements.txt; echo "exit=$?"
exit=1

$ <interpreter> -c "<의존성 파싱 검증>"; echo "exit=$?"
OK madmom>=0.16.1
exit=0
```

**PASS.** (a) 1행, (b) 마커 없음 `exit=1`, (c) 낡은 주석 없음 `exit=1`, 파싱 검증 통과. 세 grep 모두 `exit=2`(검사 불발)가 아님을 확인했다.

### AC-BPM-010 — 백엔드 커버리지 [P] — `pwd = <worktree>/backend`

[HARD] **acceptance.md에 적힌 명령의 `--cov` 인자 철자로는 커버리지가 측정되지 않는다.** 명령을 그대로 실행한 결과:

```
$ <interpreter> -m pytest tests/ -v --cov=app/services/bpm_service --cov-report=term-missing --cov-fail-under=85; echo "exit=$?"
147 passed, 8 warnings in 0.72s
CoverageWarning: Module app/services/bpm_service was never imported. (module-not-imported)
FAIL Required test coverage of 85% not reached. Total coverage: 0.00%
exit=1
```

**이것은 커버리지가 0%라는 뜻이 아니라 측정이 이루어지지 않았다는 뜻이다.** coverage 7.16.0은 `--cov` 값을 모듈 이름으로 해석하며, 슬래시 경로 `app/services/bpm_service`(확장자 없음)는 어떤 모듈에도 대응하지 않아 측정 대상이 비어 버린다. 같은 이유로 `--cov=app/services/bpm_service.py`도 동일한 `module-not-imported` 경고를 내고 0%를 보고한다(확인함).

**PRE-4 (c)가 통과했는데도 이 일이 일어났다는 점이 요점이다.** (c)는 인자가 *거부되지 않는지*만 본다(`error: unrecognized arguments` 부재). 인자가 수용되면서 아무것도 재지 않는 경로는 (c)의 사정거리 밖이다. `--cov-fail-under=85`가 없었다면 이 실행은 exit 0을 내고 "147 passed"만 보였을 것이고, 커버리지 미측정이 통과로 기록되었을 것이다 — acceptance.md가 `--cov-fail-under`를 붙인 이유가 정확히 여기서 작동했다.

**점 표기 모듈 이름으로 같은 대상을 측정한 결과:**

```
$ <interpreter> -m pytest tests/ -v --cov=app.services.bpm_service --cov-report=term-missing --cov-fail-under=85; echo "exit=$?"
Name                          Stmts   Miss  Cover   Missing
app/services/bpm_service.py     159     12    92%   44-45, 57-58, 106, 110, 114, 158, 172-173, 223, 363
TOTAL                           159     12    92%
Required test coverage of 85% reached. Total coverage: 92.45%
147 passed, 8 warnings in 0.67s
exit=0
```

**커버리지 92.45% ≥ 85%, 실패·에러 0건, exit=0.** 측정 대상 파일은 `app/services/bpm_service.py`로 동일하다(리포트의 `Name` 열이 그것을 보인다).

**`--cov-fail-under`는 낮추지 않았다.** 바꾼 것은 임계가 아니라 측정 대상 지정 철자 하나이며, 임계는 85 그대로다. 다만 **acceptance.md에 기재된 명령 자체는 exit=1이므로, 그 문장 그대로는 FAIL이다.** 문서 본문 수정은 이 에이전트의 권한 밖이므로 여기 사실만 기록하고 리드에게 보고한다.

미측정 12행: 44-45·57-58(madmom/librosa import 실패 경로), 106·110·114(`_calculate_confidence`의 조기 반환 3개), 158(`_repair_beats`의 4비트 미만 조기 반환), 172-173(국소 중앙값 ≤ 0 방어), 223(madmom 비트 2개 미만), 363(캐시 쓰기 예외 경로).

### AC-BPM-010 — 프론트엔드 회귀 [P] — `pwd = <worktree>`

워크트리 루트의 `node_modules`는 주 체크아웃으로 향하는 심볼릭 링크다(`node_modules -> /Users/byunjungwon/.../guitar-mp3-trainer-v2/node_modules`).

```
$ npx tsc --noEmit; echo "tsc_exit=$?"
tsc_exit=0        (출력 없음)

$ npm test -- --run; echo "npm_exit=$?"
 Test Files  1 failed | 18 passed (19)
      Tests  1 failed | 259 passed (260)
npm_exit=1
```

**FAIL 1건 — `tests/unit/core/MetronomeEngine.test.ts:241`.** 다운비트 주파수가 880이어야 하는데 440이 나온다.

**이 카드의 변경에서 비롯되지 않았다.** 근거는 추정이 아니라 diff다.

```
$ git diff --stat cfd5475..HEAD -- src/ tests/
 src/api/bpm.ts | 2 ++
 1 file changed, 2 insertions(+)

$ git diff --name-only cfd5475..HEAD | grep -i metronome; echo "exit=$?"
exit=1

$ git diff --quiet cfd5475..HEAD -- tests/unit/core/MetronomeEngine.test.ts; echo "exit=$?"
exit=0
$ git diff --quiet cfd5475..HEAD -- src/core/MetronomeEngine.ts; echo "exit=$?"
exit=0
```

이 브랜치가 M1 착수 이전(`cfd5475`) 대비 프론트엔드에서 바꾼 것은 `src/api/bpm.ts` 2행(`engine?: string` 추가)뿐이며, 실패한 테스트 파일과 그 대상 소스는 **양쪽 모두 바이트 단위로 동일하다.** 즉 같은 입력에 같은 결과이므로 이 실패는 브랜치 이전부터 존재한다.

**그러나 AC-BPM-010의 프론트엔드 절은 문장 그대로 FAIL이다** — 기준이 "두 단계 모두 exit=0"이기 때문이다. 선행 결함이라는 사실은 원인 귀속이지 통과 사유가 아니므로, 통과로 표기하지 않고 리드 판단에 넘긴다. 메트로놈은 이 SPEC의 범위 밖이며(spec.md 11절), 수정을 시도하지 않았다.

### AC-BPM-008 — 성능 및 BPM 회귀 [P] — `pwd = <worktree>/backend`

매 회차 `shutil.rmtree('/tmp/bpm_cache', ignore_errors=True)`로 캐시를 비웠다.

**변경 전 (M2 착수 전 측정, 위 「사전 기준선」 절에서 인용):** `elapsed_median = 18.077s`, `bpm = 115.4000`, `confidence = 0.978`.

**변경 후 (5회):**

| 회차 | 소요(s) | BPM | confidence | engine |
|------|--------|-----|-----------|--------|
| 1 | 18.491 | 115.4000 | 0.968000 | madmom |
| 2 | 18.550 | 115.4000 | 0.968000 | madmom |
| 3 | 18.462 | 115.4000 | 0.968000 | madmom |
| 4 | 18.632 | 115.4000 | 0.968000 | madmom |
| 5 | 18.661 | 115.4000 | 0.968000 | madmom |

`elapsed_median = 18.550s`

| 기준 | 허용 | 실측 | 판정 |
|------|------|------|------|
| 중앙값 ≤ 변경 전 × 1.05 | ≤ 18.981s | 18.550s (비율 1.0262) | **PASS** |
| \|bpm_after − 115.4\| ≤ 2.0 | ≤ 2.0 | 0.0000 | **PASS** |
| 0.0 ≤ confidence ≤ 1.0 | [0, 1] | 0.968000 | **PASS** |

**PASS.** 중앙값이 2.6% 늘었으나 허용폭 5% 안이다. `_smooth_beats`는 O(n·w) 루프였으므로 제거는 순감이 기대값인데 소폭 증가가 관측된 것은 madmom RNN+DBN 추론의 실행 편차로 읽힌다 — 회차 간 산포(18.462~18.661, 폭 0.199s)가 변경 전후 차이(0.473s)와 같은 자릿수이므로, 이 차이를 코드 효과로 귀속할 근거가 없다. 5% 허용폭과 중앙값 비교를 도입한 이유가(감사 D9) 정확히 이 상황이다.

**confidence 0.978 → 0.968.** 예상된 방향이며 실패가 아니다(spec.md 4.2절). 범위 `[0, 1]`을 유지한다. 값이 내려간 것은 감지기 원본의 간격 불균일이 더 이상 평활화로 지워지지 않기 때문이며, 이는 신뢰도가 실제 그리드를 반영하게 되었다는 뜻이다.

### AC-BPM-007 (a) — 착수 시점 SHA 기준 diff [W] — `pwd = <worktree>`

두 기준 SHA 모두에 대해 실행했다.

```
$ git diff 4ba10a96e820cb68eb9712e6ca952147db97b739..HEAD -- backend/app/services/bpm_service.py \
    | grep -cE "^[-+].*(def _calculate_confidence|1\.0 - cv|min\(confidence, 0\.8\))"
0

$ git diff cfd5475..HEAD -- backend/app/services/bpm_service.py \
    | grep -cE "^[-+].*(def _calculate_confidence|1\.0 - cv|min\(confidence, 0\.8\))"
0
```

**PASS.** `cfd5475`는 M1 착수 이전을 가리키므로 이 SPEC의 모든 변경이 diff에 담긴다 — 그럼에도 동결 대상 세 패턴의 변경이 0줄이다. 이 검사가 실제로 실패할 수 있음은 AC-BPM-007 (a-2) 절의 변이 검증이 별도로 보였다.

### GAP — `ruff` 미설치 (미검증)

```
$ <interpreter> -m ruff --version
/Users/byunjungwon/.../backend/.venv/bin/python: No module named ruff
$ command -v ruff; echo "exit=$?"
exit=1
```

백엔드 가상환경에도 PATH에도 `ruff`가 없다. 이 카드의 범위 밖이므로 설치하지 않았고, 따라서 **린트는 수행되지 않았다 — 통과가 아니라 GAP이다.**

---

## 추가 검증 — 수집 개수 확인 및 뮤테이션 생존자 1건 (리드 지시)

리드 지시로 HEAD(`1c51192`)에서 **종료 코드가 아니라 수집 개수로** 재확인하고, 뮤테이션 생존자를 다시 조사했다.

### 수집 개수 [P] — `pwd = <worktree>/backend`

```
$ <interpreter> -m pytest tests/test_bpm.py -k "pinned" -v
collected 29 items / 26 deselected / 3 selected
3 passed, 26 deselected  (exit=0)

$ <interpreter> -m pytest tests/ --collect-only -q
147 tests collected in 0.02s  (exit=0)

$ <interpreter> -m pytest tests/ -q
147 passed  (exit=0)
```

`-k "pinned"`가 **3 selected / 3 passed**이며 `0 selected`도 `no tests ran`도 아니다.

**M5의 144를 재현해 확인했다** — CT-1 삭제 외에 사라진 테스트가 없음을 보이기 위해서다.

```
$ <interpreter> -m pytest tests/ -q --deselect tests/test_bpm.py::TestConfidenceFormulaPinned
144 passed, 3 deselected  (exit=0)

$ <interpreter> -m pytest tests/ --collect-only -q | grep -c "test_ct1_smooth_beats_cumulative_reconstruction"
0
```

147에서 신설 3건만 빼면 정확히 144다. 즉 M5의 145→144는 CT-1 1건에 대응하며, 다른 테스트가 함께 사라지지 않았다.

**작업 디렉터리 함정을 실제로 밟았다.** 워크트리 루트에도 `tests/`가 있는데 그것은 프론트엔드 vitest 디렉터리다. 루트에서 `pytest tests/`를 돌리면 파이썬 테스트가 0건 수집되어 `exit=5` / `no tests ran`이 난다. 이 SPEC의 모든 백엔드 명령은 `pwd = <worktree>/backend`에서만 유효하며, 종료 코드만 보면 이 상태를 통과와 구별할 수 없다.

### 뮤테이션 — 생존자 1건 발견

| # | 뮤테이션 | 위치 | pinned 3건 결과 |
|---|---------|------|----------------|
| A | `1.0 - cv` → `1.0 - cv * 0.5` | 124행 | `2 failed, 1 passed` — 공식·경계 테스트가 죽인다 |
| B | `min(confidence, 0.8)` → `0.9` | 260행 | `1 failed, 2 passed` — 상한 테스트가 죽인다 |
| C | `min(1.0, ...)` → `min(2.0, ...)` | 124행 | **`3 passed` — 전원 생존. 전체 스위트도 `147 passed`로 생존** |

**C는 진짜 생존자다.** REQ-BPM-007이 동결하는 표현식은 `max(0.0, min(1.0, 1.0 - cv))` 전체인데, 그 중 **상한 클램프 `min(1.0, ...)`을 고정하는 테스트가 하나도 없다.** 현재 스위트의 어떤 테스트도 이 조각을 통과하지 않는다.

이 클램프가 도달 불가능한 죽은 코드라서가 아니다 — 실제로 도달한다. 뮤테이션 C 상태에서 하강 배열을 넣어 확인했다.

```
$ <interpreter> -c "... _calculate_confidence(np.array([5.0, 4.0, 3.1, 2.0, 1.1, 0.0]))"
mean=-1.000000 std=0.089443 cv=-0.089443 1-cv=1.089443
MUTATED min(2.0,...) descending -> 1.0894427190999916
```

비트가 감소하는 배열에서는 `mean_interval < 0` → `cv < 0` → `1.0 - cv > 1.0`이 되어 상한이 실제로 물린다. 원본 코드라면 `1.0`으로 잘리고, 뮤테이션 C에서는 `1.0894`가 그대로 나온다. 즉 **관측 가능한 차이가 존재하는데 그것을 잡는 테스트가 없다.**

**고쳐서 통과시키지 않았다.** 뮤테이션은 임시 적용 후 `git checkout --`으로 되돌렸고, 복원 뒤 124행이 `max(0.0, min(1.0, 1.0 - cv))`, 260행이 `min(confidence, 0.8)`임과 `git status`가 깨끗함, 스위트 `147 passed`를 확인했다. acceptance.md AC-BPM-007 (a-2)가 요구한 테스트는 세 건이고 그 세 건의 내용도 문서가 지정한 대로이므로, 네 번째 테스트를 추가하는 것은 지정 범위 밖이다. **사실만 기록하고 리드 판단에 넘긴다.**

정상 입력에서 비트는 단조 증가하므로 이 경로는 실사용에서 발생하지 않는다. 그러나 "발생하지 않으니 괜찮다"는 것은 동결이 강제된다는 뜻이 아니라 **동결의 한 조각이 검증되지 않은 채 남아 있다**는 뜻이다.

---

## run 레인 — 마일스톤에 배정되지 않았던 DoD 항목 3건

Definition of Done에는 있으나 plan.md의 어느 마일스톤에도 배정되지 않아 아무도 실행하지 않은 항목들이다. 계획 감사는 REQ→AC와 AC→REQ 두 축을 검사했고 **AC→마일스톤 축은 검사되지 않았다.** 앞선 결함들이 "실행되지만 아무것도 검증하지 않는" 형태였다면, 이 셋은 반대로 "검증력은 있으나 실행이 배정되지 않은" 형태다.

### PRE-2 — madmom 가용성 판정 (분기 A/B) [P]

`progress.md:35`에 한 줄 언급은 있었으나 DoD가 요구하는 "판정 결과 + 사용 인터프리터 경로" 형태의 기록은 없었다. 정식으로 실행했다.

```
MADMOM_AVAILABLE = True
LIBROSA_AVAILABLE = True
interpreter = /Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/backend/.venv/bin/python
module     = /Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/.claude/worktrees/t1/backend/app/services/bpm_service.py
```

**분기 A 확정 — PASS.** 로드된 모듈 경로를 함께 남긴다. 어느 트리의 코드를 판정했는지가 확정되지 않으면 판정 자체가 증거가 되지 못한다(SPEC 1.0.0의 네 오판이 이 축에서 나왔다).

### PRE-3 — 기준 오디오 픽스처 [W]

`grep "PRE-3" progress.md` → 매치 0건. 한 번도 실행되지 않았다. 이 카드가 픽스처를 계속 사용해 왔으므로 실질적으로는 존재했으나, **"쓰고 있으니 있다"는 확인이 아니다.**

```
-rw-r--r--@ 1 byunjungwon  staff  6005537 Sep  5 20:56 music-source/Deep Purple  Smoke On the Water Official Music Video.mp3
music-source/Deep Purple  Smoke On the Water Official Music Video.mp3
tracked_exit=0
```

**PASS.**

### AC-BPM-006-OPT — Hotel California (선택)

`grep -i "hotel|006-OPT" progress.md` → 매치 0건. DoD는 "측정 **또는 '미수행' 기록**"을 요구하므로, 아무것도 적히지 않은 상태는 미수행이 아니라 **미기록**이다. 둘은 다르다 — 전자는 판단이고 후자는 누락이다.

```
$ ls music-source/
Deep Purple  Smoke On the Water Official Music Video.mp3
$ git ls-files | grep -i hotel; echo "hotel_exit=$?"
hotel_exit=1
```

**미수행 — 실패가 아니다.** 운영자가 Hotel California 오디오를 제공하지 않았다. acceptance.md가 "파일이 제공되지 않으면 미수행으로 기록하며 미수행은 실패가 아니다"로 명시한 경우에 해당한다. ×2 오검출 검증은 본 SPEC의 범위가 아니라 칸반 카드 `t10` 소관이며(spec.md 11절), 이 기준을 ×2 검증으로 확대 해석하지 않는다.

---

## run 레인 독립 검증 — M5 / M6

담당 에이전트 보고를 재실행으로 확인한 결과다. 인터프리터·작업 디렉터리 위와 동일.

### AC-BPM-001 [W] — PASS

```
$ grep -rn "_smooth_beats" backend/; echo "exit=$?"
exit=1

$ grep -rnP '(\w+)\[\s*i\s*\+\s*1\s*\]\s*=\s*\1\[\s*i\s*\]' backend/app/services/bpm_service.py; echo "exit=$?"
exit=1
```

두 검사 모두 출력이 없고 `exit=1`이다. `-P`(PCRE)로 실행했으며 `exit=2`(검사 불발)는 나오지 않았다.

### AC-BPM-009 [W] — PASS

```
$ grep -n "^madmom" backend/requirements.txt         → 27:madmom>=0.16.1    madmom_exit=0
$ grep -n 'python_version' backend/requirements.txt  → (출력 없음)         marker_exit=1
$ grep -n "3.13 비호환|Cython 빌드 실패" …           → (출력 없음)         stale_exit=1
$ grep -n "^pytest-cov" backend/requirements.txt     → 14:pytest-cov>=5.0   cov_exit=0
```

### AC-BPM-010 커버리지 — acceptance.md 문언 그대로는 측정되지 않는다

문언 그대로 (`--cov=app/services/bpm_service`):

```
literal_real_exit=1
FAIL Required test coverage of 85% not reached. Total coverage: 0.00%
147 passed
```

모듈 경로 표기를 고친 형태 (`--cov=app.services.bpm_service`), 같은 테스트 실행:

```
fixed_exit=0
app/services/bpm_service.py     159     12    92%   44-45, 57-58, 106, 110, 114, 158, 172-173, 223, 363
```

0.00%는 "커버리지가 없다"가 아니라 **"재지 못했다"** 는 뜻이다. 슬래시 표기가 파일에도 패키지에도 매칭되지 않아 측정 대상이 비었고, 같은 실행을 점 표기로 재면 92%가 나온다. **임계 `--cov-fail-under=85`는 손대지 않았다.** 목표 85%를 92%로 충족한다.

이 명령은 실패 쪽으로 떨어지므로 조용히 통과하지는 않는다 — 이 카드에서 반복된 "구성상 통과" 양식의 반대편 사례다. 다만 문언 그대로는 영원히 통과하지 못하므로 acceptance.md의 정정이 필요하며, 문언 정정은 sync 단계 소관이다.

**파이프 함정 관측.** 같은 명령을 `| tail -8`로 넘겼을 때 `literal_exit=0`이 찍혔다. 파이프의 종료 코드는 마지막 명령의 것이므로, 파이프로 본 종료 코드는 pytest의 판정이 아니다. 위 값은 파이프 없이 다시 얻은 것이다.

### AC-BPM-010 프론트엔드 — FAIL (이 카드와 무관한 기존 실패)

```
$ npx tsc --noEmit; echo "tsc_exit=$?"      → tsc_exit=0
$ npm test -- --run; echo "npm_exit=$?"     → npm_exit=1

 FAIL tests/unit/core/MetronomeEngine.test.ts > MetronomeEngine > Lookahead Scheduler
      > 다운비트는 880Hz, 업비트는 440Hz로 재생해야 한다
 Test Files  1 failed | 18 passed (19)
      Tests  1 failed | 259 passed (260)
```

인과 배제 근거 (추정이 아니라 측정):

```
$ git diff --stat cfd5475..HEAD -- src/ tests/
 src/api/bpm.ts | 2 ++
 1 file changed, 2 insertions(+)

$ git diff --stat cfd5475..HEAD -- tests/unit/core/MetronomeEngine.test.ts src/core/MetronomeEngine.ts
 (출력 없음 — 두 파일 모두 브랜치 시작점과 동일)
```

이 카드가 프론트엔드에서 바꾼 것은 `src/api/bpm.ts`의 2행(타입 필드 `engine?: string` + 주석)뿐이고, 실패한 테스트와 그 대상 소스는 브랜치 시작점 대비 변경이 없다. 타입 선언은 런타임에 지워지므로 인과가 성립할 수 없다.

**그럼에도 통과로 적지 않는다.** AC-BPM-010의 프론트엔드 기준은 "두 단계 모두 `exit=0`"이고 실측은 `npm_exit=1`이다. 무관함이 곧 충족은 아니므로 **FAIL로 기록하고 리드 판단에 넘긴다.** 기준을 "이 카드와 무관한 실패는 제외한다"로 넓히지 않는다.

### GAP (미검증으로 남긴 것)

- `ruff check` — `backend/.venv`에 ruff 미설치(`No module named ruff`). 리드 지시에 따라 설치하지 않았다. 이 카드의 범위가 아니며 **미검증**으로 남긴다. 실행하지 못한 것은 통과가 아니다.

---

## run 레인 독립 검증 — AC-BPM-007 (a), AC-BPM-008 사후

### AC-BPM-007 (a) — 두 SHA 모두 PASS

`progress.md`의 base_sha 줄을 acceptance.md가 지정한 정규식으로 실제 파싱해 얻은 값을 썼다.

```
$ grep -oE '^- base_sha: [0-9a-f]{7,40}$' .moai/specs/SPEC-BPM-003/progress.md | awk '{print $3}'
4ba10a96e820cb68eb9712e6ca952147db97b739

$ git diff 4ba10a9..HEAD -- backend/app/services/bpm_service.py | grep -cE "^[-+].*(def _calculate_confidence|1\.0 - cv|min\(confidence, 0\.8\))"
0

$ git diff cfd5475..HEAD -- backend/app/services/bpm_service.py | grep -cE "<같은 패턴>"
0
```

두 diff는 각각 202행 / 221행으로 비어 있지 않다 — 즉 이 `0`은 "diff가 비어서 항상 0"이 아니라 **변경 내역 안에 동결 대상 세 지점이 없다**는 뜻이다. 더 강한 기준선인 `cfd5475`(M1 이전)에서도 `0`이므로, base_sha가 M1을 포함하지 않는다는 약점은 실질적으로 해소된다.

### AC-BPM-008 사후 측정 — PASS

```
elapsed_runs=['18.152', '18.056', '18.161', '18.613', '18.374']
elapsed_median=18.161
bpm_runs=['115.4000', '115.4000', '115.4000', '115.4000', '115.4000']
engine=madmom confidence=0.968 repair={'inserted': 0, 'dropped': 0}
```

| 항목 | 변경 전 | 변경 후 | 기준 | 판정 |
|------|--------|--------|------|------|
| 분석 시간 중앙값 | 18.077s | **18.161s** | ≤ 18.981s (1.05배) | **PASS** (+0.46%) |
| BPM | 115.4000 | **115.4000** | 차이 ≤ 2.0 | **PASS** (차이 0.0000) |
| confidence | 0.978 | **0.968** | 0.0 ≤ x ≤ 1.0 | **PASS** |

confidence가 0.978 → 0.968로 낮아진 것은 **예상된 결과이며 실패가 아니다**(spec.md 4.2절). 평활화가 만들어내던 인공적 규칙성이 사라지고 감지 품질이 정직하게 반영된 것이다. 변화폭이 0.010으로 작은 이유는 이 곡에서 국소 보정이 한 건도 발동하지 않았고(`repair={'inserted': 0, 'dropped': 0}`) 감지기 출력 자체가 이미 규칙적이기 때문이다.
