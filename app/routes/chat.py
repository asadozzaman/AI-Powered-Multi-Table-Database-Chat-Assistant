from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.models import DatabaseConnection, User
from app.db.session import get_db
from app.dependencies import get_current_user
from app.sql_agent.agent import ChatAgent


router = APIRouter(prefix="/chat", tags=["chat"])


class ChatAskRequest(BaseModel):
    question: str
    connection_id: int | None = None


@router.post("/ask")
def ask(payload: ChatAskRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    query = db.query(DatabaseConnection)
    connection = query.filter(DatabaseConnection.id == payload.connection_id).first() if payload.connection_id else query.filter(DatabaseConnection.is_default.is_(True)).first()
    if not connection:
        connection = query.order_by(DatabaseConnection.created_at.desc()).first()
    if not connection:
        raise HTTPException(status_code=404, detail="No database connection configured")
    return ChatAgent().ask(db, user, connection, payload.question)
