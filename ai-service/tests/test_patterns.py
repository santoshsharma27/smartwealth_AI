"""Tests for the POST /ai/detect-patterns endpoint."""

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


class TestInsufficientData:
    """Test that detection is skipped with < 2 months of data."""

    def test_zero_months_returns_empty_with_message(self):
        payload = {
            "transactions": [
                {
                    "date": "2024-01-15",
                    "description": "Netflix",
                    "amount": 649,
                    "type": "debit",
                    "category": "Entertainment",
                }
            ],
            "monthsOfData": 0,
        }
        response = client.post("/ai/detect-patterns", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["recurringExpenses"] == []
        assert data["spendingAnomalies"] == []
        assert data["message"] is not None
        assert "2 months" in data["message"].lower() or "insufficient" in data["message"].lower()

    def test_one_month_returns_empty_with_message(self):
        payload = {
            "transactions": [
                {
                    "date": "2024-01-15",
                    "description": "Netflix",
                    "amount": 649,
                    "type": "debit",
                    "category": "Entertainment",
                }
            ],
            "monthsOfData": 1,
        }
        response = client.post("/ai/detect-patterns", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["recurringExpenses"] == []
        assert data["spendingAnomalies"] == []
        assert data["message"] is not None


class TestRecurringExpenseDetection:
    """Test recurring expense detection logic."""

    def test_detects_recurring_same_description_consecutive_months(self):
        """Two transactions with same description in consecutive months, similar amounts."""
        payload = {
            "transactions": [
                {
                    "date": "2024-01-15",
                    "description": "Netflix Subscription",
                    "amount": 649,
                    "type": "debit",
                    "category": "Entertainment",
                },
                {
                    "date": "2024-02-15",
                    "description": "Netflix Subscription",
                    "amount": 649,
                    "type": "debit",
                    "category": "Entertainment",
                },
                {
                    "date": "2024-03-15",
                    "description": "Netflix Subscription",
                    "amount": 649,
                    "type": "debit",
                    "category": "Entertainment",
                },
            ],
            "monthsOfData": 3,
        }
        response = client.post("/ai/detect-patterns", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert len(data["recurringExpenses"]) == 1
        recurring = data["recurringExpenses"][0]
        assert recurring["description"].lower() == "netflix subscription"
        assert recurring["recurringAmount"] == 649.0
        assert recurring["consecutiveMonths"] == 3

    def test_case_insensitive_matching(self):
        """Description matching should be case-insensitive."""
        payload = {
            "transactions": [
                {
                    "date": "2024-01-10",
                    "description": "NETFLIX SUBSCRIPTION",
                    "amount": 649,
                    "type": "debit",
                    "category": "Entertainment",
                },
                {
                    "date": "2024-02-10",
                    "description": "netflix subscription",
                    "amount": 649,
                    "type": "debit",
                    "category": "Entertainment",
                },
            ],
            "monthsOfData": 2,
        }
        response = client.post("/ai/detect-patterns", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert len(data["recurringExpenses"]) == 1
        assert data["recurringExpenses"][0]["consecutiveMonths"] == 2

    def test_amounts_within_ten_percent(self):
        """Amounts within ±10% should still be detected as recurring."""
        payload = {
            "transactions": [
                {
                    "date": "2024-01-05",
                    "description": "Electric Bill",
                    "amount": 2000,
                    "type": "debit",
                    "category": "Bills",
                },
                {
                    "date": "2024-02-05",
                    "description": "Electric Bill",
                    "amount": 2150,  # within 10% of 2000
                    "type": "debit",
                    "category": "Bills",
                },
            ],
            "monthsOfData": 2,
        }
        response = client.post("/ai/detect-patterns", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert len(data["recurringExpenses"]) == 1
        recurring = data["recurringExpenses"][0]
        assert recurring["consecutiveMonths"] == 2
        # Average of 2000 and 2150
        assert recurring["recurringAmount"] == 2075.0

    def test_amounts_outside_ten_percent_not_detected(self):
        """Amounts outside ±10% should not be detected as recurring."""
        payload = {
            "transactions": [
                {
                    "date": "2024-01-05",
                    "description": "Electricity",
                    "amount": 1000,
                    "type": "debit",
                    "category": "Bills",
                },
                {
                    "date": "2024-02-05",
                    "description": "Electricity",
                    "amount": 1500,  # 50% more, well outside 10%
                    "type": "debit",
                    "category": "Bills",
                },
            ],
            "monthsOfData": 2,
        }
        response = client.post("/ai/detect-patterns", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert len(data["recurringExpenses"]) == 0

    def test_non_consecutive_months_not_detected(self):
        """Transactions in non-consecutive months should not be detected."""
        payload = {
            "transactions": [
                {
                    "date": "2024-01-15",
                    "description": "Gym Membership",
                    "amount": 1500,
                    "type": "debit",
                    "category": "Healthcare",
                },
                {
                    "date": "2024-03-15",
                    "description": "Gym Membership",
                    "amount": 1500,
                    "type": "debit",
                    "category": "Healthcare",
                },
            ],
            "monthsOfData": 3,
        }
        response = client.post("/ai/detect-patterns", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert len(data["recurringExpenses"]) == 0

    def test_multiple_recurring_expenses_detected(self):
        """Multiple different recurring expenses should all be detected."""
        payload = {
            "transactions": [
                # Netflix recurring
                {
                    "date": "2024-01-15",
                    "description": "Netflix",
                    "amount": 649,
                    "type": "debit",
                    "category": "Entertainment",
                },
                {
                    "date": "2024-02-15",
                    "description": "Netflix",
                    "amount": 649,
                    "type": "debit",
                    "category": "Entertainment",
                },
                # Gym recurring
                {
                    "date": "2024-01-05",
                    "description": "Gym Membership",
                    "amount": 2000,
                    "type": "debit",
                    "category": "Healthcare",
                },
                {
                    "date": "2024-02-05",
                    "description": "Gym Membership",
                    "amount": 2000,
                    "type": "debit",
                    "category": "Healthcare",
                },
            ],
            "monthsOfData": 2,
        }
        response = client.post("/ai/detect-patterns", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert len(data["recurringExpenses"]) == 2


class TestSpendingAnomalyDetection:
    """Test spending anomaly detection logic."""

    def test_detects_anomaly_exceeding_twice_category_average(self):
        """Transaction exceeding 2× category average should be flagged."""
        payload = {
            "transactions": [
                # Preceding months - establish baseline
                {
                    "date": "2024-01-10",
                    "description": "Restaurant A",
                    "amount": 500,
                    "type": "debit",
                    "category": "Food",
                },
                {
                    "date": "2024-02-10",
                    "description": "Restaurant B",
                    "amount": 600,
                    "type": "debit",
                    "category": "Food",
                },
                {
                    "date": "2024-03-10",
                    "description": "Restaurant C",
                    "amount": 550,
                    "type": "debit",
                    "category": "Food",
                },
                # Anomalous transaction in latest month
                {
                    "date": "2024-04-10",
                    "description": "Fancy Dinner",
                    "amount": 3000,  # well over 2× average of ~550
                    "type": "debit",
                    "category": "Food",
                },
            ],
            "monthsOfData": 4,
        }
        response = client.post("/ai/detect-patterns", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert len(data["spendingAnomalies"]) >= 1
        anomaly = next(
            a for a in data["spendingAnomalies"] if a["description"] == "Fancy Dinner"
        )
        assert anomaly["transactionAmount"] == 3000
        assert anomaly["category"] == "Food"
        assert anomaly["categoryAverage"] > 0
        assert anomaly["transactionAmount"] > 2 * anomaly["categoryAverage"]

    def test_normal_spending_not_flagged(self):
        """Transactions within normal range should not be flagged."""
        payload = {
            "transactions": [
                {
                    "date": "2024-01-10",
                    "description": "Grocery Store",
                    "amount": 2000,
                    "type": "debit",
                    "category": "Food",
                },
                {
                    "date": "2024-02-10",
                    "description": "Grocery Store",
                    "amount": 2200,
                    "type": "debit",
                    "category": "Food",
                },
                {
                    "date": "2024-03-10",
                    "description": "Grocery Store",
                    "amount": 2100,  # Not exceeding 2× average
                    "type": "debit",
                    "category": "Food",
                },
            ],
            "monthsOfData": 3,
        }
        response = client.post("/ai/detect-patterns", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert len(data["spendingAnomalies"]) == 0

    def test_anomaly_needs_preceding_data(self):
        """First month's transactions can't be anomalies (no preceding data)."""
        payload = {
            "transactions": [
                {
                    "date": "2024-01-10",
                    "description": "Big Purchase",
                    "amount": 50000,
                    "type": "debit",
                    "category": "Shopping",
                },
            ],
            "monthsOfData": 2,
        }
        response = client.post("/ai/detect-patterns", json=payload)
        assert response.status_code == 200
        data = response.json()
        # No preceding data to compare against, so no anomalies
        assert len(data["spendingAnomalies"]) == 0

    def test_anomaly_different_categories_independent(self):
        """Anomaly detection should work independently per category."""
        payload = {
            "transactions": [
                # Food baseline
                {
                    "date": "2024-01-10",
                    "description": "Food 1",
                    "amount": 500,
                    "type": "debit",
                    "category": "Food",
                },
                {
                    "date": "2024-02-10",
                    "description": "Food 2",
                    "amount": 500,
                    "type": "debit",
                    "category": "Food",
                },
                # Shopping baseline
                {
                    "date": "2024-01-15",
                    "description": "Shop 1",
                    "amount": 3000,
                    "type": "debit",
                    "category": "Shopping",
                },
                {
                    "date": "2024-02-15",
                    "description": "Shop 2",
                    "amount": 3000,
                    "type": "debit",
                    "category": "Shopping",
                },
                # Food anomaly in month 3
                {
                    "date": "2024-03-10",
                    "description": "Big Food",
                    "amount": 5000,  # 10× food avg
                    "type": "debit",
                    "category": "Food",
                },
                # Normal shopping in month 3
                {
                    "date": "2024-03-15",
                    "description": "Normal Shop",
                    "amount": 3500,  # ~1.17× shopping avg, not anomalous
                    "type": "debit",
                    "category": "Shopping",
                },
            ],
            "monthsOfData": 3,
        }
        response = client.post("/ai/detect-patterns", json=payload)
        assert response.status_code == 200
        data = response.json()
        # Only food should be flagged
        anomaly_categories = [a["category"] for a in data["spendingAnomalies"]]
        assert "Food" in anomaly_categories
        assert "Shopping" not in anomaly_categories


class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_empty_transactions_with_sufficient_months(self):
        """Empty transaction list should return empty results."""
        payload = {
            "transactions": [],
            "monthsOfData": 3,
        }
        response = client.post("/ai/detect-patterns", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["recurringExpenses"] == []
        assert data["spendingAnomalies"] == []

    def test_response_format_uses_camel_case(self):
        """Response should use camelCase field names per API contract."""
        payload = {
            "transactions": [
                {
                    "date": "2024-01-15",
                    "description": "Test",
                    "amount": 100,
                    "type": "debit",
                    "category": "Food",
                }
            ],
            "monthsOfData": 1,
        }
        response = client.post("/ai/detect-patterns", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "recurringExpenses" in data
        assert "spendingAnomalies" in data
        assert "message" in data

    def test_exactly_two_months_triggers_detection(self):
        """Exactly 2 months of data should trigger detection (not skip)."""
        payload = {
            "transactions": [
                {
                    "date": "2024-01-15",
                    "description": "Spotify",
                    "amount": 119,
                    "type": "debit",
                    "category": "Entertainment",
                },
                {
                    "date": "2024-02-15",
                    "description": "Spotify",
                    "amount": 119,
                    "type": "debit",
                    "category": "Entertainment",
                },
            ],
            "monthsOfData": 2,
        }
        response = client.post("/ai/detect-patterns", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["message"] is None
        assert len(data["recurringExpenses"]) == 1
