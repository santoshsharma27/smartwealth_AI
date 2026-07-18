"""Chatbot router for POST /ai/chat endpoint."""

from fastapi import APIRouter

from models.chat import ChatRequest, ChatResponse
from services.chatbot import process_chat

router = APIRouter()


@router.post("/ai/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """Process a chatbot question and return a contextual response.

    Accepts a user question with optional financial context (transactions,
    summary, goals, score data). Generates a response using only the user's
    financial data, includes a disclaimer, handles missing data, and declines
    specific investment product requests.
    """
    return process_chat(request)
