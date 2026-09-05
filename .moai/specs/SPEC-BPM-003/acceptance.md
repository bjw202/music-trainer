---
id: SPEC-BPM-003
title: 비트그리드 전역 재구성 제거 및 감지기 출력 신뢰 — 수용 기준
version: 1.4.0
status: completed
priority: P0
created: 2026-09-05
updated: 2026-09-06
author: jw
phase: "v0.5.0 target"
module: backend/app/services/bpm_service.py
lifecycle: spec-anchored
tier: M
tags: bpm, beatgrid, drift, acceptance
---

# SPEC-BPM-003 수용 기준

| 항목 | 내용 |
|------|------|
| SPEC ID | SPEC-BPM-003 |
| 형식 | Given-When-Then + 기계 검증 명령 |
| 원칙 | 모든 기준은 **명령 + 기대 결과** 쌍을 가지며, 실패할 수 있는 형태로 진술된다 |
| 추적 | 각 AC 제목에 검증 대상 요구사항 id를 명기한다 (1.2.0 — 감사 D8) |
| 실패 가능성 | [HARD] 각 기준은 "이 명령이 실패하려면 무엇이 참이어야 하는가"에 답할 수 있어야 한다. 답이 "없음"이면 그 기준은 통과가 아니라 결함이다 (1.3.0) |
| grep 부재 검사 | [HARD] `exit=1`(매치 없음)만 통과다. **`exit=2`는 검사 불발이며 통과가 아니다** — 정규식 거부나 파일 열기 실패이고, 둘 다 "매치 없음"과 구별되지 않는 0건 출력을 낸다 (1.3.0) |

> 본 문서는 SPEC 1.4.0 기준이다. 1.1.0에서 전제 네 건이, 1.2.0에서 독립 계획 감사 iter-1(FAIL 0.70)의 지적 20건이, 1.3.0에서 iter-2(PASS 0.91)의 신규 SHOULD-FIX 3건이 반영되었다. 근거는 spec.md 0절.
>
> **1.4.0 (2026-09-06, sync 단계) — 문서와 구현의 불일치 정정 4건.** run 단계에서 관측되었으나 수용 기준 본문 수정은 run의 권한이 아니어서 이월된 건들이다. 넷 다 **문서가 실제와 어긋났던 것이지 구현을 바꾼 것이 아니다** — 이 개정으로 코드는 한 줄도 변경되지 않았다.
>
> | # | 위치 | 정정 내용 |
> |---|------|----------|
> | 1 | AC-BPM-007 (a-2), Definition of Done | pinned 테스트가 **3건이 아니라 4건**이다. 리드 결정으로 추가된 `test_confidence_upper_clamp_pinned`를 표에 넣고 기대 문구를 4건으로 고쳤다. 지정된 3건은 뮤테이션에서 상한 클램프 `min(1.0, ...)`를 고정하지 못했다(생존자) |
> | 2 | AC-BPM-010 검증 명령 | `--cov` 대상 표기를 슬래시 `app/services/bpm_service`에서 점 `app.services.bpm_service`로 교정했다. 슬래시 표기는 **아무것도 측정하지 못하며**(`0.00%`, `exit=1`) 그 `0.00%`는 "커버리지 없음"이 아니라 "재지 못함"이다. 실측값은 92.45%. 임계 `--cov-fail-under=85`는 손대지 않았다 |
> | 3 | PRE-4 (c) | `--collect-only`는 **존재하지 않는 대상으로도 통과**하므로 실패할 수 없는 기준이었다. 실제 측정 + `TOTAL` 행 존재 + `0.00%` 부재를 함께 단언하는 형태로 재작성하고, 세 대상 대조로 판정력을 실측 확인했다 |
> | 4 | AC-BPM-010 프론트엔드 | 판정 **FAIL을 그대로 유지**하고 범위 경계만 기록했다. 기준을 넓혀 면제하지 않았다 — 무관함은 원인 설명이지 면제 사유가 아니다. 후속은 카드 `t2`·`t4` 소관 |
>
> 3번을 쓰는 과정에서 첫 초안이 고치려던 결함(실패할 수 없는 기준)을 그대로 물려받은 일이 있었고, 그 경과도 해당 절에 기록했다.
>
> **독립 sync 감사 판정: PASS-WITH-DEBT** (차단 결함 0건 / Functionality 92 · Security 90 · Craft 88 · Consistency 82). 정정 4건은 모두 "주장한 것을 실제로 닫는다"로 판정되었다. 감사가 찾은 유일한 문서-구현 불일치 **D1**(`engine`이 화면에 표시된다고 읽히는 서술 2곳 — `README.md`, `spec.md` 4.3절)은 문서를 구현에 맞추는 방향으로 해소했다. `engine`이 실제로 출하된 범위는 **API 응답 계층까지**이며 스토어(`BpmState`)와 패널은 이 필드를 읽지 않는다.

---

## 실행 계약 — 각 명령을 어디서 돌리는가

[HARD] **1.1.0의 "모든 명령은 워크트리 루트에서 실행한다"는 지시를 철회한다.** 워크트리 `.claude/worktrees/t1`에는 이 문서가 쓰라고 지시한 자산 대부분이 없다. 직접 확인한 것:

```bash
$ cd .claude/worktrees/t1
$ ls -d backend/.venv              → No such file or directory
$ ls -d node_modules               → No such file or directory
$ ls -d metronome-update-plan-docs → No such file or directory
```

셋 다 git untracked이므로 워크트리에 복제되지 않는다. spec.md 6.2절이 이 사실을 스스로 적어 놓고도 수용 기준은 그것을 쓰라고 지시했다 — 두 진술이 양립하지 않았다.

### 두 실행 그룹

| 그룹 | 필요한 것 | 실행 위치 | 이 문서에서 |
|------|----------|----------|-----------|
| **W** | git 추적 파일만 (`git`, `grep`, `test -f`, `ls`) | 워크트리·주 체크아웃 **어디서든** 동일 | 명령 블록에 `# [W]` 표기 |
| **P** | untracked 자산 — `backend/.venv`(Python·pytest·madmom·librosa), `node_modules`(`npx tsc`·`npm test`), 포팅 원본 `metronome-update-plan-docs/` | **주 체크아웃 전용**: `/Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2` | 명령 블록에 `# [P]` 표기 |

**그룹 P 명령의 기준 디렉터리는 주 체크아웃 루트다.** 아래 모든 P 명령은 그 루트에서 시작한다고 가정하며, `cd backend`가 붙은 것은 그 하위로 내려간 뒤의 상대 경로다.

전수 분류:

| 그룹 | 해당 기준 |
|------|----------|
| **W** | PRE-3, AC-BPM-001, AC-BPM-003 (b), AC-BPM-004 추가검증, AC-BPM-005 (a)(f), AC-BPM-007 (a) diff 부분, AC-BPM-009 (a)(b)(c) |
| **P** | PRE-1, PRE-2, PRE-4, AC-BPM-002, AC-BPM-003 (a)(c), AC-BPM-004 테스트, AC-BPM-005 (b)(c)(d)(e)(g), AC-BPM-006 전체, AC-BPM-007 (a) 테스트 부분·(b), AC-BPM-008, AC-BPM-009 의존성 파싱·(d), AC-BPM-010 |

### 왜 워크트리 프로비저닝(PRE-0)을 택하지 않았는가

`.venv`와 `node_modules`를 워크트리에 만드는 절차를 PRE-0으로 두는 대안도 있었으나 채택하지 않았다. madmom이 도는 Python 3.13.11 환경을 재구성하는 일 자체가 이 카드보다 크고(호환 shim에 의존하는 설치이므로 재현 실패 시 진단이 또 하나의 작업이 된다), 그 절차의 성공 여부를 다시 검증하는 기준이 필요해진다. **실행 위치를 나누는 쪽이 검증 가능한 명령으로 진술된다.**

### 인터프리터

Python을 호출하는 모든 명령(전부 그룹 P)은 백엔드 런타임 `backend/.venv/bin/python`(Python 3.13.11)을 쓴다. madmom은 이 환경에서만 동작하므로, 다른 인터프리터로 측정한 결과는 madmom 경로의 증거가 되지 못한다. `cd backend` 이후에는 `.venv/bin/python`으로 쓴다.

### 캐시는 워크트리 격리를 받지 않는다

`/tmp/bpm_cache`는 머신 전역 경로이므로 워크트리와 주 체크아웃이 **같은 캐시를 공유한다.** 어느 쪽에서 만든 캐시든 다른 쪽 측정을 가릴 수 있으므로, PRE-1의 `rm -rf`는 위치와 무관하게 매 측정 전에 수행한다.

---

## 공통 전제

### PRE-1: 캐시 비우기

```bash
# [P] 주 체크아웃. 단 /tmp/bpm_cache 는 머신 전역이라 위치와 무관하게 같은 캐시를 지운다.
rm -rf /tmp/bpm_cache
```

드리프트·성능을 측정하는 모든 기준(AC-BPM-006, AC-BPM-008)은 이 명령을 선행한다. 캐시 히트는 분석 경로를 통째로 건너뛰므로, 비우지 않은 측정은 증거가 아니다.

### PRE-2: madmom 가용성 판정 (shim 경로로 판정할 것)

```bash
# [P] 주 체크아웃 루트에서 시작
cd backend && .venv/bin/python -c "import sys; sys.path.insert(0,'.'); from app.services import bpm_service as b; print('MADMOM_AVAILABLE =', b._MADMOM_AVAILABLE); print('LIBROSA_AVAILABLE =', b._LIBROSA_AVAILABLE); print('interpreter =', sys.executable)"
```

**기대 결과 (확인된 값):** `MADMOM_AVAILABLE = True`, `LIBROSA_AVAILABLE = True`. `np.object` shim에서 나오는 `FutureWarning`은 정상이며 실패가 아니다.

- `MADMOM_AVAILABLE = True` → **분기 A**. madmom 경로 기준을 **실제 실행으로 검증한다.** 이것이 현재 머신에서 확인된 상태다.
- `MADMOM_AVAILABLE = False` → **분기 B**(예비). 다른 머신에 `backend/.venv`가 없거나 import가 회귀한 경우에만 해당한다. madmom 경로 기준을 모킹 단위 테스트로 대체하고, 대체 사실과 위 출력을 `progress.md`에 기록한다.

> **맨 `python -c "import madmom"`을 판정에 쓰지 않는다.** `bpm_service.py` 23-33행의 호환 shim을 거치지 않은 import는 Python 3.13에서 `ImportError: cannot import name 'MutableSequence' from 'collections'`로 **항상** 실패한다. madmom이 정상 동작하는 이 머신에서도 실패하므로, 그 실패를 "madmom 없음"으로 읽으면 분기 B로 잘못 빠진다. 1.0.0의 판정 명령이 이 형태였다.

출력의 인터프리터 경로도 함께 기록한다. 어떤 런타임에서 판정했는지가 확정되지 않으면 판정 자체가 증거가 되지 못한다.

### PRE-3: 기준 오디오 픽스처

```bash
# [W] git 추적 파일이므로 워크트리에도 존재한다
ls -l "music-source/Deep Purple  Smoke On the Water Official Music Video.mp3"
git ls-files --error-unmatch "music-source/Deep Purple  Smoke On the Water Official Music Video.mp3"; echo "tracked_exit=$?"
```

**기대 결과:** 파일 정보 출력 + `tracked_exit=0`.

이 파일이 리포지터리에서 git으로 추적되는 유일한 오디오이며, 본 SPEC의 기준 픽스처다. **추적되므로 워크트리에도 복제된다** — 실행 계약의 P 그룹 자산과 달리, 픽스처 부재를 걱정할 필요가 없다. "Hotel California"는 선택 기준(AC-BPM-006-OPT)의 보조 드리프트 측정에서만 다루며, ×2 오검출 검증은 칸반 카드 `t10` 소관이다(spec.md 11절).

### PRE-4: `pytest-cov` 선언 및 설치 (REQ-BPM-006 (b))

AC-BPM-010의 커버리지 검증이 실행 가능한 상태인지 확인한다. 감사 D4 재현 결과, 1.1.0 시점에는 선언도 설치도 없어 `--cov=` 인자가 `error: unrecognized arguments`로 즉시 실패했고 85% 목표 전체가 검증되지 않은 채였다.

**(a) 선언 확인:**

```bash
# [W]
grep -n "^pytest-cov" backend/requirements.txt; echo "exit=$?"
```

**기대 결과:** 1행 출력(`pytest-cov>=5.0` 형태), `exit=0`. 매치가 없으면 **실패**다.

**(b) 설치 확인:**

```bash
# [P]
backend/.venv/bin/python -c "import pytest_cov; print('pytest_cov', pytest_cov.__version__)"; echo "exit=$?"
```

**기대 결과:** 버전 출력, `exit=0`. `ModuleNotFoundError`면 **실패**다.

**(c) 측정 효력 확인 (선언·설치가 실제로 커버리지를 재는지):**

```bash
# [P] --collect-only 가 아니라 실제 측정을 수행한다. 파이프에 물리지 않는다 —
#     물리면 종료 코드가 마지막 명령의 것으로 덮인다.
#     --cov-fail-under 는 여기서 품질 기준이 아니라 판정 장치다: 이 인자가 있어야
#     coverage 가 "Total coverage: NN%" 행을 출력하므로, 없으면 아래 3번 검사가
#     대상 부재와 정상 측정을 구별하지 못한다(1.4.0에서 직접 확인).
cd backend && .venv/bin/python -m pytest tests/test_bpm.py -q \
  --cov=app.services.bpm_service --cov-report=term --cov-fail-under=85 \
  > /tmp/pre4c.txt 2>&1; echo "exit=$?"
grep -qE '^TOTAL +[0-9]+ +[0-9]+ +[0-9]+%' /tmp/pre4c.txt; echo "total_row=$?"
grep -q "Total coverage: 0\.00%" /tmp/pre4c.txt; echo "zero_coverage=$?"
grep -E "^TOTAL|Total coverage:" /tmp/pre4c.txt
```

**기대 결과:** 세 값이 모두 아래와 같아야 하며, 하나라도 어긋나면 **실패**다.

| 검사 | 기대 | 어긋났을 때의 뜻 |
|------|------|----------------|
| `exit=0` | `0` | 테스트 실패 또는 커버리지 임계 미달 |
| `total_row=0` | `0` (= `TOTAL nnn nn nn%` 행이 **있음**) | 측정 대상이 매칭되지 않아 **아무것도 재지 못함** |
| `zero_coverage=1` | `1` (= `Total coverage: 0.00%` 문자열이 **없음**) | 측정 대상이 비어 0%로 떨어짐 |

(a)(b)가 통과해도 이 명령이 실패하면 AC-BPM-010은 통과로 표기할 수 없다.

**이 기준이 실제로 실패할 수 있음을 확인한 실측 (1.4.0, 세 대상 대조):**

| `--cov` 대상 | `exit` | `total_row` | `Total coverage:` | 판정 |
|-------------|--------|-------------|-------------------|------|
| `app.services.bpm_service` (교정된 점 표기) | `0` | `0` | `92.45%` | **통과** |
| `app/services/bpm_service` (1.3.0까지의 슬래시 표기) | `1` | `1` | `0.00%` | **실패** |
| `totally/nonexistent/target` (존재하지 않는 대상) | `1` | `1` | `0.00%` | **실패** |

**[HARD] (c) 재작성 근거 (1.4.0).** 1.3.0까지 (c)는 `--collect-only`였고, 이 문서는 그것에 "선언·설치가 실제 효력을 갖는지" 확인하는 실효성 관문의 지위를 부여했다. **그러나 `--collect-only`가 확인하는 것은 "pytest가 `--cov` 인자를 거부하지 않았다" 하나뿐이다.** pytest는 인자를 받아들이기만 하고 그 대상이 매칭되는지는 보지 않는다. 리드가 재현한 실측:

```
--cov=app/services/bpm_service     --collect-only → exit=0   (그러나 실측정은 0.00%, exit=1)
--cov=totally/nonexistent/target   --collect-only → exit=0   ← 존재하지 않는 대상으로도 통과
```

**존재하지 않는 대상으로도 통과하므로, 이 기준은 실패할 수 없었다.** 이 문서의 [HARD] 원칙("각 기준은 '이 명령이 실패하려면 무엇이 참이어야 하는가'에 답할 수 있어야 한다. 답이 '없음'이면 그 기준은 통과가 아니라 결함이다")에 정면으로 걸리는 형태다. 실제로 커버리지 미측정을 막은 것은 (c)가 아니라 AC-BPM-010의 `--cov-fail-under=85` 임계였다.

**재작성 과정에서 같은 양식이 한 번 더 나왔다 (기록).** 1.4.0의 첫 초안은 `--cov-fail-under` 없이 실측정만 돌리고 `Total coverage: 0.00%` 부재를 단언하는 형태였다. 실행해 보니 **임계 인자가 없으면 coverage 가 `Total coverage:` 행 자체를 출력하지 않아**, 슬래시 표기에서도 그 문자열이 없어 검사가 통과했다(`exit=0`, `zero_coverage_match=1`). 즉 첫 초안 역시 존재하지 않는 대상을 걸러내지 못했다 — 고치려던 결함을 그대로 물려받은 형태이며, `progress.md`의 「결함을 고치려고 만든 장치가 같은 결함을 가진 사례」와 같은 구조다. 위 최종 형태는 임계 인자를 판정 장치로 되살리고 `TOTAL` 행 존재를 추가로 단언해 세 대상 전부에서 판정력을 갖는 것을 실측으로 확인했다.

---

## AC-BPM-001: `_smooth_beats` 완전 제거 — 검증 대상 **REQ-BPM-001**

```gherkin
Scenario: 전역 재구성 코드가 코드베이스에 남아 있지 않다
  Given 변경이 완료된 backend/ 트리
  When _smooth_beats 식별자를 전수 검색한다
  Then 어떤 파일에서도 발견되지 않는다
```

**검증 명령:**

```bash
# [W]
grep -rn "_smooth_beats" backend/ ; echo "exit=$?"
```

**기대 결과:** 출력 없음, `exit=1` (grep의 "매치 없음"). `exit=0`이면 실패.

**누적 합산 패턴 검사 (1.2.0에서 재작성 — 감사 D7).** 1.1.0은 원본 변수명 리터럴 `smoothed_beats[i + 1] = smoothed_beats[i]`를 그대로 grep했다. 그 검사는 "이름만 바뀐 변형을 잡겠다"고 선언해 놓고 정확히 그 경우를 놓친다 — 변수명이 바뀌면 매치되지 않고, 함수를 지우면 어차피 항상 통과한다. 변수명에 의존하지 않는 형태로 바꾼다.

```bash
# [W] 변수명과 무관하게 "같은 배열의 앞 원소 + 간격"을 뒷 원소에 대입하는 형태를 잡는다.
#     식별자는 \w+ 로 두고, 좌변 인덱스가 i+1, 우변 인덱스가 i 인 자기참조 누적만 매치한다.
#     [HARD] -P (PCRE) 로 실행할 것. 역참조 \1 은 POSIX ERE 에 없는 확장이며,
#     -E 로 실행하면 이 머신의 grep(ugrep 7.8.4)에서 "invalid escape" 로 exit 2 가 난다.
grep -rnP '(\w+)\[\s*i\s*\+\s*1\s*\]\s*=\s*\1\[\s*i\s*\]' backend/app/services/bpm_service.py; echo "exit=$?"
```

**기대 결과:** 출력 없음, `exit=1`. 매치가 하나라도 있으면 **실패**다.

**`exit=2`는 통과가 아니라 검사 불발이다.** grep이 정규식을 거부했거나 파일을 열지 못한 경우이며, 이때는 "매치 없음"과 구별되지 않는 0건 출력이 나온다. `exit`가 0도 1도 아니면 그 자리에서 멈추고 원인을 해결한 뒤 다시 실행한다 — 0건 출력을 근거로 통과 표기하지 않는다. (1.3.0에서 확인: `-E` 판은 실제로 `exit 2`를 냈다. `grep -P` 가용성은 `grep --version`이 `-P:pcre2` 계열을 보고하는지로 확인한다.)

이 검사는 함수를 지워도 통과한다는 점에서 여전히 약하므로, **국소 보정이 원본 비트를 이동시키지 않는다는 실질 보증은 AC-BPM-002의 `test_repair_no_cumulative_shift`가 진다.** grep은 "축소판이 남았는가"의 1차 필터이고, 불변식 테스트가 본 방어선이다.

---

## AC-BPM-002: 국소 보정 불변식 — 검증 대상 **REQ-BPM-002, REQ-BPM-002-INV**

```gherkin
Scenario: 국소 보정이 보정 대상이 아닌 비트를 이동시키지 않는다
  Given 감지기 원본 비트 배열 original
  When _repair_beats(original)을 호출한다
  Then 중복 제거로 삭제된 비트를 제외한 original의 모든 값이 결과에 그대로 존재한다
  And 살아남은 값의 차이가 1e-9를 넘지 않는다
```

**검증:** `backend/tests/test_bpm.py`에 다음 테스트를 추가하고 통과시킨다. `# [P]`

| 테스트 | 입력 | 기대 |
|--------|------|------|
| `test_repair_preserves_original_beats` | 등간격 40비트 + 미세 지터 | 결과가 **중복 제거로 삭제된 비트를 제외한** 입력의 상위집합, 원본 값 오차 ≤ 1e-9 |
| `test_repair_interpolates_gap` | 한 지점의 간격을 2배로 벌린 배열 | 그 사이에 정확히 1개 삽입, 다른 비트 위치 불변 |
| `test_repair_drops_duplicate` | 한 지점에 0.3배 간격의 중복 비트 삽입 | 해당 중복 1개만 제거, 다른 비트 위치 불변 |
| `test_repair_no_cumulative_shift` | 60비트 배열, 보정 대상 없음 | 출력 == 입력 (배열 동등, 원소별 오차 ≤ 1e-9) |

```bash
# [P]
cd backend && .venv/bin/python -m pytest tests/test_bpm.py -k "repair" -v
```

**기대 결과:** 4개 테스트 모두 PASSED, exit 0.

---

## AC-BPM-003: `engine` 필드의 4계층 전파 — 검증 대상 **REQ-BPM-003**

```gherkin
Scenario: 감지 엔진 이름이 결과·캐시·API 스키마·프론트엔드 타입에 모두 존재한다
  Given BPM 분석이 librosa 경로로 수행된 상태
  When 결과를 직렬화하고 각 계층의 타입 정의를 확인한다
  Then engine 값이 "librosa"이고 네 계층 모두에 필드가 선언되어 있다
```

**검증 명령 (a) 런타임 값:**

```bash
# [P]
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
# [W]
grep -n "engine" backend/app/models/schemas.py
grep -n "engine" src/api/bpm.ts
```

**기대 결과:** 각각 1행 이상 출력. `schemas.py`는 `engine: str`(필수), `bpm.ts`는 `engine?: string`(선택)이어야 한다. 필수/선택이 뒤바뀌면 실패.

**검증 명령 (c) 프론트엔드 타입 체크:**

```bash
# [P] node_modules 가 필요하므로 주 체크아웃 전용
npx tsc --noEmit
```

**기대 결과:** exit 0, 오류 없음.

---

## AC-BPM-004: 구 스키마 캐시의 안전한 열화 — 검증 대상 **REQ-BPM-004**

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
# [P]
cd backend && .venv/bin/python -m pytest tests/test_bpm.py -k "cache" -v
```

**기대 결과:** 모두 PASSED.

**추가 검증 (`.get()` 사용 금지):**

```bash
# [W]
grep -n 'data.get("engine"' backend/app/services/bpm_service.py; echo "exit=$?"
```

**기대 결과:** 출력 없음, `exit=1`.

---

## AC-BPM-005: 드리프트 측정 스크립트 포팅 및 동작 — 검증 대상 **REQ-BPM-005**

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
# [W]
test -f scripts/measure_beatgrid_drift.py && echo FILE_OK || echo MISSING
git ls-files --error-unmatch scripts/measure_beatgrid_drift.py; echo "tracked_exit=$?"
```

**기대 결과:** `FILE_OK` 출력, 그리고 `git ls-files`가 경로를 출력하며 `tracked_exit=0`. 파일이 있어도 untracked면 **실패**다 — 원본이 untracked였던 것이 SPEC 1.0.0의 오판을 낳은 직접 원인이므로(spec.md 0절), 추적 등록은 협상 대상이 아니다.

**검증 명령 (b) JSON 계약:**

```bash
# [P] stdout 은 JSON 문서 하나만 담아야 한다. 안내·경고가 섞이면 json.load 가 실패한다.
rm -rf /tmp/bpm_cache
backend/.venv/bin/python scripts/measure_beatgrid_drift.py "music-source/Deep Purple  Smoke On the Water Official Music Video.mp3" --json \
  | backend/.venv/bin/python -c "import json,sys; d=json.load(sys.stdin); ks={'max_drift_ms','last_beat_drift_ms','mean_drift_ms','beat_count','matched_count','inserted_count','dropped_count','engine','service_inserted','service_dropped'}; assert ks <= d.keys(), f'missing: {ks - d.keys()}'; print('KEYS OK', d)"
```

**기대 결과:** `KEYS OK {...}` 출력, exit 0. 키 누락이면 AssertionError로 실패.

키가 5개에서 8개로 늘었다 — `matched_count` / `inserted_count` / `dropped_count`는 감사 D2 대응으로 신설된 항목이다(spec.md REQ-BPM-005 측정 정의).

**stdout 오염 검사 (감사 D13):**

```bash
# [P] 캐시가 없는 상태(안내 문구가 나올 조건)에서 stdout 이 오염되지 않는지 본다.
rm -rf /tmp/bpm_cache
backend/.venv/bin/python scripts/measure_beatgrid_drift.py "music-source/Deep Purple  Smoke On the Water Official Music Video.mp3" --json 2>/dev/null \
  | backend/.venv/bin/python -c "import json,sys; s=sys.stdin.read(); json.loads(s); print('STDOUT CLEAN')"
```

**기대 결과:** `STDOUT CLEAN` 출력, exit 0. 캐시 안내가 stdout으로 나가면 `json.loads`가 `JSONDecodeError`로 실패한다.

**검증 명령 (c) 단위 테스트:**

```bash
# [P]
cd backend && .venv/bin/python -m pytest tests/test_beatgrid_drift.py -v
```

**기대 결과:** plan.md M3의 케이스 전부 PASSED — **DDD 코어 1·2·5·6·7 + TDD 3·4 + 골든 대조 1건.** 1.1.0은 이를 "RED 5개 케이스"로 적었으나, 그 중 1·2·5는 신규 CLI 계약이 아니라 측정 코어·정규화 작업이므로 DDD 코어로 재분류되었다(감사 D10, spec.md 7절 P4).

**검증 명령 (d) 오류 경로:**

```bash
# [P] stdout 은 비어 있고 메시지는 stderr 로 나가야 한다
backend/.venv/bin/python scripts/measure_beatgrid_drift.py /nonexistent/file.mp3 2>/tmp/drift-err.txt; echo "exit=$?"
test -s /tmp/drift-err.txt && echo STDERR_HAS_MESSAGE || echo STDERR_EMPTY
```

**기대 결과:** `exit=` 이 0이 아님, `STDERR_HAS_MESSAGE` 출력. stdout에 아무것도 나오지 않아야 하며, 메시지가 stdout으로 새면 실패다.

**검증 명령 (e) `APP_DIR` 비의존 (정규화 (a)):**

```bash
# [P]
rm -rf /tmp/bpm_cache
unset APP_DIR && backend/.venv/bin/python scripts/measure_beatgrid_drift.py "music-source/Deep Purple  Smoke On the Water Official Music Video.mp3" --json > /tmp/drift-no-appdir.json; echo "exit=$?"
```

**기대 결과:** `exit=0`, `/tmp/drift-no-appdir.json`이 유효한 JSON. 원본은 `APP_DIR` 기본값으로 머신 고유 절대 경로(`~/Dev/my-project-01/guitar-mp3-trainer-v2`)를 갖고 있었다. 이 명령이 실패하면 정규화 (a)가 이루어지지 않은 것이다.

**검증 명령 (f) 머신 고유 경로 및 인터프리터 하드코딩 부재 (정규화 (a)(b) 양쪽):**

REQ-BPM-005의 정규화는 **두 지점**이다 — (a) `APP_DIR` 기본값의 머신 고유 절대 경로, (b) 사용법 문구의 `backend/.venv/bin/python` 인터프리터 하드코딩. 1.1.0은 `"Dev/my-project-01"` 단일 리터럴만 grep해서 (b)를 전혀 보지 못했다(감사 D14). `~/Dev/...` 경로가 사라져도 `backend/.venv/bin/python`이 인터프리터로 박혀 있으면 (b)는 미이행인데 검사는 통과했다.

```bash
# [W] (a) 머신 고유 절대 경로
grep -nE "Dev/my-project-01|Path\.home\(\)|/Users/" scripts/measure_beatgrid_drift.py; echo "exit=$?"
```

**기대 결과:** 출력 없음, `exit=1`.

```bash
# [W] (b) 특정 가상환경 인터프리터 하드코딩
grep -nE "\.venv/bin/python|/venv/bin/python" scripts/measure_beatgrid_drift.py; echo "exit=$?"
```

**기대 결과:** 출력 없음, `exit=1`. 사용법 문구·주석·docstring 어디에 남아 있어도 실패다. 두 검사 중 **하나라도** 매치가 나오면 정규화가 미완이다.

**검증 명령 (g) 포팅 무결성 — 골든 픽스처 대조 (DDD PRESERVE):**

1.1.0은 이 기준을 "차이가 있다면 그 원인을 명시 기록한다"로 썼고, 그 조항이 **어떤 차이도 통과시키므로 기준이 아니었다**(감사 D6). 게다가 PRESERVE의 정의가 spec.md(특성화 테스트)와 plan.md(수기 기록)에서 어긋나 있었다. 1.2.0은 정의를 **특성화 테스트 하나로 통일**하고(spec.md 6.3절), 대조를 자동 테스트 + 사전 고정 허용 오차로 바꿨다.

```bash
# [W] 골든 픽스처가 git 에 등록되어 있는가
git ls-files --error-unmatch backend/tests/fixtures/drift_baseline_smoke_on_the_water.json; echo "tracked_exit=$?"
```

**기대 결과:** 경로 출력 + `tracked_exit=0`.

```bash
# [P] 포팅본을 원본 계산 방식으로 돌려 골든과 대조
cd backend && .venv/bin/python -m pytest tests/test_beatgrid_drift.py::test_ported_matches_original_golden -v
```

**기대 결과:** PASSED, exit 0. 허용 오차는 **미리 못 박혀 있다.**

| 항목 | 허용 오차 | 초과 시 |
|------|----------|--------|
| `beat_count` | 0 (정확히 일치) | **FAIL** |
| 최대 이탈 ms | ≤ 0.5 (비트 반올림 상한) | **FAIL** |
| 마지막 비트 이탈 ms | ≤ 0.5 | **FAIL** |

**"원인을 적으면 통과" 조항은 없다.** 최근접 대응 일반화로 인한 차이는 이 대조에 나타나지 않는다 — 대조가 `--legacy-index-diff` 모드(원본의 인덱스 정렬 차분을 그대로 재현)에서 이루어지기 때문이다. 일반화가 값을 어떻게 바꾸는지는 plan.md M3 DDD 코어 케이스 1·2·6·7이 합성 입력으로 결정론적으로 판정한다. **"포팅이 측정을 바꿨는가"와 "일반화가 값을 바꿨는가"를 분리한 것이 이 기준의 요점이다.**

골든 픽스처를 만든 실행의 명령·원본 경로·인터프리터·시각은 `progress.md`에 출처 기록으로 남긴다. 그 기록은 PRESERVE 자체가 아니라 골든 값의 출처 증명이다.

---

## AC-BPM-006: 드리프트 기준 — 검증 대상 **REQ-BPM-001, REQ-BPM-002, spec.md 8절 NFR**

카드의 "640ms → 0ms"를 실패 가능한 두 기준으로 재진술한 것이다(spec.md 7절 P3).

### AC-BPM-006-BEFORE: 사전 기준선 (변경 전 코드에서 측정)

```gherkin
Scenario: 변경 전 코드에서 유의미한 드리프트가 실제로 측정된다
  Given _smooth_beats가 아직 _detect_with_madmom 안에서 호출되고 있는 상태
        (함수 정의가 남아 있는 것만으로는 부족하다 — 호출 경로에 살아 있어야 한다)
  And M3이 완료되어 측정 스크립트가 존재하는 상태
  And M2 IMPROVE가 아직 174행의 호출을 _repair_beats 로 교체하지 않은 상태
  When 기준 픽스처에 대해 드리프트를 측정한다
  Then max_drift_ms가 100 이상이다
```

**측정 시점 (1.2.0에서 정정 — 감사 D3).** 이 기준선은 **M2 IMPROVE의 선행 조건**으로 측정한다(M3 완료 직후, M2 착수 전). 1.1.0은 이를 M5(함수 삭제)에 묶었으나, 기준선을 죽이는 것은 삭제가 아니라 **M2의 호출 교체**다. M1→M2→M3→M4→M5 순으로 가면 측정 시점에 호출이 이미 없어 `max_drift_ms`가 ~0ms로 나오고, `≥ 100`은 충족 자체가 불가능해진다. 1.1.0의 Given("아직 제거되지 않은 상태")도 함수 정의를 가리켜 같은 오류를 담고 있었으므로 위와 같이 고쳤다.

**선행 확인 — 호출이 살아 있는가:**

```bash
# [W] 이 명령이 174행을 출력해야 아래 측정이 기준선으로서 의미를 갖는다
grep -n "_smooth_beats(beats)" backend/app/services/bpm_service.py; echo "exit=$?"
```

**기대 결과:** `174:    beats = _smooth_beats(beats)` 출력, `exit=0`. **출력이 없으면 측정하지 않는다** — 순서를 이미 어긴 것이므로 blocker로 보고한다. 이 확인 없이 얻은 ~0ms를 기준선으로 적으면 "결함이 없었다"는 거짓 증거가 된다.

```bash
# [P]
rm -rf /tmp/bpm_cache
git rev-parse HEAD
backend/.venv/bin/python scripts/measure_beatgrid_drift.py "music-source/Deep Purple  Smoke On the Water Official Music Video.mp3" --json | tee /tmp/drift-before.json
```

**기대 결과:** `max_drift_ms >= 100`. 출력 전문과 착수 시점 SHA를 `progress.md`에 verbatim 기록한다.

**측정 불가 시:** 추정값을 쓰지 않는다. `progress.md`에 gap으로 기록하고 AC-BPM-006-AFTER만을 근거로 삼는다. **다만 "순서를 어겨서 못 쟀다"는 gap 사유가 아니다** — 그 경우 M2의 호출 교체를 임시로 되돌려 측정한 뒤 다시 적용하고, 그렇게 했다는 사실을 함께 기록한다. gap은 순서를 지켰는데도 측정이 실패한 경우에만 쓴다.

다만 현재 머신에서는 **madmom이 동작하므로(PRE-2 분기 A) 이 기준선은 실제로 측정되어야 한다.** "madmom이 없어서 못 쟀다"는 이 머신에서 성립하지 않는 사유다. 그런 보고가 나온다면 인터프리터가 `backend/.venv/bin/python`이 아니었을 가능성을 먼저 의심한다. madmom이 없는 다른 머신(분기 B)에서만, librosa 경로가 원래 `_smooth_beats`를 호출하지 않으므로(F2) 기준선이 측정되지 않는 것이 정상이며 그 사실을 기록한다.

### AC-BPM-006-AFTER: 사후 기준 (필수)

```gherkin
Scenario: 변경 후 감지기 유래 비트가 감지기 출력과 반올림 오차 내에서 일치한다
  Given _smooth_beats가 제거되고 국소 보정만 남은 상태
  When 기준 픽스처에 대해 드리프트를 측정한다
  Then 감지기 원본에서 유래한 비트의 max_drift_ms가 1.0 이하이다
  And 보고된 inserted_count / dropped_count 가 보정 로그의 건수와 일치한다
```

**측정 대상의 한정 (1.2.0에서 정정 — 감사 D2).** 1.1.0은 `emitted` 전체의 최댓값에 1.0ms를 걸었다. 그런데 REQ-BPM-002의 누락 보간은 **감지기가 내놓지 않은 위치에** 비트를 넣으므로, 한 박 누락 구간에 하나만 끼워도 최근접 감지기 비트까지의 거리가 박 간격의 절반(120 BPM에서 약 250ms)이 된다. 최댓값 지표에서는 그 한 점이 판정을 지배하므로, **국소 보정이 한 번이라도 발동하는 곡에서 이 기준은 구성상 반드시 실패했다.** spec.md 4.1절이 인트로·브레이크다운의 비트 누락을 국소 보정 존치의 근거로 들고 있으니 이 발동은 예외가 아니라 예상된 동작이다.

1.0ms의 근거("소수점 3자리 반올림 → 상한 0.5ms")도 **살아남은 원본 비트에만** 성립하며 삽입 비트에는 적용되지 않았다. 그래서 REQ-BPM-005의 측정 정의가 `emitted`를 감지기 유래 / 삽입 두 부류로 나누고, 이 기준은 **전자만** 판정한다. 삽입·제거는 `inserted_count` / `dropped_count`가 별도로 답한다. 제거는 원래부터 이 지표를 부풀리지 않는다 — 지표가 `emitted`를 순회하므로 사라진 비트는 보이지 않는다.

```bash
# [P] 스크립트의 exit code 판정 대상은 "감지기 유래 비트의 max_drift_ms" 하나다.
rm -rf /tmp/bpm_cache
backend/.venv/bin/python scripts/measure_beatgrid_drift.py "music-source/Deep Purple  Smoke On the Water Official Music Video.mp3" --threshold-ms 1.0; echo "exit=$?"
```

**기대 결과:** `exit=0` (스크립트가 임계 초과 시 1을 반환하므로 이 명령 자체가 판정이다).

**보정 건수 대조 (기준이 삽입을 못 본 척하지 않게 하는 장치):**

```bash
# [P] 스크립트가 보고한 건수와 서비스가 남긴 보정 로그의 건수를 맞춘다.
rm -rf /tmp/bpm_cache
backend/.venv/bin/python scripts/measure_beatgrid_drift.py "music-source/Deep Purple  Smoke On the Water Official Music Video.mp3" --json \
  | backend/.venv/bin/python -c "
import json,sys
d = json.load(sys.stdin)
print('inserted=%(inserted_count)d dropped=%(dropped_count)d matched=%(matched_count)d beat_count=%(beat_count)d service_inserted=%(service_inserted)d service_dropped=%(service_dropped)d' % d)
assert d['matched_count'] + d['inserted_count'] == d['beat_count'], ('identity broken', d)
assert d['inserted_count'] == d['service_inserted'], ('insert count mismatch', d)
assert d['dropped_count'] == d['service_dropped'], ('drop count mismatch', d)
"
```

**기대 결과:** 값 출력, 세 단언 모두 통과, exit 0.

**세 단언의 판정력이 서로 다르다는 점이 이 기준의 핵심이다.**

| 단언 | 무엇을 잡는가 | 실패하려면 |
|------|-------------|-----------|
| `matched + inserted == beat_count` | 분류가 `emitted`를 빠짐없이 나누는지 | `beat_count != len(emitted)`이거나 분류가 비트를 흘림 — **`beat_count == len(emitted)`인 한 구성상 성립하므로 판정력이 약하다** |
| `inserted_count == service_inserted` | 스크립트가 "삽입"이라 부른 집합이 서비스가 실제로 삽입한 집합과 같은지 | 감지기 유래 비트가 오분류되어 삽입으로 넘어감 — **`MATCH_TOLERANCE_MS` 오설정이나 최근접 대응 결함이 여기서 잡힌다** |
| `dropped_count == service_dropped` | 제거 건수 일치 | 위와 같은 방향의 오분류 |

두 번째·세 번째가 실질 방어선이다. 첫 번째만으로는 **기준 위반 비트가 조용히 삽입으로 재분류되어 `max_drift_ms`에서 빠지는 경로**를 막지 못한다 — 그 경로가 열리면 AC-BPM-006-AFTER는 D2 수정 이전의 "구성상 통과하는 기준"으로 되돌아간다.

`service_inserted` / `service_dropped`는 `_repair_beats`가 반환한 건수(spec.md 4.1절)를 스크립트가 그대로 실은 값이므로, 이 대조는 사람이 로그를 눈으로 맞추는 절차가 아니라 명령 하나로 판정된다. 출력 전문은 `progress.md`에 기록한다.

임계 1.0ms의 근거: 코드가 비트를 소수점 3자리로 반올림하므로 **감지기 유래 비트**의 이론적 편차 상한은 0.5ms다. 1.0ms를 넘는다는 것은 그 비트들에 반올림 이외의 변환이 남아 있다는 뜻이며, 이 기준은 그때 실패한다. 이 기준이 실패 가능하다는 점은 다음으로 보장된다 — `_repair_beats`가 원본 비트를 조금이라도 이동시키면(예: 국소 중앙값으로 위치를 대체하는 축소판이 남으면) 감지기 유래 비트의 편차가 즉시 1.0ms를 넘는다.

### AC-BPM-006-OPT: Hotel California (선택 — 변경 없음)

운영자가 Hotel California 오디오를 제공한 경우에만 수행한다.

```bash
rm -rf /tmp/bpm_cache
# [P]
backend/.venv/bin/python scripts/measure_beatgrid_drift.py "<운영자 제공 경로>" --threshold-ms 1.0; echo "exit=$?"
```

**기대 결과:** `exit=0`. 파일이 제공되지 않으면 이 기준은 "미수행"으로 기록하며, 미수행은 실패가 아니다.

> **범위 경계.** 이 기준은 **드리프트 보조 측정일 뿐이며, ×2 오검출 판정을 포함하지 않는다.** Hotel California의 배속 오검출(감지 146.3 BPM 대 실제 약 75) 확인과 해결은 칸반 카드 `t10`("P4 ½/×2 버튼 + 오프셋 슬라이더 ±200ms")으로 이관되었다 — spec.md 11절 「Out of Scope — Hotel California ×2 오검출 검증」. 이 기준을 ×2 검증으로 확대 해석하지 않는다.

---

## AC-BPM-007: confidence 공식 동결 및 변화 관측 — 검증 대상 **REQ-BPM-007**

```gherkin
Scenario: 신뢰도 공식과 librosa 상한이 변하지 않고, 값의 변화만 기록된다
  Given _calculate_confidence(84행 정의) 안의 115행 공식과
        _detect_with_librosa(186행 정의) 안의 208행 상한 min(confidence, 0.8)
  When 본 SPEC의 변경을 적용한다
  Then 착수 시점 SHA 기준 diff 에 두 지점의 변경이 하나도 없다
  And 두 값을 실제 값으로 고정하는 테스트가 통과한다
  And 기준 픽스처의 confidence 값 변화가 관측 기록으로 남는다
```

**두 가지를 1.2.0에서 고쳤다.** (1) 감사가 재현한 대로 `git diff HEAD`가 **구성상 항상 통과**했다 — AC 검증 시점에는 M1~M6 변경이 이미 커밋된 것이 정상 흐름이므로 diff가 비어 있고, 파이프에 입력이 없으니 `grep -c`는 공식을 고쳤든 아니든 언제나 `0`을 낸다. (2) 병행 방어선도 없었다 — `TestConfidenceCalculation`은 `> 0.9` / `< 0.9` 두 부등호 단언뿐이라(`test_bpm.py:257,268`) `1.0 - cv`를 `1.0 - cv*0.5`로 바꿔도, 208행 상한을 `0.9`로 올려도 그대로 통과한다. 이는 1.0.0에서 잡아낸 "640ms→0ms"(구성상 성립하는 기준)와 같은 성격의 결함이 다른 자리에 살아남은 것이다.

**이 수정은 REQ-BPM-007을 약화하지 않는다 — 강화한다.** 동결이라는 설계 결정 자체는 그대로 두고, 그 동결을 강제하지 못하던 검사만 실제로 강제하게 바꾼다.

**검증 명령 (a) 공식 불변 — 착수 시점 SHA 기준 diff:**

```bash
# [W] BASE_SHA 는 M2 선행 조건에서 progress.md 에 기록한 착수 시점 SHA.
#     HEAD 가 아니라 이 SHA 를 기준으로 잡아야 커밋 이후에도 diff 가 비지 않는다.
#     progress.md 가 유일한 출처다 — /tmp 는 OS 가 비우므로 증거 경로로 쓰지 않는다.
BASE_SHA=$(grep -oE '^- base_sha: [0-9a-f]{7,40}$' .moai/specs/SPEC-BPM-003/progress.md | awk '{print $3}')
test -n "$BASE_SHA" || { echo "FAIL: progress.md 에 base_sha 기록이 없다 — 미검증(gap)"; exit 1; }
git diff "$BASE_SHA"..HEAD -- backend/app/services/bpm_service.py \
  | grep -cE "^[-+].*(def _calculate_confidence|1\.0 - cv|min\(confidence, 0\.8\))"
```

**기대 결과:** 출력이 `0`. 하나라도 나오면 **실패**다.

이 명령이 실제로 실패할 수 있음은 다음으로 보장된다 — `BASE_SHA`가 변경 착수 이전을 가리키므로 diff에는 M1~M6의 모든 변경이 담기고, 그 안에 위 세 패턴 중 하나라도 있으면 `grep -c`가 0이 아닌 값을 낸다. `BASE_SHA`가 `progress.md`에 기록되어 있지 않으면 이 기준은 **미검증(gap)** 이지 통과가 아니다.

**검증 명령 (a-2) 값 고정 테스트 (병행 방어선):**

diff는 파일이 옮겨지거나 커밋이 재작성되면 무력해지므로, 값 자체를 고정하는 테스트를 신설한다. `backend/tests/test_bpm.py`에 추가:

| 테스트 | 내용 | 기대 |
|--------|------|------|
| `test_confidence_formula_pinned` | 등간격이 아닌 알려진 비트 배열(예: `[0.0, 0.5, 1.1, 1.5, 2.1, 2.5]`)을 `_calculate_confidence`에 넣고, 같은 배열로 `1.0 - std/mean`을 **테스트 안에서 직접 계산**한 값과 비교 | `abs(actual - expected) <= 1e-12`. `1.0 - cv*0.5` 같은 변형이 들어오면 즉시 실패 |
| `test_librosa_confidence_cap_pinned` | `librosa.beat.beat_track` / `librosa.load` / `librosa.frames_to_time`을 패치해 **상한을 넘는** 신뢰도가 나오는 등간격 비트를 반환시키고 `_detect_with_librosa`를 실제로 호출 | 반환된 confidence가 정확히 `0.8`. 상한을 `0.9`로 바꾸면 실패한다 |
| `test_confidence_formula_pinned_boundaries` | 완전 등간격 배열 → `1.0`, 표준편차가 평균을 넘는 배열 → `0.0` (`max(0.0, ...)` 하한 클램프 고정) | 각각 정확히 `1.0` / `0.0` |
| `test_confidence_upper_clamp_pinned` (1.4.0 추가) | 비트가 **감소하는** 배열 `[5.0, 4.0, 3.1, 2.0, 1.1, 0.0]`을 `_calculate_confidence`에 넣는다. 감소 배열은 `mean_interval < 0`이므로 `cv < 0`이 되어 `1.0 - cv`가 1.0을 **초과**한다. 테스트는 먼저 `unclamped > 1.0`을 단언해 입력이 실제로 클램프를 건드림을 확인한 뒤, 결과를 검사한다 | `_calculate_confidence(descending) == 1.0`. 상한을 `min(2.0, ...)`으로 바꾸면 이 테스트만 실패한다 |

**(a-2)의 pinned 테스트는 3건이 아니라 4건이다 (1.4.0 정정).** 1.3.0까지 이 표는 3건만 지정했으나 실제 구현은 4건이며, 네 번째 `test_confidence_upper_clamp_pinned`는 run 단계에서 **리드 결정으로 추가**되었다(`progress.md` 「리드 결정 — pinned 4번째 추가」).

추가 이유는 문서 해석이 아니라 뮤테이션으로 확인된 사실이다. 지정된 3건은 REQ-BPM-007이 동결하는 표현식 `max(0.0, min(1.0, 1.0 - cv))` 중 **상한 클램프 `min(1.0, ...)` 조각을 고정하지 못한다.** `test_confidence_formula_pinned_boundaries`가 상한을 덮지 못하는 구조적 이유는 등간격 입력이 `cv == 0`이어서 `1.0 - cv`가 정확히 1.0이 되고, 잘라낼 초과분이 없어 클램프 연산 자체가 실행되지 않기 때문이다. 뮤테이션 `min(1.0, ...)` → `min(2.0, ...)`에서 3건 전부 통과했다(생존자). 네 번째를 넣은 뒤 같은 뮤테이션은 정확히 `test_confidence_upper_clamp_pinned` 한 건에서 실패한다.

```bash
# [P]
cd backend && .venv/bin/python -m pytest tests/test_bpm.py::TestConfidenceCalculation -v
cd backend && .venv/bin/python -m pytest tests/test_bpm.py -k "pinned" -v
```

**기대 결과:** 기존 `TestConfidenceCalculation` 전부 무수정 PASSED, 신설 pinned 테스트 **4건** PASSED (1.4.0 정정 — 1.3.0까지 3건으로 적혀 있었다). `-k "pinned"`의 수집 개수가 **4 selected / 4 passed**여야 하며, `0 selected`나 `no tests ran`은 통과가 아니라 미실행이다.

`test_librosa_confidence_cap_pinned`은 **`_detect_with_librosa`를 통째로 패치하지 않는다** — 패치하면 208행이 실행되지 않아 상한을 고정하지 못한다. librosa 호출부만 패치하고 함수 본문은 실제로 실행되게 한다(spec.md 6.3절 CT-2의 모킹 계층 원칙과 동일).

**검증 명령 (b) 값 변화 기록:**

변경 전후 각각 캐시를 비우고 분석해 `confidence` 값을 `progress.md`에 기록한다. 값이 낮아지는 것은 예상된 결과이며 실패가 아니다(spec.md 4.2절). 다만 `0.0 <= confidence <= 1.0` 범위는 유지되어야 한다.

```bash
# [P]
cd backend && .venv/bin/python -c "
from app.services.bpm_service import BpmService
r = BpmService(cache_dir='/tmp/bpm_cache_ac007').analyze('../music-source/Deep Purple  Smoke On the Water Official Music Video.mp3')
assert 0.0 <= r.confidence <= 1.0, r.confidence
print('confidence=', r.confidence, 'bpm=', r.bpm, 'engine=', r.engine)
"
```

**기대 결과:** 예외 없이 값 출력, exit 0.

---

## AC-BPM-008: BPM 값 및 성능 회귀 방지 — 검증 대상 **REQ-BPM-008, spec.md 8절 NFR(BPM 차이 ≤ 2.0)**

```gherkin
Scenario: 평활화 제거가 BPM 값과 분석 시간을 크게 흔들지 않는다
  Given 기준 픽스처
  When 변경 전후로 각각 5회 이상 BPM과 분석 소요 시간을 측정한다
  Then BPM 차이가 2.0 이하이고
  And 분석 시간 중앙값이 변경 전 중앙값의 1.05배를 넘지 않는다
```

**허용폭과 회차 (1.2.0에서 정정 — 감사 D9).** 1.1.0은 REQ-BPM-008을 "증가하지 않는다"(0%)로, 기대 결과를 `* 1.05`(5%)로 써서 두 문서가 어긋나 있었다. 5% 쪽으로 통일한 것은 측정 현실 때문이다 — madmom RNN+DBN 추론은 실행마다 수백 ms 흔들리므로 **1회 측정의 0% 판정은 코드가 아니라 그날의 머신 부하를 잰다.** 그래서 (1) 허용폭을 5%로 명시하고 (2) 각 5회 이상 측정해 중앙값끼리 비교한다. 이 기준은 실패할 수 있다 — 국소 보정이 O(n²) 형태로 잘못 구현되면 중앙값이 5%를 넘는다.

**측정 시점.** 변경 전 회차는 AC-BPM-006-BEFORE와 **함께**, M2 IMPROVE 착수 전에 수행한다. M2 이후에는 "변경 전"이 존재하지 않는다.

**검증 명령:**

```bash
# [P] 변경 전/후 각각 이 블록을 실행한다. 매 회차마다 캐시를 비운다.
cd backend && .venv/bin/python -c "
import time, statistics
from app.services.bpm_service import BpmService
import shutil
xs, bpms = [], []
for _ in range(5):
    shutil.rmtree('/tmp/bpm_cache', ignore_errors=True)
    t0 = time.perf_counter()
    r = BpmService().analyze('../music-source/Deep Purple  Smoke On the Water Official Music Video.mp3')
    xs.append(time.perf_counter()-t0); bpms.append(r.bpm)
print('elapsed_runs=%s' % ['%.3f' % x for x in xs])
print('elapsed_median=%.3f bpm=%.1f engine=%s' % (statistics.median(xs), bpms[0], r.engine))
"
```

회차별 원시 값과 중앙값을 변경 전/후 모두 `progress.md`에 기록한다.

**기대 결과:** `abs(bpm_after - bpm_before) <= 2.0`, `elapsed_median_after <= elapsed_median_before * 1.05`. `_smooth_beats`는 O(n·w) 루프였으므로 제거는 순감이며, 실제 기대값은 "증가 없음"이다 — 5%는 측정 잡음의 여유이지 목표가 아니다.

---

## AC-BPM-009: 의존성 선언 (환경 마커 없음) — 검증 대상 **REQ-BPM-006 (a)**

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
# [W]
grep -n "^madmom" backend/requirements.txt
```

**기대 결과:** 1행 출력. 매치가 없으면(여전히 주석) 실패.

**검증 명령 (b) 환경 마커 부재:**

```bash
# [W]
grep -n 'python_version' backend/requirements.txt; echo "exit=$?"
```

**기대 결과:** 출력 없음, `exit=1`. `python_version` 마커가 남아 있으면 **실패**다.

**의존성 파싱 검증:**

```bash
# [P]
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
# [W]
grep -n "3.13 비호환\|Cython 빌드 실패" backend/requirements.txt; echo "exit=$?"
```

**기대 결과:** 출력 없음, `exit=1`. "Python 3.13 비호환 (Cython 빌드 실패)"는 설치되어 import까지 성공하는 현 상태와 모순되며, 남겨 두면 다음 독자가 같은 오판을 반복한다.

**검증 명령 (d) 선언과 실제의 일치:**

PRE-2의 출력이 `MADMOM_AVAILABLE = True`임을 재확인해, requirements.txt의 선언이 실제 런타임 상태와 일치함을 보인다.

---

## AC-BPM-010: 회귀 및 커버리지 — 검증 대상 **REQ-BPM-006 (b), spec.md 8절 NFR(커버리지 85%)**

```gherkin
Scenario: 백엔드 테스트 전체가 통과하고 커버리지 목표를 만족한다
  Given PRE-4가 통과해 pytest-cov 가 선언·설치된 상태
  And 변경이 완료된 상태
  When 백엔드 테스트를 커버리지와 함께 실행한다
  Then 모든 테스트가 통과하고 bpm_service.py 커버리지가 85% 이상이다
```

[HARD] **PRE-4가 통과하지 않으면 이 기준은 통과로 표기할 수 없다.** 1.1.0 시점에는 `pytest-cov`가 선언도 설치도 되어 있지 않아 아래 명령이 `error: unrecognized arguments`로 즉시 실패했고, 85% 목표를 재는 유일한 수단이 실행 불가였다(감사 D4). 명령이 실행되지 않은 것은 gap이지 통과가 아니다.

**검증 명령:**

```bash
# [P] --cov 대상은 점 표기(모듈 경로)다. 슬래시 표기는 측정되지 않는다 — 아래 1.4.0 정정 참조.
cd backend && .venv/bin/python -m pytest tests/ -v \
  --cov=app.services.bpm_service --cov-report=term-missing --cov-fail-under=85; echo "exit=$?"
```

**기대 결과:** `exit=0`, 실패·에러 0건, `app/services/bpm_service.py` 커버리지 ≥ 85%.

**[HARD] `--cov` 대상 표기 정정 (1.4.0).** 1.3.0까지 이 명령은 슬래시 표기 `--cov=app/services/bpm_service`를 썼다. 그 표기는 **파일에도 패키지에도 매칭되지 않아 측정 대상이 비어 있다.** 같은 테스트 실행으로 두 표기를 대조한 실측:

| 표기 | 결과 |
|------|------|
| `--cov=app/services/bpm_service` (1.3.0까지의 문언) | `CoverageWarning: module-not-imported`, `Total coverage: 0.00%`, **`exit=1`** |
| `--cov=app.services.bpm_service` (1.4.0 교정) | `bpm_service.py 159 stmts / 12 miss / 92%`, `Total coverage: 92.45%`, **`exit=0`** |

**`0.00%`는 "커버리지가 없다"가 아니라 "재지 못했다"이다.** 두 상태는 같은 숫자로 나타나지만 전혀 다르며, 미측정을 0%로 읽으면 gap이 실패로 오인된다(그 반대 방향이었다면 gap이 통과로 오인되었을 것이다).

**임계 `--cov-fail-under=85`는 손대지 않는다.** 이 인자가 실제 방어선이었다 — 슬래시 표기의 `0.00%`가 임계에 걸려 `exit=1`로 떨어졌기 때문에 통과 표기 경로가 닫혔다. 실측값 **92.45%**(`bpm_service.py` 159 stmts / 12 miss / 92%)는 85% 목표를 충족한다.

`--cov-fail-under=85`를 붙인 이유는 판정을 사람의 눈이 아니라 exit code가 하도록 하기 위해서다. 이 인자가 없으면 커버리지가 60%여도 pytest는 exit 0을 내므로, "터미널에 찍힌 숫자를 읽고 통과로 적는" 경로가 열린다.

**프론트엔드 회귀:**

```bash
# [P] node_modules 가 필요하므로 주 체크아웃 전용
npx tsc --noEmit && npm test -- --run; echo "exit=$?"
```

**기대 결과:** 두 단계 모두 `exit=0`.

**[HARD] 범위 경계 기록 — 이 기준의 프론트엔드 부분은 FAIL이며, 본 카드에서 고치지 않는다 (1.4.0).**

**(a) 판정은 FAIL이다.** 실측은 `npx tsc --noEmit` → `exit=0`, `npm test -- --run` → **`exit=1`**, `Tests 1 failed | 259 passed (260)`. 실패 대상은 `tests/unit/core/MetronomeEngine.test.ts > 다운비트는 880Hz, 업비트는 440Hz로 재생해야 한다`. 기준이 "두 단계 모두 `exit=0`"이고 실측이 `exit=1`이므로 **판정은 FAIL이다.**

**(b) 이 카드 이전부터 있던 결함이다 (리드 재현).** run 레인은 diff로 인과를 배제했고(본 카드의 프론트엔드 변경은 `src/api/bpm.ts` 2행뿐이며, 실패 테스트와 그 대상 소스는 착수 이전 SHA 대비 바이트 동일), 리드는 **주 체크아웃 `main`(본 카드의 변경이 하나도 없는 트리)에서 같은 테스트를 실행해 `Tests 1 failed | 15 passed`로 동일하게 실패함을 확인했다.**

**(c) 후속 처리는 다른 카드 소관이다.** 실패 대상인 메트로놈 다운비트 주파수는 백로그 카드 **t2**(스템 메트로놈 배선)와 **t4**(다운비트 880Hz 활성화)가 다루는 영역이며, 그쪽에서 처리된다.

**(d) 기준을 넓히지 않은 이유.** "이 카드와 무관한 실패는 제외한다"로 기준을 재정의하지 **않았다. 무관함은 원인 설명이지 면제 사유가 아니다.** 원인을 알아냈다는 사실은 판정을 바꾸지 못하며, 판정을 바꾸면 다음에 같은 자리에서 생기는 진짜 회귀도 함께 통과하게 된다. 판정은 FAIL로 남기고 범위 경계만 기록한다.

---

## 요구사항 ↔ 수용 기준 추적 (1.2.0 신설 — 감사 D8)

1.1.0에서는 `grep -c "REQ-BPM" acceptance.md`가 `0`이었다. 추적이 오직 번호 규약(AC-BPM-00N ↔ REQ-BPM-00N)에만 의존했는데, 그 규약이 AC-006(REQ 없음)·AC-009/AC-010(둘 다 REQ-BPM-006)에서 깨져 있었다. 아래 표와 각 AC 제목의 명시 참조가 그 규약을 대체한다.

| 요구사항 | 검증하는 수용 기준 |
|---------|-----------------|
| REQ-BPM-001 (전역 재구성 제거) | AC-BPM-001, AC-BPM-006-AFTER |
| REQ-BPM-002 / -002-INV (국소 보정) | AC-BPM-002, AC-BPM-006-AFTER (보정 건수 대조) |
| REQ-BPM-003 (`engine` 노출) | AC-BPM-003 |
| REQ-BPM-004 (캐시 안전 열화) | AC-BPM-004 |
| REQ-BPM-005 (측정 스크립트 포팅) | AC-BPM-005 (a)~(g), PRE-3 |
| REQ-BPM-006 (a) madmom 선언 | AC-BPM-009, PRE-2 |
| REQ-BPM-006 (b) `pytest-cov` 선언 | **PRE-4**, AC-BPM-010 |
| REQ-BPM-007 (confidence 동결) | AC-BPM-007 (a)(a-2)(b) |
| REQ-BPM-008 (성능 회귀 금지) | AC-BPM-008 |
| spec.md 8절 NFR (커버리지 85%) | AC-BPM-010 |
| spec.md 8절 NFR (BPM 차이 ≤ 2.0) | AC-BPM-008 |
| spec.md 6.3절 (특성화 테스트 CT-1~CT-3) | AC-BPM-001 (CT-1 삭제), AC-BPM-003 (CT-3 갱신), plan.md M4 |

**역방향 확인:** 모든 REQ가 최소 하나의 AC에 대응하며, AC-BPM-006-OPT를 제외한 모든 AC가 최소 하나의 REQ 또는 NFR에 대응한다. AC-BPM-006-OPT는 선택 기준이며 미수행이 실패가 아니므로 대응 요구사항을 갖지 않는다.

---

## Definition of Done

- [ ] **실행 계약 준수**: 각 항목의 증거에 실행 위치(W/P)와 실제 작업 디렉터리를 함께 기록
- [ ] PRE-2: 판정 결과(분기 A/B)와 사용 인터프리터 경로를 `progress.md`에 기록
- [ ] PRE-3: 기준 픽스처 존재 + git 추적 확인
- [ ] **PRE-4: `pytest-cov` 선언 (a) + 설치 (b) + `--cov` 인자 수용 (c) 전부 확인** — 미확인이면 AC-BPM-010은 통과로 표기 불가
- [ ] AC-BPM-001: `grep -rn "_smooth_beats" backend/` 결과 없음 (exit 1) + **변수명 비의존 누적 합산 정규식** 매치 없음 — 출력 첨부
- [ ] AC-BPM-002: `_repair_beats` 불변식 테스트 4건 PASSED
- [ ] AC-BPM-003: `engine` 테스트 3건 PASSED + 4계층 타입 선언 확인 + `tsc --noEmit` exit 0
- [ ] AC-BPM-004: 구 캐시 열화 테스트 PASSED + `data.get("engine"` 부재 확인
- [ ] AC-BPM-005: 포팅본 존재 + **`git ls-files` 추적 확인** + **JSON 8키 계약** + **stdout 오염 없음** + 단위 테스트 + 오류 경로 + **`APP_DIR` 없이 실행 성공** + **정규화 (a)(b) 양쪽 grep 통과** + **골든 픽스처 대조 테스트 PASSED**(허용 오차 표 기준, 면제 조항 없음)
- [ ] AC-BPM-006-BEFORE: **M2 IMPROVE 착수 전에** 측정 — 선행 `grep`으로 174행 호출이 살아 있음을 확인한 출력 + 드리프트 JSON 전문 + **착수 시점 SHA** 첨부
- [ ] AC-BPM-006-AFTER: `--threshold-ms 1.0` 실행 exit 0 + **`matched + inserted == beat_count` 항등식 성립** + 보정 건수가 `logger.info` 기록과 일치
- [ ] AC-BPM-006-OPT: Hotel California 측정 또는 "미수행" 기록 (×2 오검출 검증은 카드 `t10` 소관 — 여기서 수행하지 않는다)
- [ ] AC-BPM-007: `TestConfidenceCalculation` 무수정 PASSED + **착수 시점 SHA 기준 diff 0줄**(`HEAD` 기준 아님) + **pinned 테스트 4건 PASSED**(1.4.0 정정) + 값 변화 기록
- [ ] AC-BPM-008: BPM 차이 ≤ 2.0 + **변경 전/후 각 5회 이상 회차별 값과 중앙값** 첨부, 중앙값 비 ≤ 1.05
- [ ] AC-BPM-009: `^madmom` 매치 1건 + **환경 마커 부재 확인** + 낡은 "3.13 비호환" 주석 정리 확인
- [ ] AC-BPM-010: 백엔드 전체 통과 + `--cov-fail-under=85` exit 0, 프론트엔드 회귀 통과

---

## 증거 기록 원칙

- 모든 체크 항목은 **실제로 실행한 명령과 그 출력**으로만 표시한다. 명령을 돌리지 않은 항목은 통과가 아니라 gap이다.
- 캐시를 비우지 않고 측정한 드리프트·성능 수치는 증거로 인정하지 않는다.
- madmom 미설치(PRE-2 분기 B)로 대체 검증한 항목은 "PASS"가 아니라 "PASS (모킹 대체)"로 구분해 기록한다. **다만 이 머신에서는 분기 A가 확인되었으므로, 분기 B 대체는 원칙적으로 나오지 않아야 한다.** 대체 기록이 나온다면 인터프리터를 잘못 골랐거나 맨 `import madmom`으로 판정했을 가능성을 먼저 확인한다.
- `backend/.venv/bin/python`이 아닌 인터프리터로 측정한 madmom 경로 수치는 증거로 인정하지 않는다. madmom은 그 환경에서만 동작하므로, 다른 인터프리터의 결과는 librosa 경로의 값이다.
- **파일·환경의 부재를 주장할 때는 주 체크아웃에서 확인한 결과를 근거로 든다.** 워크트리에는 git untracked 파일이 복제되지 않으므로, 워크트리에서만 관측한 "없음"은 부재의 증거가 아니다. SPEC 1.0.0의 전제 네 건이 모두 이 착오였다(spec.md 0절).
- **반대로, 워크트리에 없는 자산을 쓰는 명령을 워크트리에서 돌리지 않는다.** 같은 원인의 반대 방향이며 1.1.0의 실행 지시가 이 형태였다(감사 D1). 그룹 P 명령의 증거에는 **실제 작업 디렉터리**(`pwd` 출력 또는 그에 준하는 기록)를 함께 남긴다 — 어디서 돌렸는지가 확정되지 않으면 그 출력은 증거가 되지 못한다.
- **"실행할 수 없었다"는 통과가 아니다.** 도구가 없어서(예: `pytest-cov` 미설치), 자산이 없어서(워크트리), 순서를 어겨서(사전 기준선) 명령을 돌리지 못한 항목은 전부 gap이다. gap은 무엇이 없었는지와 그 확인 명령의 출력을 함께 적는다.

---

*Generated by MoAI SPEC Builder (manager-spec)*
*Acceptance criteria date: 2026-09-05*
