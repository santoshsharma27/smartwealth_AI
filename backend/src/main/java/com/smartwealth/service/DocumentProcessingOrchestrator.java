package com.smartwealth.service;

import com.smartwealth.client.AiServiceClientWrapper;
import com.smartwealth.client.dto.*;
import com.smartwealth.entity.*;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import org.jboss.logging.Logger;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Orchestrator service that triggers the document processing pipeline after upload:
 * parse → categorize → score → recommend.
 *
 * Stores extracted transactions, salary data, financial summary, health score,
 * and recommendations to the database.
 *
 * Handles partial failures: if AI Service is unavailable, retains documents,
 * updates document status to indicate delayed processing.
 */
@ApplicationScoped
public class DocumentProcessingOrchestrator {

    private static final Logger LOG = Logger.getLogger(DocumentProcessingOrchestrator.class);

    @Inject
    AiServiceClientWrapper aiServiceClient;

    /**
     * Process documents by their IDs. Loads fresh managed entities in its own transaction.
     * This avoids detached entity issues from cross-transaction references.
     */
    @jakarta.transaction.Transactional(jakarta.transaction.Transactional.TxType.REQUIRES_NEW)
    public void processDocumentsByIds(UUID sessionId, List<UUID> documentIds) {
        try {
            List<Document> documents = new ArrayList<>();
            for (UUID docId : documentIds) {
                Document doc = Document.findById(docId);
                if (doc != null) {
                    documents.add(doc);
                }
            }
            if (!documents.isEmpty()) {
                processDocuments(sessionId, documents);
            }
        } catch (Exception e) {
            LOG.errorf(e, "Document processing failed for session %s", sessionId);
        }
    }

    /**
     * Triggers the document processing pipeline synchronously.
     * Documents are reloaded from DB to ensure they're in the current persistence context.
     *
     * @param sessionId the session ID
     * @param documents the uploaded documents (may be detached)
     */
    @jakarta.transaction.Transactional
    public void processDocumentsAsync(UUID sessionId, List<Document> documents) {
        try {
            // Reload documents to get managed entities in this transaction
            List<Document> managedDocs = new ArrayList<>();
            for (Document d : documents) {
                Document managed = Document.findById(d.id);
                if (managed != null) {
                    managedDocs.add(managed);
                }
            }
            if (!managedDocs.isEmpty()) {
                processDocuments(sessionId, managedDocs);
            }
        } catch (Exception e) {
            LOG.errorf(e, "Document processing failed for session %s", sessionId);
            // Don't rethrow — let the upload succeed even if processing fails
        }
    }

    /**
     * Processes all uploaded documents for a session through the full AI pipeline.
     * Called after documents are successfully uploaded.
     *
     * Pipeline: parse → categorize → calculate score → generate recommendations
     *
     * @param sessionId the session ID
     * @param documents the uploaded documents to process
     */
    public void processDocuments(UUID sessionId, List<Document> documents) {
        LOG.infof("Starting document processing pipeline for session %s with %d documents", sessionId, documents.size());

        try {
            // Step 1: Parse all documents
            List<Transaction> allTransactions = new ArrayList<>();
            for (Document document : documents) {
                parseDocument(sessionId, document, allTransactions);
            }

            // Step 2: Categorize debit transactions
            if (!allTransactions.isEmpty()) {
                categorizeTransactions(allTransactions);
            }

            // Step 3: Calculate financial summary
            FinancialSummary summary = calculateFinancialSummary(sessionId, allTransactions);

            // Step 4: Calculate health score
            if (summary != null) {
                calculateHealthScore(sessionId, summary, allTransactions);
            }

            // Step 5: Generate recommendations
            if (summary != null) {
                generateRecommendations(sessionId, summary);
            }

            // Mark all documents as processed
            markDocumentsProcessed(documents);

            LOG.infof("Document processing pipeline completed successfully for session %s", sessionId);

        } catch (Exception e) {
            LOG.errorf(e, "Document processing pipeline failed for session %s", sessionId);
            // Handle partial failure: retain documents, mark processing delayed
            markDocumentsDelayed(documents);
        }
    }

    /**
     * Parses a single document via the AI service and stores extracted data.
     */
    void parseDocument(UUID sessionId, Document document, List<Transaction> allTransactions) {
        LOG.infof("Parsing document %s (type: %s) for session %s", document.id, document.documentType, sessionId);

        // Read file content and encode as base64
        String fileContent = readFileAsBase64(document.storagePath);
        if (fileContent == null) {
            LOG.warnf("Could not read file for document %s", document.id);
            updateDocumentStatus(document, "failed");
            return;
        }

        // Update status to processing
        updateDocumentStatus(document, "processing");

        ParseRequest request = new ParseRequest(
                document.id.toString(),
                document.documentType,
                document.fileFormat,
                fileContent
        );

        ParseResponse response = aiServiceClient.parseDocument(request);

        if (response == null) {
            LOG.warnf("Parsing returned null for document %s", document.id);
            updateDocumentStatus(document, "failed");
            return;
        }

        // Check if we got usable data (even with partial extraction errors)
        boolean hasSalaryData = response.salaryData != null
                && (response.salaryData.grossSalary > 0 || response.salaryData.netSalary > 0);
        boolean hasTransactions = response.transactions != null && !response.transactions.isEmpty();

        if (!hasSalaryData && !hasTransactions) {
            LOG.warnf("Parsing produced no usable data for document %s (errors: %s)", document.id, response.extractionErrors);
            updateDocumentStatus(document, "failed");
            return;
        }

        // Store extracted data based on document type
        if ("salary_slip".equals(document.documentType) && response.salaryData != null) {
            storeSalaryData(sessionId, document.id, response.salaryData);
        }

        if (response.transactions != null && !response.transactions.isEmpty()) {
            List<Transaction> transactions = storeTransactions(sessionId, document.id, response.transactions);
            allTransactions.addAll(transactions);
        }
    }

    /**
     * Categorizes debit transactions via the AI service and updates them in the database.
     */
    void categorizeTransactions(List<Transaction> transactions) {
        // Filter debit transactions for categorization
        List<Transaction> debitTransactions = transactions.stream()
                .filter(t -> "debit".equals(t.type))
                .collect(Collectors.toList());

        if (debitTransactions.isEmpty()) {
            LOG.info("No debit transactions to categorize");
            return;
        }

        LOG.infof("Categorizing %d debit transactions", debitTransactions.size());

        List<CategorizeRequest.TransactionInput> inputs = debitTransactions.stream()
                .map(t -> new CategorizeRequest.TransactionInput(
                        t.id.toString(),
                        t.description,
                        t.amount.doubleValue(),
                        t.type
                ))
                .collect(Collectors.toList());

        CategorizeRequest request = new CategorizeRequest(inputs);
        CategorizeResponse response = aiServiceClient.categorizeTransactions(request);

        if (response == null || response.categorizedTransactions == null) {
            LOG.warn("Categorization returned null response");
            return;
        }

        // Update transactions with categories
        Map<String, CategorizeResponse.CategorizedTransaction> categoryMap = response.categorizedTransactions.stream()
                .collect(Collectors.toMap(ct -> ct.id, ct -> ct));

        for (Transaction transaction : debitTransactions) {
            CategorizeResponse.CategorizedTransaction categorized = categoryMap.get(transaction.id.toString());
            if (categorized != null) {
                transaction.category = categorized.category;
                transaction.confidence = BigDecimal.valueOf(categorized.confidence);
                transaction.categorizationMethod = categorized.method;
                // Entity is managed — changes auto-flush on transaction commit
            }
        }

        LOG.infof("Categorization complete: %d transactions categorized", response.categorizedTransactions.size());
    }

    /**
     * Calculates the financial summary from transactions and salary data, and stores it.
     */
    FinancialSummary calculateFinancialSummary(UUID sessionId, List<Transaction> transactions) {
        LOG.infof("Calculating financial summary for session %s", sessionId);

        // Determine monthly income from salary data or credit transactions
        BigDecimal monthlyIncome = calculateMonthlyIncome(sessionId, transactions);

        // Calculate total expenses from debit transactions
        BigDecimal totalExpenses = transactions.stream()
                .filter(t -> "debit".equals(t.type))
                .map(t -> t.amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Calculate expenses by category
        Map<String, Double> expensesByCategory = transactions.stream()
                .filter(t -> "debit".equals(t.type) && t.category != null)
                .collect(Collectors.groupingBy(
                        t -> t.category,
                        Collectors.summingDouble(t -> t.amount.doubleValue())
                ));

        // Calculate savings
        BigDecimal monthlySavings = monthlyIncome.subtract(totalExpenses);
        BigDecimal savingsPercentage = BigDecimal.ZERO;
        if (monthlyIncome.compareTo(BigDecimal.ZERO) > 0) {
            savingsPercentage = monthlySavings.multiply(BigDecimal.valueOf(100))
                    .divide(monthlyIncome, 2, RoundingMode.HALF_UP);
        }

        // Delete existing summary for session (upsert behavior)
        FinancialSummary existing = FinancialSummary.findBySessionId(sessionId);
        if (existing != null) {
            existing.delete();
        }

        // Create and persist new summary
        Session session = Session.findById(sessionId);
        FinancialSummary summary = new FinancialSummary();
        summary.session = session;
        summary.monthlyIncome = monthlyIncome;
        summary.totalExpenses = totalExpenses;
        summary.monthlySavings = monthlySavings;
        summary.savingsPercentage = savingsPercentage;
        summary.expensesByCategory = expensesByCategory;
        summary.persist();

        LOG.infof("Financial summary stored for session %s: income=%s, expenses=%s, savings=%s",
                sessionId, monthlyIncome, totalExpenses, monthlySavings);

        return summary;
    }

    /**
     * Calculates health score via the AI service and stores the result.
     */
    void calculateHealthScore(UUID sessionId, FinancialSummary summary, List<Transaction> transactions) {
        LOG.infof("Calculating health score for session %s", sessionId);

        // Calculate cumulative savings balance (credits - debits)
        BigDecimal totalCredits = transactions.stream()
                .filter(t -> "credit".equals(t.type))
                .map(t -> t.amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalDebits = transactions.stream()
                .filter(t -> "debit".equals(t.type))
                .map(t -> t.amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        double cumulativeSavingsBalance = totalCredits.subtract(totalDebits).doubleValue();

        // Calculate months of data from transaction date range
        int monthsOfData = calculateMonthsOfData(transactions);

        ScoreRequest request = new ScoreRequest(
                summary.monthlyIncome.doubleValue(),
                summary.totalExpenses.doubleValue(),
                summary.expensesByCategory,
                Math.max(0, cumulativeSavingsBalance),
                Math.max(1, monthsOfData)
        );

        ScoreResponse response = aiServiceClient.calculateScore(request);

        if (response == null) {
            LOG.warn("Health score calculation returned null response");
            return;
        }

        // Delete existing score for session (upsert behavior)
        HealthScore existing = HealthScore.findBySessionId(sessionId);
        if (existing != null) {
            existing.delete();
        }

        // Store health score
        Session sessionEntity = Session.findById(sessionId);
        HealthScore healthScore = new HealthScore();
        healthScore.session = sessionEntity;
        healthScore.totalScore = response.totalScore;
        healthScore.statusLabel = mapScoreToLabel(response.totalScore);

        // Extract component scores
        if (response.components != null) {
            healthScore.savingsRatioScore = getComponentScore(response.components, "savingsRatio");
            healthScore.expenseControlScore = getComponentScore(response.components, "expenseControl");
            healthScore.emiBurdenScore = getComponentScore(response.components, "emiBurden");
            healthScore.investmentAllocationScore = getComponentScore(response.components, "investmentAllocation");
            healthScore.emergencyFundScore = getComponentScore(response.components, "emergencyFundReadiness");
        }

        // Store full component details as JSON
        Map<String, Object> componentDetails = new HashMap<>();
        if (response.components != null) {
            for (Map.Entry<String, ScoreResponse.ScoreComponentDetail> entry : response.components.entrySet()) {
                Map<String, Object> detail = new HashMap<>();
                detail.put("score", entry.getValue().score);
                detail.put("ratio", entry.getValue().ratio);
                componentDetails.put(entry.getKey(), detail);
            }
        }
        healthScore.componentDetails = componentDetails;
        healthScore.persist();

        LOG.infof("Health score stored for session %s: totalScore=%d, status=%s",
                sessionId, healthScore.totalScore, healthScore.statusLabel);
    }

    /**
     * Generates AI recommendations via the AI service and stores them.
     */
    void generateRecommendations(UUID sessionId, FinancialSummary summary) {
        LOG.infof("Generating recommendations for session %s", sessionId);

        double emiAmount = summary.expensesByCategory != null
                ? summary.expensesByCategory.getOrDefault("EMI", 0.0)
                : 0.0;
        double investmentAmount = summary.expensesByCategory != null
                ? summary.expensesByCategory.getOrDefault("Investments", 0.0)
                : 0.0;
        double savingsRate = summary.monthlyIncome.compareTo(BigDecimal.ZERO) > 0
                ? summary.monthlySavings.doubleValue() / summary.monthlyIncome.doubleValue()
                : 0.0;

        RecommendRequest request = new RecommendRequest(
                summary.monthlyIncome.doubleValue(),
                summary.totalExpenses.doubleValue(),
                summary.expensesByCategory,
                savingsRate,
                emiAmount,
                investmentAmount
        );

        RecommendResponse response = aiServiceClient.generateRecommendations(request);

        if (response == null || response.recommendations == null || response.recommendations.isEmpty()) {
            LOG.warn("Recommendation generation returned no results");
            return;
        }

        // Delete existing recommendations for session (before regenerating)
        Recommendation.deleteBySessionId(sessionId);

        // Store new recommendations
        Session sessionForRecs = Session.findById(sessionId);
        int order = 1;
        for (RecommendResponse.Recommendation rec : response.recommendations) {
            Recommendation recommendation = new Recommendation();
            recommendation.session = sessionForRecs;
            recommendation.displayOrder = order++;
            recommendation.category = rec.category != null ? rec.category : "General";
            recommendation.text = rec.text;
            recommendation.dataPointReference = rec.dataPointReference != null ? rec.dataPointReference : "";
            recommendation.persist();
        }

        LOG.infof("Stored %d recommendations for session %s", response.recommendations.size(), sessionId);
    }

    // ===== Helper Methods =====

    /**
     * Reads a file from the filesystem and returns its content as a base64-encoded string.
     */
    private String readFileAsBase64(String storagePath) {
        try {
            byte[] fileBytes = Files.readAllBytes(Path.of(storagePath));
            return Base64.getEncoder().encodeToString(fileBytes);
        } catch (Exception e) {
            LOG.errorf(e, "Failed to read file at path: %s", storagePath);
            return null;
        }
    }

    /**
     * Stores salary data extracted from a salary slip.
     */
    void storeSalaryData(UUID sessionId, UUID documentId, ParseResponse.SalaryData data) {
        Session session = Session.findById(sessionId);
        Document document = Document.findById(documentId);
        SalaryData salaryData = new SalaryData();
        salaryData.session = session;
        salaryData.document = document;
        salaryData.grossSalary = BigDecimal.valueOf(data.grossSalary);
        salaryData.netSalary = BigDecimal.valueOf(data.netSalary);
        salaryData.employerName = data.employerName;
        salaryData.monthYear = data.monthYear;
        salaryData.deductions = data.deductions;
        salaryData.persist();

        LOG.infof("Stored salary data for document %s: gross=%s, net=%s", documentId, data.grossSalary, data.netSalary);
    }

    /**
     * Stores transactions extracted from a bank statement.
     */
    List<Transaction> storeTransactions(UUID sessionId, UUID documentId, List<ParseResponse.ExtractedTransaction> extracted) {
        Session session = Session.findById(sessionId);
        Document document = Document.findById(documentId);
        List<Transaction> stored = new ArrayList<>();

        for (ParseResponse.ExtractedTransaction ext : extracted) {
            Transaction transaction = new Transaction();
            transaction.session = session;
            transaction.document = document;
            transaction.description = ext.description;
            transaction.amount = BigDecimal.valueOf(ext.amount);
            transaction.type = ext.type;
            transaction.transactionDate = parseDate(ext.date);
            transaction.persist();
            stored.add(transaction);
        }

        LOG.infof("Stored %d transactions for document %s", stored.size(), documentId);
        return stored;
    }

    /**
     * Calculates monthly income from salary data or credit transactions.
     */
    private BigDecimal calculateMonthlyIncome(UUID sessionId, List<Transaction> transactions) {
        // First, try to get income from salary data
        List<SalaryData> salaryDataList = SalaryData.findBySessionId(sessionId);
        if (!salaryDataList.isEmpty()) {
            // Use average net salary if multiple salary slips
            BigDecimal totalNetSalary = salaryDataList.stream()
                    .map(s -> s.netSalary)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            return totalNetSalary.divide(BigDecimal.valueOf(salaryDataList.size()), 2, RoundingMode.HALF_UP);
        }

        // Fallback: use total credits from transactions as monthly income estimate
        BigDecimal totalCredits = transactions.stream()
                .filter(t -> "credit".equals(t.type))
                .map(t -> t.amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        int months = Math.max(1, calculateMonthsOfData(transactions));
        return totalCredits.divide(BigDecimal.valueOf(months), 2, RoundingMode.HALF_UP);
    }

    /**
     * Calculates the number of months covered by the transaction data.
     */
    private int calculateMonthsOfData(List<Transaction> transactions) {
        if (transactions.isEmpty()) {
            return 1;
        }

        Optional<LocalDate> earliest = transactions.stream()
                .map(t -> t.transactionDate)
                .filter(Objects::nonNull)
                .min(LocalDate::compareTo);
        Optional<LocalDate> latest = transactions.stream()
                .map(t -> t.transactionDate)
                .filter(Objects::nonNull)
                .max(LocalDate::compareTo);

        if (earliest.isPresent() && latest.isPresent()) {
            long months = ChronoUnit.MONTHS.between(earliest.get(), latest.get()) + 1;
            return (int) Math.max(1, months);
        }

        return 1;
    }

    /**
     * Parses a date string into a LocalDate, handling common formats.
     */
    private LocalDate parseDate(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) {
            return LocalDate.now();
        }

        // Try ISO format first (yyyy-MM-dd)
        try {
            return LocalDate.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE);
        } catch (DateTimeParseException ignored) {
        }

        // Try dd/MM/yyyy
        try {
            return LocalDate.parse(dateStr, DateTimeFormatter.ofPattern("dd/MM/yyyy"));
        } catch (DateTimeParseException ignored) {
        }

        // Try MM/dd/yyyy
        try {
            return LocalDate.parse(dateStr, DateTimeFormatter.ofPattern("MM/dd/yyyy"));
        } catch (DateTimeParseException ignored) {
        }

        // Default to today
        return LocalDate.now();
    }

    /**
     * Maps a numeric health score to a status label.
     */
    private String mapScoreToLabel(int score) {
        if (score <= 30) return "Needs Attention";
        if (score <= 50) return "Fair";
        if (score <= 70) return "Good";
        if (score <= 85) return "Very Good";
        return "Excellent";
    }

    /**
     * Extracts a component score from the response components map.
     */
    private int getComponentScore(Map<String, ScoreResponse.ScoreComponentDetail> components, String key) {
        ScoreResponse.ScoreComponentDetail detail = components.get(key);
        return detail != null ? detail.score : 0;
    }

    /**
     * Updates the status of a document entity.
     */
    void updateDocumentStatus(Document document, String status) {
        document.status = status;
        if ("processed".equals(status)) {
            document.processedAt = Timestamp.from(Instant.now());
        }
        // Entity is managed — changes auto-flush on transaction commit
    }

    /**
     * Marks all documents as processed.
     */
    void markDocumentsProcessed(List<Document> documents) {
        for (Document doc : documents) {
            if (!"failed".equals(doc.status)) {
                updateDocumentStatus(doc, "processed");
            }
        }
    }

    /**
     * Marks documents as delayed when AI service is unavailable.
     * Documents are retained; processing can be retried later.
     */
    void markDocumentsDelayed(List<Document> documents) {
        for (Document doc : documents) {
            if (!"processed".equals(doc.status) && !"failed".equals(doc.status)) {
                updateDocumentStatus(doc, "uploaded");
            }
        }
        LOG.warnf("Marked %d documents as delayed due to processing failure", documents.size());
    }
}
