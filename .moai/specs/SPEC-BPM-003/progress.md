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
