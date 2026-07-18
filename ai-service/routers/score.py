"""Financial Health Score router for POST /ai/score endpoint."""

from fastapi import APIRouter

from models.score import ScoreRequest, ScoreResponse
from services.scorer import calculate_health_score

router = APIRouter()


@router.post("/ai/score", response_model=ScoreResponse)
async def calculate_score(request: ScoreRequest) -> ScoreResponse:
    """Calculate Financial Health Score based on financial summary data.

    Computes a score from 0 to 100 from five weighted components:
    Savings Ratio, Expense Control, EMI Burden, Investment Allocation,
    and Emergency Fund Readiness.

    Returns score, status label, and per-component breakdown.
    """
    return calculate_health_score(request)
