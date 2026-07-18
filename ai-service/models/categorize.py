from pydantic import BaseModel, Field, field_validator


EXPENSE_CATEGORIES = {
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


class TransactionInput(BaseModel):
    """A transaction to be categorized."""

    id: str = Field(..., description="UUID of the transaction")
    description: str = Field(..., description="Transaction description")
    amount: float = Field(..., description="Transaction amount")
    type: str = Field(..., description="Transaction type: credit or debit")

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        allowed = {"credit", "debit"}
        if v not in allowed:
            raise ValueError(f"type must be one of {allowed}")
        return v


class CategorizeRequest(BaseModel):
    """Request model for categorization endpoint POST /ai/categorize."""

    transactions: list[TransactionInput] = Field(
        ..., min_length=1, description="List of transactions to categorize"
    )


class CategorizedTransaction(BaseModel):
    """A single categorized transaction result."""

    id: str = Field(..., description="UUID matching the input transaction")
    category: str = Field(..., description="Assigned expense category")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score")
    method: str = Field(..., description="Categorization method: rule_based or llm_based")

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in EXPENSE_CATEGORIES:
            raise ValueError(f"category must be one of {EXPENSE_CATEGORIES}")
        return v

    @field_validator("method")
    @classmethod
    def validate_method(cls, v: str) -> str:
        allowed = {"rule_based", "llm_based"}
        if v not in allowed:
            raise ValueError(f"method must be one of {allowed}")
        return v


class CategorizeStats(BaseModel):
    """Statistics about the categorization run."""

    total_processed: int = Field(..., alias="totalProcessed", ge=0)
    rule_based: int = Field(..., alias="ruleBased", ge=0)
    llm_based: int = Field(..., alias="llmBased", ge=0)
    llm_available: bool = Field(..., alias="llmAvailable")

    model_config = {"populate_by_name": True}


class CategorizeResponse(BaseModel):
    """Response model for categorization endpoint POST /ai/categorize."""

    categorized_transactions: list[CategorizedTransaction] = Field(
        ..., alias="categorizedTransactions"
    )
    stats: CategorizeStats

    model_config = {"populate_by_name": True}
