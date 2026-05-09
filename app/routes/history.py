from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.models import QueryHistory, User
from app.db.session import get_db
from app.dependencies import can_view_all_history, can_view_sql, get_current_user
from app.history.service import add_feedback, list_history


router = APIRouter(prefix="/history", tags=["history"])


class FeedbackRequest(BaseModel):
    rating: int
    comment: str | None = None


def _serialize(row: QueryHistory, role: str) -> dict:
    payload = {
        "id": row.id,
        "question": row.question,
        "answer": row.answer_json,
        "status": row.status,
        "error_message": row.error_message,
        "created_at": row.created_at.isoformat(),
    }
    if can_view_sql(role):
        payload["sql"] = row.safe_sql or row.generated_sql
    return payload


@router.get("/queries")
def queries(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    return [_serialize(row, user.role) for row in list_history(db, user)]


@router.get("/{history_id}")
def query_detail(history_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    row = db.query(QueryHistory).filter(QueryHistory.id == history_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="History not found")
    if not can_view_all_history(user.role) and row.user_id != user.id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return _serialize(row, user.role)


@router.post("/{history_id}/feedback")
def feedback(history_id: int, payload: FeedbackRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    if payload.rating < 1 or payload.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be 1-5")
    row = db.query(QueryHistory).filter(QueryHistory.id == history_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="History not found")
    if not can_view_all_history(user.role) and row.user_id != user.id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    saved = add_feedback(db, history_id, user.id, payload.rating, payload.comment)
    return {"id": saved.id, "rating": saved.rating}
