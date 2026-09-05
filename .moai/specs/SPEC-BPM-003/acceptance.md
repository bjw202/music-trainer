---
id: SPEC-BPM-003
title: 비트그리드 전역 재구성 제거 및 감지기 출력 신뢰 — 수용 기준
version: 1.1.0
status: draft
priority: high
created: 2026-09-05
updated: 2026-09-05
author: jw
phase: "v0.5.0 target"
module: backend/app/services/bpm_service.py
lifecycle: spec-anchored
tags: bpm, beatgrid, drift, acceptance
---

# SPEC-BPM-003 수용 기준

| 항목 | 내용 |
|------|------|
| SPEC ID | SPEC-BPM-003 |
| 형식 | Given-When-Then + 기계 검증 명령 |
| 원칙 | 모든 기준은 **명령 + 기대 결과** 쌍을 가지며, 실패할 수 있는 형태로 진술된다 |

모든 명령은 워크트리 루트에서 실행한다. 백엔드 테스트는 `backend/` 기준 경로를 사용한다.

**인터프리터.** Python을 호출하는 모든 명령은 백엔드 런타임 `backend/.venv/bin/python`(Python 3.13.11)을 쓴다. madmom은 이 환경에서만 동작하므로, 다른 인터프리터로 측정한 결과는 madmom 경로의 증거가 되지 못한다. `cd backend` 이후에는 `.venv/bin/python`으로 쓴다.

> 본 문서는 SPEC 1.1.0 기준이다. 1.0.0의 전제 네 건(스크립트 부재 / 가상환경 부재 / madmom 불가 / 환경 마커)이 정정되었으며, 그 근거는 spec.md 0절에 있다.

---

## 공통 전제

### PRE-1: 캐시 비우기

```bash
rm -rf /tmp/bpm_cache
```

드리프트·성능을 측정하는 모든 기준(AC-BPM-006, AC-BPM-008)은 이 명령을 선행한다. 캐시 히트는 분석 경로를 통째로 건너뛰므로, 비우지 않은 측정은 증거가 아니다.

### PRE-2: madmom 가용성 판정 (shim 경로로 판정할 것)

```bash
cd backend && .venv/bin/python -c "import sys; sys.path.insert(0,'.'); from app.services import bpm_service as b; print('MADMOM_AVAILABLE =', b._MADMOM_AVAILABLE); print('LIBROSA_AVAILABLE =', b._LIBROSA_AVAILABLE); print('interpreter =', sys.executable)"
```

**기대 결과 (확인된 값):** `MADMOM_AVAILABLE = True`, `LIBROSA_AVAILABLE = True`. `np.object` shim에서 나오는 `FutureWarning`은 정상이며 실패가 아니다.

- `MADMOM_AVAILABLE = True` → **분기 A**. madmom 경로 기준을 **실제 실행으로 검증한다.** 이것이 현재 머신에서 확인된 상태다.
- `MADMOM_AVAILABLE = False` → **분기 B**(예비). 다른 머신에 `backend/.venv`가 없거나 import가 회귀한 경우에만 해당한다. madmom 경로 기준을 모킹 단위 테스트로 대체하고, 대체 사실과 위 출력을 `progress.md`에 기록한다.

> **맨 `python -c "import madmom"`을 판정에 쓰지 않는다.** `bpm_service.py` 23-33행의 호환 shim을 거치지 않은 import는 Python 3.13에서 `ImportError: cannot import name 'MutableSequence' from 'collections'`로 **항상** 실패한다. madmom이 정상 동작하는 이 머신에서도 실패하므로, 그 실패를 "madmom 없음"으로 읽으면 분기 B로 잘못 빠진다. 1.0.0의 판정 명령이 이 형태였다.

출력의 인터프리터 경로도 함께 기록한다. 어떤 런타임에서 판정했는지가 확정되지 않으면 판정 자체가 증거가 되지 못한다.

### PRE-3: 기준 오디오 픽스처

```bash
ls -l "music-source/Deep Purple  Smoke On the Water Official Music Video.mp3"
```

이 파일이 리포지터리에서 git으로 추적되는 유일한 오디오이며, 본 SPEC의 기준 픽스처다. "Hotel California"는 선택 기준(AC-BPM-006-OPT)의 보조 드리프트 측정에서만 다루며, ×2 오검출 검증은 칸반 카드 `t10` 소관이다(spec.md 11절).

---

## AC-BPM-001: `_smooth_beats` 완전 제거

```gherkin
Scenario: 전역 재구성 코드가 코드베이스에 남아 있지 않다
  Given 변경이 완료된 backend/ 트리
  When _smooth_beats 식별자를 전수 검색한다
  Then 어떤 파일에서도 발견되지 않는다
```

**검증 명령:**

```bash
grep -rn "_smooth_beats" backend/ ; echo "exit=$?"
```

**기대 결과:** 출력 없음, `exit=1` (grep의 "매치 없음"). `exit=0`이면 실패.

```bash
grep -n "smoothed_beats\[i + 1\] = smoothed_beats\[i\]" backend/app/services/bpm_service.py; echo "exit=$?"
```

**기대 결과:** 출력 없음, `exit=1`. 누적 합산 패턴이 이름만 바뀌어 살아남는 경우를 잡는다.

---

## AC-BPM-002: 국소 보정 불변식

```gherkin
Scenario: 국소 보정이 보정 대상이 아닌 비트를 이동시키지 않는다
  Given 감지기 원본 비트 배열 original
  When _repair_beats(original)을 호출한다
  Then 제거된 비트를 제외한 original의 모든 값이 결과에 그대로 존재한다
  And 살아남은 값의 차이가 1e-9를 넘지 않는다
```

**검증:** `backend/tests/test_bpm.py`에 다음 테스트를 추가하고 통과시킨다.

| 테스트 | 입력 | 기대 |
|--------|------|------|
| `test_repair_preserves_original_beats` | 등간격 40비트 + 미세 지터 | 결과가 입력의 상위집합, 원본 값 오차 ≤ 1e-9 |
| `test_repair_interpolates_gap` | 한 지점의 간격을 2배로 벌린 배열 | 그 사이에 정확히 1개 삽입, 다른 비트 위치 불변 |
| `test_repair_drops_duplicate` | 한 지점에 0.3배 간격의 중복 비트 삽입 | 해당 중복 1개만 제거, 다른 비트 위치 불변 |
| `test_repair_no_cumulative_shift` | 60비트 배열, 보정 대상 없음 | 출력 == 입력 (배열 동등, 원소별 오차 ≤ 1e-9) |

```bash
cd backend && .venv/bin/python -m pytest tests/test_bpm.py -k "repair" -v
```

**기대 결과:** 4개 테스트 모두 PASSED, exit 0.

---

## AC-BPM-003: `engine` 필드의 4계층 전파

```gherkin
Scenario: 감지 엔진 이름이 결과·캐시·API 스키마·프론트엔드 타입에 모두 존재한다
  Given BPM 분석이 librosa 경로로 수행된 상태
  When 결과를 직렬화하고 각 계층의 타입 정의를 확인한다
  Then engine 값이 "librosa"이고 네 계층 모두에 필드가 선언되어 있다
```

**검증 명령 (a) 런타임 값:**

```bash
cd backend && .venv/bin/python -m pytest tests/test_bpm.py -k "engine" -v
```

추가할 테스트:

| 테스트 | 기대 |
|--------|------|
| `test_bpm_result_to_dict_includes_engine` | `to_dict()` 키 집합이 정확히 `{bpm, beats, confidence, file_hash, engine}` |
| `test_analyze_sets_engine_librosa` | madmom 비활성 + librosa 활성 모킹 시 `result.engine == "librosa"` |
| `test_analyze_sets_engine_madmom` | madmom 활성 모킹 시 `result.engine == "madmom"` |

**기대 결과:** 3개 모두 PASSED.

**검증 명령 (b) 타입 선언:**

```bash
grep -n "engine" backend/app/models/schemas.py
grep -n "engine" src/api/bpm.ts
```

**기대 결과:** 각각 1행 이상 출력. `schemas.py`는 `engine: str`(필수), `bpm.ts`는 `engine?: string`(선택)이어야 한다. 필수/선택이 뒤바뀌면 실패.

**검증 명령 (c) 프론트엔드 타입 체크:**

```bash
npx tsc --noEmit
```

**기대 결과:** exit 0, 오류 없음.

---

## AC-BPM-004: 구 스키마 캐시의 안전한 열화

```gherkin
Scenario: engine 키가 없는 캐시 파일은 재분석을 유발한다
  Given 캐시 디렉터리에 bpm/beats/confidence만 담긴 구 스키마 JSON이 있다
  When _get_cached_result(해당 해시)를 호출한다
  Then None이 반환된다
  And 경고 로그가 남는다
```

**검증:** `backend/tests/test_bpm.py`에 추가.

| 테스트 | 기대 |
|--------|------|
| `test_legacy_cache_without_engine_returns_none` | 구 스키마 JSON 저장 후 `_get_cached_result` → `None` |
| `test_new_cache_with_engine_roundtrips` | 신 스키마 저장 후 조회 → `engine` 값 왕복 일치 |

```bash
cd backend && .venv/bin/python -m pytest tests/test_bpm.py -k "cache" -v
```

**기대 결과:** 모두 PASSED.

**추가 검증 (`.get()` 사용 금지):**

```bash
grep -n 'data.get("engine"' backend/app/services/bpm_service.py; echo "exit=$?"
```

**기대 결과:** 출력 없음, `exit=1`.

---

## AC-BPM-005: 드리프트 측정 스크립트 포팅 및 동작

기존 `metronome-update-plan-docs/tools/measure_beatgrid_drift.py`(235행, git untracked)를 `scripts/`로 포팅한 결과를 검증한다. 신규 작성이 아니므로, 포팅본이 **git에 등록되었는지**와 **머신 고유 경로 가정 없이 도는지**가 핵심 기준이다.

```gherkin
Scenario: 포팅된 드리프트 측정 스크립트가 git에 등록되고 기계 판독 가능한 결과를 낸다
  Given metronome-update-plan-docs/tools/measure_beatgrid_drift.py 를 scripts/ 로 포팅한 상태
  When 기준 픽스처에 --json 옵션으로 실행한다
  Then 유효한 JSON이 stdout에 출력되고 5개 키를 모두 포함한다
  And 해당 파일이 git으로 추적된다
  And APP_DIR 환경 변수 없이도 동작한다
```

**검증 명령 (a) 존재 + git 추적:**

```bash
test -f scripts/measure_beatgrid_drift.py && echo FILE_OK || echo MISSING
git ls-files --error-unmatch scripts/measure_beatgrid_drift.py; echo "tracked_exit=$?"
```

**기대 결과:** `FILE_OK` 출력, 그리고 `git ls-files`가 경로를 출력하며 `tracked_exit=0`. 파일이 있어도 untracked면 **실패**다 — 원본이 untracked였던 것이 SPEC 1.0.0의 오판을 낳은 직접 원인이므로(spec.md 0절), 추적 등록은 협상 대상이 아니다.

**검증 명령 (b) JSON 계약:**

```bash
rm -rf /tmp/bpm_cache
backend/.venv/bin/python scripts/measure_beatgrid_drift.py "music-source/Deep Purple  Smoke On the Water Official Music Video.mp3" --json \
  | backend/.venv/bin/python -c "import json,sys; d=json.load(sys.stdin); ks={'max_drift_ms','last_beat_drift_ms','mean_drift_ms','beat_count','engine'}; assert ks <= d.keys(), f'missing: {ks - d.keys()}'; print('KEYS OK', d)"
```

**기대 결과:** `KEYS OK {...}` 출력, exit 0. 키 누락이면 AssertionError로 실패.

**검증 명령 (c) 단위 테스트:**

```bash
cd backend && .venv/bin/python -m pytest tests/test_beatgrid_drift.py -v
```

**기대 결과:** plan.md M3의 RED 5개 케이스 모두 PASSED.

**검증 명령 (d) 오류 경로:**

```bash
backend/.venv/bin/python scripts/measure_beatgrid_drift.py /nonexistent/file.mp3; echo "exit=$?"
```

**기대 결과:** `exit=` 이 0이 아님, stderr에 파일 없음 메시지.

**검증 명령 (e) `APP_DIR` 비의존 (정규화 (a)):**

```bash
rm -rf /tmp/bpm_cache
unset APP_DIR && backend/.venv/bin/python scripts/measure_beatgrid_drift.py "music-source/Deep Purple  Smoke On the Water Official Music Video.mp3" --json > /tmp/drift-no-appdir.json; echo "exit=$?"
```

**기대 결과:** `exit=0`, `/tmp/drift-no-appdir.json`이 유효한 JSON. 원본은 `APP_DIR` 기본값으로 머신 고유 절대 경로(`~/Dev/my-project-01/guitar-mp3-trainer-v2`)를 갖고 있었다. 이 명령이 실패하면 정규화 (a)가 이루어지지 않은 것이다.

**검증 명령 (f) 인터프리터 하드코딩 부재 (정규화 (b)):**

```bash
grep -n "Dev/my-project-01" scripts/measure_beatgrid_drift.py; echo "exit=$?"
```

**기대 결과:** 출력 없음, `exit=1`. 사용법 문구를 포함해 어디에도 머신 고유 절대 경로가 남아 있으면 실패다.

**검증 명령 (g) 포팅 무결성 (DDD PRESERVE 대조):**

plan.md M3 PRESERVE 단계에서 기록한 **원본 스크립트의 출력**과 포팅본의 출력을 기준 픽스처에서 대조하고, 두 출력을 `progress.md`에 나란히 기록한다.

**기대 결과:** 최대 이탈·마지막 비트 이탈·비트 수가 일치한다. 인덱스 정렬 차분 → 최근접 대응 일반화로 인한 차이는 예외로 허용하되, **차이가 있다면 그 원인을 명시 기록한다.** 대조 없이 넘어가면 측정값이 조용히 달라져도 아무도 알 수 없다.

---

## AC-BPM-006: 드리프트 기준

카드의 "640ms → 0ms"를 실패 가능한 두 기준으로 재진술한 것이다(spec.md 7절 P3).

### AC-BPM-006-BEFORE: 사전 기준선 (변경 전 코드에서 측정)

```gherkin
Scenario: 변경 전 코드에서 유의미한 드리프트가 실제로 측정된다
  Given _smooth_beats가 아직 제거되지 않은 상태
  And 측정 스크립트가 이미 작성된 상태
  When 기준 픽스처에 대해 드리프트를 측정한다
  Then max_drift_ms가 100 이상이다
```

```bash
rm -rf /tmp/bpm_cache
backend/.venv/bin/python scripts/measure_beatgrid_drift.py "music-source/Deep Purple  Smoke On the Water Official Music Video.mp3" --json | tee /tmp/drift-before.json
```

**기대 결과:** `max_drift_ms >= 100`. 출력 전문을 `progress.md`에 verbatim 기록한다.

**측정 불가 시:** 추정값을 쓰지 않는다. `progress.md`에 gap으로 기록하고 AC-BPM-006-AFTER만을 근거로 삼는다.

다만 현재 머신에서는 **madmom이 동작하므로(PRE-2 분기 A) 이 기준선은 실제로 측정되어야 한다.** "madmom이 없어서 못 쟀다"는 이 머신에서 성립하지 않는 사유다. 그런 보고가 나온다면 인터프리터가 `backend/.venv/bin/python`이 아니었을 가능성을 먼저 의심한다. madmom이 없는 다른 머신(분기 B)에서만, librosa 경로가 원래 `_smooth_beats`를 호출하지 않으므로(F2) 기준선이 측정되지 않는 것이 정상이며 그 사실을 기록한다.

### AC-BPM-006-AFTER: 사후 기준 (필수)

```gherkin
Scenario: 변경 후 방출 그리드가 감지기 출력과 반올림 오차 내에서 일치한다
  Given _smooth_beats가 제거되고 국소 보정만 남은 상태
  When 기준 픽스처에 대해 드리프트를 측정한다
  Then max_drift_ms가 1.0 이하이다
```

```bash
rm -rf /tmp/bpm_cache
backend/.venv/bin/python scripts/measure_beatgrid_drift.py "music-source/Deep Purple  Smoke On the Water Official Music Video.mp3" --threshold-ms 1.0; echo "exit=$?"
```

**기대 결과:** `exit=0` (스크립트가 임계 초과 시 1을 반환하므로 이 명령 자체가 판정이다).

임계 1.0ms의 근거: 코드가 비트를 소수점 3자리로 반올림하므로 이론적 상한은 0.5ms다. 1.0ms를 넘는다는 것은 반올림 이외의 변환이 남아 있다는 뜻이며, 이 기준은 그때 실패한다.

### AC-BPM-006-OPT: Hotel California (선택 — 변경 없음)

운영자가 Hotel California 오디오를 제공한 경우에만 수행한다.

```bash
rm -rf /tmp/bpm_cache
backend/.venv/bin/python scripts/measure_beatgrid_drift.py "<운영자 제공 경로>" --threshold-ms 1.0; echo "exit=$?"
```

**기대 결과:** `exit=0`. 파일이 제공되지 않으면 이 기준은 "미수행"으로 기록하며, 미수행은 실패가 아니다.

> **범위 경계.** 이 기준은 **드리프트 보조 측정일 뿐이며, ×2 오검출 판정을 포함하지 않는다.** Hotel California의 배속 오검출(감지 146.3 BPM 대 실제 약 75) 확인과 해결은 칸반 카드 `t10`("P4 ½/×2 버튼 + 오프셋 슬라이더 ±200ms")으로 이관되었다 — spec.md 11절 「Out of Scope — Hotel California ×2 오검출 검증」. 이 기준을 ×2 검증으로 확대 해석하지 않는다.

---

## AC-BPM-007: confidence 공식 동결 및 변화 관측

```gherkin
Scenario: 신뢰도 공식은 변하지 않고, 값의 변화만 기록된다
  Given _calculate_confidence의 공식과 librosa 상한 0.8
  When 본 SPEC의 변경을 적용한다
  Then 기존 TestConfidenceCalculation 테스트가 수정 없이 통과한다
  And 기준 픽스처의 confidence 값 변화가 관측 기록으로 남는다
```

**검증 명령 (a) 공식 불변:**

```bash
cd backend && .venv/bin/python -m pytest tests/test_bpm.py::TestConfidenceCalculation -v
git diff HEAD -- app/services/bpm_service.py | grep -c "^[-+].*def _calculate_confidence\|^[-+].*1.0 - cv\|^[-+].*min(confidence, 0.8)"
```

**기대 결과:** 테스트 전부 PASSED. 두 번째 명령의 출력이 `0` — 공식 관련 줄에 어떤 변경도 없음. 0이 아니면 실패.

**검증 명령 (b) 값 변화 기록:**

변경 전후 각각 캐시를 비우고 분석해 `confidence` 값을 `progress.md`에 기록한다. 값이 낮아지는 것은 예상된 결과이며 실패가 아니다(spec.md 4.2절). 다만 `0.0 <= confidence <= 1.0` 범위는 유지되어야 한다.

```bash
cd backend && .venv/bin/python -c "
from app.services.bpm_service import BpmService
r = BpmService(cache_dir='/tmp/bpm_cache_ac007').analyze('../music-source/Deep Purple  Smoke On the Water Official Music Video.mp3')
assert 0.0 <= r.confidence <= 1.0, r.confidence
print('confidence=', r.confidence, 'bpm=', r.bpm, 'engine=', r.engine)
"
```

**기대 결과:** 예외 없이 값 출력, exit 0.

---

## AC-BPM-008: BPM 값 및 성능 회귀 방지

```gherkin
Scenario: 평활화 제거가 BPM 값과 분석 시간을 크게 흔들지 않는다
  Given 기준 픽스처
  When 변경 전후로 BPM과 분석 소요 시간을 각각 측정한다
  Then BPM 차이가 2.0 이하이고, 분석 시간이 증가하지 않는다
```

**검증 명령:**

```bash
rm -rf /tmp/bpm_cache
cd backend && .venv/bin/python -c "
import time
from app.services.bpm_service import BpmService
t0 = time.perf_counter()
r = BpmService().analyze('../music-source/Deep Purple  Smoke On the Water Official Music Video.mp3')
print('elapsed_s=%.3f bpm=%.1f engine=%s' % (time.perf_counter()-t0, r.bpm, r.engine))
"
```

변경 전/후 각 1회 이상 실행하고 두 출력을 `progress.md`에 기록한다.

**기대 결과:** `abs(bpm_after - bpm_before) <= 2.0`, `elapsed_s_after <= elapsed_s_before * 1.05`. `_smooth_beats`는 O(n·w) 루프였으므로 제거는 순감이어야 한다.

---

## AC-BPM-009: 의존성 선언 (환경 마커 없음)

```gherkin
Scenario: madmom이 환경 마커 없이 주석 해제된다
  Given backend/requirements.txt
  When madmom 항목을 확인한다
  Then 주석이 아니며, 환경 마커가 붙어 있지 않다
  And 실행 중인 인터프리터에서 madmom이 실제로 사용 가능하다
```

백엔드 런타임은 Python 3.13.11이고 그 위에서 madmom이 동작한다(spec.md F11, F12). 따라서 `; python_version < "3.13"` 마커는 **madmom이 작동하는 바로 그 인터프리터에서 설치를 건너뛰게 만드는 유해한 지시**이므로 붙이지 않는다. 1.0.0의 지시였고 철회되었다(spec.md 0절 정정 3).

**검증 명령 (a) 주석 해제:**

```bash
grep -n "^madmom" backend/requirements.txt
```

**기대 결과:** 1행 출력. 매치가 없으면(여전히 주석) 실패.

**검증 명령 (b) 환경 마커 부재:**

```bash
grep -n 'python_version' backend/requirements.txt; echo "exit=$?"
```

**기대 결과:** 출력 없음, `exit=1`. `python_version` 마커가 남아 있으면 **실패**다.

**의존성 파싱 검증:**

```bash
backend/.venv/bin/python -c "
from pathlib import Path
lines = [l.strip() for l in Path('backend/requirements.txt').read_text().splitlines()]
m = [l for l in lines if l.startswith('madmom')]
assert len(m) == 1, m
assert ';' not in m[0], f'환경 마커가 남아 있음: {m[0]}'
print('OK', m[0])
"
```

**기대 결과:** `OK madmom>=0.16.1` 출력, exit 0.

**검증 명령 (c) 낡은 주석 정리:**

```bash
grep -n "3.13 비호환\|Cython 빌드 실패" backend/requirements.txt; echo "exit=$?"
```

**기대 결과:** 출력 없음, `exit=1`. "Python 3.13 비호환 (Cython 빌드 실패)"는 설치되어 import까지 성공하는 현 상태와 모순되며, 남겨 두면 다음 독자가 같은 오판을 반복한다.

**검증 명령 (d) 선언과 실제의 일치:**

PRE-2의 출력이 `MADMOM_AVAILABLE = True`임을 재확인해, requirements.txt의 선언이 실제 런타임 상태와 일치함을 보인다.

---

## AC-BPM-010: 회귀 및 커버리지

```gherkin
Scenario: 백엔드 테스트 전체가 통과하고 커버리지 목표를 만족한다
  Given 변경이 완료된 상태
  When 백엔드 테스트를 커버리지와 함께 실행한다
  Then 모든 테스트가 통과하고 bpm_service.py 커버리지가 85% 이상이다
```

**검증 명령:**

```bash
cd backend && .venv/bin/python -m pytest tests/ -v --cov=app/services/bpm_service --cov-report=term-missing
```

**기대 결과:** exit 0, 실패·에러 0건, `app/services/bpm_service.py` 커버리지 ≥ 85%.

**프론트엔드 회귀:**

```bash
npx tsc --noEmit && npm test -- --run
```

**기대 결과:** 두 단계 모두 exit 0.

---

## Definition of Done

- [ ] AC-BPM-001: `grep -rn "_smooth_beats" backend/` 결과 없음 (exit 1) — 출력 첨부
- [ ] AC-BPM-002: `_repair_beats` 불변식 테스트 4건 PASSED
- [ ] AC-BPM-003: `engine` 테스트 3건 PASSED + 4계층 타입 선언 확인 + `tsc --noEmit` exit 0
- [ ] AC-BPM-004: 구 캐시 열화 테스트 PASSED + `data.get("engine"` 부재 확인
- [ ] AC-BPM-005: 포팅본 존재 + **`git ls-files` 추적 확인** + JSON 5키 계약 + 단위 테스트 + 오류 경로 + **`APP_DIR` 없이 실행 성공** + 머신 고유 경로 부재 + 원본/포팅본 출력 대조
- [ ] AC-BPM-006-BEFORE: 사전 기준선 측정 (madmom 동작 확인됨 — 미측정은 gap이며, "madmom 부재" 사유는 이 머신에서 성립하지 않는다)
- [ ] AC-BPM-006-AFTER: `--threshold-ms 1.0` 실행 exit 0
- [ ] AC-BPM-006-OPT: Hotel California 측정 또는 "미수행" 기록 (×2 오검출 검증은 카드 `t10` 소관 — 여기서 수행하지 않는다)
- [ ] AC-BPM-007: `TestConfidenceCalculation` 무수정 PASSED + 공식 diff 0줄 + 값 변화 기록
- [ ] AC-BPM-008: BPM 차이 ≤ 2.0, 분석 시간 미증가 — 변경 전/후 출력 첨부
- [ ] AC-BPM-009: `^madmom` 매치 1건 + **환경 마커 부재 확인** + 낡은 "3.13 비호환" 주석 정리 확인
- [ ] AC-BPM-010: 백엔드 전체 통과 + 커버리지 ≥ 85%, 프론트엔드 회귀 통과
- [ ] PRE-2 판정 결과(분기 A/B)와 사용 인터프리터 경로를 `progress.md`에 기록

---

## 증거 기록 원칙

- 모든 체크 항목은 **실제로 실행한 명령과 그 출력**으로만 표시한다. 명령을 돌리지 않은 항목은 통과가 아니라 gap이다.
- 캐시를 비우지 않고 측정한 드리프트·성능 수치는 증거로 인정하지 않는다.
- madmom 미설치(PRE-2 분기 B)로 대체 검증한 항목은 "PASS"가 아니라 "PASS (모킹 대체)"로 구분해 기록한다. **다만 이 머신에서는 분기 A가 확인되었으므로, 분기 B 대체는 원칙적으로 나오지 않아야 한다.** 대체 기록이 나온다면 인터프리터를 잘못 골랐거나 맨 `import madmom`으로 판정했을 가능성을 먼저 확인한다.
- `backend/.venv/bin/python`이 아닌 인터프리터로 측정한 madmom 경로 수치는 증거로 인정하지 않는다. madmom은 그 환경에서만 동작하므로, 다른 인터프리터의 결과는 librosa 경로의 값이다.
- **파일·환경의 부재를 주장할 때는 주 체크아웃에서 확인한 결과를 근거로 든다.** 워크트리에는 git untracked 파일이 복제되지 않으므로, 워크트리에서만 관측한 "없음"은 부재의 증거가 아니다. SPEC 1.0.0의 전제 네 건이 모두 이 착오였다(spec.md 0절).

---

*Generated by MoAI SPEC Builder (manager-spec)*
*Acceptance criteria date: 2026-09-05*
