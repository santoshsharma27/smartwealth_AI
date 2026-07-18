"""Document parsing router for POST /ai/parse endpoint."""

import base64

from fastapi import APIRouter, HTTPException

from models.parse import (
    ExtractedTransaction,
    ParseMetadata,
    ParseRequest,
    ParseResponse,
    SalaryData,
)
from services.parser import (
    ParseError,
    parse_bank_statement_csv,
    parse_bank_statement_pdf,
    parse_salary_slip,
)

router = APIRouter()


@router.post("/ai/parse", response_model=ParseResponse)
async def parse_document(request: ParseRequest) -> ParseResponse:
    """Parse an uploaded document and extract structured financial data.

    Routes to the appropriate parser based on documentType and fileFormat.
    Returns structured response with transactions or salary data.
    Reports extraction errors for fields that couldn't be extracted.
    """
    # Decode base64 content
    try:
        file_content = base64.b64decode(request.file_content)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 file content.")

    if not file_content:
        raise HTTPException(status_code=400, detail="File content is empty.")

    # Route to appropriate parser
    try:
        if request.document_type == "salary_slip":
            return _parse_salary_slip(file_content, request.document_type)
        elif request.document_type == "bank_statement":
            if request.file_format == "csv":
                return _parse_bank_statement_csv(file_content, request.document_type)
            else:
                return _parse_bank_statement_pdf(file_content, request.document_type)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported document type: {request.document_type}",
            )
    except ParseError as e:
        # Return structured error response for corrupt/password-protected files
        return ParseResponse(
            success=False,
            document_type=request.document_type,
            transactions=[],
            salary_data=None,
            extraction_errors=[str(e)],
            metadata=None,
        )


def _parse_salary_slip(file_content: bytes, document_type: str) -> ParseResponse:
    """Handle salary slip parsing and response construction."""
    salary_data, extraction_errors = parse_salary_slip(file_content)

    return ParseResponse(
        success=len(extraction_errors) == 0,
        document_type=document_type,
        transactions=[],
        salary_data=salary_data,
        extraction_errors=extraction_errors,
        metadata=None,
    )


def _parse_bank_statement_pdf(file_content: bytes, document_type: str) -> ParseResponse:
    """Handle bank statement PDF parsing and response construction."""
    transactions, extraction_errors = parse_bank_statement_pdf(file_content)

    metadata = _build_transaction_metadata(transactions)

    return ParseResponse(
        success=len(extraction_errors) == 0,
        document_type=document_type,
        transactions=transactions,
        salary_data=None,
        extraction_errors=extraction_errors,
        metadata=metadata,
    )


def _parse_bank_statement_csv(file_content: bytes, document_type: str) -> ParseResponse:
    """Handle bank statement CSV parsing and response construction."""
    transactions, extraction_errors = parse_bank_statement_csv(file_content)

    metadata = _build_transaction_metadata(transactions)

    return ParseResponse(
        success=len(extraction_errors) == 0,
        document_type=document_type,
        transactions=transactions,
        salary_data=None,
        extraction_errors=extraction_errors,
        metadata=metadata,
    )


def _build_transaction_metadata(transactions: list[ExtractedTransaction]) -> ParseMetadata:
    """Build metadata from a list of extracted transactions."""
    if not transactions:
        return ParseMetadata(total_transactions=0, date_range=None)

    dates = [t.date for t in transactions if t.date != "1900-01-01"]

    date_range = None
    if dates:
        sorted_dates = sorted(dates)
        date_range = {"from": sorted_dates[0], "to": sorted_dates[-1]}

    return ParseMetadata(
        total_transactions=len(transactions),
        date_range=date_range,
    )
