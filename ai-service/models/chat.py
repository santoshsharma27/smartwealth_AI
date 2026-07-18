from typing import Optional

from pydantic import BaseModel, Field, field_validator


class FinancialContext(BaseModel):
    """Financial context provided for chatbot queries."""

    transactions: list[dict] = Field(default_factory=list)
    summary: Optional[dict] = None
    goals: list[dict] = Field(default_factory=list)
    score: Optional[dict] = None


class ChatRequest(BaseModel):
    """Request model for chatbot endpoint POST /ai/chat."""

    message: str = Field(..., min_length=1, max_length=500, description="User question")
    financial_context: FinancialContext = Field(..., alias="financialContext")

    model_config = {"populate_by_name": True}

    @field_validator("message")
    @classmethod
    def validate_message_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Message must not be empty or whitespace-only")
        return v


class ChatResponse(BaseModel):
    """Response model for chatbot endpoint POST /ai/chat."""

    answer: str = Field(..., description="AI-generated answer")
    disclaimer: str = Field(
        default="This is informational guidance only. Consult a certified financial advisor for professional advice.",
        description="Disclaimer text appended to responses",
    )
