# SPEC-BACKEND-001 구현 계획

<!-- @TAG SPEC-BACKEND-001 -->

## 개요

이 문서는 SPEC-BACKEND-001 "백엔드 프로덕션 안정화"의 구현 계획을 정의합니다. 세 가지 주요 문제(YouTube 봇 탐지, 환경변수 미설정, OOM)를 단계적으로 해결합니다.

---

## 우선순위별 마일스톤

### Phase 1: 환경변수 설정 및 YouTube 쿠키 인증 (Primary Goal)

**목표**: Railway 환경변수 설정으로 YouTube 다운로드 복원 및 프로덕션 설정 정상화

**우선순위**: Critical
**종속성**: 없음 (즉시 시작 가능)
**예상 복잡도**: Low (코드 변경 불필요)

**작업 항목**:

1. **YouTube 쿠키 추출**
   - 브라우저에서 youtube.com 로그인 후 쿠키 추출
   - Netscape 형식으로 내보내기
   - Base64 인코딩 실행
   - 완료 조건: Base64 문자열 확보

2. **Railway 환경변수 설정**
   - Railway CLI 로그인: `railway login`
   - 프로젝트 링크: `railway link fearless-appreciation`
   - 환경변수 설정:
     ```bash
     railway variable set YOUTUBE_COOKIES='<base64-encoded-cookies>'
     railway variable set CORS_ORIGINS='https://music-trainer-production.up.railway.app'
     ```
   - 완료 조건: `railway variable list` 확인

3. **환경변수 로드 검증**
   - Railway 배포 로그 확인: `railway logs`
   - YOUTUBE_COOKIES 로드 확인
   - CORS_ORIGINS 로드 확인
   - 완료 조건: 로그에서 환경변수 로드 확인

4. **YouTube 다운로드 기능 테스트**
   - 테스트 URL: https://www.youtube.com/watch?v=k04tX2fvh0o
   - API 호출:
     ```bash
     curl -X POST https://music-trainer-production.up.railway.app/api/v1/download \
       -H "Content-Type: application/json" \
       -d '{"url": "https://www.youtube.com/watch?v=k04tX2fvh0o"}'
     ```
   - 완료 조건: 다운로드 성공 응답 (200 OK)

**예상 소요 시간**: 10-15분
**리스크**: 쿠키 추출 권한 문제 (브라우저 확장 프로그램 필요 시)

---

### Phase 2: 메모리 효율적인 오디오 분리 구현 (Secondary Goal)

**목표**: Demucs split 옵션 적용으로 OOM 방지 및 안정적인 오디오 분리

**우선순위**: High
**종속성**: Phase 1 완료 (YouTube 다운로드 복원 필요)
**예상 복잡도**: Low (단일 라인 코드 변경)

**작업 항목**:

1. **separation_service.py 수정**
   - 파일 경로: `backend/app/services/separation_service.py`
   - 수정 위치: `apply_model()` 호출부
   - 변경 내용:
     ```python
     # 변경 전
     sources = apply_model(
         model,
         mix.to(device),
         device=device,
         shifts=shifts,
         overlap=overlap,
     )

     # 변경 후
     sources = apply_model(
         model,
         mix.to(device),
         device=device,
         shifts=shifts,
         overlap=overlap,
         split=True,  # 메모리 효율 최적화
     )
     ```
   - 완료 조건: 코드 리뷰 및 커밋

2. **로컬 테스트 (선택 사항)**
   - 374.6초 테스트 오디오로 분리 테스트
   - 메모리 사용량 모니터링 (`htop` 또는 `psutil`)
   - 완료 조건: OOM 없이 분리 완료

3. **Railway 배포 및 검증**
   - Git commit 및 push
   - Railway 자동 배포 대기
   - 배포 로그 확인: `railway logs`
   - 완료 조건: 배포 성공 로그

4. **프로덕션 테스트**
   - 테스트 URL로 오디오 분리 API 호출
   - 374.6초 오디오 처리 성공 확인
   - 완료 조건: HTTP 200 응답 및 출력 파일 생성

**예상 소요 시간**: 30분 (로컬 테스트 포함)
**리스크**: split 옵션의 품질 저하 가능성 (테스트 필요)

---

### Phase 3: 오디오 길이 제한 및 에러 처리 강화 (Optional Goal)

**목표**: 초장시간 오디오 처리에 대한 명확한 가이드 제공 및 사용자 경험 개선

**우선순위**: Low
**종속성**: Phase 2 완료 (split 옵션 적용 후 평가)
**예상 복잡도**: Medium (여러 파일 수정 및 테스트 필요)

**작업 항목**:

1. **config.py에 오디오 길이 제한 설정 추가**
   - 파일 경로: `backend/app/config.py`
   - 추가 내용:
     ```python
     class Settings(BaseSettings):
         max_separation_duration_seconds: int = 300  # 5분
     ```
   - 완료 조건: 설정 필드 추가

2. **separation.py에 검증 로직 추가**
   - 파일 경로: `backend/app/routes/separation.py`
   - 추가 로직:
     ```python
     from mutagen import File as MutagenFile

     def validate_audio_duration(file_path: str, max_duration: int) -> bool:
         audio = MutagenFile(file_path)
         if audio.info.length > max_duration:
             raise HTTPException(
                 status_code=400,
                 detail=f"오디오 길이({audio.info.length:.1f}초)가 최대 허용 길이({max_duration}초)를 초과합니다."
             )
         return True
     ```
   - 완료 조건: 검증 로직 추가 및 라우터 통합

3. **OOM 예외 처리 강화**
   - 파일 경로: `backend/app/services/separation_service.py`
   - 추가 내용:
     ```python
     try:
         sources = apply_model(...)
     except MemoryError as e:
         logger.error(f"메모리 부족으로 오디오 분리 실패: {e}")
         raise HTTPException(
             status_code=500,
             detail="오디오 파일이 너무 커서 처리할 수 없습니다. 더 짧은 오디오를 시도해주세요."
         )
     ```
   - 완료 조건: 예외 처리 추가

4. **통합 테스트**
   - 300초 이하 오디오: 정상 처리 확인
   - 300초 초과 오디오: HTTP 400 응답 확인
   - OOM 시뮬레이션: HTTP 500 응답 및 오류 메시지 확인
   - 완료 조건: 모든 시나리오 테스트 통과

**예상 소요 시간**: 1시간
**리스크**: mutagen 라이브러리 추가 종속성 (requirements.txt 업데이트 필요)

---

## 기술 접근 방식

### 1. YouTube 쿠키 인증 전략

**기존 코드 활용**:
- `youtube_service.py`의 `_setup_cookies()` 메서드는 이미 쿠키 인증 로직 구현
- 환경변수 YOUTUBE_COOKIES에서 Base64 디코딩
- 임시 파일 생성 및 yt-dlp 옵션 주입
- **코드 변경 불필요**, Railway 환경변수 설정만 필요

**Graceful Degradation**:
- 쿠키 미설정 시에도 공개 영상 다운로드 시도
- 실패 시 명확한 오류 메시지 반환
- 로그에 경고 출력

### 2. 메모리 최적화 전략

**Demucs split 옵션**:
- `split=True` 적용으로 오디오를 청크로 분할 처리
- 피크 메모리: 1.5GB → 318MB (79% 감소)
- 품질 저하 없음 (연구 결과 기반)

**대체 전략 (Phase 3)**:
- Tier 1: `split=True` (Primary)
- Tier 2: `max_separation_duration_seconds` 제한 (Safety)
- Tier 3: `overlap` 감소 (0.25 → 0.1) (If needed)
- Last Resort: Railway 유료 플랜 업그레이드

### 3. 환경변수 관리 전략

**Railway 환경변수 우선순위**:
1. Railway 환경변수 (최우선)
2. `.env` 파일 (컨테이너에 없음)
3. pydantic 기본값

**검증 로그 추가**:
- FastAPI 시작 시 환경변수 로드 상태 로그 출력
- YOUTUBE_COOKIES 설정 여부 확인
- CORS_ORIGINS 값 확인

---

## 파일 변경 사항

### 변경 파일 1: `backend/app/services/separation_service.py` (Phase 2)

**위치**: Line ~120 (apply_model 호출부)

**변경 내용**:
```python
# 변경 전
sources = apply_model(
    model,
    mix.to(device),
    device=device,
    shifts=shifts,
    overlap=overlap,
)

# 변경 후
sources = apply_model(
    model,
    mix.to(device),
    device=device,
    shifts=shifts,
    overlap=overlap,
    split=True,  # 메모리 효율 최적화 (SPEC-BACKEND-001)
)
```

### 변경 파일 2: `backend/app/config.py` (Phase 1 & Phase 3)

**Phase 1 추가 (로깅)**:
```python
import logging

logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    # ... 기존 필드 ...

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        logger.info(f"YOUTUBE_COOKIES 설정 여부: {'설정됨' if self.youtube_cookies else '미설정'}")
        logger.info(f"CORS_ORIGINS: {self.cors_origins}")
```

**Phase 3 추가 (오디오 길이 제한)**:
```python
class Settings(BaseSettings):
    max_separation_duration_seconds: int = 300  # 5분 (SPEC-BACKEND-001)
```

### 변경 파일 3: `backend/app/routes/separation.py` (Phase 3)

**추가 내용**:
```python
from mutagen import File as MutagenFile

def validate_audio_duration(file_path: str, max_duration: int) -> bool:
    """오디오 길이 검증 (SPEC-BACKEND-001)"""
    audio = MutagenFile(file_path)
    if audio.info.length > max_duration:
        raise HTTPException(
            status_code=400,
            detail=f"오디오 길이({audio.info.length:.1f}초)가 최대 허용 길이({max_duration}초)를 초과합니다."
        )
    return True

# 라우터에 검증 추가
@router.post("/separate")
async def separate_audio(file: UploadFile, settings: Settings = Depends()):
    validate_audio_duration(file.filename, settings.max_separation_duration_seconds)
    # ... 기존 로직 ...
```

### 변경 파일 4: `backend/requirements.txt` (Phase 3, 선택적)

**추가 종속성** (mutagen이 없는 경우):
```
mutagen>=1.47.0
```

---

## 테스트 전략

### 1. YouTube 다운로드 테스트

**테스트 URL**: https://www.youtube.com/watch?v=k04tX2fvh0o

**테스트 시나리오**:
1. 쿠키 설정 전: 봇 탐지로 실패 예상
2. 쿠키 설정 후: 다운로드 성공 예상
3. 쿠키 누락: Graceful degradation 확인

**검증 명령어**:
```bash
# Railway 환경에서 테스트
curl -X POST https://music-trainer-production.up.railway.app/api/v1/download \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=k04tX2fvh0o"}'
```

**예상 응답**:
```json
{
  "status": "success",
  "file_path": "/tmp/downloaded_audio.mp3",
  "duration": 243.5
}
```

### 2. 오디오 분리 메모리 테스트

**테스트 케이스**:

| 케이스 | 오디오 길이 | 예상 메모리 | 예상 결과 |
|--------|-------------|-------------|-----------|
| TC-1 | 60초 (1분) | ~100MB | 성공 |
| TC-2 | 180초 (3분) | ~200MB | 성공 |
| TC-3 | 374.6초 (6.2분) | ~318MB | 성공 (Phase 2 적용 후) |
| TC-4 | 600초 (10분) | ~500MB | 성공 (Phase 3 제한 적용 시 차단) |

**검증 방법**:
- Railway 배포 후 각 케이스 API 호출
- `railway logs`에서 메모리 사용량 모니터링
- OOM 발생 시 로그 확인

### 3. 통합 테스트

**시나리오**:
1. YouTube URL로 다운로드
2. 다운로드한 오디오 파일로 분리 요청
3. 분리 결과 확인

**자동화 스크립트** (bash):
```bash
#!/bin/bash
set -e

BASE_URL="https://music-trainer-production.up.railway.app/api/v1"
TEST_URL="https://www.youtube.com/watch?v=k04tX2fvh0o"

# 1. 다운로드
echo "1. YouTube 다운로드 테스트..."
DOWNLOAD_RESPONSE=$(curl -s -X POST $BASE_URL/download \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"$TEST_URL\"}")

echo $DOWNLOAD_RESPONSE | jq .

# 2. 분리
echo "2. 오디오 분리 테스트..."
FILE_PATH=$(echo $DOWNLOAD_RESPONSE | jq -r .file_path)

SEPARATION_RESPONSE=$(curl -s -X POST $BASE_URL/separate \
  -F "file=@$FILE_PATH")

echo $SEPARATION_RESPONSE | jq .

echo "✅ 통합 테스트 완료"
```

---

## 배포 및 검증 계획

### 1. Railway CLI 설정

**사전 준비**:
```bash
# Railway CLI 설치 (macOS)
brew install railway

# Railway 로그인
railway login

# 프로젝트 링크
railway link fearless-appreciation

# 현재 서비스 확인
railway status
```

### 2. 환경변수 설정 (Phase 1)

**설정 명령어**:
```bash
# YOUTUBE_COOKIES 설정
railway variable set YOUTUBE_COOKIES='<base64-encoded-cookies>'

# CORS_ORIGINS 설정
railway variable set CORS_ORIGINS='https://music-trainer-production.up.railway.app'

# 설정 확인
railway variable list
```

### 3. 코드 배포 (Phase 2)

**배포 절차**:
```bash
# 1. 브랜치 생성
git checkout -b feature/SPEC-BACKEND-001-memory-optimization

# 2. separation_service.py 수정 (split=True 추가)

# 3. 커밋
git add backend/app/services/separation_service.py
git commit -m "feat(separation): Demucs split 옵션 적용으로 메모리 최적화

- apply_model()에 split=True 추가
- 피크 메모리: 1.5GB → 318MB 예상
- 관련 SPEC: SPEC-BACKEND-001

🗿 MoAI <email@mo.ai.kr>"

# 4. Push (Railway 자동 배포)
git push origin feature/SPEC-BACKEND-001-memory-optimization

# 5. 배포 로그 확인
railway logs --follow
```

### 4. 검증 체크리스트

**Phase 1 검증**:
- [ ] Railway 환경변수 YOUTUBE_COOKIES 설정 확인
- [ ] Railway 환경변수 CORS_ORIGINS 설정 확인
- [ ] `railway logs`에서 환경변수 로드 확인
- [ ] 테스트 URL 다운로드 성공 (200 OK)

**Phase 2 검증**:
- [ ] separation_service.py에 split=True 추가 확인
- [ ] Railway 배포 성공 로그 확인
- [ ] 374.6초 오디오 분리 성공 확인
- [ ] OOM 없이 처리 완료 확인

**Phase 3 검증** (선택적):
- [ ] config.py에 max_separation_duration_seconds 추가 확인
- [ ] 300초 초과 오디오 차단 확인 (HTTP 400)
- [ ] OOM 에러 메시지 확인 (HTTP 500)

---

## 롤백 전략

### Phase 1 롤백 (환경변수)

**롤백 조건**:
- 쿠키 인증 실패로 다운로드 여전히 실패
- 예상치 못한 환경변수 충돌

**롤백 절차**:
```bash
# 환경변수 삭제
railway variable delete YOUTUBE_COOKIES

# 또는 빈 값으로 설정
railway variable set YOUTUBE_COOKIES=''

# Railway 재배포 (자동)
```

**영향도**: Low (코드 변경 없음, Graceful degradation으로 기존 동작 유지)

### Phase 2 롤백 (split 옵션)

**롤백 조건**:
- split 옵션으로 인한 품질 저하
- 예상치 못한 성능 이슈

**롤백 절차**:
```bash
# 1. 이전 커밋으로 되돌리기
git revert <commit-hash>

# 2. 또는 split=True 제거
# separation_service.py에서 해당 라인 삭제

# 3. 커밋 및 배포
git commit -m "revert: Demucs split 옵션 제거 (품질 이슈)"
git push

# 4. Railway 자동 배포 대기
railway logs --follow
```

**영향도**: Medium (OOM 재발 가능성, Railway 플랜 업그레이드 검토 필요)

### Phase 3 롤백 (오디오 길이 제한)

**롤백 조건**:
- 사용자 불만 (300초 제한이 너무 짧음)
- 비즈니스 요구사항 변경

**롤백 절차**:
```bash
# 1. config.py에서 max_separation_duration_seconds 제거 또는 증가
max_separation_duration_seconds: int = 600  # 10분으로 증가

# 2. 또는 검증 로직 완전 제거
# routes/separation.py에서 validate_audio_duration 호출 제거

# 3. 커밋 및 배포
git commit -m "config: 오디오 길이 제한 완화 (10분)"
git push
```

**영향도**: Low (선택적 기능, 핵심 로직 영향 없음)

---

## 리스크 평가

### High Risk

1. **쿠키 만료 (R-1.1)**
   - 발생 가능성: Medium (6-12개월 주기)
   - 영향도: Critical (YouTube 다운로드 중단)
   - 대응 계획: 쿠키 만료 시 알림 로직 추가 (Phase 3+)
   - 완화 전략: 쿠키 갱신 절차 문서화, 모니터링 알림 설정

2. **Railway 무료 플랜 RAM 제한 (R-3.1)**
   - 발생 가능성: Low (split 옵션 적용 후)
   - 영향도: High (초장시간 오디오 처리 실패)
   - 대응 계획: 유료 플랜 업그레이드 ($5/월)
   - 완화 전략: 오디오 길이 제한 (Phase 3)

### Medium Risk

1. **쿠키 추출 권한 문제 (R-1.2)**
   - 발생 가능성: Low (브라우저 기본 기능)
   - 영향도: Medium (초기 설정 지연)
   - 대응 계획: 쿠키 추출 도구 대안 제공 (EditThisCookie 확장 프로그램)
   - 완화 전략: 쿠키 추출 가이드 문서 작성

2. **split 옵션 품질 저하 (R-2.1)**
   - 발생 가능성: Low (연구 결과 기반)
   - 영향도: Medium (사용자 불만)
   - 대응 계획: A/B 테스트 및 사용자 피드백 수집
   - 완화 전략: split 옵션 롤백 가능하도록 설정화

### Low Risk

1. **환경변수 로드 실패 (R-2.2)**
   - 발생 가능성: Very Low (pydantic-settings 안정성)
   - 영향도: Low (기본값으로 폴백)
   - 대응 계획: Railway 로그 모니터링
   - 완화 전략: 환경변수 검증 로직 강화 (Phase 3)

---

## 성공 기준

### Phase 1 성공 기준

- [ ] Railway 환경변수에 YOUTUBE_COOKIES 설정됨
- [ ] 테스트 URL (https://www.youtube.com/watch?v=k04tX2fvh0o) 다운로드 성공
- [ ] `railway logs`에서 환경변수 로드 확인 로그 출력
- [ ] CORS_ORIGINS가 프로덕션 도메인으로 설정됨

### Phase 2 성공 기준

- [ ] separation_service.py에 split=True 적용됨
- [ ] 374.6초 오디오 분리 성공 (OOM 없음)
- [ ] Railway 배포 로그에서 정상 배포 확인
- [ ] 피크 메모리 318MB 이하 (모니터링 로그 기준)

### Phase 3 성공 기준 (선택적)

- [ ] 300초 초과 오디오 차단 (HTTP 400 응답)
- [ ] OOM 발생 시 HTTP 500 및 명확한 오류 메시지 반환
- [ ] mutagen 라이브러리 정상 설치 및 동작

### 전체 프로젝트 성공 기준

- [ ] YouTube 다운로드 복원율 99%+ (쿠키 유효 기간 내)
- [ ] 6분 이하 오디오 분리 성공률 100%
- [ ] OOM 발생률 0% (Phase 2 적용 후)
- [ ] 사용자 오류 보고 감소 90%+

---

## 다음 단계

Phase 1 완료 후:
1. Phase 2 진행 여부 결정
2. Railway 플랜 업그레이드 검토 (유료 플랜 $5/월)
3. 쿠키 갱신 자동화 검토 (장기 과제)

Phase 2 완료 후:
1. Phase 3 필요성 평가 (사용자 피드백 기반)
2. 메모리 모니터링 대시보드 추가 검토
3. 성능 벤치마크 결과 문서화

Phase 3 완료 후:
1. 전체 성능 보고서 작성
2. 사용자 가이드 업데이트
3. 장기 유지보수 계획 수립

---

**문서 버전**: 1.0
**최종 수정일**: 2026-02-17
**작성자**: MoAI manager-spec 에이전트
