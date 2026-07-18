"""Pydantic models for the recommendation engine endpoint POST /ai/recommend."""

from pydantic import BaseModel, Field


class RecommendRequest(BaseModel):
    """Request model for recommendation generation endpoint POST /ai/recommend."""

    monthly_income: float | None = Field(None, alias="monthlyIncome", ge=0)
    total_expenses: float | None = Field(None, alias="totalExpenses", ge=0)
    expenses_by_category: dict[str, float] | None = Field(None, alias="expensesByCategory")
    savings_rate: float | None = Field(None, alias="savingsRate")
    emi_amount: float | None = Field(None, alias="emiAmount", ge=0)
    investment_amount: float | None = Field(None, alias="investmentAmount", ge=0)

    model_config = {"populate_by_name": True}


class Recommendation(BaseModel):
    """A single financial recommendation."""

    category: str = Field(..., description="Category the recommendation addresses")
    text: str = Field(..., description="Recommendation text in plain language")
    data_point_reference: str = Field(
        ...,
        alias="dataPointReference",
        description="Specific data point from user's financial data this references",
    )

    model_config = {"populate_by_name": True}


class RecommendResponse(BaseModel):
    """Response model for recommendation generation endpoint POST /ai/recommend."""

    recommendations: list[Recommendation] = Field(
        ..., min_length=3, max_length=7
    )
    count: int = Field(..., ge=3, le=7, description="Number of recommendations generated")
    disclaimer: str = Field(
        ...,
        description="Standard disclaimer about consulting a certified financial advisor",
    )
    missing_data_categories: list[str] = Field(
        default_factory=list,
        alias="missingDataCategories",
        description="Data categories that were not available for analysis",
    )

    model_config = {"populate_by_name": True}
