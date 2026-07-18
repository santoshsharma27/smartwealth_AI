from typing import Optional

from pydantic import BaseModel, Field, field_validator


class ParseRequest(BaseModel):
    """Request model for document parsing endpoint POST /ai/parse."""

    document_id: str = Field(..., alias="documentId", description="UUID of the document")
    document_type: str = Field(
        ..., alias="documentType", description="Type: salary_slip or bank_statement"
    )
    file_format: str = Field(..., alias="fileFormat", description="Format: pdf or csv")
    file_content: str = Field(
        ..., alias="fileContent", description="Base64-encoded file bytes"
    )

    model_config = {"populate_by_name": True}

    @field_validator("document_type")
    @classmethod
    def validate_document_type(cls, v: str) -> str:
        allowed = {"salary_slip", "bank_statement"}
        if v not in allowed:
            raise ValueError(f"document_type must be one of {allowed}")
        return v

    @field_validator("file_format")
    @classmethod
    def validate_file_format(cls, v: str) -> str:
        allowed = {"pdf", "csv"}
        if v not in allowed:
            raise ValueError(f"file_format must be one of {allowed}")
        return v


class ExtractedTransaction(BaseModel):
    """A single transaction extracted from a bank statement."""

    date: str = Field(..., description="Transaction date (YYYY-MM-DD)")
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


class SalaryData(BaseModel):
    """Extracted salary slip data."""

    gross_salary: float = Field(..., alias="grossSalary", ge=0)
    net_salary: float = Field(..., alias="netSalary", ge=0)
    employer_name: Optional[str] = Field(None, alias="employerName")
    month_year: Optional[str] = Field(None, alias="monthYear")
    deductions: list[dict] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class ParseMetadata(BaseModel):
    """Metadata about the parsing result."""

    total_transactions: int = Field(0, alias="totalTransactions", ge=0)
    date_range: Optional[dict] = Field(None, alias="dateRange")

    model_config = {"populate_by_name": True}


class ParseResponse(BaseModel):
    """Response model for document parsing endpoint POST /ai/parse."""

    success: bool
    document_type: str = Field(..., alias="documentType")
    transactions: list[ExtractedTransaction] = Field(default_factory=list)
    salary_data: Optional[SalaryData] = Field(None, alias="salaryData")
    extraction_errors: list[str] = Field(default_factory=list, alias="extractionErrors")
    metadata: Optional[ParseMetadata] = None

    model_config = {"populate_by_name": True}
