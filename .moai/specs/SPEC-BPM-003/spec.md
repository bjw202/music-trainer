---
id: SPEC-BPM-003
title: 비트그리드 전역 재구성 제거 및 감지기 출력 신뢰
version: 1.3.0
status: completed
priority: P0
created: 2026-09-05
updated: 2026-09-06
author: jw
phase: "v0.5.0 target"
module: backend/app/services/bpm_service.py
lifecycle: spec-anchored
tier: M
tags: bpm, beatgrid, drift, madmom, librosa, ddd
related_specs:
  - SPEC-BPM-001
  - SPEC-BPM-002
---

# SPEC-BPM-003: 비트그리드 전역 재구성 제거 및 감지기 출력 신뢰

| 항목 | 내용 |
|------|------|
| SPEC ID | SPEC-BPM-003 |
| 상태 | completed |
| 버전 | 1.3.0 (계획 감사 iter-2 신규 지적 반영 — 0절 참조) |
| 작성일 | 2026-09-05 |
| 최종 수정 | 2026-09-06 (sync 단계) |
| 우선순위 | P0 (High) |
| Tier | M (spec.md + plan.md + acceptance.md + progress.md) |
| 선행 SPEC | SPEC-BPM-001 (Completed), SPEC-BPM-002 (Completed) |
| 개발 방법론 | DDD (ANALYZE-PRESERVE-IMPROVE) |
| 칸반 카드 | `t1` (class C) |

---

## 목차

0. [개정 이력](#0-개정-이력)
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

## 0. 개정 이력

| 버전 | 날짜 | 내용 |
|------|------|------|
| 1.0.0 | 2026-09-05 | 최초 작성 |
| 1.1.0 | 2026-09-05 | 전제 네 건 정정 (아래) |
| 1.2.0 | 2026-09-05 | 독립 계획 감사 iter-1(FAIL 0.70) 지적 반영 (아래) |
| 1.3.0 | 2026-09-05 | 독립 계획 감사 iter-2(PASS 0.91) 신규 SHOULD-FIX 3건 + 자체 훑기 1건 반영 (아래) |

### 1.1.0에서 바로잡은 것

**공통 원인 — 워크트리 가시성.** 1.0.0의 조사는 전부 워크트리 `.claude/worktrees/t1` 안에서 수행되었다. git 워크트리에는 **git이 추적하지 않는 파일이 복제되지 않는다.** 따라서 주 체크아웃(`/Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2`)에 존재하지만 untracked인 파일과 디렉터리는 조사 시점에 **보이지 않았고**, "존재하지 않음"으로 잘못 기록되었다. 아래 네 건은 서로 다른 실수가 아니라 이 하나의 원인이 네 곳에서 드러난 것이다.

| # | 1.0.0의 서술 | 실제 (주 체크아웃에서 확인) |
|---|-------------|--------------------------|
| 1 | `measure_beatgrid_drift.py`는 존재하지 않으므로 신규 작성한다 | `metronome-update-plan-docs/tools/measure_beatgrid_drift.py`가 **이미 존재한다** (235행, 8568바이트, untracked). 작업은 신규 작성이 아니라 **포팅 + git 등록 + 경로/환경 가정 정규화** |
| 2 | `backend/.venv` 등 가상환경이 발견되지 않는다 / 기본 인터프리터는 3.9.6 | `backend/.venv`가 **존재하며 Python 3.13.11**이다. 백엔드 런타임은 확정되어 있다 |
| 3 | madmom 설치 성공 여부는 미확정이며 3.13에서는 설치가 불가하다 | madmom은 **설치되어 있고 정상 동작한다.** `_MADMOM_AVAILABLE = True` 확인. 따라서 `; python_version < "3.13"` 환경 마커는 madmom이 실제로 작동하는 바로 그 인터프리터에서 설치를 건너뛰게 만드는 **유해한 지시**였으므로 철회한다 |
| 4 | 신규 파일이므로 `new_features: tdd` 분기를 따른다 | 신규 파일이 아니라 기존 코드의 포팅이므로 전제가 바뀌었다. 정정된 판단은 7절 P4 참조 |

madmom이 3.13에서 동작하는 메커니즘도 함께 확정되었다. `bpm_service.py` 23-33행의 호환 shim이 먼저 적용되어야 import가 성공하며, shim을 거치지 않은 맨 `import madmom`은 3.13에서 실패한다(6.1절). 1.0.0이 "과거의 흔적"으로 기록했던 F10은 사실 **현재 madmom을 살아 있게 하는 장치**다.

### 1.2.0에서 바로잡은 것

독립 계획 감사(plan-audit iter-1)가 **FAIL 0.70**(Clarity 0.78 / Completeness 0.80 / **Testability 0.55** / Traceability 0.65)을 냈다. Must-Pass 7항목은 전부 통과했고, 실패 사유는 **수용 기준이 실패할 수 없거나 아예 실행될 수 없다**는 한 갈래였다. 요구사항 본문의 설계 판단(BEFORE/AFTER 분리, `_repair_beats` 존치, confidence 동결)과 범위 경계(Hotel California ×2 이관, Out of Scope 7항목)는 감사에서도 통과 판정을 받았으므로 그대로 둔다.

| # | 감사 지적 | 1.2.0의 처리 |
|---|----------|-------------|
| D1 | 수용 기준의 모든 명령이 "워크트리 루트에서 실행"으로 지정됐는데, 워크트리에는 `backend/.venv`·`node_modules`·포팅 원본이 없다 | 실행 계약을 **위치별로 분리**했다. acceptance.md 「실행 계약」과 6.2절 참조 |
| D2 | AC-006-AFTER(≤1.0ms)가 REQ-BPM-002의 비트 삽입과 구성상 충돌 | 측정 대상을 **감지기 원본 유래 비트로 한정**하고 삽입 비트는 `inserted_count`로 분리 보고하도록 REQ-BPM-005를 재진술 |
| D3 | 사전 기준선 측정이 M5에 묶여 있는데 M2가 이미 호출을 치움 | 사전 기준선을 **M2 IMPROVE의 선행 조건**으로 이동. plan.md 의존 그래프 수정 |
| D4 | `pytest-cov` 미설치·미선언이라 AC-010의 커버리지 검증이 실행 불가 | REQ-BPM-006 범위를 **테스트·런타임 의존성 선언**으로 넓혀 `pytest-cov>=5.0`을 포함 |
| — | AC-007(a)의 `git diff HEAD`가 커밋 이후에는 항상 비어 실패 불가 | diff 기준선을 **착수 시점 SHA**로 고정하고, 공식·상한을 값으로 고정하는 테스트를 신설 (acceptance.md AC-BPM-007) |
| D11 | librosa 상한 0.8을 `_calculate_confidence` 내부로 오기재 | 실제 위치(`_detect_with_librosa` 186행 정의 안의 208행)로 정정하고 동결 범위가 그 줄을 덮도록 REQ-BPM-007을 다시 썼다 |
| D12 | `tier:` 미기재 → Tier L 취급 | `tier: M` 명시. **다만 이 리포지터리의 다른 SPEC은 `tier:`를 쓰지 않는다** — 기존 관행 복원이 아니라 새로 도입하는 필드다 |
| D15·D16 | CT-2의 모킹 계층 미지정, 6.3절 표의 테스트 1건 누락 | 6.3절에서 둘 다 보강 |
| D18·D19·D20 | 창 폭 8 근거 부재, `priority` 표기 불일치, 사전 임계 100ms 근거 부재 | 각각 근거 기술 / `P0`으로 통일 / 유도 근거 기술 |

### 1.3.0에서 바로잡은 것

감사 iter-2가 **PASS 0.91**(iter-1 0.70 대비 +0.21, 차단 0건)을 냈고 D1~D20 전건 해소가 확인되었다. 남은 지적은 신규 SHOULD-FIX 3건이며, 셋 다 **"구성상 통과하는 기준"이라는 같은 양식**이다.

| # | 지적 | 1.3.0의 처리 |
|---|------|-------------|
| N1 | `MATCH_TOLERANCE_MS`(5.0)와 `--threshold-ms`(1.0)의 대소 관계가 하중을 받는데 명시도 방어도 없다. 둘 다 조정 가능한 값이라 `tolerance ≤ threshold`가 되는 순간 **임계를 위반한 비트만 골라 "삽입"으로 재분류되어 `max_drift_ms`에서 빠진다** — AC-006-AFTER가 D2 수정 이전으로 되돌아간다 | 불변식 `MATCH_TOLERANCE_MS > threshold_ms`를 4.2절에 명시하고, 스크립트가 측정 전에 `assert`로 확인해 위반 시 측정하지 않고 중단하도록 REQ-BPM-005에 넣었다. plan.md M3에 RED 케이스 8 신설 |
| N2 | 실행 가능한 단언이 `matched + inserted == beat_count` 항등식뿐인데 이는 `beat_count == len(emitted)`인 한 구성상 성립한다. 실제 판정력을 가진 로그 대조는 산문으로만 있어 **사람이 눈으로 맞춰야 했다** | `_repair_beats`가 보정 건수를 반환하고(4.1절), `--json`이 `service_inserted`/`service_dropped`로 실어, 스크립트가 자신의 분류 건수와 **스스로 대조**하도록 했다. AC-BPM-006-AFTER에 단언 3건과 각 단언의 판정력 대조표를 넣었다. plan.md M3에 RED 케이스 9 신설 |
| N3 | `acceptance.md`의 기준선 기록 명령에 `\| tee /tmp/base-sha.txt`가 남아 있어, 1.2.0에서 넣은 plan.md의 [HARD](출처는 `progress.md` 한 줄)와 **구현자 실행 표면에서 정면 충돌**했다 | `git rev-parse HEAD`만 남기고 `tee`와 주석을 삭제했다. 기록 지시는 바로 아래 문단이 이미 담당한다 |

**자체 훑기에서 추가로 잡은 것 (감사 목록 밖).** N1~N3를 반영하면서 "이 명령이 실패하려면 무엇이 참이어야 하는가"를 기준으로 나머지 기준을 훑었고, 1.2.0이 감사 D7에 대응해 새로 쓴 누적합산 패턴 grep이 **이 머신에서 아예 실행되지 않는다**는 것을 발견했다. `-E`(POSIX ERE)에는 역참조 `\1`이 없어 ugrep 7.8.4가 `invalid escape`로 `exit 2`를 낸다(직접 실행해 확인). `-P`(PCRE)로 바꾸고, **`exit=2`는 통과가 아니라 검사 불발**임을 acceptance.md의 실행 계약에 [HARD]로 못 박았다 — 0건 출력이 "매치 없음"과 "검사 실패" 양쪽에서 나오기 때문이다.

**같은 양식이 이 카드에서 네 번 반복되었다**: "640ms→0ms"(1.0.0, 구조상 0이 되는 목표), AC-007(a)의 `git diff HEAD`(1.1.0, 커밋 후 항상 빈 diff), 항등식 단언(1.2.0, `beat_count` 정의상 성립), 그리고 실행되지 않는 grep(1.2.0, 불발이 통과로 읽힘). 앞의 셋은 "실패할 수 없는 기준", 넷째는 "실행되지 않는 기준"이지만 결과는 같다 — **통과 표기가 아무것도 보증하지 않는다.** 1.3.0은 이 물음을 acceptance.md 실행 계약의 [HARD] 원칙으로 승격시켜, 다음 기준을 쓸 때 같은 양식이 다시 들어오지 못하게 했다.

---

**D1은 워크트리 가시성이라는 같은 근본 원인이 이 카드에서 세 번째로 낳은 결함이다.** 1.0.0의 전제 네 건이 첫 번째, 1.1.0이 정정하면서도 수용 기준의 실행 위치는 손대지 않은 것이 두 번째, 그리고 감사가 잡아낸 실행 계약 붕괴가 세 번째다. 앞의 두 번은 "파일이 없다고 잘못 단정"하는 방향이었고, 세 번째는 반대로 "없는 파일을 있다고 전제하고 명령을 짠" 방향이다. 원인은 하나 — **워크트리에는 git이 추적하지 않는 파일이 복제되지 않는다.** 1.2.0은 개별 명령을 고치는 데 그치지 않고 세 문서 전체를 훑어 같은 가정이 남은 자리를 찾았다(추가 발견은 6.2절).

---

## 1. 개요

`backend/app/services/bpm_service.py`의 `_smooth_beats`(120-151행)는 비트 그리드를 **전역 재구성**한다. 첫 비트 위치만 유지하고, 이동 중앙값으로 평활화한 간격을 첫 비트부터 누적 합산하여 이후 모든 비트 위치를 다시 만든다. 작은 간격 오차가 곡 전체에 걸쳐 누적되므로, 비트 그리드가 실제 오디오에서 점진적으로 멀어진다.

본 SPEC은 이 전역 재구성을 제거하고, **감지기(madmom / librosa) 출력을 비트 위치의 단일 진실 공급원(source of truth)으로 삼는다.** 보정은 이웃 비트를 이동시키지 않는 **국소 보정(누락 보간 / 중복 제거)** 만 허용한다. 아울러 결과가 어느 감지기에서 나왔는지 사용자가 확인할 수 있도록 `engine` 필드를 API 응답까지 노출하고, 드리프트를 실제로 재는 **기존 측정 스크립트를 리포지터리로 포팅**한다(0절 정정 1).

### 1.1 검증된 현재 코드 사실 (본 SPEC의 근거)

F1-F9는 워크트리 `.claude/worktrees/t1` (HEAD `15c363b`)에서 확인한 사실이다. F10-F13은 워크트리에서 보이지 않는 untracked 파일을 포함하므로 **주 체크아웃**에서 확인했다(0절).

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
| F10 | `bpm_service.py` 23-33행의 Python 3.13 / NumPy 2.x용 madmom 호환 shim은 **현재 madmom을 동작시키는 장치**다. 이 shim을 거치면 3.13.11에서 madmom import가 성공하고, 거치지 않은 맨 `import madmom`은 `ImportError: cannot import name 'MutableSequence' from 'collections'`로 실패한다 | 아래 명령 실행 |
| F11 | 백엔드 런타임은 `backend/.venv`이며 **Python 3.13.11**이다 | `backend/.venv/bin/python --version` |
| F12 | 그 런타임에서 madmom과 librosa가 모두 사용 가능하다: `MADMOM_AVAILABLE = True`, `LIBROSA_AVAILABLE = True` | 아래 명령 실행 |
| F13 | 드리프트 측정 스크립트가 `metronome-update-plan-docs/tools/measure_beatgrid_drift.py`에 **이미 존재한다** (235행 / 8568바이트, git untracked). `main() -> int`를 가지며, madmom RNN+DBN으로 원본 비트를 얻고 `_smooth_beats` 적용 결과와의 편차를 ms로 출력한다 | `wc -lc`, 코드 정독 |

F10 / F12의 확인 명령과 관측된 출력:

```bash
cd backend && .venv/bin/python -c "import sys; sys.path.insert(0,'.'); from app.services import bpm_service as b; print('MADMOM_AVAILABLE =', b._MADMOM_AVAILABLE); print('LIBROSA_AVAILABLE =', b._LIBROSA_AVAILABLE)"
# → MADMOM_AVAILABLE = True
# → LIBROSA_AVAILABLE = True
#   (np.object shim 관련 FutureWarning 동반)
```

F13이 지목하는 기존 스크립트의 이식 대상 세부:

| 위치 | 내용 | 포팅 시 처리 |
|------|------|-------------|
| 29-30행 | `APP_DIR = Path(os.environ.get("APP_DIR", Path.home() / "Dev/my-project-01/guitar-mp3-trainer-v2"))` — 머신 고유 절대 경로가 기본값 | 스크립트 자신의 위치에서 리포 루트를 유도하도록 정규화 (REQ-BPM-005 정규화 (a)) |
| 60-62행 | `backend = APP_DIR / "backend"`를 `sys.path`에 삽입 | 정규화된 리포 루트 기준으로 동일 동작 유지 |
| 12행, 204행 | 사용법 문구가 `~/Dev/my-project-01/guitar-mp3-trainer-v2/backend/.venv/bin/python`을 인터프리터로 고정 | 리포 상대 경로 안내로 대체 (REQ-BPM-005 정규화 (b)) |
| 95-96행 | 오디오를 `APP_DIR / "music-source"`와 형제 디렉터리 `guitar-mp3-trainer/music-source`에서 탐색 | 인자로 받은 경로를 우선 사용 |

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

**폭 8의 근거.** 1.75 / 0.50 임계와 마찬가지로 경험값이며, 유도된 상수가 아니다. 다만 두 가지 제약 사이에서 고른 값이다 — 4/4 기준 두 마디(8박)를 덮으므로 마디 단위 강약 패턴에 휘둘리지 않고, 그러면서도 곡 전체 템포 변화를 평균해 버릴 만큼 넓지는 않다. 원본 `_smooth_beats`의 `window_size` 기본값도 8이었으므로(120행 시그니처), 판정 창의 폭을 바꾸는 것은 본 SPEC의 변경 대상이 아니다 — 바뀌는 것은 창의 **용도**(위치 재생성 → 판정 전용)이지 폭이 아니다. 1.75 / 0.50과 함께 모듈 상수로 분리해 후속 SPEC에서 조정 가능하게 둔다.

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

### REQ-BPM-005: 드리프트 측정 스크립트 포팅

the 프로젝트 shall 이미 존재하는 `metronome-update-plan-docs/tools/measure_beatgrid_drift.py`(F13)를 `scripts/measure_beatgrid_drift.py`로 **포팅하고 git에 등록하며**, 경로·환경 가정을 정규화하여, 임의의 오디오 파일에 대해 방출된 비트 그리드와 감지기 원본 출력 사이의 편차를 측정한다.

이 요구사항은 **신규 작성이 아니다.** 측정 로직은 이미 동작하는 코드로 존재하므로, 아래 측정 정의·보고 항목·호출 형태·임계 exit 동작은 **포팅 과정에서 확인하고 보존해야 할 계약**이지 백지에서 설계할 대상이 아니다.

**정규화 지점은 정확히 두 가지다.**

| # | 현재 상태 | 요구 |
|---|----------|------|
| (a) | 29-30행 `APP_DIR` 기본값이 머신 고유 절대 경로(`~/Dev/my-project-01/guitar-mp3-trainer-v2`) | 스크립트 자신의 파일 위치에서 리포지터리 루트를 유도한다. `APP_DIR` 환경 변수가 설정되지 않아도 정상 동작해야 한다 |
| (b) | 12행·204행 사용법 문구가 `backend/.venv/bin/python`을 인터프리터로 하드코딩 | 특정 가상환경 절대 경로에 의존하지 않는 안내로 대체한다 |

**git 등록:** 포팅된 파일은 `git ls-files`로 조회되어야 한다. 원본이 untracked였던 것이 1.0.0의 오판을 낳은 직접 원인이므로(0절), 추적 등록은 이 요구사항의 일부다.

측정 정의(포팅 시 확인·보존):

- `emitted[i]` = `BpmService.analyze(path).beats[i]`
- `detector[j]` = 해당 감지 함수가 반환한 원본 비트(보정·평활화 이전)
- `emitted`의 각 원소를 **두 부류로 분류한다.**
  - **감지기 유래 비트**: 가장 가까운 `detector[j]`와의 절대 거리가 `MATCH_TOLERANCE_MS`(기본 5.0ms) 이내인 원소. 원본 비트가 살아남은 것으로 본다.
  - **삽입 비트**: 그 밖의 원소. REQ-BPM-002의 누락 보간이 만들어 낸, 감지기가 내놓지 않은 위치다.
- 드리프트 통계(`max_drift_ms`, `last_beat_drift_ms`, `mean_drift_ms`)는 **감지기 유래 비트에 대해서만** 계산한다. 각 감지기 유래 `emitted[i]`에 대해 최근접 `detector[j]`와의 절대 편차 `|emitted[i] - detector[j]|`를 ms로 낸다.
- 삽입 비트는 드리프트 통계에 넣지 않고 **건수로만** 보고한다(`inserted_count`). 제거된 비트는 `dropped_count`로 보고한다.
- 보고 항목: `max_drift_ms`, `last_beat_drift_ms`, `mean_drift_ms`, `beat_count`, `matched_count`, `inserted_count`, `dropped_count`, `engine`, `service_inserted`, `service_dropped`
- **[HARD] 스크립트는 자신이 분류한 건수를 서비스가 실제로 보고한 건수와 스스로 대조한다.** `service_inserted` / `service_dropped`는 `_repair_beats`가 반환한 건수(4.1절)를 그대로 실은 값이다. 측정 종료 전에 `inserted_count == service_inserted` 그리고 `dropped_count == service_dropped`를 확인하고, 어긋나면 측정값을 출력하되 0이 아닌 exit code로 중단한다. 두 수가 다르다는 것은 스크립트가 "삽입"으로 분류한 집합과 서비스가 실제로 삽입한 집합이 다르다는 뜻이며, 그 상태에서는 `max_drift_ms`가 무엇을 재고 있는지 알 수 없다.
- 이 대조가 필요한 이유는 분류가 판정의 상류에 있기 때문이다. `MATCH_TOLERANCE_MS`가 잘못 잡히거나 최근접 대응이 어긋나면 감지기 유래 비트가 조용히 "삽입"으로 넘어가 통계에서 빠진다. 항등식 `matched_count + inserted_count == beat_count`는 `beat_count == len(emitted)`인 한 구성상 성립하므로 이 오분류를 잡지 못한다 — 실제 판정력은 서비스 건수와의 대조에서 나온다.

**왜 삽입 비트를 통계에서 제외하는가 (D2 결정).** 삽입 비트는 정의상 감지기가 내놓지 않은 위치에 놓인다. 한 박이 누락된 구간에 하나를 끼우면 최근접 감지기 비트까지의 거리는 박 간격의 절반 — 120 BPM이면 약 250ms, 90 BPM이면 약 333ms다. `max_drift_ms`는 최댓값이므로 이 한 점이 판정 전체를 지배하고, **국소 보정이 한 번이라도 발동하는 곡에서는 사후 기준이 구성상 반드시 실패한다.** 4.1절이 인트로·브레이크다운에서 madmom이 비트를 놓치는 것을 국소 보정 존치의 근거로 들고 있으므로, 이 발동은 예외가 아니라 예상된 동작이다. 드리프트 지표가 재려는 것은 "감지기가 준 위치를 우리가 얼마나 흔들었는가"이지 "우리가 얼마나 채워 넣었는가"가 아니므로, 두 값을 한 지표에 섞으면 지표가 재는 대상이 흐려진다. 채워 넣은 양은 `inserted_count`가 따로 답한다.

제거(중복 삭제)는 이 지표를 부풀리지 않는다 — 지표가 `emitted`를 순회하므로 사라진 비트는 애초에 보이지 않는다. 문제가 되는 방향은 삽입 하나뿐이었다.

**대안으로 채택하지 않은 것.** "기준 픽스처에서 보정이 발동하지 않음을 선행 확인하고 그대로 최댓값을 쓴다"도 성립하는 선택지였으나 채택하지 않았다. 그러면 삽입 경로가 합성 단위 테스트로만 검증되고, 보정이 발동하는 다른 곡에서 이 스크립트가 쓸 수 없는 도구가 된다. `inserted_count` 분리는 어느 곡에서도 같은 방식으로 읽힌다.

`MATCH_TOLERANCE_MS = 5.0`의 근거: 비트가 소수점 3자리로 반올림되므로 살아남은 원본 비트의 편차 상한은 0.5ms다(4.2절 아래 AC-BPM-006-AFTER 근거와 동일). 5.0ms는 그 상한의 10배로, 반올림 오차는 여유 있게 흡수하면서 삽입 비트가 만드는 수백 ms 거리와는 두 자릿수 차이로 갈린다. 이 상수 역시 모듈 상수로 분리한다.

**[HARD] 불변식: `MATCH_TOLERANCE_MS > threshold_ms`.** 두 값 모두 조정 가능한 값이므로 이 대소 관계가 하중을 받는다. `MATCH_TOLERANCE_MS ≤ threshold_ms`가 되는 순간, 임계를 넘긴 비트는 최근접 감지기 비트와 tolerance 안에서 만나지 못해 **전부 "삽입"으로 재분류되고 `max_drift_ms` 계산에서 빠진다.** 즉 기준을 위반한 비트만 골라 지표에서 사라지게 만들 수 있고, AC-BPM-006-AFTER는 D2 수정 이전의 "구성상 통과하는 기준"으로 되돌아간다. 분류가 판정의 상류에 있기 때문에 생기는 구조적 취약점이다.

방어는 문서가 아니라 코드에 둔다 — 스크립트는 측정을 시작하기 전에 다음을 확인하고, 성립하지 않으면 측정하지 않고 0이 아닌 exit code로 중단한다.

```python
assert MATCH_TOLERANCE_MS > threshold_ms, (
    f"MATCH_TOLERANCE_MS({MATCH_TOLERANCE_MS}) must exceed threshold_ms({threshold_ms}): "
    "otherwise threshold-violating beats are reclassified as inserted and vanish from max_drift_ms"
)
```

기본값 조합(5.0 > 1.0)은 이를 만족한다. `--threshold-ms`를 5.0 이상으로 올리는 사용은 이 단언에 걸려 실패하며, 그것이 의도된 동작이다.

원본 스크립트는 같은 항목을 **인덱스 정렬 차분**(`smoothed - raw`, 두 배열 길이 동일)으로 계산한다. `_smooth_beats`는 비트 개수를 바꾸지 않으므로 그 계산이 성립했다. 반면 REQ-BPM-002의 국소 보정은 비트를 삽입·제거하여 개수를 바꾸므로, 포팅 시 **최근접 대응 + 위 분류**로 일반화해야 한다. 이는 정규화 (a)(b)와 별개로 측정 정의를 유지하기 위해 반드시 필요한 이식 작업이다.

호출 형태:

```bash
python scripts/measure_beatgrid_drift.py <audio-path> [--json] [--threshold-ms 1.0] [--no-cache]
```

- 기본 출력은 사람이 읽는 표, `--json`은 기계 판독용 JSON을 **stdout에** 출력한다.
- 진행 안내·캐시 안내·경고는 **전부 stderr로 보낸다.** stdout은 `--json` 모드에서 JSON 문서 하나만 담는다 — 안내 문구가 섞이면 AC-BPM-005 (b)의 파싱이 깨진다.
- `max_drift_ms`가 임계값(기본 1.0ms)을 넘으면 exit code 1, 아니면 0. 이 판정은 **감지기 유래 비트의 `max_drift_ms`**에 대해 이루어지며, `inserted_count`는 exit code에 영향을 주지 않는다.
- 위 `python`은 백엔드 런타임 `backend/.venv/bin/python`(Python 3.13.11)을 뜻한다. madmom이 그 환경에서만 동작하므로, 다른 인터프리터로 돌리면 librosa 경로로 빠져 madmom 드리프트를 재지 못한다.

### REQ-BPM-006: 런타임·테스트 의존성 선언

the 프로젝트 shall `backend/requirements.txt`에서 (a) madmom을 **환경 마커 없이** 주석 해제하고, (b) 커버리지 측정에 필요한 `pytest-cov`를 선언한다.

```
madmom>=0.16.1
pytest-cov>=5.0
```

**(b) `pytest-cov` 선언의 근거 (D4).** 8절이 `bpm_service.py` 커버리지 85% 이상을 목표로 잡고 있고 `quality.yaml`의 `min_coverage_legacy`도 85이지만, 이를 재는 유일한 수단인 `pytest --cov=`가 현재 실행되지 않는다.

```
$ backend/.venv/bin/python -c "import pytest_cov"
ModuleNotFoundError: No module named 'pytest_cov'
$ grep -n pytest backend/requirements.txt
12:pytest>=8.3
13:pytest-asyncio>=0.25
```

선언도 설치도 없으므로 `--cov=` 인자는 `error: unrecognized arguments`로 즉시 실패하고, 커버리지 목표 전체가 검증되지 않은 채 남는다. 1.1.0까지 이 의존성 추가를 요구하는 요구사항이 SPEC 어디에도 없었으므로, 본 요구사항의 범위를 madmom 한 줄에서 **본 SPEC의 수용 기준을 실행하는 데 필요한 의존성 선언**으로 넓힌다. 선언만으로는 부족하므로 설치 확인까지 acceptance.md PRE-4에서 기계 검증한다.

- **madmom에 환경 마커를 붙이지 않는다.** 백엔드 런타임은 Python 3.13.11이고 그 위에서 madmom이 실제로 동작한다(F11, F12). `; python_version < "3.13"`을 붙이면 pip가 **madmom이 작동하는 바로 그 인터프리터에서 설치를 건너뛴다.** 1.0.0이 제안했던 마커는 이 이유로 철회한다(0절 정정 3).
- 기존 주석 "Python 3.13 비호환 (Cython 빌드 실패)"는 설치되어 import까지 성공하는 현 상태와 모순되므로 **삭제하거나 사실에 맞게 고쳐 쓴다.** 그대로 남겨 두면 다음 독자가 같은 오판을 반복한다.
- madmom import는 `bpm_service.py` 23-33행 shim에 의존한다(F10). 이 사실을 주석으로 남기는 것은 허용되며 권장된다.

### REQ-BPM-007: confidence 공식 동결 (설계 결정)

the BPM 서비스 shall 아래 **두 지점**을 본 SPEC에서 변경하지 않는다.

| # | 동결 대상 | 위치 (워크트리 HEAD `15c363b` 기준) |
|---|----------|--------------------------------|
| (1) | 신뢰도 공식 `confidence = max(0.0, min(1.0, 1.0 - cv))` | `_calculate_confidence` (84행 정의) 안의 **115행** |
| (2) | librosa 경로의 보수적 상한 `confidence = min(confidence, 0.8)` | **`_detect_with_librosa`(186행 정의) 안의 208행** |

**(2)의 위치를 1.2.0에서 정정했다 (D11).** 1.1.0은 상한 0.8을 `_calculate_confidence` 내부에 있는 것으로 적었으나, 실제로는 그 함수 밖 — librosa 감지 함수가 자기 결과에 덧씌우는 별개의 줄이다. 두 함수는 코드상 100행 넘게 떨어져 있으므로, 동결 대상을 "`_calculate_confidence`의 공식과 상한"으로 묶어 쓰면 208행이 형식적으로 동결 범위 밖에 남는다. 위 표는 두 지점을 각각의 함수와 행 번호로 지목해 그 틈을 닫는다. 두 지점 모두 acceptance.md AC-BPM-007에서 값 고정 테스트로 기계 검증한다.

근거는 4.2절에 기술한다. 이는 명시적 설계 결정이며, 구현 세부의 누락이 아니다.

### REQ-BPM-008: 성능 회귀 금지

the BPM 서비스 shall 본 변경 이후 분석 소요 시간의 **중앙값**이 변경 전 중앙값의 1.05배를 넘지 않는다.

`_smooth_beats`는 O(n·w) 루프였으므로 제거는 순감이며, 국소 보정도 동일 복잡도 이하다. 따라서 실제 기대값은 "증가 없음"이다.

**5% 허용폭과 중앙값을 쓰는 이유 (D9).** 1.1.0은 요구사항을 "증가하지 않는다"(허용폭 0%)로 쓰고 수용 기준은 `* 1.05`(5%)로 써서 두 문서가 어긋나 있었다. 어긋남을 없애면서 5% 쪽으로 맞춘 것은 측정 현실 때문이다 — madmom RNN+DBN 추론은 실행마다 수백 ms 단위로 흔들리므로, **1회 측정의 0% 판정은 코드가 아니라 그날의 머신 부하를 재게 된다.** 따라서 (1) 허용폭을 5%로 명시하고, (2) 변경 전/후 각 **5회 이상** 측정한 뒤 중앙값끼리 비교한다. 회차별 원시 값은 전부 `progress.md`에 남긴다. 이 기준은 실제로 실패할 수 있다 — 국소 보정이 O(n²) 같은 형태로 잘못 구현되면 중앙값이 5%를 넘긴다.

---

## 4. 설계 결정

### 4.1 국소 보정을 남길 것인가

**결정: 남긴다. 단, 불변식(REQ-BPM-002-INV)을 만족하는 형태로만.**

madmom의 DBN 비트 트래커는 인트로·브레이크다운 구간에서 비트를 통째로 놓치거나 두 번 찍는 경우가 있다. 이 경우 메트로놈이 한 박을 건너뛰거나 겹쳐 울린다. 이 결함은 전역 재구성 없이도 고칠 수 있으며, 그것이 국소 보정이다. "보정을 아예 하지 않는다"는 선택지도 유효하지만, 그러면 SPEC-BPM-002 구현 노트에서 `_smooth_beats` 도입 동기였던 "인트로 바운싱"이 그대로 되돌아온다.

다만 국소 보정이 실제로 무엇을 고쳤는지 확인 가능해야 하므로, 보정 건수를 로그로 남긴다(REQ-BPM-002 구현 시 `logger.info`).

**[HARD] 보정 건수는 로그와 함께 반환값으로도 노출한다.** 로그만으로는 기계 대조가 불가능하고, 사람이 눈으로 맞추는 절차는 검증 장치로 성립하지 않는다. `_repair_beats`는 보정된 비트 배열과 함께 `{"inserted": <int>, "dropped": <int>}` 형태의 건수를 반환하고, `BpmService.analyze`가 이를 결과에 실어 측정 스크립트가 읽을 수 있게 한다.

이 반환값은 REQ-BPM-002의 보정 **알고리즘**을 바꾸지 않는다 — 임계(1.75배/0.5배), 삽입·제거 규칙, 무이동 불변식(REQ-BPM-002-INV) 전부 그대로다. 바뀌는 것은 이미 로그로 내보내던 값을 호출자도 읽을 수 있게 하는 **인터페이스 하나**뿐이다. 그 값이 AC-BPM-006-AFTER의 삽입 세탁 방지 장치를 사람 눈이 아닌 코드로 옮기는 근거가 된다(N2).

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
| `backend/requirements.txt` | madmom 주석 해제 (환경 마커 없음) + 낡은 비호환 주석 정리 + `pytest-cov>=5.0` 추가 | 낮음 | 2-3행 수정 |

### 5.2 포팅 파일

| 대상 | 출처 | 용도 | 규모 |
|------|------|------|------|
| `scripts/measure_beatgrid_drift.py` | `metronome-update-plan-docs/tools/measure_beatgrid_drift.py` (기존 235행 / 8568바이트, untracked) | 비트그리드 드리프트 측정 (REQ-BPM-005) | 신규 작성이 아닌 **포팅**. 측정 로직은 이식, 경로/환경 가정 2곳 정규화, git 등록 |

기존 파일의 처분(원본을 남길지, 옮길지, 삭제할지)은 구현 시 판단한다. 본 SPEC이 요구하는 것은 `scripts/` 아래에 **git으로 추적되는** 동작하는 사본이 존재하는 것이다.

### 5.3 테스트 파일

| 파일 | 내용 |
|------|------|
| `backend/tests/test_bpm.py` (수정) | 특성화 테스트 추가(6.3절) + `_repair_beats` 불변식 테스트 + `engine` 필드 테스트 + 캐시 열화 테스트 |

### 5.4 명시적 비변경

- `src/stores/bpmStore.ts`, `src/components/Metronome/*` — `engine`을 UI에 표시하는 작업은 범위 외(11절).
- `MetronomeEngine.ts`, `AudioEngine.ts` — SPEC-BPM-002 산출물. 본 SPEC은 백엔드 그리드만 다룬다.

---

## 6. 전제 조건 및 검증 환경

### 6.1 madmom 가용성 (확인됨 — 분기 A가 성립 사례)

madmom은 백엔드 런타임에서 **동작하는 것이 확인되었다**(F12). 따라서 madmom 경로가 실제 검증 대상이며, 이하는 재현 절차이지 미확정 조건의 판정이 아니다.

**판정 명령은 shim을 거쳐야 한다.** 맨 `python -c "import madmom"`은 3.13에서 `ImportError: cannot import name 'MutableSequence' from 'collections'`로 실패하므로, madmom이 정상 동작하는 머신에서도 "없음"으로 오판한다. 올바른 명령은 다음이다.

```bash
cd backend && .venv/bin/python -c "import sys; sys.path.insert(0,'.'); from app.services import bpm_service as b; print('MADMOM_AVAILABLE =', b._MADMOM_AVAILABLE); print('LIBROSA_AVAILABLE =', b._LIBROSA_AVAILABLE)"
```

관측된 출력은 `MADMOM_AVAILABLE = True` / `LIBROSA_AVAILABLE = True`이다. 사용한 인터프리터 경로(`backend/.venv/bin/python`, Python 3.13.11)도 evidence에 함께 남긴다.

| 분기 | 판정 | 요구 동작 |
|------|------|----------|
| **A (성립 확인됨)** | `_MADMOM_AVAILABLE == True` | madmom 경로에서 REQ-BPM-001~002를 실제 실행으로 검증한다. 드리프트 측정도 madmom 결과로 수행한다 |
| B (예비) | `_MADMOM_AVAILABLE == False` | **현재 머신에서는 해당하지 않는다.** 다른 머신에 `backend/.venv`가 없거나 import가 회귀한 경우에만 발동하는 대비책이다. 이때는 madmom 경로 검증을 `_detect_with_madmom` 모킹 단위 테스트로 대체하고, 대체 사실과 위 명령의 출력을 `progress.md`에 명시 기록한다 |

분기 A가 성립함이 확인되었으므로, 검증 실행자는 madmom 경로를 **실제로 밟아야 한다.** 밟지 않고 B로 우회하는 것은 근거 없는 회피다.

### 6.2 실행 환경 (확정)

- 백엔드 런타임은 `backend/.venv`이며 **Python 3.13.11**이다(F11).
- 1.0.0이 기록한 "가상환경이 발견되지 않는다"는 **워크트리 안에서 조사한 결과의 산물**이다. `backend/.venv`는 git untracked이므로 워크트리에 복제되지 않는다(0절). 주 체크아웃에는 존재한다.
- `bpm_service.py` 23-33행의 3.13 / NumPy 2.x shim(F10)은 과거의 흔적이 아니라 **현재 madmom을 3.13에서 동작시키는 장치**다. 1.0.0이 기록한 "불일치"는 실재하지 않았다.
- 검증 명령은 **실제로 백엔드를 실행하는 인터프리터**(`backend/.venv/bin/python`)에서 돌리고, 실행자는 사용한 인터프리터 경로를 evidence에 함께 남긴다.

### 6.2.1 실행 위치 (1.2.0 신설 — D1)

같은 워크트리 가시성 문제가 이 카드에서 **세 번째로** 낳은 결함이다(0절 1.2.0). 이번에는 방향이 반대였다 — 1.1.0은 파일이 존재한다는 것까지 바로잡고도, 수용 기준의 명령은 여전히 "모두 워크트리 루트에서 실행"으로 두었다. 워크트리에 없는 자산을 워크트리에서 쓰라고 지시한 셈이다.

워크트리 `.claude/worktrees/t1`에서 직접 확인한 것:

```bash
$ ls -d backend/.venv            → No such file or directory
$ ls -d node_modules             → No such file or directory
$ ls -d metronome-update-plan-docs → No such file or directory
```

따라서 본 SPEC의 검증 명령은 **두 그룹으로 나뉜다.**

| 그룹 | 필요한 것 | 실행 위치 |
|------|----------|----------|
| **W (워크트리 가능)** | git으로 추적되는 파일만 — `git`, `grep`, `test -f`, `ls` | 워크트리 루트, 주 체크아웃 어느 쪽이든 |
| **P (주 체크아웃 전용)** | untracked 자산 — `backend/.venv`(Python·pytest·madmom), `node_modules`(`npx tsc`·`npm test`), 포팅 원본 `metronome-update-plan-docs/tools/measure_beatgrid_drift.py` | 주 체크아웃 `/Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2` |

그룹별 명령 목록과 각 명령이 어디서 도는지는 acceptance.md 「실행 계약」이 기준이다. 대안(워크트리에 `.venv`와 `node_modules`를 프로비저닝하는 PRE-0)은 채택하지 않았다 — madmom이 도는 3.13.11 환경을 워크트리에서 재구성하는 절차 자체가 이 카드보다 크고, 그 절차의 성공 여부를 다시 검증해야 하기 때문이다.

**1.2.0의 훑기에서 추가로 찾은 자리** (감사가 열거하지 않은 것):

1. **plan.md M3의 ANALYZE 표와 PRESERVE 단계 전체**가 주 체크아웃 전용이다. 감사는 AC-005 (g)의 원본 대조만 지적했으나, 원본 스크립트의 행 번호를 읽는 ANALYZE와 원본을 실행해 출력을 기록하는 PRESERVE도 같은 파일을 필요로 한다. M3은 마일스톤 단위로 주 체크아웃에 묶인다.
2. **`/tmp/bpm_cache`는 워크트리·주 체크아웃이 공유하는 머신 전역 경로다.** 워크트리 격리가 캐시에는 적용되지 않으므로, 한쪽에서 만든 캐시가 다른 쪽 측정을 가릴 수 있다. PRE-1의 `rm -rf`가 이미 이를 막지만, "워크트리를 갈아도 캐시는 남는다"는 사실 자체를 기록해 둔다.
3. **기준 픽스처 오디오는 git으로 추적되므로 워크트리에 존재한다** — `git ls-files music-source`로 확인. 이 하나는 P 그룹이 아니다. 픽스처가 없다는 오판이 나오지 않도록 명시한다.

### 6.3 특성화 테스트 (DDD PRESERVE 단계)

**PRESERVE의 정의 (1.2.0에서 통일 — D6).** 본 SPEC에서 PRESERVE는 **오직 하나를 뜻한다 — 현재 동작을 자동으로 재실행 가능한 특성화 테스트로 고정하는 것.** 사람이 값을 읽어 `progress.md`에 적는 행위는 PRESERVE가 아니라 그 값의 **출처 기록(provenance)** 이다. 1.1.0은 이 절에서는 특성화 테스트로, plan.md M3에서는 수기 기록으로 서로 다르게 썼고, 그 어긋남이 AC-BPM-005 (g)를 "차이가 있어도 원인만 적으면 통과"하는 실패 불가 기준으로 만들었다.

두 대상에 같은 정의를 적용한다.

| 대상 | PRESERVE의 구체 형태 | `progress.md`의 역할 |
|------|--------------------|-------------------|
| `bpm_service.py`의 기존 동작 | 아래 CT-1~CT-3 (자동 테스트) | 실행 출력 첨부 |
| 포팅 대상 측정 스크립트 (M3) | 원본을 1회 실행해 얻은 출력을 **골든 픽스처 파일로 리포지터리에 커밋**하고(`backend/tests/fixtures/drift_baseline_smoke_on_the_water.json`), 포팅본이 그 값을 재현하는지 단언하는 자동 테스트 | 골든 픽스처를 만든 실행의 명령·출처·인터프리터 기록 |

포팅본은 원본의 계산 방식(인덱스 정렬 차분)을 그대로 재현하는 `--legacy-index-diff` 모드를 갖는다. 골든 대조는 이 모드로 수행되므로, **"포팅이 측정을 바꿨는가"와 "최근접 대응 일반화가 값을 바꿨는가"가 분리된다.** 전자는 골든 테스트가 판정하고(차이가 있으면 곧바로 실패 — 원인을 적는 것으로 면제되지 않는다), 후자는 M3 DDD 코어의 합성 입력 테스트(케이스 1·2)가 결정론적으로 판정한다.

`backend/tests/test_bpm.py`에서 현재 고정(pin)되어 있는 동작:

| 기존 테스트 | 고정하는 동작 | 본 변경의 영향 |
|------------|-------------|--------------|
| `TestBpmResult::test_bpm_result_creation` / `test_bpm_result_to_dict` | 4개 필드 구성과 `to_dict()` 키 집합 | **깨진다.** `engine` 추가로 갱신 필요 |
| `TestCaching::test_save_and_get_cached_result` / `test_cache_file_format` | 캐시 왕복과 JSON 키 | **깨진다.** `engine` 포함하도록 갱신 필요 |
| `TestMadmomDetection::test_detect_with_madmom_success` (`test_bpm.py:166`) | 이름과 달리 madmom 감지 **내부 동작을 고정하지 않는다.** `app.services.bpm_service._detect_with_madmom`을 통째로 `patch`하고 그 모킹된 반환값 `(120.0, [0.5, 1.0, 1.5], 0.95)`를 그대로 단언한다 | **영향 없음.** 모킹이 함수 자체를 대체하므로 그 안의 `_smooth_beats` 호출은 애초에 실행되지 않는다. `_smooth_beats`를 지워도 이 테스트는 그대로 통과한다 — 즉 이 테스트는 본 변경에 대한 안전망이 **아니다.** 그 공백을 메우는 것이 아래 CT-2다 |
| `TestMadmomDetection::test_detect_falls_back_to_librosa` | madmom 부재 시 librosa 폴백 | 유지 (`result.engine == "librosa"` 단언 추가) |
| `TestAnalyze::test_analyze_returns_cached_result` | 캐시 히트 경로 | 갱신 필요 |
| `TestAnalyze::test_analyze_no_library_available` | 라이브러리 전무 시 `RuntimeError` | 영향 없음 |
| `TestConfidenceCalculation::*` | CV 기반 신뢰도 공식 | 영향 없음 (REQ-BPM-007로 동결) |

**변경 전에 추가해야 하는 신규 특성화 테스트:**

| ID | 내용 |
|----|------|
| CT-1 | `_smooth_beats`의 누적 재구성 성질을 고정한다. 합성 비트열(등간격 + 인위적 오차)을 입력해, 출력 마지막 비트가 입력 마지막 비트에서 유의미하게 벗어남을 단언 → 제거 후 이 테스트는 삭제되며, 삭제 자체가 결함 제거의 증거가 된다 |
| CT-2 | 현재 `_detect_with_madmom`이 반환하는 `beats`가 감지기 원본과 **다름**을 단언 → 변경 후 "같음"으로 뒤집히는 테스트로 전환. **모킹 계층은 아래에 고정한다** |
| CT-3 | 현재 `BpmResult.to_dict()`의 키 집합이 정확히 4개임을 단언 → 변경 후 5개로 갱신 |

**CT-2의 모킹 계층 (1.2.0에서 명시 — D15).** CT-2는 `app.services.bpm_service` 안의 **`RNNBeatProcessor`와 `DBNBeatTrackingProcessor`를 패치한다.** DBN 처리기의 호출 결과가 합성 비트 배열(등간격 + 인위적 간격 오차)을 반환하도록 두고, `_detect_with_madmom`은 **실제 코드 그대로 실행되게 한다.**

```
patch("app.services.bpm_service.RNNBeatProcessor")      ← 액티베이션 함수 대체
patch("app.services.bpm_service.DBNBeatTrackingProcessor") ← 합성 비트 배열 반환
→ _detect_with_madmom(...) 을 실제로 호출
→ 반환된 beats 와 위 합성 배열을 비교
```

기존 `test_detect_with_madmom_success`(위 표)처럼 **`_detect_with_madmom` 자체를 패치하면 안 된다.** 그렇게 하면 함수 본문이 실행되지 않아 `_smooth_beats`를 거치지 않고, "감지기 원본과 다름"이라는 단언이 모킹된 반환값을 자기 자신과 비교하는 공허한 확인이 된다 — CT-2가 아무것도 고정하지 못한다. 검증 대상 코드가 실제로 실행되는 계층에서 모킹하는 것이 CT-2의 성립 조건이다.

---

## 7. 카드 전제 중 성립하지 않은 항목

칸반 카드 `t1`이 전제한 네 가지를 검토했다. P3·P4는 실제로 성립하지 않아 해소했고, P1·P2는 1.0.0이 **잘못 판정**했으므로 1.1.0에서 되돌린다(0절).

### P1 — 스크립트는 존재한다 (1.0.0의 판정이 틀렸다)

1.0.0은 "`find` 결과 없음, `scripts/`에는 `start.sh`와 `start.bat`만 있다"고 기록했다. 이 조사는 워크트리 안에서 수행되었고, **git이 추적하지 않는 파일은 워크트리에 복제되지 않으므로** 파일이 보이지 않았을 뿐이다.

주 체크아웃에서 확인한 사실: `metronome-update-plan-docs/tools/measure_beatgrid_drift.py`가 **235행 / 8568바이트로 존재한다**(F13). madmom RNN+DBN으로 원본 비트를 얻고, `_smooth_beats` 적용 결과와의 편차를 최대·마지막·구간별로 ms 단위 출력하는 동작하는 도구다. 카드가 지목한 검증 절차는 실재하는 도구를 가리키고 있었다.

**해소:** 작업을 "신규 작성"이 아니라 **포팅 + git 등록 + 경로/환경 가정 정규화**로 재정의한다(REQ-BPM-005). 측정 정의·보고 항목·호출 형태·임계 exit 동작은 백지 설계 대상이 아니라 포팅 시 확인·보존할 계약이다. 정규화 지점은 정확히 두 곳(`APP_DIR` 머신 고유 기본값, `backend/.venv` 인터프리터 하드코딩)이다.

### P2 — madmom은 설치되어 있고 동작한다 (1.0.0의 판정이 양방향으로 틀렸다)

1.0.0은 두 가지를 동시에 틀렸다. 런타임을 "미확정"이라고 했고, 3.13에서 madmom이 불가하다고 전제해 환경 마커를 제안했다.

주 체크아웃에서 확인한 사실: `backend/.venv`가 존재하며 Python 3.13.11이고(F11), 그 위에서 `_MADMOM_AVAILABLE = True`, `_LIBROSA_AVAILABLE = True`다(F12). madmom은 **작동한다.**

두 번째 오판이 더 위험했다. 제안된 마커 `; python_version < "3.13"`은 madmom이 실제로 작동하는 3.13.11 인터프리터에서 pip가 설치를 **건너뛰게** 만든다. 결함을 고치려던 지시가 정상 동작을 깨뜨리는 형태였다.

또한 1.0.0의 판정 명령 `python -c "import madmom"` 자체가 깨져 있었다. `bpm_service.py` 23-33행 shim을 거치지 않은 맨 import는 3.13에서 실패하므로, madmom이 동작하는 머신에서도 "없음"을 보고한다.

**해소:** (1) REQ-BPM-006에서 환경 마커를 철회하고 단순 주석 해제로 바꾼다. (2) 판정 명령을 shim 경로(`bpm_service`를 import해 `_MADMOM_AVAILABLE`을 읽는 형태)로 교체한다(6.1절, acceptance.md PRE-2). (3) requirements.txt의 "3.13 비호환" 주석은 현 상태와 모순되므로 정리한다. (4) 6.1절 분기 A를 성립 확인된 사례로 기록하고, B는 다른 머신·회귀 대비용 예비 분기로만 남긴다.

### P3 — "640ms → 0ms"는 그대로는 실패할 수 없는 기준이다

제거 후에는 방출 그리드가 곧 감지기 출력이므로, 문제의 값은 **측정이 아니라 구성에 의해** 0이 된다. 그대로 두면 절대 실패하지 않는 기준이 된다.

**해소:** 두 개의 실패 가능한 기준으로 재진술한다.

1. **사전 기준선(AC-BPM-006-BEFORE):** 변경 전 코드에서 드리프트를 측정해 `max_drift_ms ≥ 100`임을 기록한다. 결함이 실재했다는 증거이며, 측정되지 않으면 gap으로 보고한다.

   **임계 100ms의 유도 근거 (1.2.0 신설 — D20).** 1.1.0은 이 값을 근거 없이 놓았다. 두 방향에서 끼워 맞춘 값이다.
   - **아래 경계**: 이 기준이 재는 것은 "누적 합산이 만든 드리프트"이므로, 반올림·부동소수 오차(상한 0.5ms, 사후 기준의 근거와 동일)와 **두 자릿수 이상** 떨어져야 한다. 100ms는 그 상한의 200배다.
   - **위 경계**: 카드가 기재한 관측값은 마지막 박 약 640ms다(재측정 대상). 임계를 그 값 가까이 올리면, 곡·머신에 따라 드리프트가 300ms대로 나왔을 때 **결함이 실재하는데도 기준이 실패한다.** 640의 약 1/6인 100ms는 관측값이 상당히 작게 나와도 견딘다.
   - 따라서 100ms는 "반올림 오차보다 압도적으로 크고, 관측된 결함 규모보다는 충분히 작은" 구간에서 고른 값이다. 실측이 이 창을 벗어나면 그 사실 자체가 보고 대상이다 — 값을 사후에 옮기지 않는다.

2. **사후 기준(AC-BPM-006-AFTER):** 변경 후 **감지기 원본에서 유래한 비트**의 `max_drift_ms ≤ 1.0`. 코드가 비트를 소수점 3자리로 반올림하므로 이론적 상한은 0.5ms이며, 1.0ms 임계는 잔여 변환이 하나라도 남아 있으면 실패한다.

   **1.0ms의 근거가 적용되는 범위 (1.2.0에서 한정 — D2).** "소수점 3자리 반올림 → 상한 0.5ms"라는 유도는 **감지기가 내놓은 위치를 그대로 옮겨 담은 비트**에만 성립한다. REQ-BPM-002의 누락 보간이 만든 삽입 비트는 감지기가 내놓지 않은 위치에 놓이므로 반올림 오차와 무관하게 최근접 감지기 비트에서 박 간격의 절반(120 BPM에서 약 250ms)만큼 떨어져 있고, 여기에 1.0ms를 적용하면 국소 보정이 발동하는 순간 기준이 구성상 실패한다. 그래서 REQ-BPM-005의 측정 정의가 두 부류를 나누고, 이 기준은 감지기 유래 비트만 판정한다. 삽입·제거 건수는 별도로 `inserted_count` / `dropped_count`가 보고하며, 그 값이 보정 로그의 건수와 일치하는지를 AC-BPM-006-AFTER가 함께 확인한다.

**테스트 오디오 출처:** git으로 추적되는 오디오는 `music-source/Deep Purple  Smoke On the Water Official Music Video.mp3` 하나뿐이다. 따라서 **기준 픽스처는 Smoke On the Water로 확정**하고, Hotel California는 운영자가 파일을 제공하는 경우에만 보조 측정으로 수행한다(AC-BPM-006-OPT).

Hotel California의 ×2 오검출 검증은 본 SPEC의 범위가 아니라 **칸반 카드 `t10`으로 이관되었다.** 11절 범위 외 항목 참조.

### P4 — `development_mode`는 `ddd`가 아니라 `hybrid`다

`.moai/config/sections/quality.yaml` 확인 결과 `constitution.development_mode: hybrid`, `hybrid_settings.legacy_refactoring: ddd`, `hybrid_settings.new_features: tdd`, `hybrid_settings.min_coverage_legacy: 85`.

**해소:** 올바른 전제를 기록한다. 본 카드는 기존 코드 수정이 중심이므로 hybrid의 `legacy_refactoring` 분기가 적용되어 **실효 사이클은 DDD가 맞다**. 커버리지 목표는 85%(`min_coverage_legacy` = `min_coverage_new` = 85).

**측정 스크립트의 분기 재판정 (1.1.0).** 1.0.0은 `scripts/measure_beatgrid_drift.py`를 "신규 파일"로 보고 `new_features: tdd`를 적용했다. 그 근거가 사라졌다 — 신규 파일이 아니라 235행 기존 코드의 포팅이다(P1). 다시 판정하면 이 파일 안에서 두 성격이 갈린다.

| 부분 | 성격 | 적용 분기 | 이유 |
|------|------|----------|------|
| 측정 코어 (madmom 감지 → 편차 산출 → 보고) | 기존 동작 코드의 이식 | **DDD** (`legacy_refactoring`) | 이미 동작하는 로직이다. 먼저 현재 출력을 특성화 테스트로 고정한 뒤(PRESERVE), 경로 정규화와 최근접 대응 일반화를 적용한다(IMPROVE). 테스트 없이 옮기면 "옮기는 김에 조용히 달라진" 측정값을 아무도 잡지 못한다 |
| 신규 CLI 계약 (`--json`, `--threshold-ms`, 임계 초과 시 exit 1, 오류 경로 exit≠0) | 원본에 존재하지 않음 (`argparse`·JSON 출력·임계 exit 모두 없음) | **TDD** (`new_features`) | 계약이 코드보다 먼저 정해져야 하는 순수 신규 표면이다. plan.md M3의 **RED 케이스 2건**(`--json` 키 계약, 오류 경로 exit)이 이 부분을 담당한다 |

즉 hybrid는 SPEC 단위가 아니라 변경 단위로 적용된다는 원래 정의대로 작동한다. **한 파일 안에서 DDD와 TDD가 함께 쓰이는 것은 모순이 아니라 이 모드가 의도한 동작이다.**

**분기 적용의 정정 (1.2.0 — D10).** 1.1.0의 plan.md M3은 다섯 개 검증 케이스를 전부 "신규 CLI 계약 (TDD)" 아래에 묶었으나, 위 표대로 읽으면 그 중 셋은 TDD 분기의 대상이 아니다.

| 1.1.0 RED 케이스 | 실제 성격 | 1.2.0에서 옮긴 곳 |
|-----------------|----------|-----------------|
| 1. 방출 그리드 == 감지기 출력 → `max_drift_ms == 0.0` | **드리프트 계산 자체**의 동작 — 원본 `measure_d1_d5()`가 이미 하던 일 | M3 **DDD 코어** (PRESERVE/IMPROVE) |
| 2. 마지막에서 0.64초 밀림 → `last_beat_drift_ms ≈ 640` | 동일 — 측정 코어 | M3 **DDD 코어** |
| 3. `--json` 출력이 유효 JSON이고 계약 키를 모두 포함 | 원본에 없는 신규 표면 | M3 **TDD** (유지) |
| 4. 존재하지 않는 파일 경로 → exit≠0 + stderr | 원본에 없는 신규 표면 | M3 **TDD** (유지) |
| 5. `APP_DIR` 없이 실행해도 리포 루트를 찾음 | **정규화 (a)의 검증** — 기존 코드를 고치는 IMPROVE 작업 | M3 **DDD 코어**(IMPROVE 검증) |

선언과 적용이 어긋난 채로 두면 "TDD 분기를 따랐다"는 진술이 실제 작업 순서를 설명하지 못한다. 1·2·5는 **기존 동작을 먼저 고정한 뒤 고치는** DDD 순서로 가고, 3·4만 **계약을 먼저 쓰고 구현하는** TDD 순서로 간다.

---

## 8. 비기능 요구사항

| 항목 | 현재 | 목표 | 검증 |
|------|------|------|------|
| 마지막 박 드리프트 (madmom 경로) | 약 640ms (카드 기재값, 재측정 대상) | **감지기 유래 비트**의 `max_drift_ms ≤ 1.0` (삽입 비트는 `inserted_count`로 분리 보고) | AC-BPM-006-AFTER |
| BPM 값 변화 | - | 기준 픽스처에서 변경 전후 차이 `≤ 2.0` BPM | AC-BPM-008 |
| 분석 소요 시간 | 기준선 측정 (변경 전 5회 이상) | 중앙값이 변경 전 중앙값의 1.05배 이하 (REQ-BPM-008) | AC-BPM-008 |
| 백엔드 테스트 커버리지 | **측정 불가** — `pytest-cov` 미설치·미선언 | `pytest-cov>=5.0` 선언·설치 후 `bpm_service.py` 85% 이상 | PRE-4 + AC-BPM-010 |
| API 하위 호환성 | - | 기존 4개 필드 이름·타입 불변, `engine`은 추가만 | AC-BPM-003 |

---

## 9. 리스크 및 완화

| 리스크 | 확률 | 영향 | 완화 |
|--------|------|------|------|
| 평활화 제거로 인트로 바운싱 재발 | 중간 | 중간 | REQ-BPM-002 국소 보정이 누락/중복을 직접 처리. 보정 건수 로깅으로 실제 발생 여부 관측 |
| confidence 하락이 사용자에게 "품질 저하"로 보임 | 높음 | 낮음 | 4.2절 결정 기록. 표시 문구 조정은 별도 SPEC |
| madmom 경로 미검증 | **낮음** | 중간 | madmom 가용성은 확인됨(F12). 분기 A로 실제 실행 검증한다. 다른 머신에서 `_MADMOM_AVAILABLE == False`가 나오는 경우에만 6.1절 B분기로 대체하고 progress.md에 명시 기록 |
| 잘못된 판정 명령으로 madmom을 "없음"으로 오판 | 중간 | 중간 | 맨 `import madmom`은 3.13에서 항상 실패한다(F10). 판정은 반드시 shim을 거치는 `bpm_service._MADMOM_AVAILABLE` 경로로 한다(6.1절, PRE-2) |
| 환경 마커가 madmom 설치를 건너뛰게 함 | — | 높음 | 1.0.0에서 실재했던 위험. REQ-BPM-006에서 마커를 철회해 제거함 |
| 포팅 과정에서 측정 로직이 조용히 달라짐 | 중간 | 높음 | 원본(235행)의 출력을 먼저 특성화 테스트로 고정한 뒤 옮긴다(7절 P4 DDD 분기). 최근접 대응 일반화는 의도된 변경이므로 테스트로 명시한다 |
| 구 스키마 캐시로 인한 재분석 폭증 | 낮음 | 낮음 | 파일당 1회. 검증 절차에서 `/tmp/bpm_cache` 비우기를 선행 |
| 국소 보정이 의도치 않게 원본 비트를 이동 | 중간 | 높음 | REQ-BPM-002-INV 불변식을 단위 테스트(AC-BPM-002)로 기계 검증 |
| 워크트리에서만 조사해 untracked 파일을 못 봄 | — | 높음 | 1.0.0의 네 오판을 낳은 원인(0절). 파일 부재를 주장하기 전에 주 체크아웃에서 확인한다 |
| 워크트리에 없는 자산을 워크트리에서 쓰라고 지시함 | — | 높음 | 같은 원인의 **반대 방향**. 1.1.0의 수용 기준이 이 형태였고 감사가 D1로 잡았다. 1.2.0에서 실행 위치를 W/P 두 그룹으로 분리했다(6.2.1절, acceptance.md 「실행 계약」) |
| 커버리지 목표가 검증되지 않은 채 통과 처리됨 | — | 중간 | `pytest-cov` 미설치 상태에서는 `--cov=`가 즉시 실패한다. REQ-BPM-006으로 선언하고 PRE-4에서 설치까지 확인한다 |
| 드리프트 사후 기준이 국소 보정 발동만으로 실패 | — | 높음 | REQ-BPM-005의 측정 정의가 감지기 유래 비트와 삽입 비트를 분리한다. 사후 기준은 전자만 판정하고 후자는 `inserted_count`로 보고한다 |
| confidence 동결이 형식상 208행을 덮지 못함 | — | 중간 | REQ-BPM-007이 두 지점을 각각의 함수·행 번호로 지목하고, AC-BPM-007이 값 고정 테스트로 기계 검증한다 |

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

- `_calculate_confidence`(84행 정의)의 공식 변경 — 115행 `1.0 - cv` 포함 (REQ-BPM-007 (1)로 명시 동결).
- `_detect_with_librosa`(186행 정의) 208행의 librosa 상한 `min(confidence, 0.8)` 조정 (REQ-BPM-007 (2)로 명시 동결). 이 줄은 `_calculate_confidence` 밖에 있으므로 별도 항목으로 적는다.
- 신뢰도 임계 기반의 결과 거부 로직 신설.

### Out of Scope — 캐시 인프라

- 구 스키마 캐시 마이그레이션 스크립트 (REQ-BPM-004의 자가 치유로 대체).
- 캐시 위치 변경, TTL 도입, 캐시 크기 제한.

### Out of Scope — 프론트엔드 동기화 계층

- `MetronomeEngine.ts` / `AudioEngine.ts` 수정. 보간·앵커 로직은 SPEC-BPM-002의 산출물이며 본 SPEC은 백엔드 그리드만 다룬다.

### Out of Scope — 환경 구축

- **백엔드 가상환경 신설.** 애초에 필요 없는 항목이다. `backend/.venv`(Python 3.13.11)가 이미 존재하며 madmom·librosa가 모두 동작한다(F11, F12). 1.0.0은 워크트리에서 조사해 이를 보지 못했다(0절).
- Python 버전 고정(`.python-version` 등 신설), 다른 인터프리터 지원 추가.
- madmom 빌드·설치 절차 문서화. 현 머신에서는 이미 설치되어 있으므로 본 SPEC에서 다룰 문제가 없다.

### Out of Scope — Hotel California ×2 오검출 검증

- "Hotel California"의 BPM ×2 오검출(감지 146.3 BPM 대 실제 약 75) 확인과 그 해결은 **칸반 카드 `t10`("P4 ½/×2 버튼 + 오프셋 슬라이더 ±200ms")으로 이관되었다.** 본 SPEC은 비트 그리드의 드리프트만 다루며, 배속 오검출은 다루지 않는다.
- 본 SPEC의 AC-BPM-006-OPT는 운영자가 파일을 제공한 경우의 **드리프트 보조 측정**일 뿐이며, ×2 판정을 수행하거나 요구하지 않는다. 선택 기준으로 유지되며 미수행은 실패가 아니다.
- ½ / ×2 보정 버튼, 오프셋 슬라이더 등 UI 수단도 전부 `t10`의 몫이다.

---

*Generated by MoAI SPEC Builder (manager-spec)*
*SPEC date: 2026-09-05*
*Predecessors: SPEC-BPM-001 (Completed), SPEC-BPM-002 (Completed)*
