"""Tests for the report generation endpoint POST /ai/report."""

import pytest
from fastapi.testclient import TestClient

from main import app
from models.report import ReportRequest
from services.report_generator import generate_report_pdf

client = TestClient(app)


class TestReportEndpoint:
    """Tests for POST /ai/report endpoint."""

    def test_report_returns_200_with_pdf_content_type(self):
        """Endpoint returns 200 with application/pdf content type."""
        payload = {
            "monthlyIncome": 120000,
            "totalExpenses": 78000,
            "monthlySavings": 42000,
            "expensesByCategory": {
                "Rent": 25000,
                "Food": 18500,
                "Travel": 5000,
            },
            "healthScore": {
                "totalScore": 72,
                "statusLabel": "Very Good",
                "components": {
                    "savingsRatio": {"score": 25, "maxScore": 30},
                    "expenseControl": {"score": 18, "maxScore": 25},
                    "emiBurden": {"score": 12, "maxScore": 15},
                    "investmentAllocation": {"score": 10, "maxScore": 15},
                    "emergencyFundReadiness": {"score": 7, "maxScore": 15},
                },
            },
            "recommendations": [
                "Reduce food spending by 15% to save an additional ₹2,775/month.",
                "Increase emergency fund to cover 6 months of expenses.",
            ],
            "goals": [
                {
                    "goalName": "Buy a Car",
                    "targetAmount": 800000,
                    "durationMonths": 24,
                    "requiredMonthlySavings": 26923,
                    "feasibilityStatus": "Challenging",
                }
            ],
            "actionItems": [
                {"priority": 1, "text": "Set up automatic savings transfer"},
                {"priority": 2, "text": "Review subscription expenses"},
                {"priority": 3, "text": "Increase SIP contribution"},
            ],
        }

        response = client.post("/ai/report", json=payload)

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"

    def test_report_returns_valid_pdf_bytes(self):
        """Response content starts with %PDF header (valid PDF)."""
        payload = {
            "monthlyIncome": 100000,
            "totalExpenses": 60000,
            "monthlySavings": 40000,
        }

        response = client.post("/ai/report", json=payload)

        assert response.status_code == 200
        assert response.content[:4] == b"%PDF"

    def test_report_with_empty_data(self):
        """Report generates successfully even with completely empty data."""
        payload = {}

        response = client.post("/ai/report", json=payload)

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert response.content[:4] == b"%PDF"

    def test_report_with_all_sections_populated(self):
        """Report generates with all sections populated."""
        payload = {
            "monthlyIncome": 120000,
            "totalExpenses": 78000,
            "monthlySavings": 42000,
            "expensesByCategory": {
                "Rent": 25000,
                "Food": 18500,
                "Travel": 5000,
                "Shopping": 8000,
                "Bills": 6000,
                "EMI": 10000,
                "Healthcare": 2000,
                "Entertainment": 3500,
            },
            "healthScore": {
                "totalScore": 72,
                "statusLabel": "Very Good",
                "components": {
                    "savingsRatio": {"score": 25, "maxScore": 30},
                    "expenseControl": {"score": 18, "maxScore": 25},
                    "emiBurden": {"score": 12, "maxScore": 15},
                    "investmentAllocation": {"score": 10, "maxScore": 15},
                    "emergencyFundReadiness": {"score": 7, "maxScore": 15},
                },
            },
            "recommendations": [
                "Reduce discretionary spending by 10%.",
                "Build emergency fund to cover 6 months.",
                "Consider increasing investment allocation to 20%.",
            ],
            "goals": [
                {
                    "goalName": "Buy a Car",
                    "targetAmount": 800000,
                    "durationMonths": 24,
                    "requiredMonthlySavings": 26923,
                    "feasibilityStatus": "Challenging",
                },
                {
                    "goalName": "Vacation Fund",
                    "targetAmount": 200000,
                    "durationMonths": 12,
                    "requiredMonthlySavings": 16667,
                    "feasibilityStatus": "Achievable",
                },
            ],
            "actionItems": [
                {"priority": 1, "text": "Set up automatic savings transfer"},
                {"priority": 2, "text": "Review subscription expenses"},
                {"priority": 3, "text": "Increase SIP contribution"},
                {"priority": 4, "text": "Track daily expenses for one week"},
                {"priority": 5, "text": "Consult financial advisor"},
            ],
        }

        response = client.post("/ai/report", json=payload)

        assert response.status_code == 200
        assert response.content[:4] == b"%PDF"
        # PDF should have substantial content
        assert len(response.content) > 1000

    def test_report_action_items_limited_to_five(self):
        """Report limits action items to max 5 even if more provided."""
        payload = {
            "actionItems": [
                {"priority": i, "text": f"Action item {i}"} for i in range(1, 10)
            ]
        }

        response = client.post("/ai/report", json=payload)

        assert response.status_code == 200
        assert response.content[:4] == b"%PDF"

    def test_report_content_disposition_header(self):
        """Response includes content-disposition header for download."""
        payload = {"monthlyIncome": 100000}

        response = client.post("/ai/report", json=payload)

        assert "content-disposition" in response.headers
        assert "smartwealth_report.pdf" in response.headers["content-disposition"]


class TestReportGeneratorService:
    """Unit tests for the report generation service."""

    def test_generate_report_pdf_returns_bytes(self):
        """Service returns bytes starting with %PDF."""
        request = ReportRequest(
            monthly_income=120000,
            total_expenses=78000,
            monthly_savings=42000,
        )

        result = generate_report_pdf(request)

        assert isinstance(result, bytes)
        assert result[:4] == b"%PDF"

    def test_generate_report_pdf_empty_request(self):
        """Service handles empty request (no data) gracefully."""
        request = ReportRequest()

        result = generate_report_pdf(request)

        assert isinstance(result, bytes)
        assert result[:4] == b"%PDF"
        assert len(result) > 0

    def test_generate_report_pdf_with_health_score_risks(self):
        """Service identifies risks for components below 50% threshold."""
        from models.report import HealthScoreData, ScoreComponent

        request = ReportRequest(
            health_score=HealthScoreData(
                total_score=40,
                status_label="Fair",
                components={
                    "savingsRatio": ScoreComponent(score=10, max_score=30),
                    "expenseControl": ScoreComponent(score=5, max_score=25),
                    "emiBurden": ScoreComponent(score=12, max_score=15),
                    "investmentAllocation": ScoreComponent(score=8, max_score=15),
                    "emergencyFundReadiness": ScoreComponent(score=5, max_score=15),
                },
            )
        )

        result = generate_report_pdf(request)

        assert isinstance(result, bytes)
        assert result[:4] == b"%PDF"

    def test_generate_report_pdf_no_risks_when_all_above_threshold(self):
        """Service reports no risks when all components >= 50% of max."""
        from models.report import HealthScoreData, ScoreComponent

        request = ReportRequest(
            health_score=HealthScoreData(
                total_score=85,
                status_label="Very Good",
                components={
                    "savingsRatio": ScoreComponent(score=25, max_score=30),
                    "expenseControl": ScoreComponent(score=20, max_score=25),
                    "emiBurden": ScoreComponent(score=12, max_score=15),
                    "investmentAllocation": ScoreComponent(score=15, max_score=15),
                    "emergencyFundReadiness": ScoreComponent(score=13, max_score=15),
                },
            )
        )

        result = generate_report_pdf(request)

        assert isinstance(result, bytes)
        assert result[:4] == b"%PDF"

    def test_format_currency_indian_format(self):
        """Currency formatting follows Indian comma grouping."""
        from services.report_generator import _format_currency

        assert _format_currency(120000) == "\u20b91,20,000.00"
        assert _format_currency(1000) == "\u20b91,000.00"
        assert _format_currency(100) == "\u20b9100.00"
        assert _format_currency(10000000) == "\u20b91,00,00,000.00"
        assert _format_currency(0) == "\u20b90.00"
