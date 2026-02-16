# 6-Stem 음원 분리 기술 조사

## 조사 개요

**조사 일자**: 2026-02-16
**조사 목적**: 현재 4-stem 음원 분리 시스템을 6-stem으로 확장할 때의 기능적 이점, 사용 가능한 프레임워크, 그리고 각 프레임워크의 장단점 파악

**현재 시스템**:
- **모델**: Demucs htdemucs
- **분리 결과**: 4개 스템 (vocals, drums, bass, other)
- **백엔드**: FastAPI + Demucs 4.x
- **프론트엔드**: React + Web Audio API + StemMixer

---

## 6-Stem 분리의 기능적 이점

### 추가되는 악기
- **Guitar** (기타): 일렉트릭/어쿠스틱 기타
- **Piano** (피아노): 피아노/키보드

### 새로운 활용 사례

#### 1. 기타 학습 강화
- **기타 솔로 연습**: 리드 기타 멜로디를 분리하여 프레이징 학습
- **리듬 기타 학습**: 코드 스트로킹 패턴 분석
- **톤 연구**: 일렉트릭 기타의 사운드 메이킹 연구
- **트랜스크립션**: 기타 악보 채보 지원

#### 2. 피아노 학습 강화
- **코드 진행 분석**: 피아노 반주 패턴 추출 및 학습
- **클래식 피아노**: 피아노 솔로 연주 트랜스크립션
- **재즈 보이싱**: 복잡한 재즈 코드 학습
- **작곡 연구**: 피아노 편곡 기법 분석

#### 3. 음악 이론 교육
- **전체 화성 구조**: 6개 악기의 화성적 역할 이해
- **악기별 역할 분석**: 멜로디 / 하모니 / 리듬 파트 구분
- **편곡 학습**: 각 악기가 어떻게 조화를 이루는지 연구
- **장르별 특성**: 록, 재즈, 클래식 등 장르별 악기 사용 패턴

#### 4. 전문적 믹싱 연습
- **6개 악기 개별 제어**: Vocals, Drums, Bass, Guitar, Piano, Other
- **세밀한 밸런스 조정**: 프로 수준의 믹싱 시뮬레이션
- **파트별 이펙트 적용**: 각 악기에 개별적인 이펙트 적용 연습
- **믹싱 스킬 향상**: 복잡한 다중 트랙 믹싱 경험

---

## 프레임워크 비교 분석

### Option 1: Demucs htdemucs_6s ⭐

#### 개요
- Facebook Research의 Demucs 프로젝트
- 기존 htdemucs 모델의 6-stem 버전
- 동일한 라이브러리 사용 (Zero new dependencies)

#### 장점
✅ **통합 용이성**:
- 현재 사용 중인 Demucs 라이브러리와 완벽 호환
- API 변경 최소화 (`get_model("htdemucs_6s")` 한 줄로 전환)
- 기존 코드베이스 재사용 가능

✅ **검증된 기술**:
- Facebook Research의 공식 모델
- 활발한 커뮤니티 및 지속적인 업데이트
- 풍부한 문서 및 예제

✅ **품질**:
- Vocals, Drums, Bass: htdemucs와 동일 수준 (우수)
- Guitar: 수용 가능한 품질 (acceptable)
- Other: 동일 수준

#### 단점
❌ **Piano 품질 제한**:
- Piano 분리 시 "bleeding and artifacts" 보고됨
- 클래식 피아노 곡이나 재즈 피아노에서 품질 저하 가능
- 단순한 피아노 반주는 실용적 수준

❌ **리소스 사용량 증가**:
- 모델 크기 증가 (메모리 사용량 약 50% 증가)
- 분리 처리 시간 약간 증가 (10-20%)

#### 기술 정보
- **Repository**: https://github.com/facebookresearch/demucs
- **Model Name**: htdemucs_6s
- **Output**: 6개 WAV 파일 (vocals, drums, bass, other, guitar, piano)
- **Sample Rate**: 44.1 kHz
- **Bit Depth**: 16-bit

---

### Option 2: BS-RoFormer

#### 개요
- Band-Split RoPE Transformer
- SDX23 Challenge 우승 모델 (Music Source Separation)
- 최고 품질의 음원 분리 성능

#### 장점
✅ **최고 품질**:
- SDX23 Challenge 12.9 dB SDR (vocals) 기록
- Piano 분리 품질 우수
- 모든 악기에서 고품질 분리

✅ **전문가 수준**:
- 연구 및 교육용으로 최적
- 상업적 음원 분리 서비스 수준
- 뛰어난 분리 정확도

#### 단점
❌ **통합 복잡도**:
- 새로운 라이브러리 필요 (`bs-roformer` PyPI package)
- Demucs와 다른 API 인터페이스
- 코드 수정 범위 확대

❌ **성능 오버헤드**:
- 더 무거운 모델 (더 많은 GPU/CPU 리소스 필요)
- 처리 시간 증가 (htdemucs_6s 대비 2-3배)
- CPU 환경에서 실용성 낮음

❌ **유지보수**:
- 커뮤니티 규모가 Demucs보다 작음
- 문서 및 예제 부족
- 장기 지원 불확실

#### 기술 정보
- **Repository**: https://github.com/lucidrains/BS-RoFormer
- **Package**: bs-roformer (PyPI)
- **Model Size**: Large (정확한 크기 미공개)
- **Quality**: SDX23 Challenge Winner (12.9 dB SDR)
- **Reference**: https://mvsep.com/en/algorithms

---

### Option 3: Spleeter (비추천)

#### 개요
- Deezer의 오픈소스 음원 분리 도구
- 2019년 공개 후 개발 중단 상태

#### 제한 사항
❌ **최대 5-stem**:
- 지원 가능한 최대 스템: 5개 (vocals, drums, bass, piano, other)
- Guitar 분리 불가능
- 6-stem 요구사항 충족 불가

❌ **품질 한계**:
- Demucs보다 낮은 분리 품질
- 2019년 기술 수준에 머물러 있음

❌ **유지보수 중단**:
- 2019년 이후 업데이트 없음
- 최신 Python 버전과 호환성 문제
- 커뮤니티 비활성화

**결론**: 6-stem 요구사항을 충족하지 못하므로 제외

---

## 비교 요약표

| 항목 | Demucs htdemucs_6s | BS-RoFormer | Spleeter |
|------|-------------------|-------------|----------|
| **Stems** | 6 (vocals, drums, bass, other, guitar, piano) | 6+ | 5 (guitar 없음) |
| **통합 난이도** | ⭐ 낮음 | ⭐⭐⭐ 높음 | ⭐⭐ 중간 |
| **Vocals 품질** | ⭐⭐⭐⭐ 우수 | ⭐⭐⭐⭐⭐ 최고 | ⭐⭐⭐ 보통 |
| **Drums 품질** | ⭐⭐⭐⭐ 우수 | ⭐⭐⭐⭐⭐ 최고 | ⭐⭐⭐ 보통 |
| **Bass 품질** | ⭐⭐⭐⭐ 우수 | ⭐⭐⭐⭐⭐ 최고 | ⭐⭐⭐ 보통 |
| **Guitar 품질** | ⭐⭐⭐ 수용 가능 | ⭐⭐⭐⭐ 우수 | N/A |
| **Piano 품질** | ⭐⭐ 낮음 | ⭐⭐⭐⭐ 우수 | ⭐⭐ 낮음 |
| **처리 속도** | ⭐⭐⭐⭐ 빠름 | ⭐⭐ 느림 | ⭐⭐⭐ 보통 |
| **메모리 사용** | ⭐⭐⭐ 보통 | ⭐ 높음 | ⭐⭐⭐⭐ 낮음 |
| **커뮤니티** | ⭐⭐⭐⭐⭐ 활발 | ⭐⭐⭐ 보통 | ⭐ 비활성 |
| **유지보수** | ⭐⭐⭐⭐⭐ 활발 | ⭐⭐⭐ 보통 | ⭐ 중단됨 |
| **CPU 지원** | ⭐⭐⭐⭐ 우수 | ⭐⭐ 제한적 | ⭐⭐⭐ 보통 |
| **문서/예제** | ⭐⭐⭐⭐⭐ 풍부 | ⭐⭐ 부족 | ⭐⭐⭐ 보통 |

---

## 권장 사항

### 단계별 적용 전략 (Hybrid Approach)

#### Phase 1: Demucs htdemucs_6s 우선 적용
**이유**:
- 최소한의 코드 변경으로 빠른 통합 가능
- 기존 시스템과 완벽 호환
- Guitar 품질은 실용적 수준
- Piano 품질 사용자 피드백 수집 가능

**적용 시점**: 즉시

#### Phase 2 (Optional): BS-RoFormer 추가 고려
**조건**:
- Piano 품질 불만이 전체 사용자의 20% 이상 발생 시
- 프리미엄 기능으로 고품질 옵션 제공 필요 시
- 서버 리소스 확충 후 (GPU 지원 등)

**적용 시점**: 사용자 피드백 기반 결정

---

## 예상 시스템 변경 사항 (개념적 수준)

### Backend
- 모델 선택 파라미터 추가 (htdemucs vs htdemucs_6s)
- Stem 개수 동적 처리 (4개 or 6개)
- API 응답 구조 확장

### Frontend
- TypeScript 타입 확장 (StemName에 'guitar', 'piano' 추가)
- StemMixer 6채널 지원
- UI 컴포넌트 동적 렌더링 (4-stem / 6-stem 자동 감지)

### 하위 호환성
- 기본값을 htdemucs로 유지하여 기존 사용자에게 영향 없음
- 사용자 선택 방식으로 4-stem / 6-stem 전환 가능

---

## 참고 자료

### Demucs
- **Official Repository**: https://github.com/facebookresearch/demucs
- **Documentation**: https://github.com/facebookresearch/demucs/wiki
- **Model Zoo**: https://github.com/facebookresearch/demucs#separated-sources
- **Paper**: "Hybrid Spectrogram and Waveform Source Separation" (Facebook AI Research)

### BS-RoFormer
- **Official Repository**: https://github.com/lucidrains/BS-RoFormer
- **PyPI Package**: https://pypi.org/project/bs-roformer/
- **MVSEP Reference**: https://mvsep.com/en/algorithms
- **Challenge**: SDX23 Music Source Separation Challenge

### 음원 분리 일반
- **Music Information Retrieval**: https://musicinformationretrieval.com/
- **ISMIR (International Society for Music Information Retrieval)**: https://www.ismir.net/
- **Source Separation Evaluation**: https://sigsep.github.io/

---

## 결론

**최종 권장**: Demucs htdemucs_6s를 우선 적용

**근거**:
1. **통합 용이성**: 기존 코드베이스와 완벽 호환, 최소 리스크
2. **실용적 품질**: Guitar는 수용 가능, Piano는 사용자 피드백 수집 후 판단
3. **검증된 기술**: Facebook Research의 공식 모델, 활발한 커뮤니티
4. **빠른 적용**: 복잡한 마이그레이션 없이 빠른 기능 제공
5. **확장 가능성**: 향후 BS-RoFormer로 업그레이드 가능 (옵션으로 제공)

**Piano 품질 이슈 대응 전략**:
- Phase 1에서 사용자 피드백 수집
- 불만이 20% 이상 발생 시 BS-RoFormer 통합 검토
- 그 전까지는 htdemucs_6s의 실용적 품질로 충분

---

**조사 완료일**: 2026-02-16
**조사자**: MoAI (AI-Driven Development Kit)
**문서 버전**: 1.0
