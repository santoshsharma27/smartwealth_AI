"""Tests for the document parsing endpoint POST /ai/parse."""

import base64

import pytest
from httpx import ASGITransport, AsyncClient

from main import app


@pytest.fixture
def sample_csv_content() -> str:
    """A sample bank statement CSV with common Indian bank format."""
    return (
        "Date,Description,Debit,Credit,Balance\n"
        "01/01/2024,SWIGGY ORDER,450.00,,50000.00\n"
        "02/01/2024,SALARY CREDIT,,120000.00,170000.00\n"
        "03/01/2024,RENT PAYMENT,25000.00,,145000.00\n"
        "05/01/2024,AMAZON PURCHASE,2999.00,,142001.00\n"
        "07/01/2024,UPI-ZOMATO,350.00,,141651.00\n"
    )


@pytest.fixture
def large_csv_content() -> str:
    """A CSV with more than 500 transactions to test the limit."""
    header = "Date,Narration,Debit,Credit,Balance\n"
    rows = []
    for i in range(600):
        day = (i % 28) + 1
        rows.append(f"{day:02d}/01/2024,TXN-{i:04d},{100 + i:.2f},,50000.00\n")
    return header + "".join(rows)


@pytest.mark.asyncio
async def test_csv_parsing_extracts_transactions(sample_csv_content: str):
    """Test that CSV parsing correctly extracts transactions."""
    encoded = base64.b64encode(sample_csv_content.encode()).decode()
    payload = {
        "documentId": "test-doc-001",
        "documentType": "bank_statement",
        "fileFormat": "csv",
        "fileContent": encoded,
    }

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/ai/parse", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["documentType"] == "bank_statement"
    assert len(data["transactions"]) == 5
    assert data["extractionErrors"] == []

    # Verify first transaction
    txn = data["transactions"][0]
    assert txn["date"] == "2024-01-01"
    assert txn["description"] == "SWIGGY ORDER"
    assert txn["amount"] == 450.00
    assert txn["type"] == "debit"

    # Verify credit transaction
    credit_txn = data["transactions"][1]
    assert credit_txn["type"] == "credit"
    assert credit_txn["amount"] == 120000.00


@pytest.mark.asyncio
async def test_csv_parsing_with_narration_column():
    """Test that CSV with 'Narration' column is handled."""
    csv_content = (
        "Date,Narration,Withdrawal,Deposit,Balance\n"
        "15/02/2024,ELECTRICITY BILL,1500.00,,48500.00\n"
        "16/02/2024,FREELANCE INCOME,,25000.00,73500.00\n"
    )
    encoded = base64.b64encode(csv_content.encode()).decode()
    payload = {
        "documentId": "test-doc-002",
        "documentType": "bank_statement",
        "fileFormat": "csv",
        "fileContent": encoded,
    }

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/ai/parse", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["transactions"]) == 2
    assert data["transactions"][0]["description"] == "ELECTRICITY BILL"
    assert data["transactions"][0]["type"] == "debit"
    assert data["transactions"][1]["type"] == "credit"


@pytest.mark.asyncio
async def test_empty_content_returns_error():
    """Test that empty base64 content returns appropriate error."""
    encoded = base64.b64encode(b"").decode()
    payload = {
        "documentId": "test-doc-003",
        "documentType": "bank_statement",
        "fileFormat": "csv",
        "fileContent": encoded,
    }

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/ai/parse", json=payload)

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_invalid_base64_returns_error():
    """Test that invalid base64 content returns 400."""
    payload = {
        "documentId": "test-doc-004",
        "documentType": "bank_statement",
        "fileFormat": "pdf",
        "fileContent": "not-valid-base64!!!",
    }

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/ai/parse", json=payload)

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_corrupt_pdf_returns_error_response():
    """Test that corrupt PDF bytes return a structured error response."""
    corrupt_bytes = b"this is not a valid PDF file content at all"
    encoded = base64.b64encode(corrupt_bytes).decode()
    payload = {
        "documentId": "test-doc-005",
        "documentType": "bank_statement",
        "fileFormat": "pdf",
        "fileContent": encoded,
    }

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/ai/parse", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert len(data["extractionErrors"]) > 0


@pytest.mark.asyncio
async def test_transaction_limit_500(large_csv_content: str):
    """Test that transactions are limited to 500 max."""
    encoded = base64.b64encode(large_csv_content.encode()).decode()
    payload = {
        "documentId": "test-doc-006",
        "documentType": "bank_statement",
        "fileFormat": "csv",
        "fileContent": encoded,
    }

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/ai/parse", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["transactions"]) == 500
    assert data["metadata"]["totalTransactions"] == 500


@pytest.mark.asyncio
async def test_invalid_document_type_returns_422():
    """Test that an invalid documentType is rejected by Pydantic validation."""
    encoded = base64.b64encode(b"some content").decode()
    payload = {
        "documentId": "test-doc-007",
        "documentType": "invoice",
        "fileFormat": "pdf",
        "fileContent": encoded,
    }

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/ai/parse", json=payload)

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_metadata_includes_date_range(sample_csv_content: str):
    """Test that metadata includes the date range of transactions."""
    encoded = base64.b64encode(sample_csv_content.encode()).decode()
    payload = {
        "documentId": "test-doc-008",
        "documentType": "bank_statement",
        "fileFormat": "csv",
        "fileContent": encoded,
    }

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/ai/parse", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["metadata"] is not None
    assert data["metadata"]["totalTransactions"] == 5
    assert data["metadata"]["dateRange"]["from"] == "2024-01-01"
    assert data["metadata"]["dateRange"]["to"] == "2024-01-07"
