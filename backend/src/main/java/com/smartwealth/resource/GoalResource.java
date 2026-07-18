package com.smartwealth.resource;

import com.smartwealth.dto.CreateGoalRequest;
import com.smartwealth.entity.FinancialSummary;
import com.smartwealth.entity.Goal;
import com.smartwealth.entity.Session;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;

/**
 * REST resource for Goal Planner functionality.
 * Handles goal CRUD operations, monthly savings calculation using FV annuity formula,
 * and feasibility assessment based on user's financial data.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8
 */
@Path("/api/sessions/{sessionId}/goals")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class GoalResource {

    private static final MathContext MATH_CONTEXT = new MathContext(20, RoundingMode.HALF_UP);
    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final BigDecimal TWELVE = new BigDecimal("12");
    private static final BigDecimal FIFTY_PERCENT = new BigDecimal("0.50");

    /**
     * Create a new financial goal.
     * Calculates required monthly savings using the future value of annuity formula
     * and determines feasibility status.
     */
    @POST
    @Transactional
    public Response createGoal(@PathParam("sessionId") UUID sessionId, @Valid CreateGoalRequest request) {
        // Validate session exists
        Session session = Session.findById(sessionId);
        if (session == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(new ErrorResponse("Session not found"))
                    .build();
        }

        // Custom validation: existing savings must not exceed target amount
        if (request.existingSavings.compareTo(request.targetAmount) > 0) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(new ErrorResponse("Existing savings must not exceed target amount"))
                    .build();
        }

        // Calculate required monthly savings
        BigDecimal requiredMonthlySavings = calculateRequiredMonthlySavings(
                request.targetAmount,
                request.existingSavings,
                request.expectedReturnPercent,
                request.durationMonths
        );

        // Determine feasibility status
        String feasibilityStatus = determineFeasibilityStatus(requiredMonthlySavings, sessionId);

        // Handle "Already Met" case: existing savings >= target
        if (request.existingSavings.compareTo(request.targetAmount) >= 0) {
            requiredMonthlySavings = BigDecimal.ZERO;
            feasibilityStatus = "Already Met";
        }

        // Create and persist goal
        Goal goal = new Goal();
        goal.session = session;
        goal.goalName = request.goalName;
        goal.goalType = request.goalType;
        goal.targetAmount = request.targetAmount;
        goal.durationMonths = request.durationMonths;
        goal.existingSavings = request.existingSavings;
        goal.expectedReturnPercent = request.expectedReturnPercent;
        goal.requiredMonthlySavings = requiredMonthlySavings.setScale(2, RoundingMode.HALF_UP);
        goal.feasibilityStatus = feasibilityStatus;
        goal.persist();

        // Build response with available monthly savings info
        GoalResponse response = buildGoalResponse(goal, sessionId);
        return Response.status(Response.Status.CREATED).entity(response).build();
    }

    /**
     * List all goals for a session.
     */
    @GET
    public Response listGoals(@PathParam("sessionId") UUID sessionId) {
        Session session = Session.findById(sessionId);
        if (session == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(new ErrorResponse("Session not found"))
                    .build();
        }

        List<Goal> goals = Goal.findBySessionId(sessionId);
        List<GoalResponse> responses = goals.stream()
                .map(goal -> buildGoalResponse(goal, sessionId))
                .toList();
        return Response.ok(responses).build();
    }

    /**
     * Get a single goal by ID.
     */
    @GET
    @Path("/{goalId}")
    public Response getGoal(@PathParam("sessionId") UUID sessionId, @PathParam("goalId") UUID goalId) {
        Session session = Session.findById(sessionId);
        if (session == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(new ErrorResponse("Session not found"))
                    .build();
        }

        Goal goal = Goal.findByIdAndSessionId(goalId, sessionId);
        if (goal == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(new ErrorResponse("Goal not found"))
                    .build();
        }

        GoalResponse response = buildGoalResponse(goal, sessionId);
        return Response.ok(response).build();
    }

    /**
     * Delete a goal.
     */
    @DELETE
    @Path("/{goalId}")
    @Transactional
    public Response deleteGoal(@PathParam("sessionId") UUID sessionId, @PathParam("goalId") UUID goalId) {
        Session session = Session.findById(sessionId);
        if (session == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(new ErrorResponse("Session not found"))
                    .build();
        }

        long deleted = Goal.deleteByIdAndSessionId(goalId, sessionId);
        if (deleted == 0) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(new ErrorResponse("Goal not found"))
                    .build();
        }

        return Response.noContent().build();
    }

    /**
     * Calculate required monthly savings using the Future Value of Annuity formula
     * with compound interest.
     *
     * Formula:
     * - monthlyRate = expectedReturnPercent / 12 / 100
     * - If rate == 0: requiredMonthly = (target - existing) / months
     * - Else: requiredMonthly = (target - existing * (1+r)^n) * r / ((1+r)^n - 1)
     *   where r = monthlyRate, n = durationMonths
     *
     * Requirements: 8.2, 8.5
     */
    BigDecimal calculateRequiredMonthlySavings(
            BigDecimal targetAmount,
            BigDecimal existingSavings,
            BigDecimal expectedReturnPercent,
            int durationMonths) {

        BigDecimal remaining = targetAmount.subtract(existingSavings);

        // If already met, return zero
        if (remaining.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }

        // Calculate monthly rate: expectedReturnPercent / 12 / 100
        BigDecimal monthlyRate = expectedReturnPercent
                .divide(TWELVE, MATH_CONTEXT)
                .divide(HUNDRED, MATH_CONTEXT);

        // If rate is effectively zero, use simple division
        if (monthlyRate.compareTo(BigDecimal.ZERO) == 0) {
            return remaining.divide(BigDecimal.valueOf(durationMonths), MATH_CONTEXT);
        }

        // FV Annuity formula:
        // requiredMonthly = (target - existing * (1+r)^n) * r / ((1+r)^n - 1)
        BigDecimal onePlusR = BigDecimal.ONE.add(monthlyRate);
        BigDecimal onePlusRPowN = pow(onePlusR, durationMonths);

        // Future value of existing savings
        BigDecimal existingFV = existingSavings.multiply(onePlusRPowN, MATH_CONTEXT);

        // Amount still needed after existing savings grow
        BigDecimal amountNeeded = targetAmount.subtract(existingFV);

        // If existing savings will grow to meet target, no additional savings needed
        if (amountNeeded.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }

        // Required monthly = amountNeeded * r / ((1+r)^n - 1)
        BigDecimal numerator = amountNeeded.multiply(monthlyRate, MATH_CONTEXT);
        BigDecimal denominator = onePlusRPowN.subtract(BigDecimal.ONE);

        return numerator.divide(denominator, MATH_CONTEXT);
    }

    /**
     * Determine feasibility status based on required monthly savings
     * compared to user's available monthly savings from FinancialSummary.
     *
     * - Achievable: required ≤ 50% of monthly savings
     * - Challenging: required > 50% and ≤ 100% of monthly savings
     * - Not Feasible: required > 100% of monthly savings
     * - Unable to assess: no FinancialSummary exists
     *
     * Requirements: 8.3, 8.8
     */
    String determineFeasibilityStatus(BigDecimal requiredMonthlySavings, UUID sessionId) {
        // If no savings are required, goal is already met
        if (requiredMonthlySavings.compareTo(BigDecimal.ZERO) <= 0) {
            return "Already Met";
        }

        // Look up financial summary for this session
        FinancialSummary summary = FinancialSummary.findBySessionId(sessionId);
        if (summary == null) {
            return "Unable to assess";
        }

        BigDecimal monthlySavings = summary.monthlySavings;

        // If monthly savings is zero or negative, any positive requirement is not feasible
        if (monthlySavings.compareTo(BigDecimal.ZERO) <= 0) {
            return "Not Feasible";
        }

        // Calculate thresholds
        BigDecimal fiftyPercent = monthlySavings.multiply(FIFTY_PERCENT, MATH_CONTEXT);

        if (requiredMonthlySavings.compareTo(fiftyPercent) <= 0) {
            return "Achievable";
        } else if (requiredMonthlySavings.compareTo(monthlySavings) <= 0) {
            return "Challenging";
        } else {
            return "Not Feasible";
        }
    }

    /**
     * Build a GoalResponse DTO from a Goal entity, including monthly savings available info.
     */
    private GoalResponse buildGoalResponse(Goal goal, UUID sessionId) {
        FinancialSummary summary = FinancialSummary.findBySessionId(sessionId);
        BigDecimal monthlySavingsAvailable = summary != null ? summary.monthlySavings : null;

        return new GoalResponse(
                goal.id,
                goal.goalName,
                goal.goalType,
                goal.targetAmount,
                goal.durationMonths,
                goal.existingSavings,
                goal.expectedReturnPercent,
                goal.requiredMonthlySavings,
                goal.feasibilityStatus,
                monthlySavingsAvailable
        );
    }

    /**
     * BigDecimal power function for (1+r)^n calculation.
     */
    private BigDecimal pow(BigDecimal base, int exponent) {
        BigDecimal result = BigDecimal.ONE;
        for (int i = 0; i < exponent; i++) {
            result = result.multiply(base, MATH_CONTEXT);
        }
        return result;
    }

    /**
     * Response DTO for goal endpoints.
     */
    public record GoalResponse(
            UUID id,
            String goalName,
            String goalType,
            BigDecimal targetAmount,
            int durationMonths,
            BigDecimal existingSavings,
            BigDecimal expectedReturnPercent,
            BigDecimal requiredMonthlySavings,
            String feasibilityStatus,
            BigDecimal monthlySavingsAvailable
    ) {}

    /**
     * Error response for consistent error messaging.
     */
    public record ErrorResponse(String message) {}
}
