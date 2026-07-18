package com.smartwealth.service;

import com.smartwealth.entity.*;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@ApplicationScoped
public class DemoDataService {

    @Transactional
    public void loadDemoData(Session session) {
        Document demoDocument = createDemoDocument(session);
        createDemoSalaryData(session, demoDocument);
        List<Transaction> transactions = createDemoTransactions(session, demoDocument);
        createDemoFinancialSummary(session);
        createDemoHealthScore(session);
        createDemoRecommendations(session);
        createDemoGoal(session);
        createDemoRecurringExpenses(session);
        createDemoSpendingAnomaly(session, transactions);
        session.isDemoActive = true;
        session.lastAccessedAt = Timestamp.from(Instant.now());
        session.persist();
    }

    @Transactional
    public void clearDemoData(Session session) {
        UUID sessionId = session.id;
        SpendingAnomaly.delete("session.id", sessionId);
        RecurringExpense.delete("session.id", sessionId);
        ChatMessage.delete("session.id", sessionId);
        Goal.delete("session.id", sessionId);
        Recommendation.delete("session.id", sessionId);
        HealthScore.delete("session.id", sessionId);
        FinancialSummary.delete("session.id", sessionId);
        Transaction.delete("session.id", sessionId);
        SalaryData.delete("session.id", sessionId);
        Document.delete("session.id", sessionId);
        session.isDemoActive = false;
        session.lastAccessedAt = Timestamp.from(Instant.now());
        session.persist();
    }

    private Document createDemoDocument(Session session) {
        Document doc = new Document();
        doc.session = session;
        doc.fileName = "demo_bank_statement.pdf";
        doc.fileFormat = "pdf";
        doc.documentType = "bank_statement";
        doc.storagePath = "/demo/demo_bank_statement.pdf";
        doc.status = "processed";
        doc.fileSizeBytes = 102400;
        doc.processedAt = Timestamp.from(Instant.now());
        doc.persist();
        return doc;
    }

    private void createDemoSalaryData(Session session, Document document) {
        SalaryData salary = new SalaryData();
        salary.session = session;
        salary.document = document;
        salary.grossSalary = new BigDecimal("120000.00");
        salary.netSalary = new BigDecimal("98000.00");
        salary.employerName = "TechCorp India Pvt Ltd";
        salary.monthYear = "2024-01";
        salary.deductions = List.of(Map.of("label", "PF", "amount", 7200.0), Map.of("label", "Professional Tax", "amount", 200.0), Map.of("label", "Income Tax", "amount", 12600.0), Map.of("label", "Health Insurance", "amount", 2000.0));
        salary.persist();
    }

    private List<Transaction> createDemoTransactions(Session session, Document document) {
        LocalDate baseDate = LocalDate.now().withDayOfMonth(1);
        List<Transaction> txns = new ArrayList<>();
        txns.add(makeTxn(session, document, baseDate, "RENT TRANSFER TO LANDLORD", "25000.00", "debit", "Rent"));
        txns.add(makeTxn(session, document, baseDate.plusDays(2), "SWIGGY ORDER #45231", "650.00", "debit", "Food"));
        txns.add(makeTxn(session, document, baseDate.plusDays(5), "ZOMATO FOOD DELIVERY", "480.00", "debit", "Food"));
        txns.add(makeTxn(session, document, baseDate.plusDays(8), "BIGBASKET GROCERY ORDER", "5200.00", "debit", "Food"));
        txns.add(makeTxn(session, document, baseDate.plusDays(15), "DMART SUPERMARKET", "7800.00", "debit", "Food"));
        txns.add(makeTxn(session, document, baseDate.plusDays(22), "RESTAURANT DINNER BARBEQUE NATION", "4370.00", "debit", "Food"));
        txns.add(makeTxn(session, document, baseDate.plusDays(3), "OLA RIDE TO OFFICE", "350.00", "debit", "Travel"));
        txns.add(makeTxn(session, document, baseDate.plusDays(10), "UBER TRIP AIRPORT", "1200.00", "debit", "Travel"));
        txns.add(makeTxn(session, document, baseDate.plusDays(18), "IRCTC TRAIN BOOKING", "3450.00", "debit", "Travel"));
        txns.add(makeTxn(session, document, baseDate.plusDays(6), "AMAZON PURCHASE ELECTRONICS", "4500.00", "debit", "Shopping"));
        txns.add(makeTxn(session, document, baseDate.plusDays(12), "FLIPKART ORDER CLOTHING", "2200.00", "debit", "Shopping"));
        txns.add(makeTxn(session, document, baseDate.plusDays(25), "MYNTRA FASHION SALE", "1300.00", "debit", "Shopping"));
        txns.add(makeTxn(session, document, baseDate.plusDays(1), "ELECTRICITY BILL TATA POWER", "2500.00", "debit", "Bills"));
        txns.add(makeTxn(session, document, baseDate.plusDays(4), "AIRTEL BROADBAND MONTHLY", "1500.00", "debit", "Bills"));
        txns.add(makeTxn(session, document, baseDate.plusDays(7), "MOBILE RECHARGE JIO", "2000.00", "debit", "Bills"));
        txns.add(makeTxn(session, document, baseDate.plusDays(5), "HOME LOAN EMI HDFC", "10000.00", "debit", "EMI"));
        txns.add(makeTxn(session, document, baseDate.plusDays(9), "APOLLO PHARMACY MEDICINES", "1200.00", "debit", "Healthcare"));
        txns.add(makeTxn(session, document, baseDate.plusDays(20), "DR MEHTA CONSULTATION FEE", "800.00", "debit", "Healthcare"));
        txns.add(makeTxn(session, document, baseDate.plusDays(11), "NETFLIX SUBSCRIPTION", "649.00", "debit", "Entertainment"));
        txns.add(makeTxn(session, document, baseDate.plusDays(16), "PVR CINEMAS MOVIE TICKETS", "2851.00", "debit", "Entertainment"));
        txns.add(makeTxn(session, document, baseDate, "SALARY CREDIT TECHCORP INDIA", "120000.00", "credit", null));
        return txns;
    }

    private Transaction makeTxn(Session session, Document document, LocalDate date, String description, String amount, String type, String category) {
        Transaction txn = new Transaction();
        txn.session = session;
        txn.document = document;
        txn.transactionDate = date;
        txn.description = description;
        txn.amount = new BigDecimal(amount);
        txn.type = type;
        txn.category = category;
        txn.confidence = category != null ? new BigDecimal("0.95") : null;
        txn.categorizationMethod = category != null ? "rule_based" : null;
        txn.persist();
        return txn;
    }

    private void createDemoFinancialSummary(Session session) {
        FinancialSummary summary = new FinancialSummary();
        summary.session = session;
        summary.monthlyIncome = new BigDecimal("120000.00");
        summary.totalExpenses = new BigDecimal("78000.00");
        summary.monthlySavings = new BigDecimal("42000.00");
        summary.savingsPercentage = new BigDecimal("35.00");
        summary.expensesByCategory = Map.of("Rent", 25000.0, "Food", 18500.0, "Travel", 5000.0, "Shopping", 8000.0, "Bills", 6000.0, "EMI", 10000.0, "Healthcare", 2000.0, "Entertainment", 3500.0);
        summary.persist();
    }

    private void createDemoHealthScore(Session session) {
        HealthScore score = new HealthScore();
        score.session = session;
        score.totalScore = 72;
        score.statusLabel = "Very Good";
        score.savingsRatioScore = 30;
        score.expenseControlScore = 18;
        score.emiBurdenScore = 12;
        score.investmentAllocationScore = 5;
        score.emergencyFundScore = 7;
        score.componentDetails = Map.of("savingsRatio", Map.of("score", 30, "maxScore", 30, "value", 0.35), "expenseControl", Map.of("score", 18, "maxScore", 25, "value", 0.45), "emiBurden", Map.of("score", 12, "maxScore", 15, "value", 0.083), "investmentAllocation", Map.of("score", 5, "maxScore", 15, "value", 0.0), "emergencyFundReadiness", Map.of("score", 7, "maxScore", 15, "value", 2.8));
        score.persist();
    }

    private void createDemoRecommendations(Session session) {
        Timestamp now = Timestamp.from(Instant.now());
        persistRec(session, 1, "Savings", "Your savings rate is 35%, which is excellent! Consider allocating a portion of your monthly savings towards long-term investments to grow your wealth faster.", "Savings rate: 35% (₹42,000/month)", now);
        persistRec(session, 2, "Food", "Your food expenses are ₹18,500 (23.7% of total expenses). Consider meal planning and reducing food delivery orders to save approximately ₹4,000-5,000 monthly.", "Food expenses: ₹18,500/month (23.7%)", now);
        persistRec(session, 3, "EMI", "Your EMI payments of ₹10,000 represent 8.3% of your income, which is well within the healthy range. Continue maintaining this low EMI burden.", "EMI burden: 8.3% of income (₹10,000)", now);
        persistRec(session, 4, "Investment", "Consider starting a Systematic Investment Plan (SIP) with a portion of your monthly savings. Allocating 15-20% of income towards investments can help build long-term wealth.", "Current investment allocation: 0%", now);
        persistRec(session, 5, "Emergency Fund", "Your emergency fund covers approximately 2.8 months of expenses. Aim to build it to 6 months for better financial security against unexpected events.", "Emergency fund coverage: 2.8 months", now);
    }

    private void persistRec(Session session, int order, String category, String text, String dataPointRef, Timestamp generatedAt) {
        Recommendation rec = new Recommendation();
        rec.session = session;
        rec.displayOrder = order;
        rec.category = category;
        rec.text = text;
        rec.dataPointReference = dataPointRef;
        rec.generatedAt = generatedAt;
        rec.persist();
    }

    private void createDemoGoal(Session session) {
        Goal goal = new Goal();
        goal.session = session;
        goal.goalName = "Buy a Car";
        goal.goalType = "buy_car";
        goal.targetAmount = new BigDecimal("800000.00");
        goal.durationMonths = 24;
        goal.existingSavings = new BigDecimal("100000.00");
        goal.expectedReturnPercent = new BigDecimal("8.00");
        goal.requiredMonthlySavings = new BigDecimal("26923.00");
        goal.feasibilityStatus = "Challenging";
        goal.persist();
    }

    private void createDemoRecurringExpenses(Session session) {
        Timestamp now = Timestamp.from(Instant.now());
        RecurringExpense netflix = new RecurringExpense();
        netflix.session = session;
        netflix.description = "NETFLIX SUBSCRIPTION";
        netflix.recurringAmount = new BigDecimal("649.00");
        netflix.consecutiveMonths = 6;
        netflix.detectedAt = now;
        netflix.persist();
        RecurringExpense electricity = new RecurringExpense();
        electricity.session = session;
        electricity.description = "ELECTRICITY BILL TATA POWER";
        electricity.recurringAmount = new BigDecimal("2500.00");
        electricity.consecutiveMonths = 4;
        electricity.detectedAt = now;
        electricity.persist();
        RecurringExpense broadband = new RecurringExpense();
        broadband.session = session;
        broadband.description = "AIRTEL BROADBAND MONTHLY";
        broadband.recurringAmount = new BigDecimal("1500.00");
        broadband.consecutiveMonths = 5;
        broadband.detectedAt = now;
        broadband.persist();
    }

    private void createDemoSpendingAnomaly(Session session, List<Transaction> transactions) {
        Transaction anomalousTxn = transactions.stream().filter(t -> t.description.contains("DMART SUPERMARKET")).findFirst().orElse(null);
        if (anomalousTxn != null) {
            SpendingAnomaly anomaly = new SpendingAnomaly();
            anomaly.session = session;
            anomaly.transaction = anomalousTxn;
            anomaly.description = anomalousTxn.description;
            anomaly.transactionAmount = anomalousTxn.amount;
            anomaly.category = "Food";
            anomaly.categoryAverage = new BigDecimal("3700.00");
            anomaly.detectedAt = Timestamp.from(Instant.now());
            anomaly.persist();
        }
    }
}
