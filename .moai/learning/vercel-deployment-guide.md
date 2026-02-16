# Vercel 프론트엔드 배포 가이드

> **작성일**: 2026-02-16
> **대상**: Guitar MP3 Trainer v2 (Vite + React + TypeScript)
> **플랫폼**: Vercel (무료 티어)

---

## 목차

1. [사전 준비사항](#사전-준비사항)
2. [Step 1: Vercel 계정 생성](#step-1-vercel-계정-생성)
3. [Step 2: GitHub 저장소 연결](#step-2-github-저장소-연결)
4. [Step 3: 프로젝트 Import](#step-3-프로젝트-import)
5. [Step 4: 빌드 설정 확인](#step-4-빌드-설정-확인)
6. [Step 5: 환경 변수 설정](#step-5-환경-변수-설정)
7. [Step 6: 배포 실행](#step-6-배포-실행)
8. [Step 7: 배포 확인](#step-7-배포-확인)
9. [Step 8: 커스텀 도메인 설정 (선택사항)](#step-8-커스텀-도메인-설정-선택사항)
10. [자주 발생하는 문제 해결](#자주-발생하는-문제-해결)
11. [자동 배포 워크플로](#자동-배포-워크플로)

---

## 사전 준비사항

### 필수 조건

- [x] GitHub 저장소에 코드 푸시 완료
- [x] `package.json`에 `build` 스크립트 존재 확인
- [x] `vite.config.ts` 설정 완료
- [x] `.env.example` 파일 준비 (환경 변수 템플릿)

### 로컬 빌드 테스트

배포 전 반드시 로컬에서 프로덕션 빌드를 테스트하세요:

```bash
# 의존성 설치 확인
npm install

# TypeScript 타입 체크
npm run typecheck

# 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview
```

**성공 확인**:
- `dist/` 폴더 생성됨
- `http://localhost:4173`에서 앱 정상 동작
- 콘솔 에러 없음

---

## Step 1: Vercel 계정 생성

### 1.1 Vercel 가입

1. [Vercel 홈페이지](https://vercel.com) 접속
2. **"Sign Up"** 클릭
3. **"Continue with GitHub"** 선택
4. GitHub 계정으로 로그인 및 권한 승인

### 1.2 Vercel CLI 설치 (선택사항)

로컬에서 배포를 관리하려면 Vercel CLI를 설치하세요:

```bash
npm install -g vercel

# 로그인
vercel login
```

---

## Step 2: GitHub 저장소 연결

### 2.1 GitHub 계정 연동 확인

Vercel 대시보드에서:
1. 우측 상단 프로필 아이콘 클릭
2. **"Settings"** → **"Git Integration"**
3. GitHub 연결 상태 확인 (초록색 체크 표시)

### 2.2 저장소 권한 부여

만약 특정 저장소가 보이지 않는다면:
1. **"Adjust GitHub App Permissions"** 클릭
2. Vercel에 접근 권한 부여할 저장소 선택
   - `guitar-mp3-trainer-v2` 체크
3. **"Save"** 클릭

---

## Step 3: 프로젝트 Import

### 3.1 새 프로젝트 생성

1. Vercel 대시보드 메인 화면에서 **"Add New..."** 클릭
2. **"Project"** 선택
3. **"Import Git Repository"** 섹션에서 `guitar-mp3-trainer-v2` 찾기
4. **"Import"** 클릭

### 3.2 프로젝트 설정 화면

다음 화면에서 아래 설정을 진행합니다.

---

## Step 4: 빌드 설정 확인

Vercel은 자동으로 Vite 프로젝트를 감지하지만, 수동으로 확인해야 합니다:

### 4.1 Framework Preset

```
Framework Preset: Vite
```

만약 "Other"로 표시된다면 **"Vite"**로 변경하세요.

### 4.2 Root Directory

```
Root Directory: ./
```

**중요**: 루트 디렉터리는 프론트엔드 코드가 있는 위치입니다.
백엔드 폴더(`backend/`)는 Railway에서 별도로 배포하므로 무시됩니다.

### 4.3 Build Command

```bash
tsc && vite build
```

**설명**:
- `tsc`: TypeScript 타입 체크 및 컴파일
- `vite build`: 프로덕션 빌드 수행

### 4.4 Output Directory

```
dist
```

**설명**: Vite는 빌드 결과를 `dist/` 폴더에 생성합니다.
이 폴더가 Vercel CDN에 배포됩니다.

### 4.5 Install Command

```bash
npm install
```

또는 `pnpm`, `yarn` 사용 시:
```bash
pnpm install
# 또는
yarn install
```

---

## Step 5: 환경 변수 설정

### 5.1 환경 변수 추가

**"Environment Variables"** 섹션에서:

| Key | Value | Environment |
|-----|-------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Production, Preview, Development |

**임시 값 설명**:
- Railway 백엔드 배포 전이므로 일단 로컬 주소로 설정
- **Railway 배포 후 실제 백엔드 URL로 업데이트 필요**

### 5.2 Railway 배포 후 업데이트

Railway 백엔드 배포 완료 후:

1. Vercel 대시보드 → 프로젝트 선택 → **"Settings"** → **"Environment Variables"**
2. `VITE_API_BASE_URL` 값 수정:
   ```
   https://your-backend.railway.app
   ```
3. **"Save"** 클릭
4. **"Deployments"** 탭 → 최신 배포 → **"Redeploy"** 클릭

---

## Step 6: 배포 실행

### 6.1 배포 시작

모든 설정 완료 후 **"Deploy"** 버튼 클릭

### 6.2 빌드 로그 확인

배포 화면에서 실시간 로그를 확인할 수 있습니다:

```
Running "npm install"
added 234 packages in 15s

Running "npm run build"
vite v6.0.1 building for production...
✓ 156 modules transformed.
dist/index.html                   0.52 kB
dist/assets/index-abc123.js     234.56 kB │ gzip: 78.12 kB

Build completed successfully!

Deploying to Vercel Edge Network...
Deployment completed in 2m 34s
```

### 6.3 배포 완료 확인

**성공 메시지**:
```
✅ Deployment ready
   https://guitar-mp3-trainer-v2.vercel.app
```

---

## Step 7: 배포 확인

### 7.1 배포된 앱 접속

1. Vercel 대시보드에서 **"Visit"** 버튼 클릭
2. 또는 제공된 URL 직접 접속:
   ```
   https://guitar-mp3-trainer-v2.vercel.app
   ```

### 7.2 기능 테스트

**현재 단계에서 가능한 테스트**:
- [x] 앱 UI 정상 로드
- [x] 로컬 오디오 파일 업로드 및 재생
- [x] 키보드 단축키 (Q, Space, 방향키 등)
- [x] 음량 조절, 속도 조절, 피치 조절

**현재 단계에서 불가능한 테스트** (Railway 배포 후 가능):
- [ ] YouTube URL 변환
- [ ] AI 음원 분리 (Demucs)
- [ ] 백엔드 API 호출

**예상 동작**:
- YouTube 변환 시도 시: "Failed to fetch" 또는 CORS 에러 (정상, 백엔드 미배포)
- 로컬 파일 재생: 정상 동작 (브라우저 내 처리)

### 7.3 브라우저 DevTools 확인

Chrome DevTools 열기 (F12):

**Console 탭**:
- 에러 메시지 확인
- `VITE_API_BASE_URL` 값 확인:
  ```javascript
  console.log(import.meta.env.VITE_API_BASE_URL)
  // 출력: http://localhost:8000
  ```

**Network 탭**:
- Static 파일 로드 확인 (200 OK)
- API 호출 실패 확인 (CORS 에러, 정상)

---

## Step 8: 커스텀 도메인 설정 (선택사항)

### 8.1 도메인 준비

자신의 도메인이 있다면 (예: `musictrainer.com`):

1. Vercel 프로젝트 → **"Settings"** → **"Domains"**
2. **"Add"** 클릭
3. 도메인 입력: `musictrainer.com` 또는 `app.musictrainer.com`
4. **"Add"** 클릭

### 8.2 DNS 설정

Vercel이 제공하는 DNS 레코드를 도메인 등록업체(예: Cloudflare, GoDaddy)에 추가:

**A 레코드**:
```
Type: A
Name: @
Value: 76.76.21.21
```

**CNAME 레코드** (서브도메인 사용 시):
```
Type: CNAME
Name: app
Value: cname.vercel-dns.com
```

### 8.3 SSL 인증서 자동 발급

Vercel은 Let's Encrypt를 통해 SSL 인증서를 **자동으로 발급**합니다:
- 발급 시간: 수 분 ~ 1시간
- 갱신: 자동 (90일마다)

---

## 자주 발생하는 문제 해결

### 문제 1: 빌드 실패 - TypeScript 에러

**증상**:
```
error TS2307: Cannot find module '@/components/Player'
Build failed
```

**해결 방법**:
1. 로컬에서 `npm run typecheck` 실행하여 에러 확인
2. `tsconfig.json`의 `paths` 설정 확인:
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./src/*"],
         "@components/*": ["./src/components/*"]
       }
     }
   }
   ```
3. `vite.config.ts`의 `alias` 설정과 일치하는지 확인
4. 수정 후 `git push` → Vercel 자동 재배포

---

### 문제 2: 빌드 성공했지만 404 에러

**증상**:
- `/` 페이지는 정상 로드
- `/about` 같은 경로 접속 시 404 에러

**원인**:
SPA 라우팅 설정이 없어서 Vercel이 `/about.html`을 찾으려고 시도

**해결 방법**:
`vercel.json` 파일 생성 (이미 생성됨):
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

---

### 문제 3: 환경 변수가 undefined

**증상**:
```javascript
console.log(import.meta.env.VITE_API_BASE_URL)
// 출력: undefined
```

**원인**:
- Vercel 환경 변수에 `VITE_API_BASE_URL`을 설정하지 않음
- 또는 `VITE_` 접두사 누락

**해결 방법**:
1. Vercel 대시보드 → **"Settings"** → **"Environment Variables"**
2. 변수명 확인: **`VITE_API_BASE_URL`** (대문자)
3. Environment 체크: **Production, Preview, Development** 모두 선택
4. **"Save"** 후 **"Redeploy"** 필수

**주의**: 환경 변수 변경 시 반드시 재배포해야 적용됩니다!

---

### 문제 4: CORS 에러 (Railway 배포 후)

**증상**:
```
Access to fetch at 'https://api.railway.app/convert' from origin
'https://guitar-mp3-trainer-v2.vercel.app' has been blocked by CORS policy
```

**원인**:
Railway 백엔드의 CORS 설정에서 Vercel 도메인을 허용하지 않음

**해결 방법**:
1. Railway 대시보드 → 프로젝트 → **"Variables"**
2. `CORS_ORIGINS` 환경 변수 확인:
   ```
   https://guitar-mp3-trainer-v2.vercel.app
   ```
3. **정확히 일치하는지 확인** (하이픈, 점, 슬래시)
4. Railway 서비스 재시작
5. Vercel 앱에서 재테스트

---

### 문제 5: 빌드 시간 초과

**증상**:
```
Error: Build exceeded maximum duration of 45 minutes
```

**원인**:
- 너무 많은 의존성
- 또는 무한 루프 빌드 스크립트

**해결 방법**:

**임시 해결책**:
1. Vercel 대시보드 → **"Settings"** → **"Functions"**
2. **"Max Duration"** → 60초로 증가

**근본 해결책**:
1. 의존성 최적화:
   ```bash
   # 사용하지 않는 패키지 제거
   npm uninstall <unused-package>

   # package-lock.json 정리
   rm -rf node_modules package-lock.json
   npm install
   ```

2. 빌드 캐싱 활성화:
   ```json
   // vercel.json
   {
     "build": {
       "env": {
         "VITE_BUILD_CACHE": "true"
       }
     }
   }
   ```

---

## 자동 배포 워크플로

### Git Push → 자동 배포

**main 브랜치 푸시 시**:
```bash
git add .
git commit -m "feat: 새 기능 추가"
git push origin main
```

**Vercel 자동 동작**:
1. GitHub Webhook 감지
2. 코드 클론
3. 빌드 실행 (`npm run build`)
4. 프로덕션 배포
5. 완료 알림 (이메일, Slack 연동 가능)

**배포 시간**: 평균 2-3분

---

### Pull Request Preview 배포

**PR 생성 시**:
```bash
git checkout -b feature/new-ui
# 작업 후
git push origin feature/new-ui
```

GitHub에서 PR 생성 시:
- Vercel이 **자동으로 Preview 배포** 생성
- PR 댓글에 Preview URL 추가:
  ```
  ✅ Preview deployment ready
     https://guitar-mp3-trainer-v2-git-feature-new-ui-username.vercel.app
  ```

**활용**:
- 팀원과 변경사항 미리보기 공유
- 프로덕션 배포 전 테스트

---

### 배포 롤백

**문제 발생 시 이전 버전으로 롤백**:

1. Vercel 대시보드 → **"Deployments"**
2. 이전 배포 선택
3. **"︙"** (점 3개) → **"Promote to Production"**
4. 즉시 이전 버전으로 복구 (30초 이내)

---

## 배포 완료 체크리스트

배포 후 다음 항목을 확인하세요:

### 프론트엔드 단독 기능

- [x] 앱 UI 정상 로드
- [x] 로컬 오디오 파일 업로드 및 재생
- [x] 재생 컨트롤 (재생/일시정지, 탐색)
- [x] 음량 조절, 속도 조절, 피치 조절
- [x] 키보드 단축키 (Q, Space, ←, →, ↑, ↓)
- [x] 반응형 UI (모바일, 태블릿, 데스크톱)

### Railway 백엔드 연동 후 추가 기능

- [ ] YouTube URL 입력 및 변환
- [ ] 진행률 표시 (SSE)
- [ ] MP3 다운로드 및 재생
- [ ] AI 음원 분리 (Demucs)
- [ ] 스템 믹서 UI (Vocals, Drums, Bass, Other)
- [ ] 스템별 음량 조절

---

## 다음 단계

1. **Railway 백엔드 배포**: `backend/` 폴더를 Railway에 배포
2. **환경 변수 업데이트**: Vercel의 `VITE_API_BASE_URL`을 Railway URL로 변경
3. **CORS 설정**: Railway 환경 변수에 Vercel 도메인 추가
4. **통합 테스트**: YouTube 변환 및 음원 분리 기능 전체 테스트
5. **모니터링 설정**: Vercel Analytics 활성화

---

## 참고 자료

- [Vercel 공식 문서](https://vercel.com/docs)
- [Vite 프로덕션 빌드 가이드](https://vitejs.dev/guide/build.html)
- [환경 변수 설정 가이드](https://vercel.com/docs/concepts/projects/environment-variables)
- [커스텀 도메인 설정](https://vercel.com/docs/concepts/projects/domains)

---

**작성일**: 2026-02-16
**버전**: 1.0.0
**다음 업데이트**: Railway 백엔드 배포 후 통합 가이드
