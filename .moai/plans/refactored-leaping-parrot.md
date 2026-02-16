# Phase 4 문서 업데이트: GPU 가속 → CPU 처리 전환

## Context

Phase 4 (AI 음원 분리 및 스템 믹서)는 원래 GPU 가속 (CUDA/MPS)을 계획했으나, 비용 효율적인 백엔드 운영을 위해 CPU 전용 처리로 전환한다. 프로젝트 문서(product.md, tech.md)에 이 결정을 반영하여, 향후 개발 시 CPU 기반 아키텍처로 진행하도록 한다.

## 변경 사항

### 1. `.moai/project/product.md`

**Line 95** - GPU 가속 제거:
- Before: `GPU 가속 처리 (CUDA/MPS 지원)`
- After: `CPU 기반 처리 (비용 효율적 서버 운영)`

**Line 96** - 작업 큐 단순화:
- Before: `비동기 작업 큐 (Celery/Redis 또는 백그라운드 태스크)`
- After: `비동기 백그라운드 태스크 (FastAPI BackgroundTasks)`

### 2. `.moai/project/tech.md`

**Line 180** - 성능 수치 CPU 기준으로 수정:
- Before: `실시간 성능: 곡 길이의 50% 시간에 처리 가능 (GPU 사용 시)`
- After: `CPU 처리 성능: 곡 길이의 2~5배 시간 소요 (서버 CPU 사양에 따라 다름)`

**Line 411-414** - GPU 가속 섹션을 CPU 기반으로 전면 수정:
- Before:
  ```
  **GPU 가속 (선택)**
  - Demucs CPU 처리: 곡 길이의 50% 시간 소요
  - GPU 처리: 곡 길이의 10% 시간 소요
  - Railway GPU 옵션 또는 AWS EC2 g4dn 인스턴스
  ```
- After:
  ```
  **CPU 기반 처리 (비용 우선)**
  - Demucs CPU 처리: 곡 길이의 2~5배 시간 소요
  - 비용 효율: GPU 인스턴스 대비 월 운영비 80% 이상 절감
  - Railway 또는 Fly.io CPU 인스턴스 (2~4 vCPU, 4~8GB RAM)
  - 향후 수요 증가 시 GPU 옵션 검토 가능
  ```

**Line 49-50** - 데이터베이스 섹션에서 Redis 역할 명확화:
- Before: `Redis: 캐싱 및 작업 큐 (선택)`
- After: `Redis: 분리 결과 캐싱 (선택)`

## 수정 대상 파일

| 파일 | 변경 | 설명 |
|------|------|------|
| `.moai/project/product.md` | EDIT | Phase 4 GPU→CPU, 작업 큐 단순화 |
| `.moai/project/tech.md` | EDIT | 성능 수치, 배포 섹션, Redis 역할 수정 |

## 검증

1. 두 파일에서 "GPU", "CUDA", "MPS", "g4dn" 검색 → 결과 0건 확인
2. "CPU" 키워드로 Phase 4 관련 내용이 올바르게 반영되었는지 확인
3. `git diff`로 변경 내용 최종 검토
