"""Document parsing service for salary slips and bank statements."""

import csv
import io
import re
from datetime import datetime
from typing import Optional

import fitz  # PyMuPDF
import pandas as pd

from models.parse import ExtractedTransaction, SalaryData


MAX_TRANSACTIONS = 500


class ParseError(Exception):
    """Raised when a document cannot be parsed."""

    def __init__(self, message: str, is_password_protected: bool = False):
        super().__init__(message)
        self.is_password_protected = is_password_protected


def parse_salary_slip(file_content: bytes) -> tuple[SalaryData, list[str]]:
    """Parse a salary slip PDF and extract structured salary data.

    Strategy:
    1. Try regex-based extraction first (fast, no LLM cost)
    2. If regex fails to extract key fields, fall back to LLM-based extraction

    Args:
        file_content: Raw PDF bytes.

    Returns:
        Tuple of (SalaryData, list of extraction errors for fields that couldn't be read).

    Raises:
        ParseError: If the PDF is corrupt or password-protected.
    """
    extraction_errors: list[str] = []

    try:
        doc = fitz.open(stream=file_content, filetype="pdf")
    except Exception as e:
        error_msg = str(e).lower()
        if "password" in error_msg or "encrypted" in error_msg:
            raise ParseError(
                "File is password-protected and cannot be read.",
                is_password_protected=True,
            )
        raise ParseError(f"File is corrupt or unreadable: {e}")

    if doc.is_encrypted:
        doc.close()
        raise ParseError(
            "File is password-protected and cannot be read.",
            is_password_protected=True,
        )

    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()

    if not text.strip():
        raise ParseError("Could not extract any text from the PDF. The file may be a scanned image.")

    import logging
    _logger = logging.getLogger(__name__)
    print(f"[PARSE DEBUG] Extracted {len(text)} chars from salary PDF. First 500: {repr(text[:500])}")

    # --- Strategy 1: Regex-based extraction ---
    gross_salary = _extract_amount(
        text,
        [
            r"gross\s*(?:salary|pay|earnings?)[\s:₹Rs.]*([0-9,]+(?:\.[0-9]{1,2})?)",
            r"total\s*(?:gross|earnings?)[\s:₹Rs.]*([0-9,]+(?:\.[0-9]{1,2})?)",
            r"gross[\s:₹Rs.]*([0-9,]+(?:\.[0-9]{1,2})?)",
        ],
    )

    net_salary = _extract_amount(
        text,
        [
            r"net\s*(?:salary|pay|take[\s-]*home)[\s:₹Rs.]*([0-9,]+(?:\.[0-9]{1,2})?)",
            r"take[\s-]*home\s*(?:pay|salary)?[\s:₹Rs.]*([0-9,]+(?:\.[0-9]{1,2})?)",
            r"amount\s*(?:payable|credited)[\s:₹Rs.]*([0-9,]+(?:\.[0-9]{1,2})?)",
            r"net[\s:₹Rs.]*([0-9,]+(?:\.[0-9]{1,2})?)",
        ],
    )

    employer_name = _extract_employer(text)
    month_year = _extract_month_year(text)
    deductions = _extract_deductions(text)

    print(f"[PARSE DEBUG] Regex results: gross={gross_salary}, net={net_salary}, employer={employer_name}, month={month_year}")
    print(f"[PARSE DEBUG] Deductions found: {deductions}")

    # --- Strategy 2: LLM fallback if regex missed critical fields ---
    if gross_salary is None or net_salary is None:
        llm_data = _parse_salary_with_llm(text)
        if llm_data:
            if gross_salary is None and llm_data.get("gross_salary"):
                gross_salary = llm_data["gross_salary"]
            if net_salary is None and llm_data.get("net_salary"):
                net_salary = llm_data["net_salary"]
            if employer_name is None and llm_data.get("employer_name"):
                employer_name = llm_data["employer_name"]
            if month_year is None and llm_data.get("month_year"):
                month_year = llm_data["month_year"]
            if not deductions and llm_data.get("deductions"):
                deductions = llm_data["deductions"]

    # Record remaining extraction errors
    if gross_salary is None:
        extraction_errors.append("gross_salary")
        gross_salary = 0.0
    if net_salary is None:
        extraction_errors.append("net_salary")
        net_salary = 0.0
    if employer_name is None:
        extraction_errors.append("employer_name")
    if not deductions:
        extraction_errors.append("deductions")

    salary_data = SalaryData(
        gross_salary=gross_salary,
        net_salary=net_salary,
        employer_name=employer_name,
        month_year=month_year,
        deductions=deductions,
    )

    return salary_data, extraction_errors


def _parse_salary_with_llm(text: str) -> Optional[dict]:
    """Use LLM to extract salary data from unstructured text.

    Returns a dict with keys: gross_salary, net_salary, employer_name, month_year, deductions.
    Returns None if LLM is unavailable.
    """
    import json
    from services.llm_client import chat_completion, is_available

    if not is_available():
        return None

    # Truncate text to avoid token limits (send first 3000 chars)
    truncated_text = text[:3000]

    messages = [
        {
            "role": "system",
            "content": (
                "You are a financial document parser. Extract salary information from the following payslip text. "
                "Respond ONLY with valid JSON in this exact format (no markdown, no explanation):\n"
                '{"gross_salary": 120000.00, "net_salary": 95000.00, "employer_name": "Company Name", '
                '"month_year": "June 2024", "deductions": [{"label": "PF", "amount": 5000}, {"label": "Tax", "amount": 10000}]}\n\n'
                "Rules:\n"
                "- All amounts should be numbers (no commas, no ₹ symbol)\n"
                "- If a field cannot be found, use null\n"
                "- For deductions, include all deduction items you find\n"
                "- gross_salary is the total earnings BEFORE deductions\n"
                "- net_salary is the take-home pay AFTER deductions"
            ),
        },
        {
            "role": "user",
            "content": f"Extract salary data from this payslip:\n\n{truncated_text}",
        },
    ]

    try:
        result = chat_completion(messages, temperature=0.1, max_tokens=500)
        if not result:
            return None

        # Clean up the response (remove markdown code fences if present)
        result = result.strip()
        if result.startswith("```"):
            result = re.sub(r"^```(?:json)?\s*", "", result)
            result = re.sub(r"\s*```$", "", result)

        data = json.loads(result)

        # Validate and convert
        parsed = {}
        if data.get("gross_salary") is not None:
            parsed["gross_salary"] = float(data["gross_salary"])
        if data.get("net_salary") is not None:
            parsed["net_salary"] = float(data["net_salary"])
        if data.get("employer_name"):
            parsed["employer_name"] = str(data["employer_name"])
        if data.get("month_year"):
            parsed["month_year"] = str(data["month_year"])
        if data.get("deductions") and isinstance(data["deductions"], list):
            parsed["deductions"] = [
                {"label": str(d.get("label", "")), "amount": float(d.get("amount", 0))}
                for d in data["deductions"]
                if d.get("amount")
            ]

        return parsed if parsed else None

    except (json.JSONDecodeError, ValueError, TypeError) as e:
        import logging
        logging.getLogger(__name__).warning("LLM salary parsing failed: %s", str(e))
        return None


def parse_bank_statement_pdf(file_content: bytes) -> tuple[list[ExtractedTransaction], list[str]]:
    """Parse a bank statement PDF and extract transactions.

    Args:
        file_content: Raw PDF bytes.

    Returns:
        Tuple of (list of transactions (max 500), list of extraction errors).

    Raises:
        ParseError: If the PDF is corrupt or password-protected.
    """
    extraction_errors: list[str] = []

    try:
        doc = fitz.open(stream=file_content, filetype="pdf")
    except Exception as e:
        error_msg = str(e).lower()
        if "password" in error_msg or "encrypted" in error_msg:
            raise ParseError(
                "File is password-protected and cannot be read.",
                is_password_protected=True,
            )
        raise ParseError(f"File is corrupt or unreadable: {e}")

    if doc.is_encrypted:
        doc.close()
        raise ParseError(
            "File is password-protected and cannot be read.",
            is_password_protected=True,
        )

    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()

    if not text.strip():
        raise ParseError("Could not extract any text from the PDF.")

    transactions = _extract_transactions_from_text(text)

    if not transactions:
        extraction_errors.append("transactions")

    # Limit to MAX_TRANSACTIONS
    if len(transactions) > MAX_TRANSACTIONS:
        transactions = transactions[:MAX_TRANSACTIONS]

    return transactions, extraction_errors


def parse_bank_statement_csv(file_content: bytes) -> tuple[list[ExtractedTransaction], list[str]]:
    """Parse a bank statement CSV and extract transactions.

    Args:
        file_content: Raw CSV bytes.

    Returns:
        Tuple of (list of transactions (max 500), list of extraction errors).

    Raises:
        ParseError: If the CSV cannot be read.
    """
    extraction_errors: list[str] = []

    try:
        text = file_content.decode("utf-8")
    except UnicodeDecodeError:
        try:
            text = file_content.decode("latin-1")
        except Exception:
            raise ParseError("File encoding is not supported.")

    if not text.strip():
        raise ParseError("File is empty or contains no readable data.")

    try:
        df = pd.read_csv(io.StringIO(text))
    except Exception as e:
        raise ParseError(f"Could not parse CSV file: {e}")

    if df.empty:
        extraction_errors.append("transactions")
        return [], extraction_errors

    # Normalize column names to lowercase for matching
    df.columns = [col.strip().lower() for col in df.columns]

    # Map common column names
    date_col = _find_column(df, ["date", "transaction date", "txn date", "value date", "posting date"])
    desc_col = _find_column(df, ["description", "narration", "particulars", "remarks", "details", "transaction description"])
    amount_col = _find_column(df, ["amount", "transaction amount", "txn amount"])
    debit_col = _find_column(df, ["debit", "withdrawal", "dr", "debit amount"])
    credit_col = _find_column(df, ["credit", "deposit", "cr", "credit amount"])
    type_col = _find_column(df, ["type", "transaction type", "txn type", "dr/cr"])

    if date_col is None:
        extraction_errors.append("date")
    if desc_col is None:
        extraction_errors.append("description")

    transactions: list[ExtractedTransaction] = []

    for _, row in df.iterrows():
        if len(transactions) >= MAX_TRANSACTIONS:
            break

        # Extract date
        date_str = _parse_date(row.get(date_col) if date_col else None)
        if date_str is None:
            date_str = "1900-01-01"

        # Extract description
        description = str(row.get(desc_col, "")).strip() if desc_col else ""
        if not description or description == "nan":
            description = "Unknown"

        # Determine amount and type
        amount, txn_type = _determine_amount_and_type(
            row, amount_col, debit_col, credit_col, type_col
        )

        if amount is not None and amount != 0:
            transactions.append(
                ExtractedTransaction(
                    date=date_str,
                    description=description,
                    amount=abs(amount),
                    type=txn_type,
                )
            )

    if not transactions:
        extraction_errors.append("transactions")

    return transactions, extraction_errors


# --- Helper functions ---


def _extract_amount(text: str, patterns: list[str]) -> Optional[float]:
    """Try multiple regex patterns to extract a monetary amount."""
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            amount_str = match.group(1).replace(",", "")
            try:
                return float(amount_str)
            except ValueError:
                continue
    return None


def _extract_employer(text: str) -> Optional[str]:
    """Extract employer name from salary slip text."""
    patterns = [
        r"(?:employer|company|organization|organisation|firm)[\s:]+([A-Za-z][A-Za-z0-9\s&.,]+)",
        r"(?:issued by|paid by)[\s:]+([A-Za-z][A-Za-z0-9\s&.,]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            name = match.group(1).strip()
            # Clean up trailing punctuation or whitespace
            name = re.sub(r"[,.\s]+$", "", name)
            if len(name) > 2:
                return name
    return None


def _extract_month_year(text: str) -> Optional[str]:
    """Extract month/year from salary slip text."""
    # Match patterns like "January 2024", "Jan-2024", "01/2024"
    patterns = [
        r"(?:month|period|for|salary for)[\s:]*([A-Za-z]+[\s/-]*\d{4})",
        r"((?:January|February|March|April|May|June|July|August|September|October|November|December)[\s/-]*\d{4})",
        r"((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s/-]*\d{4})",
        r"(\d{2}[/-]\d{4})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return None


def _extract_deductions(text: str) -> list[dict]:
    """Extract deduction line items from salary slip text."""
    deductions: list[dict] = []

    # Common deduction labels in Indian payslips
    deduction_labels = [
        "provident fund", "pf", "epf", "professional tax", "pt",
        "income tax", "tds", "esi", "health insurance", "lic",
        "loan", "advance", "other deductions",
    ]

    for label in deduction_labels:
        pattern = rf"({re.escape(label)})[\s:₹Rs.]*([0-9,]+(?:\.[0-9]{{1,2}})?)"
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            amount_str = match.group(2).replace(",", "")
            try:
                amount = float(amount_str)
                if amount > 0:
                    deductions.append({"label": match.group(1).strip(), "amount": amount})
            except ValueError:
                continue

    return deductions


def _extract_transactions_from_text(text: str) -> list[ExtractedTransaction]:
    """Extract transactions from bank statement PDF text."""
    transactions: list[ExtractedTransaction] = []

    # Pattern: date followed by description and amount(s)
    # Common bank statement formats:
    # DD/MM/YYYY or DD-MM-YYYY  Description  Amount  Dr/Cr
    date_pattern = r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})"
    amount_pattern = r"([0-9,]+\.\d{2})"

    lines = text.split("\n")

    for line in lines:
        if len(transactions) >= MAX_TRANSACTIONS:
            break

        line = line.strip()
        if not line:
            continue

        # Try to find a date at the start
        date_match = re.match(date_pattern, line)
        if not date_match:
            continue

        date_str = _parse_date(date_match.group(1))
        if date_str is None:
            continue

        # Find all amounts in the line
        amounts = re.findall(amount_pattern, line)
        if not amounts:
            continue

        # Extract description (between date and first amount)
        remaining = line[date_match.end():].strip()
        desc_match = re.match(r"(.+?)\s+[0-9,]+\.\d{2}", remaining)
        description = desc_match.group(1).strip() if desc_match else remaining[:50]

        if not description:
            description = "Unknown"

        # Determine type based on context
        amount_str = amounts[0].replace(",", "")
        try:
            amount = float(amount_str)
        except ValueError:
            continue

        # Check for Dr/Cr indicators
        line_lower = line.lower()
        if "cr" in line_lower or "credit" in line_lower:
            txn_type = "credit"
        elif "dr" in line_lower or "debit" in line_lower:
            txn_type = "debit"
        elif len(amounts) >= 2:
            # Two amount columns typically means debit/credit columns
            debit_str = amounts[0].replace(",", "")
            credit_str = amounts[1].replace(",", "")
            debit_val = float(debit_str)
            credit_val = float(credit_str)
            if debit_val > 0 and credit_val == 0:
                txn_type = "debit"
                amount = debit_val
            elif credit_val > 0:
                txn_type = "credit"
                amount = credit_val
            else:
                txn_type = "debit"
        else:
            txn_type = "debit"

        if amount > 0:
            transactions.append(
                ExtractedTransaction(
                    date=date_str,
                    description=description,
                    amount=amount,
                    type=txn_type,
                )
            )

    return transactions


def _parse_date(value) -> Optional[str]:
    """Parse a date value into YYYY-MM-DD format."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None

    date_str = str(value).strip()
    if not date_str or date_str == "nan":
        return None

    # Try multiple date formats
    formats = [
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%m/%d/%Y",
        "%d/%m/%y",
        "%d-%m-%y",
        "%Y/%m/%d",
        "%d %b %Y",
        "%d %B %Y",
        "%b %d, %Y",
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None


def _find_column(df: pd.DataFrame, candidates: list[str]) -> Optional[str]:
    """Find the first matching column name from a list of candidates."""
    for candidate in candidates:
        if candidate in df.columns:
            return candidate
    # Try partial match
    for candidate in candidates:
        for col in df.columns:
            if candidate in col:
                return col
    return None


def _determine_amount_and_type(
    row, amount_col: Optional[str], debit_col: Optional[str],
    credit_col: Optional[str], type_col: Optional[str]
) -> tuple[Optional[float], str]:
    """Determine the transaction amount and type from a row."""
    amount: Optional[float] = None
    txn_type: str = "debit"

    # If separate debit/credit columns exist
    if debit_col and credit_col:
        debit_val = _to_float(row.get(debit_col))
        credit_val = _to_float(row.get(credit_col))

        if debit_val and debit_val > 0:
            amount = debit_val
            txn_type = "debit"
        elif credit_val and credit_val > 0:
            amount = credit_val
            txn_type = "credit"
    elif amount_col:
        amount = _to_float(row.get(amount_col))
        if amount is not None:
            # Determine type
            if type_col:
                type_val = str(row.get(type_col, "")).strip().lower()
                if type_val in ("cr", "credit", "c"):
                    txn_type = "credit"
                else:
                    txn_type = "debit"
            elif amount < 0:
                txn_type = "debit"
                amount = abs(amount)
            else:
                txn_type = "credit"

    return amount, txn_type


def _to_float(value) -> Optional[float]:
    """Convert a value to float, handling commas and empty values."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        if pd.isna(value):
            return None
        return float(value)
    val_str = str(value).strip().replace(",", "").replace("₹", "").replace("Rs.", "").replace("Rs", "")
    if not val_str or val_str == "nan" or val_str == "-":
        return None
    try:
        return float(val_str)
    except ValueError:
        return None
