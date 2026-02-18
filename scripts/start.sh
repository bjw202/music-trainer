#!/bin/bash
# Guitar MP3 Trainer - 로컬 개발 서버 시작 스크립트
# 백엔드(FastAPI)와 프론트엔드(Vite)를 동시에 실행합니다.

set -e

# 프로젝트 루트로 이동
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "🎸 Guitar MP3 Trainer 시작 중..."
echo "📁 프로젝트 경로: $PROJECT_ROOT"
echo ""

# Python 버전 확인
if ! command -v python3 &>/dev/null; then
  echo "❌ Python 3이 설치되지 않았습니다. https://python.org 에서 설치하세요."
  exit 1
fi

PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "🐍 Python $PYTHON_VERSION 감지됨"

# pnpm 확인
if ! command -v pnpm &>/dev/null; then
  echo "❌ pnpm이 설치되지 않았습니다. 'npm install -g pnpm' 으로 설치하세요."
  exit 1
fi

# ──────────────────────────────────────────
# 가상환경 생성 및 백엔드 의존성 설치 (최초 1회)
# ──────────────────────────────────────────
if [ ! -d "backend/.venv" ]; then
  echo "📦 백엔드 가상환경 생성 중 (최초 실행: 5~15분 소요 가능)..."
  python3 -m venv backend/.venv
  echo "📦 백엔드 의존성 설치 중 (PyTorch, Demucs 등 대용량 패키지 포함)..."
  backend/.venv/bin/pip install --upgrade pip -q
  backend/.venv/bin/pip install -r backend/requirements.txt
  echo "✅ 백엔드 의존성 설치 완료"
fi

# 프론트엔드 의존성 설치 (최초 1회)
if [ ! -d "node_modules" ]; then
  echo "📦 프론트엔드 의존성 설치 중..."
  pnpm install
  echo "✅ 프론트엔드 의존성 설치 완료"
fi

# ──────────────────────────────────────────
# .env 파일 자동 설정
# ──────────────────────────────────────────
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  cp .env.example .env
  echo "📝 .env 파일 생성됨 (.env.example 복사)"
fi

if [ ! -f "backend/.env" ] && [ -f "backend/.env.example" ]; then
  cp backend/.env.example backend/.env
  echo "📝 backend/.env 파일 생성됨 (backend/.env.example 복사)"
fi

# ──────────────────────────────────────────
# 백엔드 시작 (백그라운드)
# ──────────────────────────────────────────
echo ""
echo "🚀 백엔드 서버 시작 중 (포트 8000)..."
cd backend
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!
cd "$PROJECT_ROOT"

# 종료 시 두 프로세스 모두 정리
cleanup() {
  echo ""
  echo "🛑 서버 종료 중..."
  kill "$BACKEND_PID" 2>/dev/null || true
  echo "✅ 모든 서버가 종료되었습니다."
}
trap cleanup EXIT INT TERM

# ──────────────────────────────────────────
# 백엔드 헬스체크 대기 (최대 30초)
# ──────────────────────────────────────────
echo "⏳ 백엔드 준비 대기 중..."
HEALTH_URL="http://localhost:8000/api/v1/health"
for i in $(seq 1 30); do
  if curl -s "$HEALTH_URL" > /dev/null 2>&1; then
    echo "✅ 백엔드 준비 완료 (${i}초)"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "⚠️  백엔드 30초 내 응답 없음. 계속 진행합니다..."
  fi
  sleep 1
done

# ──────────────────────────────────────────
# 브라우저 자동 열기 (macOS)
# ──────────────────────────────────────────
if command -v open &>/dev/null; then
  # Vite 포트 5173이 준비되기를 잠시 기다렸다가 브라우저 오픈
  (sleep 3 && open "http://localhost:5173") &
fi

# ──────────────────────────────────────────
# 프론트엔드 시작 (포그라운드)
# ──────────────────────────────────────────
echo "🚀 프론트엔드 서버 시작 중 (포트 5173)..."
echo ""
echo "─────────────────────────────────────────────"
echo "  백엔드:    http://localhost:8000"
echo "  프론트엔드: http://localhost:5173"
echo "  종료:      Ctrl+C"
echo "─────────────────────────────────────────────"
echo ""

pnpm dev
