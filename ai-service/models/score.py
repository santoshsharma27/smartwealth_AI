from typing import Literal

from pydantic import BaseModel, Field, field_validator


class ScoreRequest(BaseModel):
    """Request model for health score calculation endpoint POST /ai/score."""

    monthly_income: float = Field(..., alias="monthlyIncome", ge=0)
    total_expenses: float = Field(..., alias="totalExpenses", ge=0)
    expenses_by_category: dict[str, float] = Field(..., alias="expensesByCategory")
    cumulative_savings_balance: float = Field(..., alias="cumulativeSavingsBalance")
    months_of_data: int = Field(..., alias="monthsOfData", ge=1)

    model_config = {"populate_by_name": True}

    @field_validator("expenses_by_category")
    @classmethod
    def validate_categories(cls, v: dict[str, float]) -> dict[str, float]:
        allowed = {
            "Rent",
            "Food",
            "Travel",
            "Shopping",
            "Bills",
            "EMI",
            "Healthcare",
            "Entertainment",
            "Investments",
            "Savings",
            "Education",
            "Miscellaneous",
        }
        for key in v:
            if key not in allowed:
                raise ValueError(f"Unknown category: {key}. Must be one of {allowed}")
        return v


class ScoreComponentDetail(BaseModel):
    """Detail for a single score component."""

    score: int = Field(..., ge=0)
    max_score: int = Field(..., alias="maxScore")
    ratio: float = Field(default=0.0)

    model_config = {"populate_by_name": True}


StatusLabel = Literal[
    "Needs Attention", "Fair", "Good", "Very Good", "Excellent"
]


class ScoreResponse(BaseModel):
    """Response model for health score calculation endpoint POST /ai/score."""

    total_score: int = Field(..., alias="totalScore", ge=0, le=100)
    status: StatusLabel
    components: dict[str, ScoreComponentDetail]
    reason: str | None = None

    model_config = {"populate_by_name": True}
