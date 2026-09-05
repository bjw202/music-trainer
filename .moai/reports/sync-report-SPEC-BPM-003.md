# SPEC-BPM-003 sync 보고서

| 항목 | 값 |
|------|-----|
| SPEC ID | SPEC-BPM-003 |
| 칸반 카드 | `t1` (class C) |
| 브랜치 | `WT-remove-smooth-beats` |
| 워크트리 | `.claude/worktrees/t1` |
| 착수 HEAD | `28d3f9d` |
| 일자 | 2026-09-06 |
| lifecycle | `spec-anchored` (Level 2) / `tier: M` |

---

## 요약

이번 단계에서 한 일은 **문서를 실제 구현에 맞춘 것**이다. 구현 코드는 한 줄도 바꾸지 않았다.

run 단계에서 "문서와 구현이 어긋난다"고 관측되었지만 수용 기준 본문을 고치는 것은 run의 권한이 아니어서 넘어온 건이 네 개 있었다. 그 넷을 `acceptance.md`에 반영하고, 변경 내역을 `CHANGELOG.md`와 `README.md`에 동기화했으며, SPEC 문서 네 개의 상태를 `completed`로 전이했다.

잘 된 것: 백엔드 테스트 148건이 그대로 통과했고(코드를 안 바꿨으니 당연하지만, 확인 없이 넘어가지 않았다), 커버리지 92.45%도 직접 재서 확인했다.

막힌 것: 린트(`ruff`)는 도구가 설치되어 있지 않아 **아예 돌리지 못했다.** 이것은 통과가 아니라 미검증이며, 그대로 미검증으로 남긴다. 그리고 프론트엔드 테스트 1건이 여전히 실패하는데, 이 카드가 만든 문제가 아님이 확인되었지만 **판정은 실패 그대로 두었다.**

---

## 1. 정정한 4건

### 정정 1 — pinned 테스트는 3건이 아니라 4건

**위치:** `acceptance.md` AC-BPM-007 (a-2) 표 / 기대 문구 / Definition of Done

**이전:** 표에 3건만 등재. "신설 pinned 테스트 **3건** PASSED", DoD "**pinned 테스트 3건 PASSED**"

**이후:** 표에 `test_confidence_upper_clamp_pinned` 행 추가. "신설 pinned 테스트 **4건** PASSED (1.4.0 정정 — 1.3.0까지 3건으로 적혀 있었다)", DoD "**pinned 테스트 4건 PASSED**(1.4.0 정정)"

**근거.** 문서 해석이 아니라 뮤테이션으로 확인된 사실이다. 지정된 3건은 REQ-BPM-007이 동결하는 표현식 `max(0.0, min(1.0, 1.0 - cv))` 중 상한 클램프 `min(1.0, ...)` 조각을 고정하지 못한다. 등간격 입력은 `cv == 0`이라 `1.0 - cv`가 정확히 1.0이고, 잘라낼 초과분이 없어 클램프 연산이 실행되지 않기 때문이다. 뮤테이션 `min(1.0, ...)` → `min(2.0, ...)`에서 3건 전부 통과(생존자)했고, 4번째를 넣은 뒤에는 그 뮤테이션이 정확히 `test_confidence_upper_clamp_pinned` 한 건에서 실패한다. 출처: `progress.md` 「리드 결정 — pinned 4번째 추가」.

### 정정 2 — `--cov` 대상 표기 (슬래시는 아무것도 측정하지 못한다)

**위치:** `acceptance.md` AC-BPM-010 검증 명령

**이전:** `--cov=app/services/bpm_service`

**이후:** `--cov=app.services.bpm_service` + 두 표기 대조표

| 표기 | 결과 |
|------|------|
| `app/services/bpm_service` (슬래시) | `CoverageWarning: module-not-imported`, `Total coverage: 0.00%`, `exit=1` |
| `app.services.bpm_service` (점) | `bpm_service.py 159 stmts / 12 miss / 92%`, `Total coverage: 92.45%`, `exit=0` |

**핵심.** `0.00%`는 "커버리지가 없다"가 아니라 **"재지 못했다"**이다. 슬래시 표기는 파일에도 패키지에도 매칭되지 않아 측정 대상이 비어 있었다. 임계 `--cov-fail-under=85`는 손대지 않았다 — 그 임계가 실제 방어선이었기 때문이다(0.00%가 임계에 걸려 `exit=1`로 떨어져 통과 표기 경로가 닫혔다). 실측 92.45%는 85% 목표를 충족한다.

### 정정 3 — PRE-4 (c)는 실패할 수 없는 기준이었다

**위치:** `acceptance.md` PRE-4 (c)

**이전:** `--collect-only`. 문서는 여기에 "선언·설치가 실제 효력을 갖는지" 확인하는 실효성 관문의 지위를 부여했다.

**문제.** `--collect-only`가 확인하는 것은 "pytest가 `--cov` 인자를 거부하지 않았다" 하나뿐이다. 리드 재현:

```
--cov=app/services/bpm_service     --collect-only → exit=0   (그러나 실측정은 0.00%, exit=1)
--cov=totally/nonexistent/target   --collect-only → exit=0   ← 존재하지 않는 대상으로도 통과
```

**이후:** 실측정 + `TOTAL` 행 존재 + `0.00%` 부재의 3중 단언으로 재작성. 세 대상 대조로 판정력을 실측 확인했다(아래 §3).

### 정정 4 — 프론트엔드 FAIL은 그대로 둔다

**위치:** `acceptance.md` AC-BPM-010 프론트엔드 회귀

**한 일:** 판정을 바꾸지 않고 범위 경계만 기록했다.

- **(a)** 판정은 **FAIL**이다. `npx tsc --noEmit` → `exit=0`, `npm test -- --run` → `exit=1`, `Tests 1 failed | 259 passed (260)`. 실패 대상은 `tests/unit/core/MetronomeEngine.test.ts > 다운비트는 880Hz, 업비트는 440Hz로 재생해야 한다`.
- **(b)** 리드가 주 체크아웃 `main`(이 카드의 변경이 하나도 없는 트리)에서 같은 테스트를 돌려 `Tests 1 failed | 15 passed`로 동일 실패를 확인했다. **선행 결함이다.**
- **(c)** 후속은 카드 `t2`(스템 메트로놈 배선)·`t4`(다운비트 880Hz 활성화) 소관이다.
- **(d)** 기준을 "무관한 실패는 제외한다"로 넓히지 **않았다. 무관함은 원인 설명이지 면제 사유가 아니다.** 원인을 안다고 판정이 바뀌지는 않으며, 바꿔 두면 다음에 같은 자리에서 생기는 진짜 회귀도 함께 통과한다.

---

## 2. 정정 3을 쓰다가 같은 결함을 한 번 더 만들었다 (기록)

PRE-4 (c) 재작성의 **첫 초안**은 `--cov-fail-under` 없이 실측정만 돌리고 `Total coverage: 0.00%` 부재를 단언하는 형태였다. 실행해 보니:

```
$ ... --cov=app/services/bpm_service --cov-report=term   (깨진 슬래시 표기)
slash_exit=0
zero_coverage_match=1        ← "0.00% 없음" = 통과
```

**임계 인자가 없으면 coverage 가 `Total coverage:` 행 자체를 출력하지 않는다.** 그래서 깨진 표기에서도 그 문자열이 없어 검사가 통과했다. 즉 첫 초안 역시 고치려던 결함을 그대로 물려받았다 — `progress.md`의 「결함을 고치려고 만든 장치가 같은 결함을 가진 사례」의 세 번째 사례다.

최종 형태는 임계 인자를 판정 장치로 되살리고 `TOTAL` 행 존재를 추가로 단언한다.

---

## 3. 증거 — 직접 실행해 관측한 것

### 위치 확인 (쓰기 이전)

```
$ git rev-parse --show-toplevel
/Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/.claude/worktrees/t1
$ git branch --show-current
WT-remove-smooth-beats
$ git rev-parse --short HEAD
28d3f9d
```

### 백엔드 회귀 (코드 무변경 가드)

```
$ pwd
/Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/.claude/worktrees/t1/backend
$ <interpreter> -m pytest tests/ -q --no-header -p no:warnings
PYTEST_EXIT=0
148 passed in 0.44s
```

수집 개수 `148`을 직접 읽었다. 파이프에 물리지 않고 파일로 받아 종료 코드를 그대로 관측했다 — 이 카드가 세 번 걸렸던 함정이다.

### 커버리지

```
$ <interpreter> -m pytest tests/test_bpm.py -q --cov=app.services.bpm_service --cov-report=term --cov-fail-under=85
exit=0
TOTAL                           159     12    92%
Required test coverage of 85% reached. Total coverage: 92.45%
```

### 재작성한 PRE-4 (c)의 판정력 — 세 대상 대조

| `--cov` 대상 | `exit` | `total_row` | `Total coverage:` | 판정 |
|-------------|--------|-------------|-------------------|------|
| `app.services.bpm_service` (교정) | `0` | `0` | `92.45%` | **통과** |
| `app/services/bpm_service` (1.3.0 문언) | `1` | `1` | `0.00%` | **실패** |
| `totally/nonexistent/target` | `1` | `1` | `0.00%` | **실패** |

세 검사 전부가 깨진 대상과 정상 대상을 구별한다.

### spec.md / plan.md 본문 무충돌 확인

```
$ grep -n "커버리지\|--cov\|test_confidence\|테스트 3건" spec.md plan.md
→ 슬래시 표기 `--cov=app/services/...` 리터럴 0건, pinned 3건 문언 0건
```

두 문서의 어떤 진술도 정정 4건과 충돌하지 않으므로 **본문을 고치지 않고 frontmatter만 전이했다.**

### CHANGELOG 발행 전 자체 점검 (B12)

| 점검 | 명령 | 결과 |
|------|------|------|
| 중복 발행 방지 | `git show HEAD:CHANGELOG.md \| grep -c 'SPEC-BPM-003'` | `0` — 기존 항목 없음, 발행 가능 |
| AC 개수 대조 | `grep -oE 'AC-BPM-[0-9]{3}' acceptance.md \| sort -u \| wc -l` | `10` (AC-BPM-001~010). 0이 아니며 문서 구조와 일치 |
| 파일 경로 실재 | `ls` 6건 | 6건 전부 존재 |

AC 개수 대조에서 기본 정규식 `AC-([A-Z0-9]+-)*[0-9]+`는 `14`를 냈으나, 그 안에 산문 조각 `AC-BPM-00`과 축약 표기 `AC-006`/`AC-009`/`AC-010`이 섞여 있었다. 실제 기준 식별자는 `AC-BPM-001`~`AC-BPM-010`의 **10건**이다.

---

## 4. 인용한 값의 출처

아래 값은 **리드가 독립 재현한 것**이며 이 단계에서 다시 계산하지 않았다:

| 항목 | 값 |
|------|-----|
| 비트그리드 드리프트 | 360.000 ms → **0.000 ms** |
| BPM | **115.4** (변화 없음) |
| confidence | 0.978 → **0.968** — 의도된 하락. 평활화가 만들던 인공적 규칙성이 사라진 결과이며 회귀가 아니다 |
| 분석 시간 | **+0.46%** (기준 ≤ 1.05배 중앙값 비) |
| `_smooth_beats` 부재 | `grep -rn` **0건** |

이 단계에서 직접 실행해 관측한 것: 백엔드 **148 passed**, 커버리지 **92.45%**.

---

## 5. 미검증 (GAP) — 통과가 아니다

- **`ruff check` 미수행.** `backend/.venv`에도 PATH에도 `ruff`가 없다(`No module named ruff`). 지시에 따라 설치하지 않았다. **린트는 수행되지 않았으며 이는 통과가 아니라 미검증이다.** `progress.md` 419행·1357절·1551행의 기록을 문구 그대로 유지했다.
- **프론트엔드 회귀 미재실행.** `node_modules`가 필요한 그룹 P 명령이고 이 단계는 코드를 바꾸지 않았으므로 백엔드 가드만 돌렸다. §1 정정 4의 수치는 run 단계와 리드 재현의 기록을 인용한 것이지 이 단계의 관측이 아니다.
- **AC-BPM-010 프론트엔드는 FAIL로 남아 있다.** 선행 결함임이 확인되었을 뿐 해소되지 않았다. 카드 `t2`·`t4`로 이관된다.
- **독립 sync 감사 미수행.** 이 단계의 범위가 아니며 리드 세션이 별도로 수행한다.

---

## 6. 잔여 위험

- ~~커버리지가 `tests/test_bpm.py` 기준과 전체 `tests/` 기준에서 달라질 수 있다~~ → **해소.** 전체 `tests/` 기준으로 다시 측정해 동일함을 확인했다: `exit=0`, `TOTAL 159 12 92%`, `Total coverage: 92.45%`, `148 passed`. AC-BPM-010의 대상 범위에서도 같은 값이다.
- `README.md`의 madmom·librosa 표기는 `backend/requirements.txt`의 **선언(`>=`)**에 맞췄다. 실제 설치본은 madmom 0.16.1 / librosa 0.11.0이며 선언을 만족한다. 고정 버전을 적고 싶다면 별도 판단이 필요하다.
- 프론트엔드 테스트 수(README 190건)는 현재 실측(260건)과 다르지만 이 카드가 지정한 정정 범위 밖이어서 손대지 않았다.

---

*sync 단계 수행: manager-docs / 2026-09-06*
