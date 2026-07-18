"""Report generation service for creating PDF financial reports."""

from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from models.report import ReportRequest

DISCLAIMER_TEXT = (
    "DISCLAIMER: This report is for educational and informational purposes only. "
    "It does not constitute professional financial advice and does not replace "
    "consultation with a certified financial advisor, tax consultant, or "
    "investment professional. All data and recommendations are generated "
    "algorithmically and may not reflect your complete financial situation."
)

NO_DATA_MESSAGE = "No data available for this section."


def _get_styles():
    """Return custom paragraph styles for the report."""
    styles = getSampleStyleSheet()

    # Brand colors
    primary = colors.HexColor("#2563eb")  # Blue
    dark = colors.HexColor("#1e293b")  # Dark slate
    muted = colors.HexColor("#64748b")  # Muted gray

    styles.add(
        ParagraphStyle(
            "ReportTitle",
            parent=styles["Title"],
            fontSize=24,
            textColor=primary,
            spaceAfter=4,
            fontName="Helvetica-Bold",
        )
    )
    styles.add(
        ParagraphStyle(
            "ReportSubtitle",
            parent=styles["Normal"],
            fontSize=11,
            textColor=muted,
            spaceAfter=16,
        )
    )
    styles.add(
        ParagraphStyle(
            "SectionHeader",
            parent=styles["Heading2"],
            fontSize=14,
            spaceAfter=8,
            spaceBefore=18,
            textColor=primary,
            fontName="Helvetica-Bold",
            borderWidth=0,
            borderPadding=0,
        )
    )
    styles.add(
        ParagraphStyle(
            "DisclaimerStyle",
            parent=styles["Normal"],
            fontSize=7.5,
            textColor=muted,
            spaceAfter=16,
            leading=10,
        )
    )
    styles.add(
        ParagraphStyle(
            "NoData",
            parent=styles["Normal"],
            textColor=colors.HexColor("#94a3b8"),
            fontName="Helvetica-Oblique",
            fontSize=9,
        )
    )
    styles.add(
        ParagraphStyle(
            "ReportBody",
            parent=styles["Normal"],
            fontSize=10,
            textColor=dark,
            leading=14,
        )
    )
    styles.add(
        ParagraphStyle(
            "MetricValue",
            parent=styles["Normal"],
            fontSize=16,
            textColor=dark,
            fontName="Helvetica-Bold",
        )
    )
    styles.add(
        ParagraphStyle(
            "MetricLabel",
            parent=styles["Normal"],
            fontSize=9,
            textColor=muted,
        )
    )
    styles.add(
        ParagraphStyle(
            "SummaryBox",
            parent=styles["Normal"],
            fontSize=10,
            textColor=dark,
            leading=15,
            backColor=colors.HexColor("#f8fafc"),
            borderWidth=1,
            borderColor=colors.HexColor("#eef2ff"),
            borderPadding=10,
            spaceAfter=12,
        )
    )
    return styles


def _format_currency(amount: float) -> str:
    """Format amount in Indian Rupee format with comma grouping."""
    if amount < 0:
        inner = _format_currency(-amount)
        return "-" + inner
    # Indian numbering: last 3 digits, then groups of 2
    s = f"{amount:,.2f}"
    parts = s.split(".")
    integer_part = parts[0].replace(",", "")
    decimal_part = parts[1]

    if len(integer_part) <= 3:
        formatted = integer_part
    else:
        last_three = integer_part[-3:]
        remaining = integer_part[:-3]
        # Group remaining digits in pairs from right
        groups = []
        while remaining:
            groups.append(remaining[-2:])
            remaining = remaining[:-2]
        groups.reverse()
        formatted = ",".join(groups) + "," + last_three

    return f"Rs.{formatted}.{decimal_part}"


def _generate_executive_summary(request: ReportRequest) -> str:
    """Generate an AI-powered executive summary using LLM.

    Falls back to a template-based summary if LLM is unavailable.
    """
    from services.llm_client import chat_completion, is_available

    # Build context for the LLM
    context_parts = []
    if request.monthly_income:
        context_parts.append(f"Monthly income: ₹{request.monthly_income:,.0f}")
    if request.total_expenses:
        context_parts.append(f"Monthly expenses: ₹{request.total_expenses:,.0f}")
    if request.monthly_savings:
        context_parts.append(f"Monthly savings: ₹{request.monthly_savings:,.0f}")
    if request.health_score:
        context_parts.append(f"Health Score: {request.health_score.total_score}/100 ({request.health_score.status_label})")
    if request.expenses_by_category:
        top_3 = sorted(request.expenses_by_category.items(), key=lambda x: -x[1])[:3]
        context_parts.append(f"Top expenses: {', '.join(f'{k}: ₹{v:,.0f}' for k, v in top_3)}")

    if not context_parts:
        return ""

    financial_context = "; ".join(context_parts)

    # Try LLM first
    if is_available():
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a financial analyst writing a brief executive summary for a personal finance report. "
                    "Write a 3-4 sentence paragraph summarizing the user's financial health. "
                    "Be concise, professional, and reference specific numbers. "
                    "Mention the overall health status and 1-2 key areas for improvement. "
                    "Do NOT recommend specific stocks, funds, or financial products. "
                    "Do NOT include any disclaimers — the report already has one."
                ),
            },
            {
                "role": "user",
                "content": f"Write an executive summary based on this data: {financial_context}",
            },
        ]

        result = chat_completion(messages, temperature=0.4, max_tokens=200)
        if result:
            return result

    # Fallback: template-based summary
    if request.monthly_income and request.total_expenses:
        savings_rate = ((request.monthly_income - request.total_expenses) / request.monthly_income) * 100
        score_text = ""
        if request.health_score:
            score_text = f" Your Financial Health Score is {request.health_score.total_score}/100, rated \"{request.health_score.status_label}\"."

        return (
            f"Your monthly income is ₹{request.monthly_income:,.0f} with expenses of "
            f"₹{request.total_expenses:,.0f}, resulting in a savings rate of {savings_rate:.1f}%.{score_text} "
            f"Review the detailed analysis below for specific insights and actionable recommendations."
        )

    return ""


def _add_executive_summary(elements: list, request: ReportRequest, styles):
    """Add AI-generated executive summary section."""
    summary_text = _generate_executive_summary(request)
    if summary_text:
        elements.append(Paragraph("Executive Summary", styles["SectionHeader"]))
        elements.append(Paragraph(summary_text, styles["SummaryBox"]))
        elements.append(Spacer(1, 0.3 * cm))


def _add_disclaimer(elements: list, styles):
    """Add report header and disclaimer on the first page."""
    elements.append(Paragraph("SmartWealth AI", styles["ReportTitle"]))
    elements.append(Paragraph("Personal Financial Wellness Report", styles["ReportSubtitle"]))

    # Separator line
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#2563eb"), spaceAfter=12))

    elements.append(Paragraph(DISCLAIMER_TEXT, styles["DisclaimerStyle"]))
    elements.append(Spacer(1, 0.3 * cm))


def _add_income_summary(elements: list, request: ReportRequest, styles):
    """Add income summary section."""
    elements.append(Paragraph("Income Summary", styles["SectionHeader"]))
    if request.monthly_income is None:
        elements.append(Paragraph(NO_DATA_MESSAGE, styles["NoData"]))
    else:
        income_text = f"Monthly Income: {_format_currency(request.monthly_income)}"
        elements.append(Paragraph(income_text, styles["Normal"]))
    elements.append(Spacer(1, 0.3 * cm))


def _add_expense_summary(elements: list, request: ReportRequest, styles):
    """Add expense summary section with category breakdown."""
    elements.append(Paragraph("Expense Summary", styles["SectionHeader"]))
    if request.total_expenses is None and not request.expenses_by_category:
        elements.append(Paragraph(NO_DATA_MESSAGE, styles["NoData"]))
    else:
        if request.total_expenses is not None:
            elements.append(
                Paragraph(
                    f"Total Monthly Expenses: {_format_currency(request.total_expenses)}",
                    styles["Normal"],
                )
            )
            elements.append(Spacer(1, 0.2 * cm))

        if request.expenses_by_category:
            elements.append(
                Paragraph("Category Breakdown:", styles["Normal"])
            )
            table_data = [["Category", "Amount"]]
            for category, amount in sorted(
                request.expenses_by_category.items(), key=lambda x: -x[1]
            ):
                if amount > 0:
                    table_data.append([category, _format_currency(amount)])

            if len(table_data) > 1:
                table = Table(table_data, colWidths=[8 * cm, 5 * cm])
                table.setStyle(
                    TableStyle(
                        [
                            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef2ff")),
                            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                            ("FONTSIZE", (0, 0), (-1, -1), 9),
                            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#c7d2fe")),
                            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                            ("TOPPADDING", (0, 0), (-1, -1), 4),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                        ]
                    )
                )
                elements.append(table)
    elements.append(Spacer(1, 0.3 * cm))


def _add_savings_analysis(elements: list, request: ReportRequest, styles):
    """Add savings analysis section."""
    elements.append(Paragraph("Savings Analysis", styles["SectionHeader"]))
    if request.monthly_savings is None and request.monthly_income is None:
        elements.append(Paragraph(NO_DATA_MESSAGE, styles["NoData"]))
    else:
        if request.monthly_savings is not None:
            elements.append(
                Paragraph(
                    f"Monthly Savings: {_format_currency(request.monthly_savings)}",
                    styles["Normal"],
                )
            )
        if (
            request.monthly_income is not None
            and request.monthly_income > 0
            and request.monthly_savings is not None
        ):
            savings_pct = (request.monthly_savings / request.monthly_income) * 100
            elements.append(
                Paragraph(
                    f"Savings Rate: {savings_pct:.1f}%",
                    styles["Normal"],
                )
            )
    elements.append(Spacer(1, 0.3 * cm))


def _add_health_score(elements: list, request: ReportRequest, styles):
    """Add Financial Health Score section with component breakdown."""
    elements.append(
        Paragraph("Financial Health Score", styles["SectionHeader"])
    )
    if request.health_score is None:
        elements.append(Paragraph(NO_DATA_MESSAGE, styles["NoData"]))
    else:
        hs = request.health_score
        elements.append(
            Paragraph(
                f"Overall Score: {hs.total_score}/100 ({hs.status_label})",
                styles["Normal"],
            )
        )
        elements.append(Spacer(1, 0.2 * cm))

        if hs.components:
            elements.append(
                Paragraph("Component Breakdown:", styles["Normal"])
            )
            table_data = [["Component", "Score", "Max Score"]]
            for name, comp in hs.components.items():
                display_name = name.replace("_", " ").replace(
                    "Ratio", " Ratio"
                ).title()
                table_data.append([display_name, str(comp.score), str(comp.max_score)])

            table = Table(table_data, colWidths=[7 * cm, 3 * cm, 3 * cm])
            table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef2ff")),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, -1), 9),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#c7d2fe")),
                        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                        ("TOPPADDING", (0, 0), (-1, -1), 4),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ]
                )
            )
            elements.append(table)
    elements.append(Spacer(1, 0.3 * cm))


def _add_key_risks(elements: list, request: ReportRequest, styles):
    """Add key financial risks section.

    A risk is identified when a score component is below 50% of its maximum.
    """
    elements.append(Paragraph("Key Financial Risks", styles["SectionHeader"]))
    if request.health_score is None or not request.health_score.components:
        elements.append(Paragraph(NO_DATA_MESSAGE, styles["NoData"]))
    else:
        risks = []
        for name, comp in request.health_score.components.items():
            if comp.score < (comp.max_score * 0.5):
                display_name = name.replace("_", " ").replace(
                    "Ratio", " Ratio"
                ).title()
                risks.append(
                    f"{display_name}: Scoring {comp.score}/{comp.max_score} "
                    f"(below 50% threshold of {comp.max_score * 0.5:.0f})"
                )

        if risks:
            for risk in risks:
                elements.append(
                    Paragraph(f"\u2022 {risk}", styles["Normal"])
                )
        else:
            elements.append(
                Paragraph(
                    "No significant financial risks identified. "
                    "All components are at or above 50% of their maximum.",
                    styles["Normal"],
                )
            )
    elements.append(Spacer(1, 0.3 * cm))


def _add_recommendations(elements: list, request: ReportRequest, styles):
    """Add AI recommendations section."""
    elements.append(Paragraph("AI Recommendations", styles["SectionHeader"]))
    if not request.recommendations:
        elements.append(Paragraph(NO_DATA_MESSAGE, styles["NoData"]))
    else:
        for i, rec in enumerate(request.recommendations, 1):
            elements.append(
                Paragraph(f"{i}. {rec}", styles["Normal"])
            )
    elements.append(Spacer(1, 0.3 * cm))


def _add_goal_plan_summary(elements: list, request: ReportRequest, styles):
    """Add goal plan summary section."""
    elements.append(Paragraph("Goal Plan Summary", styles["SectionHeader"]))
    if not request.goals:
        elements.append(Paragraph(NO_DATA_MESSAGE, styles["NoData"]))
    else:
        table_data = [
            ["Goal", "Target", "Duration", "Monthly Required", "Feasibility"]
        ]
        for goal in request.goals:
            table_data.append(
                [
                    goal.goal_name,
                    _format_currency(goal.target_amount),
                    f"{goal.duration_months} months",
                    _format_currency(goal.required_monthly_savings),
                    goal.feasibility_status,
                ]
            )

        table = Table(
            table_data, colWidths=[3.5 * cm, 3 * cm, 2.5 * cm, 3.5 * cm, 3 * cm]
        )
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef2ff")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#c7d2fe")),
                    ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        elements.append(table)
    elements.append(Spacer(1, 0.3 * cm))


def _add_action_items(elements: list, request: ReportRequest, styles):
    """Add next action items section (max 5)."""
    elements.append(Paragraph("Next Action Items", styles["SectionHeader"]))
    if not request.action_items:
        elements.append(Paragraph(NO_DATA_MESSAGE, styles["NoData"]))
    else:
        # Take at most 5 items, sorted by priority
        sorted_items = sorted(request.action_items, key=lambda x: x.priority)[:5]
        for item in sorted_items:
            elements.append(
                Paragraph(
                    f"{item.priority}. {item.text}",
                    styles["Normal"],
                )
            )
    elements.append(Spacer(1, 0.3 * cm))


def generate_report_pdf(request: ReportRequest) -> bytes:
    """Generate a PDF report from the given financial data.

    The report contains the following sections:
    - Disclaimer (first page)
    - Income Summary
    - Expense Summary (with category breakdown)
    - Savings Analysis
    - Financial Health Score with component breakdown
    - Key Financial Risks (components below 50% of max)
    - AI Recommendations
    - Goal Plan Summary
    - Next Action Items (max 5 prioritized items)

    For any section where data is unavailable, includes "No data available".

    Returns the PDF as bytes.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = _get_styles()
    elements = []

    # Disclaimer on first page
    _add_disclaimer(elements, styles)

    # AI-generated executive summary
    _add_executive_summary(elements, request, styles)

    # Report sections
    _add_income_summary(elements, request, styles)
    _add_expense_summary(elements, request, styles)
    _add_savings_analysis(elements, request, styles)
    _add_health_score(elements, request, styles)
    _add_key_risks(elements, request, styles)
    _add_recommendations(elements, request, styles)
    _add_goal_plan_summary(elements, request, styles)
    _add_action_items(elements, request, styles)

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
