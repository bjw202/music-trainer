# SPEC-BACKEND-001: 백엔드 프로덕션 안정화

## 메타데이터

- **SPEC ID**: SPEC-BACKEND-001
- **제목**: 백엔드 프로덕션 안정화 (YouTube 봇 탐지, 환경변수, OOM 해결)
- **생성일**: 2026-02-17
- **상태**: 아카이브 (Railway 배포 포기)
- **우선순위**: Critical
- **영향받는 컴포넌트**:
  - backend/app/services/youtube_service.py
  - backend/app/services/separation_service.py
  - backend/app/config.py
  - Railway 환경 설정

## 개요 및 문제 정의

### 현재 상황

Guitar MP3 Trainer 백엔드가 Railway 프로덕션 환경에서 세 가지 치명적인 문제에 직면해 있습니다:

1. **YouTube 봇 탐지로 인한 다운로드 실패** (Issue 1)
   - YouTube가 yt-dlp 요청을 봇으로 탐지하여 차단
   - 사용자가 YouTube URL로 음원을 다운로드할 수 없는 상태
   - 핵심 기능 중단으로 서비스 사용 불가

2. **환경변수 미설정으로 인한 설정 오류** (Issue 2)
   - Railway에 YOUTUBE_COOKIES 등 필수 환경변수가 설정되지 않음
   - pydantic-settings가 `.env` 파일을 찾지 못하고 기본값으로 폴백
   - CORS, 인증 등 주요 설정이 프로덕션 환경에 맞지 않음

3. **오디오 분리 중 OOM(Out of Memory) 발생** (Issue 3)
   - Demucs htdemucs 모델이 374.6초 오디오 처리 시 메모리 부족
   - 추정 피크 메모리: ~1.5GB+
   - Railway 무료 플랜의 RAM 제한(512MB-1GB)으로 프로세스 강제 종료
   - 사용자에게 오류 메시지 없이 처리 실패

### 비즈니스 영향

- **Issue 1 (YouTube 봇 탐지)**: 핵심 기능 중단, 사용자 이탈 위험 90%+
- **Issue 2 (환경변수)**: 보안 및 운영 불안정성, 문제 진단 지연
- **Issue 3 (OOM)**: 긴 오디오 처리 불가, 사용자 경험 저하

### 해결 목표

1. YouTube 쿠키 인증을 통한 봇 탐지 우회 및 안정적인 다운로드 복원
2. Railway 환경변수 설정을 통한 프로덕션 설정 정상화
3. 메모리 효율적인 오디오 분리 구현으로 OOM 방지

---

## Environment (전제조건)

### 기술 스택

- **Python**: 3.11+
- **웹 프레임워크**: FastAPI 0.118.3
- **오디오 처리**: demucs 4.1.0, yt-dlp 2025.1.15
- **배포 플랫폼**: Railway (무료 플랜)
- **환경 관리**: pydantic-settings 2.6.1

### Railway 환경 제약사항

- **메모리 제한**: 512MB-1GB (무료 플랜 추정)
- **컨테이너 환경**: .env 파일 없음, 환경변수로만 설정 주입
- **네트워크**: 외부 API 호출 가능 (YouTube, 쿠키 인증 지원)

### 코드베이스 현황

- **YouTube 다운로드**: `youtube_service.py`에 쿠키 인증 로직 이미 구현됨
  - `_setup_cookies()` 메서드 (43-64줄)
  - YOUTUBE_COOKIES 환경변수 읽기 및 base64 디코딩
  - 쿠키 파일 생성 및 yt-dlp 옵션 주입
- **오디오 분리**: `separation_service.py`에 Demucs 모델 적용 로직
  - `apply_model()` 호출 시 `split` 옵션 미사용 (메모리 효율 최적화 미적용)
- **설정 관리**: `config.py`에 pydantic-settings 기반 설정

---

## Assumptions (가정)

### 기술적 가정

1. **쿠키 유효성** (High Confidence)
   - 브라우저에서 추출한 YouTube 쿠키는 6-12개월 유효
   - Base64 인코딩된 쿠키를 Railway 환경변수로 안전하게 주입 가능
   - 검증 방법: 테스트 URL로 다운로드 성공 여부 확인

2. **Demucs split 옵션 효과** (High Confidence)
   - `split=True` 적용 시 피크 메모리 ~318MB로 감소 (연구 결과 기반)
   - 512MB RAM 환경에서 60% 헤드룸 확보
   - 검증 방법: 374.6초 오디오로 Railway 환경 테스트

3. **Railway 환경변수 주입** (High Confidence)
   - Railway CLI를 통한 환경변수 설정 시 즉시 반영
   - 재배포 없이 환경변수 업데이트 가능
   - 검증 방법: `railway logs`로 환경변수 로드 확인

### 비즈니스 가정

1. **쿠키 갱신 주기** (Medium Confidence)
   - 6-12개월마다 브라우저에서 쿠키 재추출 필요
   - 쿠키 만료 시 수동 갱신 허용 가능
   - 리스크: 쿠키 만료 시 일시적 서비스 중단

2. **오디오 길이 분포** (Medium Confidence)
   - 대부분의 사용자 오디오는 300초(5분) 이하
   - 374.6초(6.2분)는 상위 10% 이내
   - 리스크: 초장시간 오디오(10분+) 처리 시 여전히 메모리 부족 가능

### 운영 가정

1. **Railway 무료 플랜 지속** (Low Confidence)
   - Railway 무료 플랜의 RAM 제한이 현행 유지
   - 리스크: 플랜 변경 시 메모리 제약 변동 가능
   - 대응: 유료 플랜 업그레이드 옵션 확보

---

## Requirements (요구사항)

### 1. YouTube 쿠키 인증 요구사항

#### REQ-1.1: YouTube 쿠키 환경변수 설정 (Ubiquitous)
**EARS 형식**: 시스템은 **항상** Railway 환경변수에서 YOUTUBE_COOKIES를 읽어야 한다.

- **검증 기준**: `config.py`에서 `youtube_cookies` 필드 정의 및 로드 확인
- **우선순위**: Critical
- **구현 위치**: Railway 설정 (코드 변경 불필요)

#### REQ-1.2: 쿠키 기반 다운로드 (Event-Driven)
**EARS 형식**: **WHEN** YOUTUBE_COOKIES 환경변수가 설정되어 있으면 **THEN** yt-dlp는 쿠키 파일을 사용하여 YouTube 다운로드를 수행해야 한다.

- **검증 기준**: 테스트 URL (https://www.youtube.com/watch?v=k04tX2fvh0o) 다운로드 성공
- **우선순위**: Critical
- **구현 위치**: `youtube_service.py` (이미 구현됨)

#### REQ-1.3: 쿠키 누락 시 Graceful Degradation (Unwanted → Optional)
**EARS 형식**: **IF** YOUTUBE_COOKIES가 설정되지 않았으면 **THEN** 시스템은 쿠키 없이 다운로드를 시도하되 **가능하면** 경고 로그를 남겨야 한다.

- **검증 기준**: 쿠키 없이도 공개 영상 다운로드 시도, 로그에 경고 출력
- **우선순위**: Medium
- **구현 위치**: `youtube_service.py` (이미 구현됨)

### 2. 환경변수 관리 요구사항

#### REQ-2.1: Railway 환경변수 설정 (Ubiquitous)
**EARS 형식**: 시스템은 **항상** Railway 환경변수로부터 다음 필수 설정을 읽어야 한다:
- YOUTUBE_COOKIES (쿠키 인증)
- CORS_ORIGINS (프로덕션 도메인)

- **검증 기준**: `railway variable list` 명령어로 환경변수 확인
- **우선순위**: High
- **구현 위치**: Railway CLI

#### REQ-2.2: 환경변수 로드 확인 (Event-Driven)
**EARS 형식**: **WHEN** FastAPI 앱이 시작되면 **THEN** 로그에 환경변수 로드 상태를 출력해야 한다.

- **검증 기준**: `railway logs`에서 YOUTUBE_COOKIES, CORS_ORIGINS 로드 확인
- **우선순위**: Medium
- **구현 위치**: `config.py` (로깅 추가)

### 3. 오디오 분리 메모리 최적화 요구사항

#### REQ-3.1: Demucs split 옵션 적용 (Ubiquitous)
**EARS 형식**: 시스템은 **항상** Demucs `apply_model()` 호출 시 `split=True` 옵션을 사용하여 메모리 사용량을 최소화해야 한다.

- **검증 기준**: `separation_service.py` 코드에서 `split=True` 파라미터 확인
- **우선순위**: Critical
- **구현 위치**: `separation_service.py`

#### REQ-3.2: 오디오 길이 제한 (Optional)
**EARS 형식**: **가능하면** 시스템은 300초(5분)를 초과하는 오디오 분리 요청에 대해 경고를 제공해야 한다.

- **검증 기준**: `max_separation_duration_seconds` 설정 추가 및 validation 로직
- **우선순위**: Low (Phase 3)
- **구현 위치**: `config.py`, `routes/separation.py`

#### REQ-3.3: OOM 방지 및 에러 처리 (Unwanted)
**EARS 형식**: 시스템은 메모리 부족으로 인한 **무응답 종료를 하지 않아야** 하며, 사용자에게 명확한 오류 메시지를 반환해야 한다.

- **검증 기준**: 메모리 부족 시 HTTP 500 응답 및 오류 메시지 반환
- **우선순위**: Medium
- **구현 위치**: `separation_service.py` (예외 처리 강화)

---

## Specifications (상세 사양)

### 1. YouTube 쿠키 인증 구현

#### 1.1 Railway 환경변수 설정

**설정 방법**:
```bash
# Railway CLI 사용
railway variable set YOUTUBE_COOKIES='<base64-encoded-cookies>'
```

**쿠키 추출 절차**:
1. Chrome 브라우저에서 youtube.com 로그인
2. 개발자 도구 > Application > Cookies > youtube.com
3. 쿠키를 Netscape 형식으로 내보내기
4. Base64 인코딩: `base64 -i cookies.txt`
5. Railway 환경변수로 설정

**검증 명령어**:
```bash
railway variable list | grep YOUTUBE_COOKIES
```

#### 1.2 기존 코드 활용

`youtube_service.py`의 `_setup_cookies()` 메서드는 이미 다음 로직을 구현:
- 환경변수에서 YOUTUBE_COOKIES 읽기
- Base64 디코딩 및 임시 파일 생성
- yt-dlp 옵션에 쿠키 파일 경로 추가

**코드 위치**: Lines 43-64
**변경 필요**: 없음 (Railway 환경변수 설정만 필요)

### 2. 환경변수 관리

#### 2.1 필수 환경변수 목록

| 환경변수 이름 | 설명 | 기본값 | 프로덕션 권장값 |
|--------------|------|--------|----------------|
| YOUTUBE_COOKIES | YouTube 쿠키 (Base64) | None | <브라우저 추출 쿠키> |
| CORS_ORIGINS | CORS 허용 오리진 | http://localhost:3000 | https://music-trainer-production.up.railway.app |
| LOG_LEVEL | 로그 레벨 | INFO | INFO |

#### 2.2 환경변수 로드 검증 로그 추가

`config.py`에 다음 로직 추가:

```python
# config.py에 추가할 로깅 코드
import logging

logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    # ... 기존 필드 ...

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        logger.info(f"YOUTUBE_COOKIES 설정 여부: {'설정됨' if self.youtube_cookies else '미설정'}")
        logger.info(f"CORS_ORIGINS: {self.cors_origins}")
```

### 3. 오디오 분리 메모리 최적화

#### 3.1 Demucs split 옵션 적용

**변경 파일**: `backend/app/services/separation_service.py`

**변경 전**:
```python
sources = apply_model(
    model,
    mix.to(device),
    device=device,
    shifts=shifts,
    overlap=overlap,
)
```

**변경 후**:
```python
sources = apply_model(
    model,
    mix.to(device),
    device=device,
    shifts=shifts,
    overlap=overlap,
    split=True,  # 메모리 효율 최적화
)
```

**예상 효과**:
- 피크 메모리: 1.5GB → 318MB (79% 감소)
- 512MB RAM 환경에서 60% 헤드룸 확보

#### 3.2 오디오 길이 제한 (Optional, Phase 3)

**변경 파일**:
- `backend/app/config.py`
- `backend/app/routes/separation.py`

**config.py 추가**:
```python
class Settings(BaseSettings):
    max_separation_duration_seconds: int = 300  # 5분
```

**routes/separation.py 검증 로직**:
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

#### 3.3 OOM 에러 처리 강화

**separation_service.py 예외 처리 추가**:
```python
try:
    sources = apply_model(...)
except MemoryError as e:
    logger.error(f"메모리 부족으로 오디오 분리 실패: {e}")
    raise HTTPException(
        status_code=500,
        detail="오디오 파일이 너무 커서 처리할 수 없습니다. 더 짧은 오디오를 시도해주세요."
    )
except Exception as e:
    logger.error(f"오디오 분리 중 예상치 못한 오류: {e}")
    raise
```

---

## 추적성 (Traceability)

### TAG 블록
```
<!-- @TAG SPEC-BACKEND-001 -->
```

### 파일별 TAG 매핑

- `backend/app/config.py`: SPEC-BACKEND-001 (환경변수 로드 로깅)
- `backend/app/services/youtube_service.py`: SPEC-BACKEND-001 (쿠키 인증)
- `backend/app/services/separation_service.py`: SPEC-BACKEND-001 (split 옵션, OOM 처리)
- `backend/app/routes/separation.py`: SPEC-BACKEND-001 (오디오 길이 검증)
- Railway 환경 설정: SPEC-BACKEND-001 (환경변수)

---

## 규제 준수 및 보안

### 보안 고려사항

1. **쿠키 보안** (Medium Risk)
   - Base64 인코딩은 암호화가 아님 (난독화 수준)
   - Railway 환경변수는 HTTPS로 전송되며 프로젝트 멤버만 접근 가능
   - 대응: 쿠키 갱신 주기 준수, 비공개 레포지토리 관리

2. **환경변수 노출 방지**
   - `.env` 파일을 `.gitignore`에 추가
   - Railway 환경변수는 로그에 출력하지 않음 (마스킹 처리)

3. **YouTube ToS 준수**
   - 쿠키 인증은 YouTube ToS의 회색 영역
   - 개인 계정 쿠키 사용으로 YouTube API 할당량 문제 우회
   - 리스크: YouTube 정책 변경 시 차단 가능

---

## 참고 자료

- **yt-dlp 문서**: https://github.com/yt-dlp/yt-dlp#authentication-with-cookies
- **Demucs 메모리 최적화**: https://github.com/facebookresearch/demucs#memory-efficient-inference
- **Railway 환경변수**: https://docs.railway.app/guides/variables
- **FastAPI 환경변수**: https://fastapi.tiangolo.com/advanced/settings/
- **Pydantic Settings**: https://docs.pydantic.dev/latest/concepts/pydantic_settings/

---

**작성자**: MoAI manager-spec 에이전트
**검토자**: 사용자 승인 대기
**최종 수정일**: 2026-02-17

---

## 아카이브 사유

### 결정

**날짜**: 2026-02-17
**결정**: Railway 배포 전략 포기 → SPEC 아카이브 처리

### 포기 이유

Railway 프리 플랜의 구조적 제약으로 인해 프로덕션 안정화 목표 달성이 불가능하다고 판단:

1. **메모리 제한 (512MB-1GB)**: Demucs split=True 적용으로 OOM 완화 가능하나, 장시간 오디오 처리 시 여전히 위험
2. **YouTube 봇 탐지**: 쿠키 인증 방식은 임시방편이며, Railway IP 환경에서 추가 차단 가능
3. **비용 대비 효과**: Railway 유료 플랜 비용 대비 자체 서버 또는 대안 플랫폼 검토가 더 효율적

### 잔존 변경사항 요약

SPEC 실행 중 적용된 변경사항 (코드베이스에 유지):

| 파일 | 변경 내용 | 상태 |
|------|----------|------|
| `backend/app/services/separation_service.py` | `split=True` 옵션 추가 (OOM 완화) | **유지** - 로컬 환경에서도 메모리 효율 개선 |
| `backend/app/config.py` | 환경변수 로드 확인 로깅 추가 | **유지** - 디버깅 유용 |
| `backend/app/services/youtube_service.py` | 쿠키 인증 로직 (기존 구현) | **유지** - 코드 변경 없음 |

### Phase 3 미구현 항목

포기로 인해 구현하지 않은 항목:

- REQ-3.2: 오디오 길이 제한 (300초 경고)
- REQ-3.3: OOM 방지 강화 에러 처리
- Railway 환경변수 설정 (YOUTUBE_COOKIES, CORS_ORIGINS)

### 향후 고려사항

다른 배포 플랫폼으로 전환 시 참고할 사항:

- Demucs 실행을 위해 최소 **2GB RAM** 권장
- GPU 지원 환경에서 처리 속도 10x 이상 개선 가능
- YouTube 다운로드는 별도 서비스(microservice) 분리 고려
