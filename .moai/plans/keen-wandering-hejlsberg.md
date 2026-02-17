# FIX: Railway CORS "Failed to fetch" 배포 문제

## Context

Vercel(프론트엔드) + Railway(백엔드) 배포에서 브라우저가 "Failed to fetch" 에러를 표시합니다.
curl로 직접 테스트하면 Railway health 200 OK이지만, CORS preflight(OPTIONS)가 400 "Disallowed CORS origin"으로 실패합니다.

**근본 원인**: pydantic-settings 2.x는 `list[str]` 타입 필드에 대해 환경변수를 **JSON으로 먼저 파싱**합니다. 커스텀 `field_validator`보다 먼저 실행되므로, Railway에 설정한 콤마 구분 문자열(`https://a.com,http://b.com`)이 JSON 파싱에 실패하여 기본값(localhost만 허용)으로 폴백됩니다.

---

## 수정 사항 (1개 파일)

### `backend/app/config.py` - CORS 파싱 수정

**문제**: `cors_origins: list[str]` 타입이므로 pydantic-settings가 JSON 파싱을 먼저 시도. 콤마 구분 문자열이 JSONDecodeError 발생 → 기본값 폴백.

**수정**: 필드 타입을 `str`로 받아서 직접 파싱하거나, pydantic-settings의 `json_parse_fallback` 동작을 우회.

```python
# 현재 (문제)
cors_origins: list[str] = [
    "http://localhost:5173",
    "http://localhost:3000",
]

# 수정안: 타입 어노테이션에 str 유니온 추가 + model_config에 env_parse_none 설정
# 또는 더 간단하게: 필드를 str로 선언하고 프로퍼티로 list 반환
```

구체적 수정:

```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # CORS: str로 받아서 파싱 (pydantic-settings JSON 우선 파싱 우회)
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | list[str]) -> str:
        # list가 들어오면 콤마 조인 (테스트 코드 호환)
        if isinstance(v, list):
            return ",".join(v)
        return v

    @property
    def cors_origins_list(self) -> list[str]:
        """파싱된 CORS 오리진 리스트 반환."""
        v = self.cors_origins
        try:
            parsed = json.loads(v)
            if isinstance(parsed, list):
                return [str(o).strip() for o in parsed]
        except (json.JSONDecodeError, TypeError):
            pass
        return [origin.strip() for origin in v.split(",") if origin.strip()]
```

그리고 `backend/app/main.py`에서:
```python
# 현재
allow_origins=settings.cors_origins,
# 수정
allow_origins=settings.cors_origins_list,
```

---

## 즉시 조치 (Railway 환경변수)

코드 수정 배포 전에 Railway 환경변수를 JSON 배열 형식으로 변경하면 즉시 해결:

```
CORS_ORIGINS=["https://music-trainer-sigma.vercel.app","http://localhost:5173"]
```

(대괄호 + 쌍따옴표 포함, .env.example과 동일한 형식)

---

## 수정 대상 파일

| 파일 | 변경 내용 |
|------|-----------|
| `backend/app/config.py` | cors_origins를 str 타입으로 변경, cors_origins_list 프로퍼티 추가 |
| `backend/app/main.py` | allow_origins에 settings.cors_origins_list 사용 (105행) |

---

## 검증

1. Railway 환경변수를 JSON 배열 형식으로 즉시 변경 → 재배포
2. `curl -X OPTIONS -H "Origin: https://music-trainer-sigma.vercel.app" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type" https://music-trainer-production.up.railway.app/api/v1/youtube/convert` → 200 + `access-control-allow-origin` 헤더 확인
3. 코드 수정 후 로컬 테스트: `CORS_ORIGINS="https://example.com,http://localhost:5173" python -c "from app.config import get_settings; print(get_settings().cors_origins_list)"` → 콤마 구분 파싱 확인
4. 브라우저에서 https://music-trainer-sigma.vercel.app/ 접속 → YouTube URL 변환 테스트
