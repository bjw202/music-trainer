#!/bin/bash
# Guitar MP3 Trainer - macOS 더블클릭 런처
# Finder에서 이 파일을 더블클릭하면 Terminal이 열리고 서버가 시작됩니다.

cd "$(dirname "$0")"
bash scripts/start.sh
