from typing import Optional

from pydantic import BaseModel, Field


class PatternTransaction(BaseModel):
    """A transaction for pattern detection."""

    date: str = Field(..., description="Transaction date (YYYY-MM-DD)")
    description: str = Field(..., description="Transaction description")
    amount: float = Field(..., description="Transaction amount")
    type: str = Field(default="debit", description="Transaction type (credit/debit)")
    category: str = Field(..., description="Assigned expense category")


class DetectPatternsRequest(BaseModel):
    """Request model for pattern detection endpoint POST /ai/detect-patterns."""

    transactions: list[PatternTransaction] = Field(
        ..., description="List of categorized transactions"
    )
    months_of_data: int = Field(
        ..., alias="monthsOfData", ge=0, description="Number of months of data available"
    )

    model_config = {"populate_by_name": True}


class RecurringExpense(BaseModel):
    """A detected recurring expense."""

    description: str = Field(..., description="Transaction description")
    recurring_amount: float = Field(
        ..., alias="recurringAmount", description="Typical recurring amount"
    )
    consecutive_months: int = Field(
        ..., alias="consecutiveMonths", ge=2, description="Number of consecutive months detected"
    )

    model_config = {"populate_by_name": True}


class SpendingAnomaly(BaseModel):
    """A detected spending anomaly."""

    description: str = Field(..., description="Transaction description")
    transaction_amount: float = Field(
        ..., alias="transactionAmount", description="Amount of the anomalous transaction"
    )
    category: str = Field(..., description="Expense category")
    category_average: float = Field(
        ..., alias="categoryAverage", description="Average amount for this category"
    )

    model_config = {"populate_by_name": True}


class DetectPatternsResponse(BaseModel):
    """Response model for pattern detection endpoint POST /ai/detect-patterns."""

    recurring_expenses: list[RecurringExpense] = Field(
        default_factory=list, alias="recurringExpenses"
    )
    spending_anomalies: list[SpendingAnomaly] = Field(
        default_factory=list, alias="spendingAnomalies"
    )
    message: Optional[str] = Field(
        default=None, description="Optional message (e.g., insufficient data)"
    )

    model_config = {"populate_by_name": True}
