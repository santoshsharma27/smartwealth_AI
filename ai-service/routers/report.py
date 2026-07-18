"""Report generation router for POST /ai/report endpoint."""

from fastapi import APIRouter
from fastapi.responses import Response

from models.report import ReportRequest
from services.report_generator import generate_report_pdf

router = APIRouter()


@router.post("/ai/report")
async def generate_report(request: ReportRequest) -> Response:
    """Generate a comprehensive PDF financial report.

    The report includes:
    - Disclaimer on first page
    - Income summary
    - Expense summary with category breakdown
    - Savings analysis
    - Financial Health Score with component breakdown
    - Key financial risks (any score component below 50% of max)
    - AI recommendations
    - Goal plan summary
    - Next action items (max 5 prioritized)

    Sections with no data include a "No data available" message.

    Returns the PDF as application/pdf content type.
    """
    pdf_bytes = generate_report_pdf(request)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=smartwealth_report.pdf"},
    )
