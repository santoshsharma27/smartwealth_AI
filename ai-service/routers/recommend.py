"""Recommendation engine router for POST /ai/recommend endpoint."""

from fastapi import APIRouter

from models.recommend import RecommendRequest, RecommendResponse
from services.recommender import generate_recommendations

router = APIRouter()


@router.post("/ai/recommend", response_model=RecommendResponse)
async def recommend(request: RecommendRequest) -> RecommendResponse:
    """Generate personalized financial recommendations.

    Produces 3-7 recommendations based on the user's financial summary.
    Each recommendation references specific numeric data points,
    uses plain language, and excludes specific financial instrument names.

    The response includes a disclaimer about consulting a certified
    financial advisor and lists any missing data categories.
    """
    return generate_recommendations(request)
