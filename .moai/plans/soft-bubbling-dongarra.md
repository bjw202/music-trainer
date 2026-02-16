# 6-Stem 음원 분리 기술 조사 및 구현 계획

## Context

### 현재 상태
- **구현된 기능**: Demucs htdemucs 모델로 4-stem 분리 (vocals, drums, bass, other)
- **아키텍처**: FastAPI 백엔드 + React/Web Audio API 프론트엔드
- **핵심 파일**:
  - Backend: `backend/app/services/separation_service.py`
  - Frontend: `src/core/StemMixer.ts`, `src/stores/stemStore.ts`
  - Types: `src/types/stem.ts`

### 사용자 요구사항
6-stem 분리 적용 시:
1. **기능적으로 어떤 부분이 가능한지?**
2. **어떤 프레임워크를 써야 하는지?**
3. **이 프로젝트에 어떻게 반영해야 할지?**

---

## 조사 결과 요약

### 6-Stem 분리의 기능적 이점

**추가되는 2개 악기**: Guitar, Piano

**새로운 활용 사례**:

1. **기타 학습 강화**
   - 기타 솔로/리프 분리 연습
   - 리듬 기타 패턴 학습
   - 어쿠스틱/일렉트릭 기타 톤 연구

2. **피아노 학습 강화**
   - 코드 진행 분석
   - 피아노 반주 학습
   - 클래식 피아노 트랜스크립션

3. **음악 이론 교육**
   - 전체 화성 구조 분석
   - 악기별 역할 이해 (멜로디/하모니/리듬)
   - 편곡 학습

4. **전문적 믹싱 연습**
   - 6개 악기의 개별 밸런스 조정
   - 프로 수준의 믹싱 시뮬레이션

---

## 프레임워크 비교 분석

### Option 1: Demucs htdemucs_6s ⭐ (권장)

**장점**:
- 기존 Demucs 라이브러리 활용 (Zero new dependencies)
- API 호환성 100% (`get_model("htdemucs_6s")` 한 줄로 전환)
- Guitar 품질: 수용 가능 (acceptable)
- Bass/Drums/Vocals 품질: htdemucs와 동일 수준
- 빠른 통합 (약 8일 소요)

**단점**:
- Piano 품질: 상대적으로 낮음 ("bleeding and artifacts" 보고됨)
- 모델 크기 증가 (메모리 사용량 50% 증가 예상)

**출처**:
- GitHub - facebookresearch/demucs: https://github.com/facebookresearch/demucs
- Demucs Model Zoo: htdemucs, htdemucs_6s 모델 제공

### Option 2: BS-RoFormer (미래 v2.0 고려)

**장점**:
- 최고 품질: SDX23 Challenge 우승 (12.9 dB SDR for vocals)
- Piano 품질 우수
- 음질 개선에 대한 사용자 요구 시 대응 가능

**단점**:
- 새로운 라이브러리 필요 (`bs-roformer` PyPI package)
- 다른 API 인터페이스 (Demucs와 호환 불가)
- 더 무거운 모델 (처리 속도 느림)
- 통합 난이도 높음 (약 15-20일 소요)

**출처**:
- GitHub - lucidrains/BS-RoFormer: https://github.com/lucidrains/BS-RoFormer
- MVSEP Algorithms: https://mvsep.com/en/algorithms

### Option 3: Spleeter (비추천)

**이유**:
- 최대 5-stem만 지원 (piano 없음)
- 2019년 이후 개발 중단 (abandoned)
- 품질이 Demucs보다 낮음

---

## 권장 구현 전략

### Hybrid Approach (단계별 적용)

**Phase 1: htdemucs_6s 통합 (v0.4.0)**
- 빠른 6-stem 분리 기능 제공
- Guitar 품질은 사용자에게 충분
- Piano 품질 사용자 피드백 수집

**Phase 2 (Optional): BS-RoFormer 추가 (v2.0)**
- Piano 품질 불만이 20% 이상 발생 시 고려
- 고품질 옵션으로 제공 (사용자 선택 가능)
- 프리미엄 기능으로 활용 가능

---

## 구현 계획 (8일 소요)

### Day 1-2: Backend Foundation

**파일**: `backend/app/services/separation_service.py`

**변경사항**:
1. 모델 선택 파라미터 추가
   ```python
   # 현재: STEM_NAMES = ["vocals", "drums", "bass", "other"]
   # 수정 후: 동적 처리
   STEM_NAMES_4 = ["vocals", "drums", "bass", "other"]
   STEM_NAMES_6 = ["vocals", "drums", "bass", "other", "guitar", "piano"]
   ```

2. 모델 로딩 로직 수정
   ```python
   def get_model(name: str = "htdemucs"):
       # htdemucs or htdemucs_6s 선택 가능
   ```

3. Dual model caching
   - htdemucs와 htdemucs_6s를 메모리에 동시 로드 (선택적)
   - 첫 요청 시 lazy loading

**API 엔드포인트 수정**:
- `POST /api/v1/separate?model=htdemucs_6s`
- 기본값: `model=htdemucs` (하위 호환성 유지)

### Day 3-4: Frontend Types and Store

**파일**:
- `src/types/stem.ts`
- `src/stores/stemStore.ts`

**변경사항**:
1. TypeScript 타입 확장
   ```typescript
   // 현재
   export type StemName = 'vocals' | 'drums' | 'bass' | 'other'

   // 수정 후
   export type StemName = 'vocals' | 'drums' | 'bass' | 'other' | 'guitar' | 'piano'
   ```

2. StemStore 인터페이스 확장
   - `StemData`, `StemGains`, `StemMuted`, `StemSolo` 모두 6-stem 지원

3. 색상 코딩 추가
   ```typescript
   export const STEM_COLORS = {
     vocals: 'violet',
     drums: 'red',
     bass: 'blue',
     other: 'emerald',
     guitar: 'orange',  // 신규
     piano: 'purple',   // 신규
   }
   ```

### Day 5-6: Core Audio Logic

**파일**:
- `src/core/StemMixer.ts`
- `src/hooks/useStemMixer.ts`

**변경사항**:
1. AudioBuffer 배열 크기 확장
   - 4개 AudioBufferSource → 6개로 확장
   - 6개 GainNode 추가

2. ScriptProcessorNode 채널 매핑 확장
   - 현재: 4채널 믹싱
   - 수정: 6채널 동시 믹싱

3. 동적 스템 로딩
   - API 응답에서 stems 개수 자동 감지
   - 4-stem 파일과 6-stem 파일 모두 지원

### Day 7: UI Components

**파일**:
- `src/components/StemMixer/StemMixerPanel.tsx`
- `src/components/StemMixer/StemTrack.tsx`

**변경사항**:
1. 동적 트랙 렌더링
   ```tsx
   {STEM_NAMES.map(stemName => (
     <StemTrack key={stemName} stemName={stemName} />
   ))}
   ```

2. 레이아웃 조정
   - 6개 트랙이 UI에 맞게 배치
   - 2열 3행 또는 3열 2행 그리드 레이아웃

3. 모델 선택 UI 추가
   - "4-Stem" / "6-Stem" 토글 버튼
   - 분리 시작 전 선택 가능

### Day 8: Testing & Documentation

**테스트 파일**:
- `tests/unit/core/StemMixer.test.ts`
- `tests/e2e/stem-separation.spec.ts`

**테스트 케이스**:
1. 6-stem 분리 전체 파이프라인 (E2E)
2. StemMixer 6채널 동시 재생
3. Guitar/Piano 개별 볼륨 제어
4. 4-stem 하위 호환성 검증

**문서 업데이트**:
- `README.md`: 6-stem 기능 추가 설명
- `CHANGELOG.md`: v0.4.0 릴리즈 노트
- `SPEC-STEM-002.md`: 6-stem 구현 SPEC 생성

---

## Critical Files (수정 필요 파일 목록)

### Backend (3 files)
1. `backend/app/services/separation_service.py` - 모델 로딩 및 분리 로직
2. `backend/app/routes/separation.py` - API 엔드포인트 수정
3. `backend/app/models/separation.py` - Pydantic 스키마 확장

### Frontend Core (5 files)
4. `src/types/stem.ts` - TypeScript 타입 정의
5. `src/stores/stemStore.ts` - Zustand 상태 관리
6. `src/core/StemMixer.ts` - 멀티트랙 오디오 엔진
7. `src/hooks/useStemMixer.ts` - 커스텀 훅
8. `src/api/separation.ts` - API 클라이언트

### Frontend UI (3 files)
9. `src/components/StemMixer/StemMixerPanel.tsx` - 믹서 패널 UI
10. `src/components/StemMixer/StemTrack.tsx` - 개별 트랙 컴포넌트
11. `src/components/StemMixer/SeparationButton.tsx` - 모델 선택 UI 추가

### Tests (2 files)
12. `tests/unit/core/StemMixer.test.ts` - 유닛 테스트
13. `tests/e2e/stem-separation.spec.ts` - E2E 테스트

**총 13개 파일** 수정 예상

---

## Verification Steps

### Phase 1: Backend Verification
1. `pytest backend/tests/services/test_separation_service.py`
2. 수동 테스트: `POST /api/v1/separate?model=htdemucs_6s`
3. 6개 스템 파일 생성 확인 (vocals, drums, bass, other, guitar, piano)

### Phase 2: Frontend Verification
1. `pnpm test:unit` - StemMixer 유닛 테스트
2. TypeScript 타입 체크: `pnpm typecheck`
3. 6개 트랙 UI 렌더링 확인

### Phase 3: Integration Verification
1. `pnpm test:e2e` - E2E 테스트 전체 통과
2. 실제 음원 업로드 → 6-stem 분리 → 개별 재생 테스트
3. 4-stem 파일과 6-stem 파일 모두 재생 확인

### Phase 4: Quality Gate
1. **LSP Quality Gate**: Zero errors, zero type errors
2. **TRUST 5 Validation**:
   - Tested: 85%+ coverage (StemMixer.test.ts, e2e tests)
   - Readable: TypeScript strict mode, 주석 추가
   - Unified: 기존 코드 스타일 유지
   - Secured: API 입력 검증 (model parameter whitelist)
   - Trackable: Conventional commit 메시지

---

## Risk Assessment

### Low Risk
- **기존 4-stem 하위 호환성**: 기본값을 htdemucs로 유지하면 기존 사용자에게 영향 없음
- **Demucs 라이브러리 안정성**: 이미 검증된 라이브러리

### Medium Risk
- **Piano 품질 불만**: 사용자 피드백에 따라 BS-RoFormer로 전환 필요할 수 있음
- **메모리 사용량 증가**: 6-stem 모델이 더 많은 RAM 소비 (약 50% 증가)

### Mitigation Strategy
- **사용자 선택권 제공**: 4-stem과 6-stem을 UI에서 선택 가능하게
- **점진적 롤아웃**: v0.4.0에서 6-stem을 베타 기능으로 출시, 피드백 수집 후 정식 기능으로 전환
- **성능 모니터링**: 분리 시간 및 메모리 사용량 로깅 추가

---

## Timeline Summary

| Day | Phase | Deliverable |
|-----|-------|-------------|
| 1-2 | Backend Foundation | separation_service.py, API endpoints |
| 3-4 | Frontend Types | stem.ts, stemStore.ts, STEM_COLORS |
| 5-6 | Core Audio Logic | StemMixer.ts, useStemMixer.ts |
| 7 | UI Components | StemMixerPanel.tsx, StemTrack.tsx |
| 8 | Testing & Docs | Unit tests, E2E tests, documentation |

**Total: 8 days**

---

## Recommendation

**Primary Choice**: Demucs htdemucs_6s
- 빠른 통합 (8일)
- 최소 의존성 변경
- Guitar 품질 수용 가능
- 기존 아키텍처와 완벽 호환

**Future Enhancement**: BS-RoFormer (v2.0)
- Piano 품질 불만이 20% 이상 발생 시 고려
- 고품질 옵션으로 제공 (선택적 기능)

---

## Next Steps

사용자 승인 후:
1. SPEC-STEM-002 문서 생성
2. `/moai run SPEC-STEM-002` 실행
3. DDD 방식으로 8일 일정으로 구현
4. 각 단계별 테스트 및 검증
5. 문서 동기화 (`/moai sync`)
6. v0.4.0 릴리즈

---

**Plan ID**: soft-bubbling-dongarra
**Created**: 2026-02-16
**Status**: Pending Approval
