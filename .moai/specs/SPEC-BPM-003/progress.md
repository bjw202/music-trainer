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
