package com.smartwealth.resource;

import com.smartwealth.dto.*;
import com.smartwealth.entity.*;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * REST resource for financial data retrieval endpoints.
 * All endpoints are scoped to a session and return 404 if the session does not exist.
 */
@Path("/api/sessions")
@Produces(MediaType.APPLICATION_JSON)
public class FinancialDataResource {

    /**
     * GET /api/sessions/{id}/summary
     * Returns the financial summary with ₹ formatting metadata.
     */
    @GET
    @Path("/{id}/summary")
    public Response getFinancialSummary(@PathParam("id") UUID sessionId) {
        Session session = Session.findById(sessionId);
        if (session == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(new ErrorResponse("Session not found"))
                    .build();
        }

        FinancialSummary summary = FinancialSummary.findBySessionId(sessionId);
        if (summary == null) {
            return Response.ok(new FinancialSummaryResponse(
                    null, null, null, null, null, null, null,
                    FinancialSummaryResponse.CurrencyMetadata.INR
            )).build();
        }

        FinancialSummaryResponse response = new FinancialSummaryResponse(
                summary.id,
                summary.monthlyIncome,
                summary.totalExpenses,
                summary.monthlySavings,
                summary.savingsPercentage,
                summary.expensesByCategory,
                summary.calculatedAt,
                FinancialSummaryResponse.CurrencyMetadata.INR
        );

        return Response.ok(response).build();
    }

    /**
     * GET /api/sessions/{id}/transactions
     * Returns paginated, categorized transactions with optional category filter.
     */
    @GET
    @Path("/{id}/transactions")
    public Response getTransactions(
            @PathParam("id") UUID sessionId,
            @QueryParam("page") @DefaultValue("0") int page,
            @QueryParam("size") @DefaultValue("20") int size,
            @QueryParam("category") String category) {

        Session session = Session.findById(sessionId);
        if (session == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(new ErrorResponse("Session not found"))
                    .build();
        }

        // Ensure valid page/size values
        if (page < 0) page = 0;
        if (size < 1) size = 20;
        if (size > 100) size = 100;

        List<Transaction> transactions;
        long totalItems;

        if (category != null && !category.isBlank()) {
            transactions = Transaction.find(
                            "session.id = ?1 and category = ?2 order by transactionDate desc",
                            sessionId, category)
                    .page(page, size)
                    .list();
            totalItems = Transaction.count("session.id = ?1 and category = ?2", sessionId, category);
        } else {
            transactions = Transaction.find(
                            "session.id = ?1 order by transactionDate desc", sessionId)
                    .page(page, size)
                    .list();
            totalItems = Transaction.count("session.id", sessionId);
        }

        List<TransactionResponse> transactionDtos = transactions.stream()
                .map(t -> new TransactionResponse(
                        t.id,
                        t.transactionDate,
                        t.description,
                        t.amount,
                        t.type,
                        t.category,
                        t.confidence,
                        t.categorizationMethod
                ))
                .collect(Collectors.toList());

        int totalPages = (int) Math.ceil((double) totalItems / size);

        PaginatedTransactionsResponse response = new PaginatedTransactionsResponse(
                transactionDtos, page, size, totalItems, totalPages
        );

        return Response.ok(response).build();
    }

    /**
     * GET /api/sessions/{id}/score
     * Returns the Financial Health Score with component breakdown.
     * Response matches design contract: components include score, maxScore, and value fields;
     * metadata block provides income/expenses/savings context.
     */
    @GET
    @Path("/{id}/score")
    public Response getHealthScore(@PathParam("id") UUID sessionId) {
        Session session = Session.findById(sessionId);
        if (session == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(new ErrorResponse("Session not found"))
                    .build();
        }

        HealthScore score = HealthScore.findBySessionId(sessionId);
        if (score == null) {
            return Response.ok(null).build();
        }

        // Extract component values from componentDetails JSONB if available
        Double savingsRatioValue = extractComponentValue(score.componentDetails, "savingsRatio");
        Double expenseControlValue = extractComponentValue(score.componentDetails, "expenseControl");
        Double emiBurdenValue = extractComponentValue(score.componentDetails, "emiBurden");
        Double investmentAllocationValue = extractComponentValue(score.componentDetails, "investmentAllocation");
        Double emergencyFundValue = extractComponentValue(score.componentDetails, "emergencyFundReadiness");

        // Build metadata from financial summary if available
        FinancialSummary summary = FinancialSummary.findBySessionId(sessionId);
        HealthScoreResponse.ScoreMetadata metadata = summary != null
                ? new HealthScoreResponse.ScoreMetadata(
                        summary.monthlyIncome,
                        summary.totalExpenses,
                        summary.monthlySavings,
                        score.calculatedAt)
                : new HealthScoreResponse.ScoreMetadata(null, null, null, score.calculatedAt);

        HealthScoreResponse response = new HealthScoreResponse(
                score.totalScore,
                score.statusLabel,
                new HealthScoreResponse.ScoreComponents(
                        new HealthScoreResponse.ScoreComponent(score.savingsRatioScore, 30, savingsRatioValue),
                        new HealthScoreResponse.ScoreComponent(score.expenseControlScore, 25, expenseControlValue),
                        new HealthScoreResponse.ScoreComponent(score.emiBurdenScore, 15, emiBurdenValue),
                        new HealthScoreResponse.ScoreComponent(score.investmentAllocationScore, 15, investmentAllocationValue),
                        new HealthScoreResponse.ScoreComponent(score.emergencyFundScore, 15, emergencyFundValue)
                ),
                metadata
        );

        return Response.ok(response).build();
    }

    /**
     * Extract a component value (ratio/coverage) from the componentDetails JSONB map.
     */
    @SuppressWarnings("unchecked")
    private Double extractComponentValue(java.util.Map<String, Object> componentDetails, String componentKey) {
        if (componentDetails == null || !componentDetails.containsKey(componentKey)) {
            return null;
        }
        Object val = componentDetails.get(componentKey);
        if (val instanceof Number) {
            return ((Number) val).doubleValue();
        }
        if (val instanceof java.util.Map) {
            java.util.Map<String, Object> componentMap = (java.util.Map<String, Object>) val;
            // Try common keys: "value", "ratio", "coverage"
            for (String key : List.of("value", "ratio", "coverage", "monthsCoverage",
                    "savingsRatio", "discretionaryRatio", "emiRatio", "investmentRatio")) {
                if (componentMap.containsKey(key)) {
                    Object innerVal = componentMap.get(key);
                    if (innerVal instanceof Number) {
                        return ((Number) innerVal).doubleValue();
                    }
                }
            }
        }
        return null;
    }

    /**
     * GET /api/sessions/{id}/recommendations
     * Returns AI-generated recommendations ordered by displayOrder.
     */
    @GET
    @Path("/{id}/recommendations")
    public Response getRecommendations(@PathParam("id") UUID sessionId) {
        Session session = Session.findById(sessionId);
        if (session == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(new ErrorResponse("Session not found"))
                    .build();
        }

        List<Recommendation> recommendations = Recommendation.findBySessionId(sessionId);
        return Response.ok(recommendations).build();
    }

    /**
     * GET /api/sessions/{id}/recurring
     * Returns detected recurring expenses.
     */
    @GET
    @Path("/{id}/recurring")
    public Response getRecurringExpenses(@PathParam("id") UUID sessionId) {
        Session session = Session.findById(sessionId);
        if (session == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(new ErrorResponse("Session not found"))
                    .build();
        }

        List<RecurringExpense> recurringExpenses = RecurringExpense.findBySessionId(sessionId);
        return Response.ok(recurringExpenses).build();
    }

    /**
     * GET /api/sessions/{id}/anomalies
     * Returns detected spending anomalies.
     */
    @GET
    @Path("/{id}/anomalies")
    public Response getSpendingAnomalies(@PathParam("id") UUID sessionId) {
        Session session = Session.findById(sessionId);
        if (session == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(new ErrorResponse("Session not found"))
                    .build();
        }

        List<SpendingAnomaly> anomalies = SpendingAnomaly.findBySessionId(sessionId);
        return Response.ok(anomalies).build();
    }

    /**
     * Simple error response record for consistent error messaging.
     */
    public record ErrorResponse(String message) {
    }
}
