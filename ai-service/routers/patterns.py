"""Pattern detection router for POST /ai/detect-patterns endpoint."""

from fastapi import APIRouter

from models.patterns import DetectPatternsRequest, DetectPatternsResponse
from services.pattern_detector import detect_patterns

router = APIRouter()


@router.post("/ai/detect-patterns", response_model=DetectPatternsResponse)
async def detect_patterns_endpoint(request: DetectPatternsRequest) -> DetectPatternsResponse:
    """Detect recurring expenses and spending anomalies.

    Identifies:
    - Recurring expenses: matching descriptions (case-insensitive) with
      amounts within ±10%, appearing in ≥2 consecutive months.
    - Spending anomalies: transactions exceeding 2× category average
      over the preceding 3 months.

    Returns empty results with a message if less than 2 months of data.
    """
    return detect_patterns(request)
