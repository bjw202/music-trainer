# Plan: SPEC-BACKEND-001 아카이브 처리

## Context

Railway 배포 포기로 인해 SPEC-BACKEND-001의 주요 목표(프로덕션 안정화)가 무효화됨.
Phase 1(split=True OOM 해결)은 완료되었으나, SPEC 전체 맥락이 Railway 전제이므로
"포기됨" 상태로 아카이브 처리가 적절함.

## 변경 파일

- `.moai/specs/SPEC-BACKEND-001/spec.md`
  - 상태: `완료 (Phase 1-2), Phase 3 Optional 미구현` → `아카이브 (Railway 배포 포기)`
  - 하단에 아카이브 사유 섹션 추가

## 작업

1. spec.md 메타데이터 상태 업데이트
2. 아카이브 사유 섹션 추가 (Railway 포기 결정, 날짜, 잔존 변경사항 요약)
3. git commit & push
