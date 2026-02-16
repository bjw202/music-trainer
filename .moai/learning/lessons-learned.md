# Lessons Learned: Music Trainer 개발

## Executive Summary

Music Trainer 프로젝트는 5개의 SPEC을 통해 단계적으로 발전한 웹 기반 음악 연습 도구입니다. 약 2개월간 MVP부터 AI 음원 분리까지 구현하며, 초기 설계 실수로 인한 대규모 리팩토링(SPEC-PERF-001)을 경험했고, 이를 통해 귀중한 교훈을 얻었습니다.

**주요 성과:**
- 5개 SPEC 성공적 구현 (MVP → UPDATE → PERF → API → STEM)
- 287개 테스트 구축 (190 unit + 32 E2E + 65 backend)
- 3개 버전 릴리스 (v0.1.0 → v0.2.0 → v0.3.0)
- AI 기반 음원 분리 및 멀티트랙 믹서 구현

**핵심 교훈:**
초기 아키텍처 설계의 중요성. 오디오 버퍼링 문제를 해결하기 위한 SPEC-PERF-001 리팩토링은 MVP 단계에서 청크 기반 처리를 설계했다면 방지할 수 있었습니다.

---

## 1. 아키텍처 및 설계 결정

### 1.1 ✅ 성공: Skill-First 접근 방식

**실천 내용:**
구현 전 yt-dlp와 Demucs 관련 Skills을 먼저 작성하여 도메인 지식을 캡처하고, 이를 기반으로 백엔드 API를 구현했습니다.

**장점:**
- 도메인 전문 지식의 체계적 정리
- 구현 시행착오 감소
- 재사용 가능한 지식 자산 확보
- 다른 프로젝트로 쉽게 이전 가능

**권장사항:**
새로운 기술 스택이나 라이브러리를 도입할 때는 반드시 Skill 문서를 먼저 작성하고, 핵심 개념과 사용 패턴을 정리한 후 구현을 시작하세요.

---

### 1.2 ❌ 실수: 초기 오디오 처리 아키텍처

**문제:**
MVP(SPEC-MVP-001) 단계에서 청크 기반 스트리밍 아키텍처를 설계하지 않고, 전체 오디오 버퍼를 메모리에 로드하는 단순한 방식으로 시작했습니다.

**영향:**
- 대용량 파일(5분 이상) 로딩 시 브라우저 메모리 부족
- 재생 시작까지 긴 대기 시간
- 속도/피치 제어 추가 시(SPEC-UPDATE-001) 22개 테스트 실패
- SPEC-PERF-001 "실시간 스트리밍 아키텍처" 대규모 리팩토링 필요

**해결책:**
SPEC-PERF-001에서 전면 리팩토링:
- `ScriptProcessorNode` 기반 청크 처리 도입
- 스트리밍 버퍼 관리 시스템 구현
- 메모리 효율적인 오디오 파이프라인 재설계

**교훈:**
오디오/비디오/스트리밍 애플리케이션에서는 **프로토타이핑 단계에서 핵심 기술 가정을 검증**해야 합니다. 대용량 파일 처리, 실시간 변환, 메모리 제약 등 핵심 기술 요구사항을 MVP 설계에 반영하지 않으면 나중에 전체 아키텍처 재설계가 불가피합니다.

**권장사항:**
- **데이터 흐름 아키텍처를 FIRST 설계**: MVP 시작 전 데이터 파이프라인 다이어그램 작성
- **성능 제약 조건 사전 검증**: 최대 파일 크기, 메모리 한계, 실시간 처리 요구사항 테스트
- **Spike 프로토타입 작성**: 핵심 기술 스택(Web Audio API, AudioWorklet 등) 1-2일 검증 프로토타입 개발

---

### 1.3 Web Audio API 복잡성

**문제:**
`ScriptProcessorNode`는 deprecated API이지만, 대체 API인 `AudioWorklet`로 마이그레이션하지 못해 현재 22개 테스트가 여전히 실패 상태입니다.

**영향:**
- 장기적 브라우저 호환성 리스크
- 성능 최적화 한계
- 테스트 안정성 저하

**교훈:**
**Deprecated API 상태를 구현 전에 확인**하세요. Critical path에 deprecated API를 사용하면 기술 부채가 누적되며, 나중에 마이그레이션 비용이 훨씬 커집니다.

**권장사항:**
- 프로젝트 시작 전 핵심 API의 deprecation status 확인
- Can I Use, MDN Web Docs에서 브라우저 지원 상태 검증
- Deprecated API 사용 시 migration plan 사전 수립

---

## 2. 개발 워크플로우 인사이트

### 2.1 SPEC-Driven 개발

**구조:**
5개 SPEC를 통해 점진적 기능 확장:
1. SPEC-MVP-001: 기본 오디오 트레이너 (v0.1.0)
2. SPEC-UPDATE-001: 속도/피치 제어
3. SPEC-PERF-001: 실시간 스트리밍 아키텍처
4. SPEC-API-001: YouTube 통합 (v0.2.0)
5. SPEC-STEM-001: AI 음원 분리 (v0.3.0)

**장점:**
- 명확한 요구사항 추적
- 각 SPEC별 독립적 테스트 가능
- 버전별 릴리스 노트 자동 생성 용이
- 진행 상황 명확한 가시화

**과제:**
SPEC-PERF-001은 사실상 대규모 리팩토링이었습니다. MVP 단계에서 포함되었어야 할 내용이 별도 SPEC으로 분리된 케이스입니다.

**교훈:**
**MVP SPEC 작성 시 핵심 아키텍처 결정을 포함**시키세요. 성능 요구사항, 확장성 고려사항, 기술 스택 선택 이유를 MVP 문서에 명시적으로 기록하면 나중에 아키텍처 변경 필요성을 조기 발견할 수 있습니다.

---

### 2.2 점진적 기능 추가

**릴리스 전략:**
- v0.1.0: 코어 기능 (190 unit tests)
- v0.2.0: YouTube 통합 (65 backend tests 추가)
- v0.3.0: AI 음원 분리 (32 E2E tests 추가)

**장점:**
- 각 버전마다 안정적인 릴리스 포인트 확보
- 기능별 독립적인 테스트 가능
- 사용자 피드백 조기 수집 가능

**교훈:**
점진적 릴리스 전략은 잘 작동했습니다. 각 버전이 독립적으로 배포 가능한 상태를 유지하며, 새 기능 추가 시 기존 기능 회귀를 방지했습니다.

---

### 2.3 테스트 커버리지 진화

**테스트 전략 변화:**
- Phase 1 (MVP): 190개 unit tests로 시작
- Phase 2 (API): 65개 backend tests 추가
- Phase 3 (STEM): 32개 E2E tests 추가
- **총 287개 테스트**

**현재 상태:**
- 일부 테스트 실패 (ScriptProcessorNode deprecation 관련 22개)
- Known issues와 실제 regression 구분 필요

**교훈:**
**Known failures와 regression을 명확히 구분**하세요. CI/CD에서 deprecated API 관련 실패는 "expected failures"로 표시하고, 새로운 regression과 분리해야 팀이 실제 문제에 집중할 수 있습니다.

**권장사항:**
- `@skip` 또는 `@expectedFailure` 데코레이터로 known issues 표시
- CI 리포트에서 known failures 필터링
- Technical debt backlog에 migration task 등록

---

## 3. 공통 버그 패턴 및 예방

### 3.1 React Hooks 규칙 위반

**사례:**
LoadAudioModal에서 `useCallback`이 조건부 return 이후에 호출되어 "Hooks called in wrong order" 에러 발생.

**근본 원인:**
React Hooks는 항상 컴포넌트 최상단에서 동일한 순서로 호출되어야 하는데, early return 이후에 Hook을 배치함.

**예방 방법:**
- ESLint의 `eslint-plugin-react-hooks` 규칙 활성화
- Code review 시 Hooks 위치 체크
- React DevTools로 Hooks 호출 순서 검증

**수정 패턴:**
모든 Hook 호출(useState, useCallback, useEffect 등)을 컴포넌트 함수 최상단에 배치하고, 조건부 로직은 Hook 호출 이후에 작성.

---

### 3.2 백엔드 타입 핸들링

**사례들:**
1. YouTube download: `title=None` 상황에서 TypeError 발생
2. cleanup_service: dict와 dataclass 간 호환성 문제

**근본 원인:**
- Optional 타입에 대한 None 체크 부재
- 타입 가정(dict vs dataclass) 불일치

**예방 방법:**
- Python type hints 적극 활용 (`Optional[str]`)
- mypy 정적 타입 검사 도구 사용
- Runtime validation (Pydantic 모델)

**수정 패턴:**
- 명시적 None 체크: `if title is not None:`
- 타입 유연성 확보: dict와 dataclass 모두 처리 가능한 코드 작성

---

### 3.3 라이브러리 API 오용

**사례:**
Demucs `apply_model` 함수에 `segment=12` 파라미터를 전달했으나, 실제로는 모델 기본값(7.8초)을 사용해야 함.

**근본 원인:**
공식 문서를 충분히 읽지 않고, 예제 코드나 추측에 의존.

**예방 방법:**
- 공식 문서의 API reference 섹션 정독
- GitHub Issues에서 유사 사례 검색
- 엣지 케이스 테스트 작성

**수정 패턴:**
커스텀 파라미터를 제거하고 라이브러리 기본값을 사용. 필요 시 공식 문서에 명시된 방법으로 설정 변경.

---

### 3.4 상태 관리 버그

**사례:**
새 파일 로드 시 stem 상태가 리셋되지 않아, 이전 파일의 stem 믹서 상태가 남아있는 문제.

**근본 원인:**
파일 로드 코드 경로가 여러 개(LoadAudioModal, 드래그앤드롭)인데, 각 경로마다 상태 초기화 로직이 일관되지 않음.

**예방 방법:**
- 공통 작업을 단일 함수로 중앙화
- 상태 리셋 체크리스트 문서화
- E2E 테스트로 모든 경로 검증

**수정 패턴:**
`handleLoadNewFile` 래퍼 함수를 생성하여 모든 파일 로드 경로를 통합하고, 상태 초기화 로직을 한 곳에서 관리.

---

### 3.5 의존성 버전 충돌

**사례:**
`torchaudio 2.10.0`이 `torchcodec 0.10.0`을 암시적으로 요구하는데, 이를 명시하지 않아 설치 실패.

**근본 원인:**
암시적 의존성(implicit dependencies)이 문서화되지 않음.

**예방 방법:**
- `requirements.txt` 또는 `pyproject.toml`에 버전 고정
- Dependency graph 도구 사용 (pipdeptree)
- CI에서 clean install 테스트

**수정 패턴:**
의존성 파일에 명시적 버전 제약 추가:
```
torchaudio==2.10.0
torchcodec>=0.10.0
```

---

## 4. 기술 스택별 인사이트

### 4.1 Web Audio API

**복잡성:**
- AudioContext, sources, nodes의 복잡한 생명주기 관리
- Deprecated APIs (ScriptProcessorNode → AudioWorklet 마이그레이션 필요)

**교훈:**
브라우저 API는 빠르게 변화합니다. **최신 API 상태를 주기적으로 확인**하고, deprecated 경고를 무시하지 마세요.

**권장사항:**
- MDN Web Docs와 Can I Use를 정기적으로 체크
- Polyfill 또는 대체 API 마이그레이션 계획 수립

---

### 4.2 Python ML 라이브러리 (Demucs, PyTorch)

**과제:**
- CPU 전용 배포의 성능 제약
- 5MB 파일 처리에 5분 이상 소요

**교훈:**
ML 모델의 **실제 처리 시간을 과소평가하지 마세요**. CPU 환경에서는 GPU 대비 10-100배 느릴 수 있습니다.

**권장사항:**
- 타임아웃 설정 여유롭게 (최소 10-30분)
- 캐싱 시스템 구현 (파일 해시 기반)
- 사용자에게 현실적인 예상 시간 표시

---

### 4.3 FastAPI & SSE (Server-Sent Events)

**성공 사례:**
- SSE를 통한 실시간 진행률 스트리밍
- Async 백그라운드 작업 처리

**교훈:**
**일방향 업데이트에는 SSE가 WebSocket보다 단순**합니다. WebSocket의 복잡성(양방향 통신, 연결 관리) 없이 실시간 업데이트 구현 가능.

**권장사항:**
- 일방향 진행률 업데이트 → SSE
- 양방향 실시간 채팅 → WebSocket
- 단순 polling이 충분한 경우 → HTTP Long Polling

---

### 4.4 프론트엔드 상태 관리 (Zustand)

**성공 사례:**
6개 독립 store로 관심사 분리:
- audioStore, playerStore, controlStore, loopStore, youtubeStore, stemStore

**과제:**
Store 간 상태 동기화 시 규칙이 명확하지 않으면 버그 발생.

**교훈:**
**Store 경계와 상호작용 패턴을 문서화**하세요. 어느 store가 어떤 store를 구독하는지, 업데이트 순서는 어떻게 되는지 명시.

**권장사항:**
- Store dependency diagram 작성
- 각 store의 책임 범위 명확히 정의
- Cross-store update 패턴 표준화

---

## 5. 향후 프로젝트 권장사항

### 5.1 구현 전 단계

1. **도메인 전용 Skills 먼저 작성** (✅ 우리가 잘한 점)
2. **핵심 기술 아키텍처 프로토타이핑** (❌ 오디오 버퍼링 실수)
3. **Critical 라이브러리 API 검증** (❌ ScriptProcessorNode deprecation)
4. **데이터 흐름 다이어그램 설계** (SPEC-PERF-001에서 추가했어야 MVP에 포함)

---

### 5.2 구현 중

1. **공통 작업을 중앙화** (예: 파일 로딩, 상태 리셋)
2. **타입 힌트 및 런타임 검증 사용** (Python 백엔드)
3. **통합 지점을 조기 테스트** (YouTube → AudioEngine → StemMixer)
4. **Deprecated API 모니터링** (ScriptProcessorNode 문제)

---

### 5.3 테스팅 전략

1. **Unit/Integration/E2E 명확히 분리** (✅ 우리가 잘한 점)
2. **Known failures와 regressions 구분** (ScriptProcessorNode 테스트)
3. **외부 의존성 Mock 처리** (YouTube, Demucs를 빠른 테스트로)
4. **상태 전환 테스트** (stem mode on/off, file loading)

---

### 5.4 문서화

1. **CHANGELOG 상세 작성** (✅ 잘 유지됨)
2. **버그 수정 시 근본 원인 문서화** (✅ 실천함)
3. **Architecture Decision Records (ADR) 작성** (개선 여지)

---

## 6. 메트릭 및 성과

**테스트 커버리지:**
- Unit: 190개
- E2E: 32개
- Backend: 65개
- **총 287개 테스트**

**버그 밀도:**
3개 버전에서 5개 주요 버그 이벤트 = 약 **1.7 bugs/version**

**아키텍처 리팩토링:**
1개 대규모 리팩토링 (SPEC-PERF-001)

**기능 제공:**
5개 SPEC 성공적 구현

**코드 품질:**
- TypeScript strict mode
- 85%+ coverage 목표

---

## 7. 핵심 요약

1. ✅ **Skill-first 접근 방식 효과적**: yt-dlp와 Demucs Skills을 사전 작성하여 구현 효율성 향상
2. ❌ **설계 > 구현**: SPEC-PERF-001 리팩토링은 초기 설계로 방지 가능했음
3. ✅ **점진적 릴리스**: v0.1 → v0.2 → v0.3 구조 효과적
4. ❌ **API deprecation 리스크**: ScriptProcessorNode 문제 미해결
5. ✅ **타입 안전성 도움**: TypeScript strict mode가 많은 버그 조기 발견
6. ❌ **상태 관리 복잡성**: 여러 리셋 포인트가 버그 유발
7. ✅ **테스트 투자**: 287개 테스트가 신뢰성 제공
8. ❌ **성능 과소평가**: CPU 기반 Demucs가 5분+ 소요는 예상 밖

**최종 권장사항:**

미디어 처리 애플리케이션의 경우, **프로덕션 코드 작성 전에 아키텍처 설계 및 프로토타이핑에 충분히 투자**하세요. SPEC-PERF-001 리팩토링 경험이 이를 명확히 증명합니다.

청크 기반 스트리밍, 메모리 효율적 버퍼 관리, 실시간 처리 파이프라인 등 **핵심 아키텍처 결정은 MVP 단계에서 확정**되어야 하며, 나중에 변경하려면 막대한 비용이 듭니다.

---

**버전:** 1.0.0
**작성일:** 2026-02-16
**작성자:** MoAI Documentation Specialist
**프로젝트:** Guitar MP3 Trainer v2
