"""Models for the report generation endpoint POST /ai/report."""

from typing import Optional

from pydantic import BaseModel, Field


class ScoreComponent(BaseModel):
    """A single component of the Financial Health Score."""

    score: int = Field(ge=0, description="Actual score for this component")
    max_score: int = Field(
        ge=1, alias="maxScore", description="Maximum possible score"
    )

    model_config = {"populate_by_name": True}


class HealthScoreData(BaseModel):
    """Health score data for the report."""

    total_score: int = Field(ge=0, le=100, alias="totalScore")
    status_label: str = Field(alias="statusLabel")
    components: dict[str, ScoreComponent] = Field(default_factory=dict)

    model_config = {"populate_by_name": True}


class GoalSummary(BaseModel):
    """Summary of a financial goal for the report."""

    goal_name: str = Field(alias="goalName")
    target_amount: float = Field(alias="targetAmount")
    duration_months: int = Field(alias="durationMonths")
    required_monthly_savings: float = Field(alias="requiredMonthlySavings")
    feasibility_status: str = Field(alias="feasibilityStatus")

    model_config = {"populate_by_name": True}


class ActionItem(BaseModel):
    """A prioritized action item for the report."""

    priority: int = Field(ge=1)
    text: str


class ReportRequest(BaseModel):
    """Request model for report generation endpoint POST /ai/report."""

    monthly_income: Optional[float] = Field(None, alias="monthlyIncome")
    total_expenses: Optional[float] = Field(None, alias="totalExpenses")
    monthly_savings: Optional[float] = Field(None, alias="monthlySavings")
    expenses_by_category: Optional[dict[str, float]] = Field(
        None, alias="expensesByCategory"
    )
    health_score: Optional[HealthScoreData] = Field(None, alias="healthScore")
    recommendations: list[str] = Field(default_factory=list)
    goals: list[GoalSummary] = Field(default_factory=list)
    action_items: list[ActionItem] = Field(default_factory=list, alias="actionItems")

    model_config = {"populate_by_name": True}
