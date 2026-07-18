"""Pydantic v2 request/response models for the SmartWealth AI service."""

from models.parse import (
    ExtractedTransaction,
    ParseMetadata,
    ParseRequest,
    ParseResponse,
    SalaryData,
)
from models.categorize import (
    CategorizedTransaction,
    CategorizeRequest,
    CategorizeResponse,
    CategorizeStats,
    TransactionInput,
)
from models.score import ScoreComponentDetail, ScoreRequest, ScoreResponse
from models.recommend import Recommendation, RecommendRequest, RecommendResponse
from models.chat import ChatRequest, ChatResponse, FinancialContext
from models.patterns import (
    DetectPatternsRequest,
    DetectPatternsResponse,
    PatternTransaction,
    RecurringExpense,
    SpendingAnomaly,
)
from models.report import ReportRequest

__all__ = [
    # Parse
    "ParseRequest",
    "ParseResponse",
    "ExtractedTransaction",
    "SalaryData",
    "ParseMetadata",
    # Categorize
    "CategorizeRequest",
    "CategorizeResponse",
    "CategorizedTransaction",
    "CategorizeStats",
    "TransactionInput",
    # Score
    "ScoreRequest",
    "ScoreResponse",
    "ScoreComponentDetail",
    # Recommend
    "RecommendRequest",
    "RecommendResponse",
    "Recommendation",
    # Chat
    "ChatRequest",
    "ChatResponse",
    "FinancialContext",
    # Patterns
    "DetectPatternsRequest",
    "DetectPatternsResponse",
    "PatternTransaction",
    "RecurringExpense",
    "SpendingAnomaly",
    # Report
    "ReportRequest",
]
