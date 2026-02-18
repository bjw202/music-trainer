@echo off
chcp 65001 >nul
:: Guitar MP3 Trainer - Windows 로컬 개발 서버 시작 스크립트
:: 백엔드(FastAPI)와 프론트엔드(Vite)를 동시에 실행합니다.

:: 프로젝트 루트로 이동 (scripts\ 폴더의 상위 디렉토리)
cd /d "%~dp0.."
set PROJECT_ROOT=%CD%

echo Guitar MP3 Trainer 시작 중...
echo 프로젝트 경로: %PROJECT_ROOT%
echo.

:: ──────────────────────────────────────────
:: Python 확인
:: ──────────────────────────────────────────
where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [오류] Python이 설치되지 않았습니다.
    echo        https://python.org 에서 설치 후 PATH에 추가하세요.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('python -c "import sys; print(str(sys.version_info.major) + '.' + str(sys.version_info.minor))"') do set PYTHON_VERSION=%%v
echo Python %PYTHON_VERSION% 감지됨

:: ──────────────────────────────────────────
:: pnpm 확인
:: ──────────────────────────────────────────
where pnpm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [오류] pnpm이 설치되지 않았습니다.
    echo        'npm install -g pnpm' 명령으로 설치하세요.
    pause
    exit /b 1
)

:: ──────────────────────────────────────────
:: 가상환경 생성 및 백엔드 의존성 설치 (최초 1회)
:: ──────────────────────────────────────────
if not exist "backend\.venv" (
    echo [패키지] 백엔드 가상환경 생성 중 (최초 실행: 5~15분 소요 가능)...
    python -m venv backend\.venv
    echo [패키지] 백엔드 의존성 설치 중 (PyTorch, Demucs 등 대용량 패키지 포함^)...
    backend\.venv\Scripts\pip install --upgrade pip -q
    backend\.venv\Scripts\pip install -r backend\requirements.txt
    echo [완료] 백엔드 의존성 설치 완료
)

:: ──────────────────────────────────────────
:: 프론트엔드 의존성 설치 (최초 1회)
:: ──────────────────────────────────────────
if not exist "node_modules" (
    echo [패키지] 프론트엔드 의존성 설치 중...
    pnpm install
    echo [완료] 프론트엔드 의존성 설치 완료
)

:: ──────────────────────────────────────────
:: .env 파일 자동 설정
:: ──────────────────────────────────────────
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo [설정] .env 파일 생성됨 (.env.example 복사)
    )
)

if not exist "backend\.env" (
    if exist "backend\.env.example" (
        copy "backend\.env.example" "backend\.env" >nul
        echo [설정] backend\.env 파일 생성됨 (backend\.env.example 복사)
    )
)

:: ──────────────────────────────────────────
:: 백엔드 시작 (백그라운드)
:: ──────────────────────────────────────────
echo.
echo [시작] 백엔드 서버 시작 중 (포트 8000)...
start /B backend\.venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8000 --app-dir backend

:: ──────────────────────────────────────────
:: 백엔드 헬스체크 대기 (최대 30초)
:: ──────────────────────────────────────────
echo [대기] 백엔드 준비 대기 중...
set HEALTH_URL=http://localhost:8000/api/v1/health
set /a WAIT_COUNT=0

:health_loop
set /a WAIT_COUNT+=1
if %WAIT_COUNT% gtr 30 (
    echo [경고] 백엔드 30초 내 응답 없음. 계속 진행합니다...
    goto health_done
)

:: curl로 헬스체크 (Windows 10 1803+ 기본 내장)
curl -s -o nul -w "%%{http_code}" %HEALTH_URL% 2>nul | findstr /C:"200" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [완료] 백엔드 준비 완료 (%WAIT_COUNT%초)
    goto health_done
)

timeout /t 1 /nobreak >nul
goto health_loop

:health_done

:: ──────────────────────────────────────────
:: 브라우저 자동 열기 (3초 후)
:: ──────────────────────────────────────────
start /B cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5173"

:: ──────────────────────────────────────────
:: 프론트엔드 시작 (포그라운드)
:: ──────────────────────────────────────────
echo [시작] 프론트엔드 서버 시작 중 (포트 5173)...
echo.
echo ─────────────────────────────────────────────
echo   백엔드:     http://localhost:8000
echo   프론트엔드:  http://localhost:5173
echo   종료:       Ctrl+C (또는 창 닫기)
echo ─────────────────────────────────────────────
echo.

pnpm dev
