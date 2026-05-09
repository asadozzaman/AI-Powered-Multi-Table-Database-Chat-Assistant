from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models import QueryFeedback, QueryHistory, User
from app.dependencies import can_view_all_history


def log_query(
    db: Session,
    user_id: int,
    connection_id: int,
    question: str,
    generated_sql: str | None,
    safe_sql: str | None,
    answer_json: dict,
    status: str = "success",
    error_message: str | None = None,
) -> QueryHistory:
    history = QueryHistory(
        user_id=user_id,
        connection_id=connection_id,
        question=question,
        generated_sql=generated_sql,
        safe_sql=safe_sql,
        answer_json=answer_json,
        status=status,
        error_message=error_message,
    )
    db.add(history)
    db.commit()
    db.refresh(history)
    return history


def list_history(db: Session, user: User) -> list[QueryHistory]:
    query = db.query(QueryHistory).order_by(QueryHistory.created_at.desc())
    if not can_view_all_history(user.role):
        query = query.filter(QueryHistory.user_id == user.id)
    return query.limit(100).all()


def add_feedback(db: Session, history_id: int, user_id: int, rating: int, comment: str | None) -> QueryFeedback:
    feedback = QueryFeedback(query_history_id=history_id, user_id=user_id, rating=rating, comment=comment)
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback
