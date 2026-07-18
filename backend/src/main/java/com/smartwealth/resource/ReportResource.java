package com.smartwealth.resource;

import com.smartwealth.client.AiServiceClientWrapper;
import com.smartwealth.client.dto.ReportRequest;
import com.smartwealth.entity.*;

import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import org.eclipse.microprofile.faulttolerance.exceptions.TimeoutException;
import org.jboss.logging.Logger;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * REST resource for financial report generation.
 * Handles triggering AI service report generation and returning PDF output.
 * Tracks per-session generation status (idle, generating, succeeded, failed).
 */
@Path("/api/sessions/{id}/report")
@Produces(MediaType.APPLICATION_JSON)
public class ReportResource {

    private static final Logger LOG = Logger.getLogger(ReportResource.class);

    /**
     * In-memory tracking of report generation status per session.
     * In production this would use a distributed cache or database table.
     */
    private static final ConcurrentHashMap<UUID, ReportStatus> reportStatusMap = new ConcurrentHashMap<>();

    @Inject
    AiServiceClientWrapper aiServiceClientWrapper;

    /**
     * Trigger AI service report generation and return the generated PDF.
     * Gathers session financial data (summary, score, recommendations, goals)
     * and sends to AI service for report generation.
     * The AI service call has a 15-second timeout enforced by @Timeout on the wrapper.
     * On failure, the user can retry by calling POST again.
     *
     * @param sessionId the session UUID
     * @return PDF bytes with Content-Type application/pdf, or error response
     */
    @POST
    public Response generateReport(@PathParam("id") UUID sessionId) {
        // Validate session exists
        Session session = Session.findById(sessionId);
        if (session == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(new ErrorResponse("Session not found"))
                    .build();
        }

        // Mark status as generating
        reportStatusMap.put(sessionId, new ReportStatus("generating", null));

        // Gather financial data for the report
        FinancialSummary summary = FinancialSummary.findBySessionId(sessionId);
        HealthScore healthScore = HealthScore.findBySessionId(sessionId);
        List<Recommendation> recommendations = Recommendation.findBySessionId(sessionId);
        List<Goal> goals = Goal.findBySessionId(sessionId);
        List<RecurringExpense> recurringExpenses = RecurringExpense.findBySessionId(sessionId);
        List<SpendingAnomaly> anomalies = SpendingAnomaly.findBySessionId(sessionId);

        // Build the report request DTO
        ReportRequest reportRequest = buildReportRequest(summary, healthScore, recommendations, goals,
                recurringExpenses, anomalies);

        // Call AI service (15-second timeout enforced by AiServiceClientWrapper)
        try {
            byte[] pdfBytes = aiServiceClientWrapper.generateReport(reportRequest);

            if (pdfBytes == null || pdfBytes.length == 0) {
                reportStatusMap.put(sessionId, new ReportStatus("failed",
                        "Report generation returned empty result."));
                return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                        .entity(new ErrorResponse("Report generation returned empty result. Please retry."))
                        .build();
            }

            // Mark as succeeded
            reportStatusMap.put(sessionId, new ReportStatus("succeeded", null));

            return Response.ok(pdfBytes, "application/pdf")
                    .header("Content-Disposition", "attachment; filename=\"smartwealth-report.pdf\"")
                    .header("Content-Length", pdfBytes.length)
                    .build();

        } catch (TimeoutException e) {
            LOG.errorf("Report generation timed out for session %s", sessionId);
            reportStatusMap.put(sessionId, new ReportStatus("failed",
                    "Report generation timed out (15 second limit exceeded)."));
            return Response.status(Response.Status.GATEWAY_TIMEOUT)
                    .entity(new ErrorResponse("Report generation timed out (15 second limit exceeded). Please try again."))
                    .build();
        } catch (Exception e) {
            LOG.errorf(e, "Report generation failed for session %s", sessionId);
            reportStatusMap.put(sessionId, new ReportStatus("failed",
                    "Report generation failed: " + e.getMessage()));
            return Response.status(Response.Status.SERVICE_UNAVAILABLE)
                    .entity(new ErrorResponse("Report generation failed: " + e.getMessage() + ". Please retry."))
                    .build();
        }
    }

    /**
     * Check report generation status for a session.
     * Returns whether a report is being generated, has succeeded, or has failed.
     * If no generation has been attempted, returns "idle" status.
     *
     * @param sessionId the session UUID
     * @return JSON with status, hasFinancialData, and message fields
     */
    @GET
    @Path("/status")
    public Response getReportStatus(@PathParam("id") UUID sessionId) {
        // Validate session exists
        Session session = Session.findById(sessionId);
        if (session == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(new ErrorResponse("Session not found"))
                    .build();
        }

        // Check if session has financial data available for report
        FinancialSummary summary = FinancialSummary.findBySessionId(sessionId);
        boolean hasData = summary != null;

        // Get tracked status
        ReportStatus reportStatus = reportStatusMap.get(sessionId);

        Map<String, Object> statusResponse = new LinkedHashMap<>();
        statusResponse.put("sessionId", sessionId.toString());
        statusResponse.put("hasFinancialData", hasData);

        if (reportStatus == null) {
            statusResponse.put("status", "idle");
            statusResponse.put("message", hasData
                    ? "Report generation is available. Use POST to generate."
                    : "No financial data available. Upload documents or load demo data first.");
        } else {
            statusResponse.put("status", reportStatus.status());
            switch (reportStatus.status()) {
                case "generating":
                    statusResponse.put("message", "Report is currently being generated.");
                    break;
                case "succeeded":
                    statusResponse.put("message", "Report was generated successfully. Use POST to download again.");
                    break;
                case "failed":
                    statusResponse.put("message", reportStatus.errorMessage() != null
                            ? reportStatus.errorMessage() + " You can retry by calling POST again."
                            : "Report generation failed. You can retry by calling POST again.");
                    statusResponse.put("canRetry", true);
                    break;
                default:
                    statusResponse.put("message", "Unknown status.");
            }
        }

        return Response.ok(statusResponse).build();
    }

    /**
     * Builds the ReportRequest DTO from session entities.
     */
    private ReportRequest buildReportRequest(FinancialSummary summary, HealthScore healthScore,
                                              List<Recommendation> recommendations, List<Goal> goals,
                                              List<RecurringExpense> recurringExpenses,
                                              List<SpendingAnomaly> anomalies) {
        ReportRequest request = new ReportRequest();

        // Financial summary fields
        if (summary != null) {
            request.monthlyIncome = summary.monthlyIncome.doubleValue();
            request.totalExpenses = summary.totalExpenses.doubleValue();
            request.monthlySavings = summary.monthlySavings.doubleValue();
            request.expensesByCategory = summary.expensesByCategory;
        }

        // Health score
        if (healthScore != null) {
            ReportRequest.HealthScoreData scoreData = new ReportRequest.HealthScoreData();
            scoreData.totalScore = healthScore.totalScore;
            scoreData.statusLabel = healthScore.statusLabel;
            Map<String, ReportRequest.ScoreComponent> components = new HashMap<>();
            ReportRequest.ScoreComponent sr = new ReportRequest.ScoreComponent();
            sr.score = healthScore.savingsRatioScore; sr.maxScore = 30;
            components.put("savingsRatio", sr);
            ReportRequest.ScoreComponent ec = new ReportRequest.ScoreComponent();
            ec.score = healthScore.expenseControlScore; ec.maxScore = 25;
            components.put("expenseControl", ec);
            ReportRequest.ScoreComponent eb = new ReportRequest.ScoreComponent();
            eb.score = healthScore.emiBurdenScore; eb.maxScore = 15;
            components.put("emiBurden", eb);
            ReportRequest.ScoreComponent ia = new ReportRequest.ScoreComponent();
            ia.score = healthScore.investmentAllocationScore; ia.maxScore = 15;
            components.put("investmentAllocation", ia);
            ReportRequest.ScoreComponent ef = new ReportRequest.ScoreComponent();
            ef.score = healthScore.emergencyFundScore; ef.maxScore = 15;
            components.put("emergencyFundReadiness", ef);
            scoreData.components = components;
            request.healthScore = scoreData;
        }

        // Recommendations as simple text strings
        if (recommendations != null && !recommendations.isEmpty()) {
            request.recommendations = recommendations.stream()
                    .map(rec -> rec.text)
                    .collect(Collectors.toList());
        }

        // Goals
        if (goals != null && !goals.isEmpty()) {
            request.goals = goals.stream()
                    .map(goal -> {
                        ReportRequest.GoalSummary gs = new ReportRequest.GoalSummary();
                        gs.goalName = goal.goalName;
                        gs.targetAmount = goal.targetAmount.doubleValue();
                        gs.durationMonths = goal.durationMonths;
                        gs.requiredMonthlySavings = goal.requiredMonthlySavings.doubleValue();
                        gs.feasibilityStatus = goal.feasibilityStatus;
                        return gs;
                    })
                    .collect(Collectors.toList());
        }

        // Action items (top 5 from recommendations)
        if (recommendations != null && !recommendations.isEmpty()) {
            request.actionItems = recommendations.stream()
                    .limit(5)
                    .map(rec -> new ReportRequest.ActionItem(rec.displayOrder, rec.text))
                    .collect(Collectors.toList());
        }

        return request;
    }

    /**
     * Immutable record tracking the status of report generation for a session.
     */
    private record ReportStatus(String status, String errorMessage) {}

    /**
     * Simple error response record for consistent error messaging.
     */
    public record ErrorResponse(String message) {}
}
