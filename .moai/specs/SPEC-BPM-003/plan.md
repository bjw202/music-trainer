---
id: SPEC-BPM-003
title: 비트그리드 전역 재구성 제거 및 감지기 출력 신뢰 — 구현 계획
version: 1.3.0
status: draft
priority: P0
created: 2026-09-05
updated: 2026-09-05
author: jw
phase: "v0.5.0 target"
module: backend/app/services/bpm_service.py
lifecycle: spec-anchored
tier: M
tags: bpm, beatgrid, drift, ddd, plan
---

# SPEC-BPM-003 구현 계획

| 항목 | 내용 |
|------|------|
| SPEC ID | SPEC-BPM-003 |
| 개발 방법론 | Hybrid → 기존 코드 수정은 DDD(ANALYZE-PRESERVE-IMPROVE), 원본에 없던 신규 CLI 계약만 TDD |
| 커버리지 목표 | 85% (`hybrid_settings.min_coverage_legacy` = `min_coverage_new` = 85) |
| 칸반 카드 | `t1` (class C) |
| Tier | M |
| 계획 버전 | 1.2.0 (계획 감사 iter-1 지적 반영 — spec.md 0절) |

> 전제 정정 (1): 디스패치는 `development_mode: ddd`라고 했으나 실제 설정은 `hybrid`다. 기존 코드를 고치는 작업이므로 `hybrid_settings.legacy_refactoring: ddd`가 적용되어 **실효 사이클은 DDD**다.
>
> 전제 정정 (2, 1.1.0): `scripts/measure_beatgrid_drift.py`는 신규 파일이 **아니다.** `metronome-update-plan-docs/tools/measure_beatgrid_drift.py`에 235행짜리 동작하는 원본이 이미 있으며(git untracked이라 워크트리에서 보이지 않았을 뿐이다), 본 작업은 **포팅 + git 등록 + 경로/환경 가정 정규화**다. 따라서 측정 코어는 DDD, 원본에 없던 CLI 계약(`--json` / `--threshold-ms` / 임계 exit)만 TDD로 간다. 근거와 분기표는 spec.md 7절 P4.
>
> 전제 정정 (3, 1.1.0): madmom은 `backend/.venv`(Python 3.13.11)에서 **설치되어 정상 동작한다**(`_MADMOM_AVAILABLE = True`). 환경 마커 제안은 철회되었고, madmom 경로는 실제 실행으로 검증한다.
>
> 이 세 정정의 공통 원인은 하나다 — 1.0.0의 조사가 워크트리 안에서만 이루어져 git untracked 파일(`backend/.venv`, 원본 스크립트)을 볼 수 없었다. spec.md 0절 참조.
>
> 전제 정정 (4, 1.2.0): 독립 계획 감사 iter-1이 **FAIL 0.70**을 냈고, 차단 결함 4건 중 둘이 이 계획서의 문제였다 — **마일스톤 순서**(사전 기준선을 M5에 두었으나 M2가 이미 호출을 치운다)와 **TDD/DDD 분기 적용**(M3 RED 5건 중 3건이 DDD 작업). 1.2.0에서 둘 다 고쳤다. 근거와 처리 내역은 spec.md 0절 「1.2.0에서 바로잡은 것」.
>
> **독립 감사(plan-audit)는 본 SPEC의 흐름 안에서 수행하지 않는다.** 칸반 lead 세션이 별도로 진행한다.

---

## 실행 위치 — 이 계획서를 어디서 돌리는가

[HARD] 이 카드의 작업은 **주 체크아웃 `/Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2`에서 수행한다.** 워크트리 `.claude/worktrees/t1`에는 `backend/.venv`도 `node_modules`도 포팅 원본 `metronome-update-plan-docs/`도 없다 — 전부 git untracked이므로 복제되지 않는다(spec.md 6.2.1절).

git·grep·파일 존재 확인처럼 추적 파일만 보는 명령(그룹 W)은 어느 쪽에서 돌려도 같다. Python·pytest·`npx tsc`·`npm test`·원본 스크립트 실행(그룹 P)은 주 체크아웃 전용이다. 명령별 그룹 표기는 acceptance.md 「실행 계약」이 기준이며, **각 마일스톤의 명령에는 그룹 표기가 붙는다.**

M3은 마일스톤 **전체**가 그룹 P다. ANALYZE가 원본 스크립트의 행 번호를 읽고 PRESERVE가 원본을 실행하는데, 그 파일이 워크트리에 없기 때문이다.

## 병합 시점 처리 방침 — 주 체크아웃의 미커밋 @MX 주석 2줄

[HARD] 주 체크아웃 `backend/app/services/bpm_service.py` 최상단에 커밋되지 않은 `@MX:NOTE` / `@MX:REASON` 2줄이 있고(워크트리에는 없다), "madmom 경로는 도달하지 않고 librosa 폴백만 실행된다"는 그 내용은 실측(madmom 0.16.1 설치됨, `_MADMOM_AVAILABLE = True`, 322행 분기 진입)과 어긋난다 — 이 카드가 그 주석의 근거였던 requirements.txt의 madmom 주석을 해제하므로, **병합 시점에 이 2줄을 삭제하고 그 삭제를 M6 커밋에 포함시킨다**(본 SPEC 작업 중에는 해당 파일의 그 부분을 건드리지 않으며, 워크트리에 없는 줄을 미리 다루려 하지 않는다).

---

## 마일스톤 개요

되돌리기 어려운 결정을 앞에, 기계적 작업을 뒤에 배치했다. M1~M3은 사람이 검토해야 할 판단이 들어 있고, M4~M6은 앞의 결정이 확정되면 기계적으로 따라온다.

| 마일스톤 | 우선순위 | 요구사항 | 성격 |
|----------|---------|---------|------|
| M1: 데이터 모델 및 스키마 확장 (`engine`) | Primary | REQ-BPM-003, REQ-BPM-004 | 데이터 모델 변경 — 되돌리기 비쌈 |
| M3: 드리프트 측정 스크립트 포팅 (DDD 코어 + TDD CLI) | Primary | REQ-BPM-005 | 기존 도구 이식 + 신규 계약 — **측정 수단이므로 M2보다 먼저 끝나야 한다** |
| M2: 국소 보정 설계 확정 및 구현 | Primary | REQ-BPM-002 | 알고리즘 판단 — 되돌리기 비쌈. **착수 전에 사전 기준선을 측정한다** |
| M4: 특성화 테스트 보강 (PRESERVE) | Primary | 6.3절 CT-1~CT-3 | 안전망 — M5의 선행 조건 |
| M5: `_smooth_beats` 제거 (IMPROVE) | Primary | REQ-BPM-001 | 기계적 삭제 |
| M6: 의존성 선언 및 성능 확인 | Secondary | REQ-BPM-006, REQ-BPM-008 | 기계적 |

번호는 1.1.0의 것을 그대로 유지하되 **실행 순서는 M1 → M3 → M2 → M4 → M5 → M6**이다. 번호와 순서가 어긋나는 것이 읽기에 불편하지만, 이미 발행된 번호를 다시 매기면 감사 보고서·`progress.md`와의 상호 참조가 끊긴다.

의존 관계:

```
M1 (engine 필드) ────────────────┐
                                 │
M3 (측정 스크립트 포팅)            │
  └─→ [사전 기준선 측정] ──────────┼─→ M4 (특성화) ─→ M5 (_smooth_beats 제거) ─→ M6
        └─→ M2 (국소 보정 구현) ───┘
```

**M3 → 사전 기준선 → M2는 순서가 고정된 사슬이다** (1.2.0에서 정정 — D3).

| 화살표 | 왜 뒤집을 수 없는가 |
|--------|-------------------|
| M3 → 사전 기준선 | 기준선을 재는 도구가 M3의 산출물이다. 도구 없이는 측정 자체가 불가능하다 |
| 사전 기준선 → M2 | **M2 IMPROVE가 174행의 `_smooth_beats(beats)` 호출을 `_repair_beats(beats)`로 바꾼다.** 그 교체 이후에는 결함 코드가 호출 경로에서 사라지므로 드리프트가 ~0ms로 나오고, AC-BPM-006-BEFORE(`max_drift_ms ≥ 100`)는 충족 자체가 불가능해진다 |

1.1.0은 이 측정을 M5(삭제)에 묶고 "반드시 M5 삭제 전에"라고 적었다. 구속 조건을 잘못 짚은 것이다 — 기준선을 죽이는 것은 **함수 정의의 삭제(M5)가 아니라 호출의 교체(M2)** 다. M1→M2→M3→M4→M5 순으로 진행하면 M5 시점에는 잴 것이 남아 있지 않고, 결함이 실재했다는 유일한 증거가 계획 순서 때문에 구조적으로 gap 처리된다.

M1은 이 사슬과 독립이다(`engine` 필드는 비트 위치에 관여하지 않는다). M4 이후는 종전과 같다.

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

## M2: 국소 보정 설계 확정 및 구현 (Primary — M3 완료 후 착수)

`_smooth_beats`를 그냥 지우면 인트로 바운싱이 되돌아온다(SPEC-BPM-002 구현 노트가 밝힌 도입 동기). 대체물을 먼저 확정해야 M5가 안전해진다.

### 선행 조건: 사전 기준선 측정 (IMPROVE 착수 **전**, 그룹 P)

[HARD] 아래를 먼저 실행해 기록하기 전에는 이 마일스톤의 IMPROVE 단계를 시작하지 않는다. IMPROVE의 마지막 항목이 174행의 호출을 교체하는데, 교체 이후에는 기준선을 잴 수 없다.

```bash
# 주 체크아웃에서 실행. 이 시점의 코드는 아직 _smooth_beats 를 호출한다.
rm -rf /tmp/bpm_cache
backend/.venv/bin/python scripts/measure_beatgrid_drift.py \
  "music-source/Deep Purple  Smoke On the Water Official Music Video.mp3" --json | tee /tmp/drift-before.json
```

기록할 것:

1. 위 출력 전문을 `progress.md`에 verbatim (AC-BPM-006-BEFORE의 증거).
2. **착수 시점 SHA** — `git rev-parse HEAD`의 출력. AC-BPM-007 (a)의 diff 기준선이 이 값이다. 이후 어떤 커밋이 쌓여도 이 SHA는 바뀌지 않는다.
   [HARD] `progress.md`에 **정확히 아래 한 줄 형태로** 적는다. AC-BPM-007 (a)가 이 줄을 기계적으로 읽으므로, 형식이 다르면 그 기준은 통과가 아니라 미검증(gap)으로 떨어진다.
   ```
   - base_sha: <위 명령의 출력 전체>
   ```
   `/tmp` 등 OS가 비우는 경로를 이 값의 출처로 쓰지 않는다 — 감사 시점에 해석되지 않는 경로를 인용한 주장은 귀속되지 않은 주장이다.
3. 측정에 쓴 인터프리터 경로.
4. **변경 전 성능 기준선** — 같은 파일에 대해 캐시를 비우고 5회 이상 분석해 소요 시간 회차별 값과 중앙값 (AC-BPM-008). 이것도 M2 IMPROVE 이후에는 존재하지 않는 값이다.
5. **변경 전 confidence 값** — 기준 픽스처의 `confidence` (AC-BPM-007 (b)).

측정 직전에 호출이 아직 살아 있는지 스스로 확인한다(`grep -n "_smooth_beats(beats)" backend/app/services/bpm_service.py`가 174행을 출력해야 한다). 출력이 없다면 순서를 이미 어긴 것이므로 측정하지 말고 blocker로 보고한다 — 추정값을 적지 않는다.

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

`_detect_with_madmom` 174행의 `_smooth_beats(beats)` 자리에 `_repair_beats(beats)`가 들어간다. 호출 순서(보정 → BPM 계산 → confidence 계산)는 유지한다. **이 교체가 사전 기준선을 소멸시키는 지점이므로, 위 선행 조건이 끝나지 않았다면 여기서 멈춘다.**

### 대안 평가

| 선택지 | 장점 | 단점 | 판단 |
|--------|------|------|------|
| 보정 완전 제거 | 가장 단순, 감지기 출력 100% 신뢰 | 인트로 바운싱 재발 | 채택 안 함 |
| **국소 보정 (채택)** | 드리프트 0, 누락/중복은 해결 | 임계값 1.75 / 0.50이 경험값 | **채택** |
| 국소 중앙값으로 위치 대체 | 부드러움 | 원본 이동 = 전역 재구성의 축소판 | 채택 안 함 |

임계값 1.75와 0.50은 경험값이므로 모듈 상수로 분리해 조정 가능하게 둔다.

---

## M3: 드리프트 측정 스크립트 포팅 (Primary, DDD 코어 + TDD CLI — M2보다 먼저 끝낸다)

**마일스톤 전체가 그룹 P(주 체크아웃 전용)다.** 원본 스크립트가 untracked이므로 워크트리에서는 ANALYZE도 PRESERVE도 수행할 수 없다.

**신규 작성이 아니라 포팅이다.** 원본은 `metronome-update-plan-docs/tools/measure_beatgrid_drift.py` (235행 / 8568바이트, git untracked). 목적지는 `scripts/measure_beatgrid_drift.py`이며, git에 등록되어야 한다.

### ANALYZE — 원본이 이미 하는 일

| 원본 위치 | 동작 | 포팅 시 |
|----------|------|--------|
| `_patch_numpy_for_madmom()` (37행), `_load_smooth_beats()` (58행) | `sys.path`에 `APP_DIR/backend`를 넣고 대상 앱의 `_smooth_beats`를 실제로 가져온다(없으면 동등 사본) | 유지. 단 경로 유도 방식은 정규화 (a) |
| `measure_d1_d5()` (107행) | madmom `RNNBeatProcessor` + `DBNBeatTrackingProcessor(fps=100)`로 원본 비트를 얻고, `smoothed - raw` 차분에서 최대 이탈·마지막 비트 이탈·구간별 이탈을 ms로 출력 | **측정 코어. 보존 대상** |
| `check_d2_downbeat()` (161행) | 다운비트 점검 | 본 SPEC 범위 밖(spec.md 11절). 포팅 시 제외 가능 |
| `main() -> int` (194행) | 곡을 자동 탐색해 순회 | 인자로 받은 단일 경로 우선으로 변경 |

원본에 **없는** 것: `argparse`, JSON 출력, `--threshold-ms`, 임계 초과 시 exit 1. 이 넷이 신규 계약이며 TDD 대상이다.

### PRESERVE — 옮기기 전에 고정할 것 (골든 픽스처 + 자동 테스트)

**PRESERVE는 자동 특성화 테스트를 뜻한다** — spec.md 6.3절의 정의와 같다. 1.1.0은 이 자리에서만 PRESERVE를 "`progress.md`에 수기 기록"으로 썼고, 그 어긋남이 AC-BPM-005 (g)를 실패 불가 기준으로 만들었다(감사 D6). 1.2.0에서 정의를 하나로 맞춘다. 수기 기록은 PRESERVE가 아니라 골든 값의 **출처 기록**이다.

절차:

1. 원본을 기준 픽스처에 대해 1회 실행한다(그룹 P).
   ```bash
   backend/.venv/bin/python metronome-update-plan-docs/tools/measure_beatgrid_drift.py \
     "music-source/Deep Purple  Smoke On the Water Official Music Video.mp3"
   ```
2. 그 출력에서 **최대 이탈 ms / 마지막 비트 이탈 ms / 비트 수**를 뽑아 골든 픽스처 파일로 리포지터리에 **커밋한다**: `backend/tests/fixtures/drift_baseline_smoke_on_the_water.json`. 원본이 untracked였던 것이 1.0.0 오판의 원인이었으므로, 그 출력만이라도 추적 대상으로 만든다.
3. 실행 명령·원본 경로·인터프리터 경로·실행 시각을 `progress.md`에 기록한다(출처 기록).
4. 포팅본에 **`--legacy-index-diff` 모드**를 만든다. 원본의 계산 방식(`smoothed - raw` 인덱스 정렬 차분)을 그대로 재현하는 모드다.
5. 포팅본을 이 모드로 돌려 골든 값과 대조하는 자동 테스트를 쓴다 (`backend/tests/test_beatgrid_drift.py::test_ported_matches_original_golden`).

**대조 기준은 실패할 수 있어야 한다.** 따라서 허용 오차를 미리 못 박는다.

| 항목 | 허용 오차 | 불일치 시 |
|------|----------|----------|
| `beat_count` | 0 (정확히 일치) | **실패** |
| 최대 이탈 ms | ≤ 0.5 (비트 반올림 상한) | **실패** |
| 마지막 비트 이탈 ms | ≤ 0.5 | **실패** |

"차이가 있으면 원인을 적는다"는 면제 조항은 두지 않는다 — 그 조항이 있으면 어떤 차이도 통과하므로 기준이 아니다. **최근접 대응 일반화로 인한 차이는 이 대조에 나타나지 않는다.** 대조가 `--legacy-index-diff` 모드에서 이루어지므로 일반화 경로를 타지 않기 때문이다. 일반화가 값을 어떻게 바꾸는지는 아래 DDD 코어 케이스 1·2가 합성 입력으로 결정론적으로 판정한다. 두 질문("포팅이 측정을 바꿨는가" / "일반화가 값을 바꿨는가")을 분리한 것이 이 설계의 핵심이다.

### IMPROVE — 정규화 두 곳 (REQ-BPM-005)

1. **(a) `APP_DIR` 정규화.** 29-30행의 머신 고유 절대 경로 기본값(`Path.home() / "Dev/my-project-01/guitar-mp3-trainer-v2"`)을 버리고, `Path(__file__).resolve().parent.parent`처럼 스크립트 자신의 위치에서 리포 루트를 유도한다. `APP_DIR` 환경 변수 없이 실행해도 동작해야 한다(AC-BPM-005 (e)).
2. **(b) 인터프리터 하드코딩 제거.** 12행·204행 사용법 문구의 `~/Dev/.../backend/.venv/bin/python`을 리포 상대 안내로 대체한다.

3. **(c) 최근접 대응 + 비트 분류 일반화.** 원본은 `smoothed - raw`의 **인덱스 정렬 차분**을 쓰는데, 이는 `_smooth_beats`가 비트 개수를 바꾸지 않기에 성립했다. `_repair_beats`는 삽입·제거로 개수를 바꾸므로 **최근접 대응**으로 바꾸고, 나아가 `emitted`를 감지기 유래 비트와 삽입 비트로 분류해 드리프트 통계를 전자에만 적용한다(spec.md REQ-BPM-005 측정 정의, 감사 D2). 원본 계산은 `--legacy-index-diff` 모드로 보존한다.

### DDD 코어 검증 — 측정 로직 자체 (1.2.0에서 TDD 절에서 이관 — 감사 D10)

아래 세 케이스는 **원본이 이미 하던 일**(1·2)이거나 **정규화 (a)를 검증하는 IMPROVE 작업**(5)이므로, 신규 CLI 계약이 아니라 DDD 코어에 속한다. 1.1.0은 다섯을 전부 "신규 CLI 계약 (TDD)" 아래에 묶어 선언과 적용이 어긋나 있었다. 번호는 1.1.0의 것을 유지한다.

`backend/tests/test_beatgrid_drift.py` (합성 입력 — madmom·오디오 불필요, 결정론적):

1. 방출 그리드 == 감지기 출력 → `max_drift_ms == 0.0`, `inserted_count == 0`, `dropped_count == 0`
2. 방출 그리드가 마지막에서 0.64초 밀림 → `last_beat_drift_ms ≈ 640`, `max_drift_ms ≥ 100`
5. `APP_DIR` 환경 변수를 지운 상태에서 실행해도 리포 루트를 찾아 정상 동작 (정규화 (a) 검증)

여기에 D2 분리를 검증하는 케이스를 더한다.

6. 방출 그리드가 감지기 출력 + **삽입 비트 1개**(누락 구간 중앙) → `max_drift_ms`는 여전히 반올림 오차 수준(≤ 0.5ms)이고 `inserted_count == 1`. 삽입 비트가 드리프트 통계로 새어 들어오면 이 케이스가 실패한다 — 감사 D2가 지목한 구성상 충돌을 잡는 기준이다.
7. 방출 그리드가 감지기 출력에서 **1개 제거** → `dropped_count == 1`, `max_drift_ms` 영향 없음.

DDD 순서: 1·2는 원본 동작이므로 PRESERVE(골든)로 먼저 고정된 뒤 IMPROVE에서 일반화를 적용하며, 5·6·7은 IMPROVE가 도입하는 동작의 검증이다.

### RED — 신규 CLI 계약 (TDD)

원본에 **없던** 표면만 여기 남는다. 계약을 먼저 쓰고 구현한다.

3. `--json` 출력이 유효한 JSON이고 계약 키를 모두 포함: `max_drift_ms`, `last_beat_drift_ms`, `mean_drift_ms`, `beat_count`, `matched_count`, `inserted_count`, `dropped_count`, `engine`, `service_inserted`, `service_dropped`
4. 존재하지 않는 파일 경로 → 0이 아닌 exit code + **stderr** 메시지 (stdout은 비어 있어야 한다)
8. `--threshold-ms 5.0`(= `MATCH_TOLERANCE_MS`) 및 `--threshold-ms 9.0`(> tolerance)으로 실행 → **측정하지 않고** 0이 아닌 exit code + stderr에 불변식 위반 메시지 (N1 방어선)
9. 서비스 보고 건수와 스크립트 분류 건수가 어긋나도록 조작한 입력 → `inserted_count != service_inserted`를 스크립트가 스스로 감지해 0이 아닌 exit code (N2 방어선)

`--threshold-ms` 초과 시 exit 1은 3의 계약에 포함된다(임계 판정 대상은 감지기 유래 비트의 `max_drift_ms`이며, `inserted_count`는 exit code에 영향을 주지 않는다).

케이스 8·9는 **기준 자체를 지키는 기준**이다. 8이 없으면 임계를 tolerance 이상으로 올려 위반 비트를 삽입으로 재분류할 수 있고, 9가 없으면 오분류가 조용히 통과한다. 둘 다 없으면 AC-BPM-006-AFTER는 D2 수정 이전 상태로 되돌아간다.

### GREEN

`scripts/measure_beatgrid_drift.py` (포팅 결과):

```
usage: python scripts/measure_beatgrid_drift.py <audio-path>
         [--json] [--threshold-ms 1.0] [--no-cache] [--legacy-index-diff]

동작:
  1. 감지기 원본 출력 획득 (madmom 가용 시 madmom 감지 단계, 아니면 librosa) — 보정 이전 배열
  2. BpmService.analyze(path).beats 로 방출 그리드 획득
  0. [HARD] assert MATCH_TOLERANCE_MS > threshold_ms — 성립하지 않으면 측정하지 않고 중단
     (tolerance ≤ threshold 면 임계 위반 비트가 전부 "삽입"으로 빠져나간다. spec.md 4.2절)
  1'. BpmService 로부터 서비스 측 보정 건수(service_inserted / service_dropped)도 함께 받는다
  3. emitted[i] 각각에 대해 가장 가까운 detector[j] 탐색 → |차이| * 1000 (ms)
     거리 ≤ MATCH_TOLERANCE_MS(5.0) 이면 "감지기 유래", 아니면 "삽입"으로 분류
  4. 감지기 유래 비트에 대해서만 max / last / mean 산출
     + beat_count / matched_count / inserted_count / dropped_count / engine
     + service_inserted / service_dropped
  4'. [HARD] assert inserted_count == service_inserted and dropped_count == service_dropped
      어긋나면 측정값을 출력하되 0이 아닌 exit code 로 중단 (오분류 감지)
  5. 표(stdout) 또는 JSON(stdout) 출력, 감지기 유래 max > threshold 면 exit 1

  --legacy-index-diff: 3~4를 원본 방식(인덱스 정렬 차분, 분류 없음)으로 계산.
                       PRESERVE 골든 대조 전용이며 기본 경로가 아니다.
```

**출력 스트림 규약 (1.2.0에서 명시 — 감사 D13).** 캐시가 결과를 가리지 않도록 시작 시 대상 해시의 캐시 파일 유무를 알리고 `--no-cache`로 우회할 수 있게 하되, **이 안내를 포함한 모든 진행 문구·경고·오류 메시지는 stderr로 보낸다.** stdout은 `--json` 모드에서 JSON 문서 하나만 담는다.

1.1.0은 "시작 시 캐시 파일 유무를 알린다"고만 쓰고 스트림을 정하지 않았다. stdout으로 나가면 AC-BPM-005 (b)가 그 출력을 `json.load`로 파싱하는 순간 깨진다 — 안내 한 줄이 JSON 문서 앞에 붙기 때문이다. 기본(표) 모드에서도 규약은 같다: 측정 결과만 stdout, 나머지는 stderr.

이 규약은 위 RED 케이스 4(오류 경로에서 stdout이 비어 있을 것)와 AC-BPM-005 (b)가 함께 검증한다.

### REFACTOR

감지기 원본 획득 로직을 `bpm_service`에 중복 구현하지 않고 재사용 가능한 최소 진입점으로 정리한다. 원본 스크립트의 `_load_smooth_beats()`가 이미 "대상 앱의 실제 함수를 import하고 실패 시 사본으로 폴백"하는 형태이므로, 그 의도를 유지하되 리포 안으로 들어온 만큼 폴백 사본은 걷어낸다.

[HARD] **포팅본은 `_smooth_beats`를 import하지 않는다.** 원본은 그 함수를 직접 가져와 자기가 적용했지만, 포팅본은 방출 그리드를 `BpmService.analyze(path).beats`로 얻으므로 그럴 필요가 없다. import를 남겨 두면 M5에서 함수가 삭제되는 순간 스크립트가 깨지고, **사후 측정(AC-BPM-006-AFTER)을 수행할 도구가 사라진다.** `--legacy-index-diff`는 차분 계산 방식만 바꾸는 옵션이지 `_smooth_beats`를 필요로 하지 않는다.

### 완료 조건

- `git ls-files scripts/measure_beatgrid_drift.py`가 파일을 찾는다 (원본이 untracked였던 것이 오판의 원인이었다).
- `git ls-files backend/tests/fixtures/drift_baseline_smoke_on_the_water.json`이 골든 픽스처를 찾는다.
- `APP_DIR` 없이 실행해도 동작한다.
- `test_ported_matches_original_golden`이 통과한다 — 위 PRESERVE 표의 허용 오차 안에서 골든과 일치한다. 면제 조항은 없다.
- DDD 코어 케이스 1·2·5·6·7과 TDD 케이스 3·4가 모두 통과한다.
- **M2 착수 전에 이 마일스톤이 끝나 있다.** 사전 기준선을 잴 도구가 여기서 나오기 때문이다.

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

### 사전 기준선은 여기가 아니라 M2의 선행 조건이다

[HARD] 1.1.0은 사전 기준선 측정을 이 마일스톤에 두고 "반드시 M5 삭제 전에"라고 적었으나, 그 시점에는 **M2가 이미 174행의 호출을 `_repair_beats`로 바꿔 놓았으므로 잴 것이 남아 있지 않다.** 측정은 M2 선행 조건으로 이동했다(M2 절 참조). 여기서 다시 재려 하지 않는다 — 이 시점의 측정값은 기준선이 아니라 사후 값이다.

M5에 도달했을 때 `progress.md`에 사전 기준선 기록이 없다면, 순서를 어긴 것이므로 진행하지 말고 blocker로 보고한다. 되돌리는 방법은 하나뿐이다 — M2의 호출 교체를 임시로 되돌려 측정하고 다시 적용하는 것이며, 그렇게 했다면 그 사실도 함께 기록한다.

### 삭제 절차

1. `bpm_service.py` 120-151행 `_smooth_beats` 함수 정의 삭제.
2. 174행의 호출이 M2에서 이미 `_repair_beats(beats)`로 교체되어 있음을 확인한다(교체는 M2의 작업이다).
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
   그리고 커버리지 측정 의존성을 같은 파일에 추가한다(감사 D4):
   ```
   pytest-cov>=5.0
   ```
   `pytest-cov`는 선언도 설치도 되어 있지 않아 AC-BPM-010의 `--cov=` 인자가 `error: unrecognized arguments`로 즉시 실패한다 — 85% 커버리지 목표를 재는 유일한 수단이 실행 불가 상태였다. 선언 후 주 체크아웃에서 설치하고(`backend/.venv/bin/python -m pip install -r backend/requirements.txt`), 설치 확인은 acceptance.md PRE-4가 수행한다.

   **madmom에 환경 마커를 붙이지 않는다.** 백엔드 런타임은 Python 3.13.11이고 그 위에서 madmom이 실제로 동작하므로, `; python_version < "3.13"`은 madmom이 작동하는 바로 그 인터프리터에서 설치를 건너뛰게 만든다. 낡은 "3.13 비호환" 주석도 함께 정리한다 — 그대로 두면 다음 독자가 같은 오판을 반복한다.
2. 백엔드 실행 인터프리터에서 madmom 가용성 판정 → 결과와 인터프리터 경로 기록(spec.md 6.1절, acceptance.md PRE-2):
   ```bash
   cd backend && .venv/bin/python -c "import sys; sys.path.insert(0,'.'); from app.services import bpm_service as b; print('MADMOM_AVAILABLE =', b._MADMOM_AVAILABLE)"
   ```
   **맨 `python -c "import madmom"`을 쓰지 않는다.** shim을 거치지 않은 import는 3.13에서 항상 실패하므로, madmom이 동작하는 머신에서도 "없음"으로 오판한다.
3. 분석 소요 시간 변경 전/후 비교 (REQ-BPM-008). 동일 파일, 캐시를 비운 상태에서 **각 5회 이상** 측정하고 중앙값끼리 비교한다. 1회 측정은 madmom 추론의 실행 편차 때문에 코드가 아니라 그날의 머신 부하를 재게 된다(감사 D9). 회차별 원시 값을 전부 `progress.md`에 남긴다.

   **변경 전 측정 시점.** 이 측정도 M2의 사전 기준선과 함께 수행한다 — M2 IMPROVE 이후에는 "변경 전"이 존재하지 않는다.

---

## 위험 관리

| 위험 | 대응 |
|------|------|
| madmom 경로를 못 밟음 | 가능성 낮음 — madmom 가용성은 확인되었다(`_MADMOM_AVAILABLE = True`). 실제 실행으로 검증한다. 다른 머신에서 False가 나오는 경우에만 spec.md 6.1 B분기로 대체하고 progress.md에 명시한다 |
| 판정 명령을 맨 `import madmom`으로 써서 오판 | shim 경로(`bpm_service._MADMOM_AVAILABLE`)로만 판정한다. 맨 import는 3.13에서 항상 실패한다 |
| 포팅 중 측정 로직이 조용히 달라짐 | M3 PRESERVE — 원본 출력을 먼저 verbatim 기록하고 포팅본과 대조한다 |
| 포팅본을 git에 등록하지 않음 | 원본이 untracked였던 것이 1.0.0 오판의 직접 원인이다. `git ls-files`로 확인하는 것을 완료 조건에 넣었다 |
| Hotel California 픽스처 부재 | Smoke On the Water로 기준 픽스처 확정. Hotel은 운영자 제공 시 보조 측정(AC-BPM-006-OPT). ×2 오검출 검증은 카드 `t10`으로 이관 |
| 사전 기준선을 측정하지 못함 | **1순위 원인은 순서를 어긴 것이다** — M2가 174행 호출을 이미 교체했는지 먼저 확인한다. 순서를 지켰는데도 못 쟀다면 추정값 기입 금지, gap으로 보고 |
| 계획서를 워크트리에서 그대로 실행 | `backend/.venv`·`node_modules`·포팅 원본이 워크트리에 없다. 「실행 위치」 절의 W/P 구분을 따른다 |
| 커버리지 검증이 실행조차 되지 않음 | M6에서 `pytest-cov>=5.0` 선언 + 설치. PRE-4가 설치를 확인한 뒤에만 AC-BPM-010을 통과로 표기한다 |
| 캐시 안내가 stdout으로 나가 JSON 파싱을 깸 | 안내·경고·오류는 전부 stderr. RED 케이스 4와 AC-BPM-005 (b)가 함께 검증한다 |
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
- **반대로, 워크트리에 없는 자산을 워크트리에서 쓰라고 지시하는 것** — 같은 원인의 반대 방향이며 1.1.0의 수용 기준이 이 형태였다. 명령을 쓸 때마다 "이 명령이 필요로 하는 것이 추적 파일인가"를 먼저 묻는다.
- M2 IMPROVE를 먼저 하고 나중에 사전 기준선을 재려는 것 — 교체된 뒤에는 잴 것이 없다. ~0ms를 "측정했다"고 적으면 결함이 없었다는 거짓 증거가 된다.
- 포팅본과 원본의 차이를 "원인을 적었으니 통과"로 처리하는 것 — 허용 오차 표를 넘으면 실패다. 면제 조항은 기준을 기준이 아니게 만든다.
- 삽입 비트를 드리프트 통계에 섞는 것 — 국소 보정이 발동하는 순간 사후 기준이 구성상 실패한다. `inserted_count`로 분리한다.
- `git diff HEAD`로 공식 동결을 검증하는 것 — 검증 시점에는 변경이 이미 커밋되어 diff가 비어 있으므로 항상 통과한다. 착수 시점 SHA를 기준으로 잡는다.

---

## 상호 참조

- `.moai/specs/SPEC-BPM-003/spec.md` — 요구사항 및 설계 결정
- `.moai/specs/SPEC-BPM-003/acceptance.md` — 수용 기준
- `.moai/specs/SPEC-BPM-002/spec.md` — `_smooth_beats` 도입 경위 (구현 노트)
- `.moai/config/sections/quality.yaml` — hybrid 모드 및 커버리지 설정

---

*Generated by MoAI SPEC Builder (manager-spec)*
*Plan date: 2026-09-05*
