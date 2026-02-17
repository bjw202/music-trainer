# SPEC-BACKEND-001 인수 기준

<!-- @TAG SPEC-BACKEND-001 -->

## 개요

이 문서는 SPEC-BACKEND-001 "백엔드 프로덕션 안정화"의 상세 인수 기준을 정의합니다. 모든 기준은 Given-When-Then 형식으로 작성되었습니다.

---

## Phase 1: 환경변수 설정 및 YouTube 쿠키 인증

### AC-1.1: Railway 환경변수 설정 확인

**Given**: Railway 프로젝트에 접근 권한이 있고
**When**: `railway variable list` 명령어를 실행하면
**Then**:
- YOUTUBE_COOKIES 환경변수가 설정되어 있어야 함
- CORS_ORIGINS 환경변수가 설정되어 있어야 함
- 각 값이 마스킹되어 표시되어야 함 (보안)

**검증 방법**:
```bash
railway variable list | grep YOUTUBE_COOKIES
railway variable list | grep CORS_ORIGINS
```

**예상 출력**:
```
YOUTUBE_COOKIES=****** (hidden)
CORS_ORIGINS=https://music-trainer-production.up.railway.app
```

---

### AC-1.2: FastAPI 시작 시 환경변수 로드 확인

**Given**: Railway에 환경변수가 설정되어 있고
**When**: FastAPI 앱이 시작되면
**Then**:
- Railway 로그에 "YOUTUBE_COOKIES 설정 여부: 설정됨" 메시지가 출력되어야 함
- Railway 로그에 "CORS_ORIGINS: https://..." 메시지가 출력되어야 함

**검증 방법**:
```bash
railway logs | grep "YOUTUBE_COOKIES 설정 여부"
railway logs | grep "CORS_ORIGINS"
```

**예상 출력**:
```
[INFO] YOUTUBE_COOKIES 설정 여부: 설정됨
[INFO] CORS_ORIGINS: https://music-trainer-production.up.railway.app
```

---

### AC-1.3: YouTube 쿠키 인증 성공

**Given**: YOUTUBE_COOKIES 환경변수가 유효한 Base64 쿠키로 설정되어 있고
**When**: 테스트 URL (https://www.youtube.com/watch?v=k04tX2fvh0o)로 다운로드 API를 호출하면
**Then**:
- HTTP 200 응답을 반환해야 함
- 응답 JSON에 `status: "success"` 필드가 포함되어야 함
- 응답 JSON에 `file_path` 필드가 포함되어야 함
- 응답 JSON에 `duration` 필드가 포함되어야 함

**검증 방법**:
```bash
curl -X POST https://music-trainer-production.up.railway.app/api/v1/download \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=k04tX2fvh0o"}' \
  | jq .
```

**예상 출력**:
```json
{
  "status": "success",
  "file_path": "/tmp/downloaded_audio_<id>.mp3",
  "duration": 243.5,
  "title": "Test Audio Title"
}
```

---

### AC-1.4: 쿠키 누락 시 Graceful Degradation

**Given**: YOUTUBE_COOKIES 환경변수가 설정되지 않았고
**When**: 공개 YouTube URL로 다운로드 API를 호출하면
**Then**:
- HTTP 200 응답을 시도해야 함 (공개 영상인 경우)
- 또는 HTTP 403 응답 및 명확한 오류 메시지를 반환해야 함 (봇 탐지 시)
- Railway 로그에 "YOUTUBE_COOKIES 설정 여부: 미설정" 경고가 출력되어야 함

**검증 방법**:
```bash
# 환경변수 임시 제거
railway variable delete YOUTUBE_COOKIES

# 다운로드 시도
curl -X POST https://music-trainer-production.up.railway.app/api/v1/download \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'

# 로그 확인
railway logs | grep "YOUTUBE_COOKIES 설정 여부"
```

**예상 출력** (봇 탐지 시):
```json
{
  "status": "error",
  "message": "YouTube 봇 탐지로 인해 다운로드에 실패했습니다. YOUTUBE_COOKIES 환경변수를 설정해주세요.",
  "error_code": "YOUTUBE_BOT_DETECTED"
}
```

---

### AC-1.5: CORS 설정 검증

**Given**: CORS_ORIGINS 환경변수가 프로덕션 도메인으로 설정되어 있고
**When**: 프로덕션 도메인에서 API 요청을 보내면
**Then**:
- 응답 헤더에 `Access-Control-Allow-Origin: https://music-trainer-production.up.railway.app`이 포함되어야 함
- 프리플라이트 OPTIONS 요청이 성공해야 함

**검증 방법**:
```bash
# CORS 프리플라이트 요청
curl -X OPTIONS https://music-trainer-production.up.railway.app/api/v1/download \
  -H "Origin: https://music-trainer-production.up.railway.app" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

**예상 출력** (헤더):
```
< HTTP/2 200
< access-control-allow-origin: https://music-trainer-production.up.railway.app
< access-control-allow-methods: POST, GET, OPTIONS
```

---

## Phase 2: 메모리 효율적인 오디오 분리

### AC-2.1: Demucs split 옵션 적용 확인

**Given**: separation_service.py가 수정되었고
**When**: 코드를 검토하면
**Then**:
- `apply_model()` 호출부에 `split=True` 파라미터가 추가되어 있어야 함
- 해당 라인에 주석 "# 메모리 효율 최적화" 또는 "SPEC-BACKEND-001"이 포함되어야 함

**검증 방법**:
```bash
grep -A 5 "apply_model" backend/app/services/separation_service.py | grep "split=True"
```

**예상 출력**:
```python
sources = apply_model(
    model,
    mix.to(device),
    device=device,
    shifts=shifts,
    overlap=overlap,
    split=True,  # 메모리 효율 최적화 (SPEC-BACKEND-001)
)
```

---

### AC-2.2: 짧은 오디오 분리 성공 (60초)

**Given**: split 옵션이 적용된 코드가 배포되었고
**When**: 60초 길이의 오디오 파일로 분리 API를 호출하면
**Then**:
- HTTP 200 응답을 반환해야 함
- 응답 JSON에 `status: "success"` 필드가 포함되어야 함
- 응답 JSON에 `separated_files` 배열이 포함되어야 함
- 분리된 파일 경로가 유효해야 함 (vocals.mp3, accompaniment.mp3)

**검증 방법**:
```bash
# 60초 오디오 업로드 및 분리
curl -X POST https://music-trainer-production.up.railway.app/api/v1/separate \
  -F "file=@test_audio_60s.mp3" \
  | jq .
```

**예상 출력**:
```json
{
  "status": "success",
  "separated_files": {
    "vocals": "/tmp/separated_<id>_vocals.mp3",
    "accompaniment": "/tmp/separated_<id>_accompaniment.mp3"
  },
  "duration": 60.2,
  "processing_time": 15.3
}
```

---

### AC-2.3: 중간 길이 오디오 분리 성공 (180초)

**Given**: split 옵션이 적용된 코드가 배포되었고
**When**: 180초(3분) 길이의 오디오 파일로 분리 API를 호출하면
**Then**:
- HTTP 200 응답을 반환해야 함
- OOM 없이 분리가 완료되어야 함
- Railway 로그에 메모리 에러가 없어야 함

**검증 방법**:
```bash
# 180초 오디오 업로드 및 분리
curl -X POST https://music-trainer-production.up.railway.app/api/v1/separate \
  -F "file=@test_audio_180s.mp3" \
  | jq .

# Railway 로그에서 에러 확인
railway logs | grep -i "memory\|oom\|killed"
```

**예상 출력** (로그):
```
(No memory errors)
[INFO] Separation completed successfully for duration 180.5s
```

---

### AC-2.4: 긴 오디오 분리 성공 (374.6초, Critical Test Case)

**Given**: split 옵션이 적용된 코드가 배포되었고
**When**: 374.6초(6.2분) 길이의 오디오 파일로 분리 API를 호출하면
**Then**:
- HTTP 200 응답을 반환해야 함
- 분리가 OOM 없이 완료되어야 함
- 피크 메모리 사용량이 400MB 이하여야 함 (Railway 로그 기준)
- Railway 로그에 "Killed" 메시지가 없어야 함

**검증 방법**:
```bash
# 테스트 URL로 다운로드 후 분리
TEST_URL="https://www.youtube.com/watch?v=k04tX2fvh0o"

# 1. 다운로드
DOWNLOAD_RESPONSE=$(curl -s -X POST https://music-trainer-production.up.railway.app/api/v1/download \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"$TEST_URL\"}")

FILE_PATH=$(echo $DOWNLOAD_RESPONSE | jq -r .file_path)

# 2. 분리
curl -X POST https://music-trainer-production.up.railway.app/api/v1/separate \
  -F "file=@$FILE_PATH" \
  | jq .

# 3. Railway 로그 확인
railway logs | grep -A 5 "Separation completed"
```

**예상 출력**:
```json
{
  "status": "success",
  "separated_files": {
    "vocals": "/tmp/separated_<id>_vocals.mp3",
    "accompaniment": "/tmp/separated_<id>_accompaniment.mp3"
  },
  "duration": 374.6,
  "processing_time": 120.5,
  "peak_memory_mb": 318
}
```

---

### AC-2.5: 품질 저하 없음 확인 (음질 검증)

**Given**: split 옵션이 적용된 코드가 배포되었고
**When**: 동일한 오디오를 split=False와 split=True로 각각 분리하면
**Then**:
- 두 출력 파일의 스펙트로그램이 95% 이상 유사해야 함
- SNR (Signal-to-Noise Ratio) 차이가 1dB 이하여야 함
- 사용자가 청각적 차이를 인지할 수 없어야 함

**검증 방법** (로컬 환경):
```python
import librosa
import numpy as np

# split=False 출력
y1, sr1 = librosa.load("output_no_split_vocals.mp3")

# split=True 출력
y2, sr2 = librosa.load("output_split_vocals.mp3")

# 유사도 계산
correlation = np.corrcoef(y1[:len(y2)], y2)[0, 1]
print(f"Correlation: {correlation:.4f}")  # Expected: > 0.95
```

**예상 출력**:
```
Correlation: 0.9872
Quality degradation: Negligible (< 1dB SNR difference)
```

---

## Phase 3: 오디오 길이 제한 및 에러 처리 강화 (Optional)

### AC-3.1: 오디오 길이 제한 설정 확인

**Given**: config.py가 수정되었고
**When**: 코드를 검토하면
**Then**:
- `max_separation_duration_seconds` 필드가 정의되어 있어야 함
- 기본값이 300초(5분)로 설정되어 있어야 함

**검증 방법**:
```bash
grep "max_separation_duration_seconds" backend/app/config.py
```

**예상 출력**:
```python
max_separation_duration_seconds: int = 300  # 5분 (SPEC-BACKEND-001)
```

---

### AC-3.2: 300초 이하 오디오 정상 처리

**Given**: 오디오 길이 제한이 활성화되어 있고
**When**: 180초 길이의 오디오로 분리 API를 호출하면
**Then**:
- HTTP 200 응답을 반환해야 함
- 정상적으로 분리가 완료되어야 함
- 길이 제한 경고가 없어야 함

**검증 방법**:
```bash
curl -X POST https://music-trainer-production.up.railway.app/api/v1/separate \
  -F "file=@test_audio_180s.mp3" \
  | jq .
```

**예상 출력**:
```json
{
  "status": "success",
  "separated_files": {...},
  "duration": 180.5
}
```

---

### AC-3.3: 300초 초과 오디오 차단

**Given**: 오디오 길이 제한이 활성화되어 있고
**When**: 360초(6분) 길이의 오디오로 분리 API를 호출하면
**Then**:
- HTTP 400 응답을 반환해야 함
- 응답 JSON에 명확한 오류 메시지가 포함되어야 함
- 오류 메시지에 현재 길이와 최대 허용 길이가 포함되어야 함

**검증 방법**:
```bash
curl -X POST https://music-trainer-production.up.railway.app/api/v1/separate \
  -F "file=@test_audio_360s.mp3" \
  | jq .
```

**예상 출력**:
```json
{
  "status": "error",
  "message": "오디오 길이(360.0초)가 최대 허용 길이(300초)를 초과합니다.",
  "error_code": "AUDIO_TOO_LONG",
  "current_duration": 360.0,
  "max_duration": 300
}
```

---

### AC-3.4: OOM 발생 시 명확한 에러 메시지

**Given**: 메모리가 부족한 상황이고
**When**: 매우 긴 오디오 파일(10분+)로 분리 API를 호출하면
**Then**:
- HTTP 500 응답을 반환해야 함
- 응답 JSON에 사용자 친화적인 오류 메시지가 포함되어야 함
- Railway 로그에 MemoryError 예외가 기록되어야 함

**검증 방법** (시뮬레이션):
```bash
# 매우 긴 오디오로 테스트
curl -X POST https://music-trainer-production.up.railway.app/api/v1/separate \
  -F "file=@test_audio_600s.mp3" \
  | jq .

# Railway 로그 확인
railway logs | grep "MemoryError\|메모리 부족"
```

**예상 출력**:
```json
{
  "status": "error",
  "message": "오디오 파일이 너무 커서 처리할 수 없습니다. 더 짧은 오디오를 시도해주세요.",
  "error_code": "MEMORY_ERROR",
  "recommendation": "5분 이하의 오디오 파일을 사용하거나 파일 크기를 줄여주세요."
}
```

**Railway 로그**:
```
[ERROR] 메모리 부족으로 오디오 분리 실패: MemoryError
[ERROR] Duration: 600.5s, Peak memory exceeded 512MB limit
```

---

### AC-3.5: 임시 파일 정리 (Cleanup)

**Given**: 오디오 분리가 실패했고
**When**: 에러가 발생했을 때
**Then**:
- 임시로 생성된 입력/출력 파일이 자동 삭제되어야 함
- /tmp 디렉토리에 orphan 파일이 남아있지 않아야 함
- Railway 로그에 "Cleanup completed" 메시지가 출력되어야 함

**검증 방법**:
```bash
# 에러 유발 요청
curl -X POST https://music-trainer-production.up.railway.app/api/v1/separate \
  -F "file=@invalid_audio.mp3"

# Railway 로그 확인
railway logs | grep "Cleanup"
```

**예상 로그**:
```
[INFO] Separation failed, starting cleanup...
[INFO] Cleanup completed: 3 temporary files removed
```

---

## 통합 인수 기준

### AC-INT-1: 완전한 워크플로우 성공 (End-to-End)

**Given**: Phase 1과 Phase 2가 모두 완료되었고
**When**: YouTube URL로 다운로드 후 즉시 분리를 수행하면
**Then**:
- YouTube 다운로드가 성공해야 함 (HTTP 200)
- 다운로드한 오디오 분리가 성공해야 함 (HTTP 200)
- 전체 프로세스가 5분 이내에 완료되어야 함
- 중간에 OOM 또는 에러가 발생하지 않아야 함

**검증 방법**:
```bash
#!/bin/bash
set -e

BASE_URL="https://music-trainer-production.up.railway.app/api/v1"
TEST_URL="https://www.youtube.com/watch?v=k04tX2fvh0o"

echo "Step 1: YouTube 다운로드..."
START_TIME=$(date +%s)

DOWNLOAD_RESPONSE=$(curl -s -X POST $BASE_URL/download \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"$TEST_URL\"}")

echo $DOWNLOAD_RESPONSE | jq .
FILE_PATH=$(echo $DOWNLOAD_RESPONSE | jq -r .file_path)

echo "Step 2: 오디오 분리..."
SEPARATION_RESPONSE=$(curl -s -X POST $BASE_URL/separate \
  -F "file=@$FILE_PATH")

echo $SEPARATION_RESPONSE | jq .

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "✅ 전체 프로세스 완료: ${DURATION}초"
```

**예상 출력**:
```json
Step 1: YouTube 다운로드...
{
  "status": "success",
  "file_path": "/tmp/downloaded_audio_xyz.mp3",
  "duration": 374.6
}

Step 2: 오디오 분리...
{
  "status": "success",
  "separated_files": {
    "vocals": "/tmp/separated_xyz_vocals.mp3",
    "accompaniment": "/tmp/separated_xyz_accompaniment.mp3"
  },
  "processing_time": 125.3
}

✅ 전체 프로세스 완료: 145초
```

---

### AC-INT-2: 동시 요청 처리 (Concurrency)

**Given**: Railway 환경이 안정적이고
**When**: 3개의 동시 분리 요청을 보내면
**Then**:
- 모든 요청이 성공해야 함 (3개 모두 HTTP 200)
- 메모리 부족 에러가 발생하지 않아야 함
- 각 요청의 처리 시간이 순차 처리 대비 2배 이내여야 함

**검증 방법**:
```bash
#!/bin/bash

BASE_URL="https://music-trainer-production.up.railway.app/api/v1"

# 3개 동시 요청
curl -X POST $BASE_URL/separate -F "file=@test1.mp3" &
curl -X POST $BASE_URL/separate -F "file=@test2.mp3" &
curl -X POST $BASE_URL/separate -F "file=@test3.mp3" &

wait

echo "✅ 모든 동시 요청 완료"
railway logs | grep -i "memory\|oom" | wc -l  # Expected: 0
```

**예상 결과**:
- 3개 요청 모두 성공
- OOM 에러 0건
- 평균 처리 시간: 150초 이하 (순차 대비 1.5배)

---

### AC-INT-3: Health Check 정상 응답

**Given**: Railway 배포가 완료되었고
**When**: Health Check 엔드포인트를 호출하면
**Then**:
- HTTP 200 응답을 반환해야 함
- 응답 JSON에 `status: "healthy"` 필드가 포함되어야 함
- 환경변수 상태가 포함되어야 함 (YOUTUBE_COOKIES 설정 여부)

**검증 방법**:
```bash
curl https://music-trainer-production.up.railway.app/api/v1/health | jq .
```

**예상 출력**:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-17T10:30:00Z",
  "environment": {
    "youtube_cookies_configured": true,
    "cors_origins": "https://music-trainer-production.up.railway.app"
  },
  "services": {
    "demucs": "ready",
    "yt_dlp": "ready"
  }
}
```

---

## 성능 벤치마크

### PERF-1: 다운로드 성능

**Given**: YouTube 쿠키가 설정되어 있고
**When**: 5분 길이의 YouTube 영상을 다운로드하면
**Then**:
- 다운로드 시간이 30초 이하여야 함
- 네트워크 대역폭 사용량이 10MB/s 이하여야 함

---

### PERF-2: 분리 성능

**Given**: split 옵션이 적용되었고
**When**: 5분 길이의 오디오를 분리하면
**Then**:
- 분리 시간이 120초 이하여야 함
- 피크 메모리가 400MB 이하여야 함
- CPU 사용률이 80% 이하여야 함

---

### PERF-3: 메모리 효율성

**Given**: split 옵션이 적용되었고
**When**: 6분 길이의 오디오를 분리하면
**Then**:
- 피크 메모리가 split=False 대비 70% 이하여야 함
- 기존: ~1.5GB → 적용 후: ~318MB
- 메모리 사용량 그래프가 톱니 모양 (청크 단위 처리 확인)

---

## Definition of Done

### Phase 1 완료 조건

- [ ] AC-1.1: Railway 환경변수 설정 확인 통과
- [ ] AC-1.2: FastAPI 환경변수 로드 확인 통과
- [ ] AC-1.3: YouTube 쿠키 인증 성공 통과
- [ ] AC-1.4: Graceful Degradation 통과
- [ ] AC-1.5: CORS 설정 검증 통과

### Phase 2 완료 조건

- [ ] AC-2.1: split 옵션 적용 확인 통과
- [ ] AC-2.2: 60초 오디오 분리 성공 통과
- [ ] AC-2.3: 180초 오디오 분리 성공 통과
- [ ] AC-2.4: 374.6초 오디오 분리 성공 통과 (Critical)
- [ ] AC-2.5: 품질 저하 없음 확인 통과

### Phase 3 완료 조건 (Optional)

- [ ] AC-3.1: 오디오 길이 제한 설정 확인 통과
- [ ] AC-3.2: 300초 이하 오디오 정상 처리 통과
- [ ] AC-3.3: 300초 초과 오디오 차단 통과
- [ ] AC-3.4: OOM 에러 메시지 통과
- [ ] AC-3.5: 임시 파일 정리 통과

### 전체 프로젝트 완료 조건

- [ ] AC-INT-1: End-to-End 워크플로우 성공
- [ ] AC-INT-2: 동시 요청 처리 성공
- [ ] AC-INT-3: Health Check 정상 응답
- [ ] PERF-1: 다운로드 성능 기준 충족
- [ ] PERF-2: 분리 성능 기준 충족
- [ ] PERF-3: 메모리 효율성 기준 충족
- [ ] 모든 Railway 로그에서 에러 0건
- [ ] 사용자 테스트 피드백 긍정 90%+

---

## 회귀 테스트 (Regression Tests)

### REG-1: 기존 기능 정상 동작 확인

**Given**: 새로운 기능이 배포되었고
**When**: 기존 API 엔드포인트를 호출하면
**Then**:
- 모든 기존 엔드포인트가 정상 응답해야 함
- 응답 스키마가 변경되지 않아야 함
- 평균 응답 시간이 10% 이상 증가하지 않아야 함

**검증 항목**:
- [ ] GET /api/v1/health
- [ ] POST /api/v1/download
- [ ] POST /api/v1/separate
- [ ] GET /api/v1/jobs/{job_id}
- [ ] DELETE /api/v1/jobs/{job_id}

---

### REG-2: 기존 오디오 파일 재처리

**Given**: 이전에 성공적으로 분리된 오디오 파일이 있고
**When**: 동일한 파일을 다시 분리하면
**Then**:
- 동일한 출력 파일이 생성되어야 함 (MD5 해시 일치)
- 처리 시간이 이전과 유사해야 함 (±20%)

---

## 문서 버전

- **버전**: 1.0
- **최종 수정일**: 2026-02-17
- **작성자**: MoAI manager-spec 에이전트
- **검토 상태**: 사용자 승인 대기

---

## 참고 사항

- 모든 테스트는 Railway 프로덕션 환경에서 수행되어야 함
- 테스트 오디오 파일은 `tests/fixtures/` 디렉토리에 준비
- 성능 벤치마크는 Railway 무료 플랜 기준
- Phase 3는 선택적 기능으로, 사용자 피드백에 따라 구현 여부 결정
