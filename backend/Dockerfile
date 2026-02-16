FROM python:3.12-slim

# ffmpeg 설치 (오디오 처리용)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# PyTorch CPU 전용 설치 (GPU 버전 ~2GB → CPU 버전 ~200MB)
RUN pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu

# 나머지 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 애플리케이션 복사
COPY app/ ./app/

# 다운로드 디렉터리 생성
RUN mkdir -p /tmp/ytdlp_downloads

# Railway 동적 PORT 사용 (HEALTHCHECK는 railway.json에서 관리)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
