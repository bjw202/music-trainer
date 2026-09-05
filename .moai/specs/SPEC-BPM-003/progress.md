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
