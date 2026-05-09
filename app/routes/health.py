import time
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.session import get_db

router = APIRouter(tags=["health"])

_START = time.time()


@router.get("/health")
def health(db: Session = Depends(get_db)) -> dict:
    settings = get_settings()
    db_ok = False
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    return {
        "status": "ok" if db_ok else "degraded",
        "app_env": settings.app_env,
        "uptime_seconds": round(time.time() - _START),
        "checks": {
            "database": "ok" if db_ok else "error",
            "llm_provider": settings.llm_provider,
            "vector_db": settings.vector_db_type,
        },
    }
