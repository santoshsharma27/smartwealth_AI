"""Generate sample salary slip PDF and bank statement CSV for testing."""
import os

# Ensure output directory exists
os.makedirs("output", exist_ok=True)

# ============================================================
# 1. Generate Sample Salary Slip PDF using PyMuPDF (fitz)
# ============================================================
import fitz  # PyMuPDF

doc = fitz.open()
page = doc.new_page()

# Company header
page.insert_text((50, 50), "TECHVISTA SOLUTIONS PRIVATE LIMITED", fontsize=14, fontname="helv")
page.insert_text((50, 70), "4th Floor, Manyata Tech Park, Bengaluru - 560045", fontsize=9)
page.insert_text((50, 85), "=" * 80, fontsize=8)

# Payslip title
page.insert_text((200, 110), "PAYSLIP FOR: JULY-2025", fontsize=12, fontname="helv")
page.insert_text((50, 125), "-" * 80, fontsize=8)

# Employee details
page.insert_text((50, 145), "Emp Code: TV-2024-0456", fontsize=9)
page.insert_text((300, 145), "Emp Name: Rahul Sharma", fontsize=9)
page.insert_text((50, 160), "Designation: Senior Software Engineer", fontsize=9)
page.insert_text((300, 160), "Department: Engineering", fontsize=9)
page.insert_text((50, 175), "Date of Joining: 15-03-2021", fontsize=9)
page.insert_text((300, 175), "PAN: ABCPS1234K", fontsize=9)
page.insert_text((50, 190), "Bank: HDFC Bank", fontsize=9)
page.insert_text((300, 190), "A/C: XXXX-XXXX-4567", fontsize=9)
page.insert_text((50, 205), "-" * 80, fontsize=8)

# Earnings section
page.insert_text((50, 225), "EARNINGS", fontsize=10, fontname="helv")
page.insert_text((350, 225), "DEDUCTIONS", fontsize=10, fontname="helv")
page.insert_text((50, 240), "-" * 80, fontsize=8)

# Earnings
earnings = [
    ("Basic Salary", "45,000"),
    ("House Rent Allowance", "22,500"),
    ("Special Allowance", "18,000"),
    ("Conveyance Allowance", "3,200"),
    ("Medical Allowance", "2,500"),
    ("Performance Bonus", "8,800"),
]

y = 260
for label, amount in earnings:
    page.insert_text((50, y), f"{label}", fontsize=9)
    page.insert_text((220, y), f"{amount}", fontsize=9)
    y += 15

# Deductions
deductions = [
    ("Provident Fund", "5,400"),
    ("Professional Tax", "200"),
    ("Income Tax (TDS)", "12,500"),
    ("Health Insurance", "1,200"),
]

y2 = 260
for label, amount in deductions:
    page.insert_text((350, y2), f"{label}", fontsize=9)
    page.insert_text((520, y2), f"{amount}", fontsize=9)
    y2 += 15

# Totals
page.insert_text((50, 370), "-" * 80, fontsize=8)
page.insert_text((50, 390), "Gross Salary: 1,00,000", fontsize=10, fontname="helv")
page.insert_text((50, 410), "Total Deductions: 19,300", fontsize=10)
page.insert_text((50, 430), "Net Salary: 80,700", fontsize=11, fontname="helv")
page.insert_text((50, 455), "-" * 80, fontsize=8)
page.insert_text((50, 475), "Amount Credited to Bank: Rs. 80,700/-", fontsize=9)
page.insert_text((50, 495), "This is a computer-generated document and does not require a signature.", fontsize=8)

doc.save("output/sample_salary_slip.pdf")
doc.close()
print("Created: output/sample_salary_slip.pdf")


# ============================================================
# 2. Generate Sample Bank Statement CSV
# ============================================================
import csv

transactions = [
    ("01/07/2025", "SALARY CREDIT - TECHVISTA", 80700.00, "", "credit"),
    ("02/07/2025", "RENT PAYMENT - JUNE", "", 25000.00, "debit"),
    ("03/07/2025", "SWIGGY ORDER #4521", "", 450.00, "debit"),
    ("04/07/2025", "UBER TRIP - OFFICE", "", 320.00, "debit"),
    ("05/07/2025", "AMAZON PURCHASE - HEADPHONES", "", 2999.00, "debit"),
    ("06/07/2025", "ELECTRICITY BILL - BESCOM", "", 1850.00, "debit"),
    ("07/07/2025", "NETFLIX SUBSCRIPTION", "", 649.00, "debit"),
    ("08/07/2025", "ZOMATO ORDER #8812", "", 380.00, "debit"),
    ("09/07/2025", "HDFC MUTUAL FUND SIP", "", 5000.00, "debit"),
    ("10/07/2025", "PETROL - HP PUMP", "", 2500.00, "debit"),
    ("11/07/2025", "GROCERY - BIGBASKET", "", 3200.00, "debit"),
    ("12/07/2025", "FLIPKART - SHOES", "", 4500.00, "debit"),
    ("13/07/2025", "HOSPITAL VISIT - APOLLO", "", 1200.00, "debit"),
    ("14/07/2025", "EMI - CAR LOAN HDFC", "", 12000.00, "debit"),
    ("15/07/2025", "BROADBAND - AIRTEL", "", 999.00, "debit"),
    ("16/07/2025", "SWIGGY ORDER #4590", "", 520.00, "debit"),
    ("17/07/2025", "UBER TRIP - AIRPORT", "", 890.00, "debit"),
    ("18/07/2025", "MYNTRA - CLOTHES", "", 3200.00, "debit"),
    ("19/07/2025", "SPOTIFY PREMIUM", "", 119.00, "debit"),
    ("20/07/2025", "TRANSFER TO SAVINGS", "", 10000.00, "debit"),
    ("21/07/2025", "RESTAURANT - DINNER", "", 1800.00, "debit"),
    ("22/07/2025", "UDEMY COURSE - REACT", "", 499.00, "debit"),
    ("23/07/2025", "PVR CINEMA - TICKETS", "", 600.00, "debit"),
    ("24/07/2025", "OLA RIDE - MALL", "", 280.00, "debit"),
    ("25/07/2025", "MEDICAL STORE - APOLLO", "", 450.00, "debit"),
]

with open("output/sample_bank_statement.csv", "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["Date", "Description", "Credit", "Debit", "Type"])
    for row in transactions:
        writer.writerow(row)

print("Created: output/sample_bank_statement.csv")
print("\nFiles ready in test-data/output/")
print("  - sample_salary_slip.pdf (Gross: 1,00,000 | Net: 80,700)")
print("  - sample_bank_statement.csv (25 transactions, multiple categories)")
