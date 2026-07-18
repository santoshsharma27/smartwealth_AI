package com.smartwealth.resource;

import com.smartwealth.entity.FinancialSummary;
import com.smartwealth.entity.Session;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasSize;

/**
 * Integration tests for GoalResource REST endpoints.
 * Tests CRUD operations, FV annuity calculations, feasibility logic,
 * input validation, and edge cases.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8
 */
@QuarkusTest
class GoalResourceTest {

    @Inject
    EntityManager entityManager;

    /**
     * Helper to create a session and return its ID.
     */
    private String createSession() {
        return given()
                .when().post("/api/sessions")
                .then()
                .statusCode(201)
                .extract().path("id");
    }

    /**
     * Helper to create a session with a FinancialSummary (monthly savings = ₹42,000).
     */
    @Transactional
    String createSessionWithFinancialSummary() {
        Session session = new Session();
        session.isDemoActive = false;
        session.persist();

        FinancialSummary summary = new FinancialSummary();
        summary.session = session;
        summary.monthlyIncome = new BigDecimal("120000.00");
        summary.totalExpenses = new BigDecimal("78000.00");
        summary.monthlySavings = new BigDecimal("42000.00");
        summary.savingsPercentage = new BigDecimal("35.00");
        summary.expensesByCategory = Map.of(
                "Rent", 25000.0,
                "Food", 18500.0,
                "Travel", 5000.0,
                "Shopping", 8000.0,
                "Bills", 6000.0,
                "EMI", 10000.0,
                "Healthcare", 2000.0,
                "Entertainment", 3500.0
        );
        summary.persist();

        return session.id.toString();
    }

    // ==================== POST /api/sessions/{id}/goals ====================

    @Test
    void testCreateGoal_withFinancialData_feasibilityAchievable() {
        String sessionId = createSessionWithFinancialSummary();

        // Goal requiring small monthly savings relative to ₹42,000 monthly savings
        // Target: ₹100,000, duration: 24 months, existing: ₹50,000, return: 0%
        // Required = (100000 - 50000) / 24 = ₹2,083 → Achievable (2083 < 21000 which is 50% of 42000)
        String body = """
                {
                    "goalName": "Small Vacation",
                    "goalType": "vacation",
                    "targetAmount": 100000,
                    "durationMonths": 24,
                    "existingSavings": 50000,
                    "expectedReturnPercent": 0
                }
                """;

        given()
                .header("X-Session-Id", sessionId)
                .contentType("application/json")
                .body(body)
                .when().post("/api/sessions/" + sessionId + "/goals")
                .then()
                .statusCode(201)
                .body("id", notNullValue())
                .body("goalName", is("Small Vacation"))
                .body("durationMonths", is(24))
                .body("feasibilityStatus", is("Achievable"))
                .body("monthlySavingsAvailable", notNullValue());
    }

    @Test
    void testCreateGoal_withFinancialData_feasibilityChallenging() {
        String sessionId = createSessionWithFinancialSummary();

        // "Buy a Car" - requires ~₹26,923/month → Challenging (>50% of 42000=21000, ≤42000)
        String body = """
                {
                    "goalName": "Buy a Car",
                    "goalType": "buy_car",
                    "targetAmount": 800000,
                    "durationMonths": 24,
                    "existingSavings": 100000,
                    "expectedReturnPercent": 8.0
                }
                """;

        given()
                .header("X-Session-Id", sessionId)
                .contentType("application/json")
                .body(body)
                .when().post("/api/sessions/" + sessionId + "/goals")
                .then()
                .statusCode(201)
                .body("id", notNullValue())
                .body("goalName", is("Buy a Car"))
                .body("feasibilityStatus", is("Challenging"))
                .body("monthlySavingsAvailable", is(42000.0F));
    }

    @Test
    void testCreateGoal_withFinancialData_feasibilityNotFeasible() {
        String sessionId = createSessionWithFinancialSummary();

        // Large goal requiring > ₹42,000/month
        // Target: ₹5,000,000, duration: 12 months, existing: 0, return: 0%
        // Required = 5000000 / 12 = ₹416,666 → Not Feasible (> 42000)
        String body = """
                {
                    "goalName": "Buy a House",
                    "goalType": "buy_house",
                    "targetAmount": 5000000,
                    "durationMonths": 12,
                    "existingSavings": 0,
                    "expectedReturnPercent": 0
                }
                """;

        given()
                .header("X-Session-Id", sessionId)
                .contentType("application/json")
                .body(body)
                .when().post("/api/sessions/" + sessionId + "/goals")
                .then()
                .statusCode(201)
                .body("feasibilityStatus", is("Not Feasible"))
                .body("monthlySavingsAvailable", is(42000.0F));
    }

    @Test
    void testCreateGoal_noFinancialData_unableToAssess() {
        String sessionId = createSession();
        // No FinancialSummary exists → "Unable to assess"

        String body = """
                {
                    "goalName": "Emergency Fund",
                    "goalType": "emergency_fund",
                    "targetAmount": 300000,
                    "durationMonths": 12,
                    "existingSavings": 0,
                    "expectedReturnPercent": 5.0
                }
                """;

        given()
                .header("X-Session-Id", sessionId)
                .contentType("application/json")
                .body(body)
                .when().post("/api/sessions/" + sessionId + "/goals")
                .then()
                .statusCode(201)
                .body("feasibilityStatus", is("Unable to assess"))
                .body("monthlySavingsAvailable", nullValue());
    }

    @Test
    void testCreateGoal_alreadyMet() {
        String sessionId = createSessionWithFinancialSummary();

        // Existing savings >= target → Already Met
        String body = """
                {
                    "goalName": "Small Goal",
                    "goalType": "custom",
                    "targetAmount": 50000,
                    "durationMonths": 12,
                    "existingSavings": 50000,
                    "expectedReturnPercent": 10.0
                }
                """;

        given()
                .header("X-Session-Id", sessionId)
                .contentType("application/json")
                .body(body)
                .when().post("/api/sessions/" + sessionId + "/goals")
                .then()
                .statusCode(201)
                .body("feasibilityStatus", is("Already Met"))
                .body("requiredMonthlySavings", is(0.0F));
    }

    @Test
    void testCreateGoal_zeroReturnRate() {
        String sessionId = createSession();

        // 0% return → simple division: (200000 - 50000) / 10 = ₹15,000/month
        String body = """
                {
                    "goalName": "Save for Education",
                    "goalType": "education",
                    "targetAmount": 200000,
                    "durationMonths": 10,
                    "existingSavings": 50000,
                    "expectedReturnPercent": 0
                }
                """;

        given()
                .header("X-Session-Id", sessionId)
                .contentType("application/json")
                .body(body)
                .when().post("/api/sessions/" + sessionId + "/goals")
                .then()
                .statusCode(201)
                .body("requiredMonthlySavings", is(15000.0F));
    }

    // ==================== Validation Tests (Requirement 8.6) ====================

    @Test
    void testCreateGoal_validation_emptyGoalName() {
        String sessionId = createSession();

        String body = """
                {
                    "goalName": "",
                    "goalType": "custom",
                    "targetAmount": 100000,
                    "durationMonths": 12,
                    "existingSavings": 0,
                    "expectedReturnPercent": 5.0
                }
                """;

        given()
                .header("X-Session-Id", sessionId)
                .contentType("application/json")
                .body(body)
                .when().post("/api/sessions/" + sessionId + "/goals")
                .then()
                .statusCode(400);
    }

    @Test
    void testCreateGoal_validation_targetAmountTooLow() {
        String sessionId = createSession();

        String body = """
                {
                    "goalName": "Test Goal",
                    "goalType": "custom",
                    "targetAmount": 0,
                    "durationMonths": 12,
                    "existingSavings": 0,
                    "expectedReturnPercent": 5.0
                }
                """;

        given()
                .header("X-Session-Id", sessionId)
                .contentType("application/json")
                .body(body)
                .when().post("/api/sessions/" + sessionId + "/goals")
                .then()
                .statusCode(400);
    }

    @Test
    void testCreateGoal_validation_targetAmountTooHigh() {
        String sessionId = createSession();

        String body = """
                {
                    "goalName": "Test Goal",
                    "goalType": "custom",
                    "targetAmount": 1000000000,
                    "durationMonths": 12,
                    "existingSavings": 0,
                    "expectedReturnPercent": 5.0
                }
                """;

        given()
                .header("X-Session-Id", sessionId)
                .contentType("application/json")
                .body(body)
                .when().post("/api/sessions/" + sessionId + "/goals")
                .then()
                .statusCode(400);
    }

    @Test
    void testCreateGoal_validation_durationTooLow() {
        String sessionId = createSession();

        String body = """
                {
                    "goalName": "Test Goal",
                    "goalType": "custom",
                    "targetAmount": 100000,
                    "durationMonths": 0,
                    "existingSavings": 0,
                    "expectedReturnPercent": 5.0
                }
                """;

        given()
                .header("X-Session-Id", sessionId)
                .contentType("application/json")
                .body(body)
                .when().post("/api/sessions/" + sessionId + "/goals")
                .then()
                .statusCode(400);
    }

    @Test
    void testCreateGoal_validation_durationTooHigh() {
        String sessionId = createSession();

        String body = """
                {
                    "goalName": "Test Goal",
                    "goalType": "custom",
                    "targetAmount": 100000,
                    "durationMonths": 361,
                    "existingSavings": 0,
                    "expectedReturnPercent": 5.0
                }
                """;

        given()
                .header("X-Session-Id", sessionId)
                .contentType("application/json")
                .body(body)
                .when().post("/api/sessions/" + sessionId + "/goals")
                .then()
                .statusCode(400);
    }

    @Test
    void testCreateGoal_validation_returnPercentTooHigh() {
        String sessionId = createSession();

        String body = """
                {
                    "goalName": "Test Goal",
                    "goalType": "custom",
                    "targetAmount": 100000,
                    "durationMonths": 12,
                    "existingSavings": 0,
                    "expectedReturnPercent": 31.0
                }
                """;

        given()
                .header("X-Session-Id", sessionId)
                .contentType("application/json")
                .body(body)
                .when().post("/api/sessions/" + sessionId + "/goals")
                .then()
                .statusCode(400);
    }

    @Test
    void testCreateGoal_validation_existingSavingsExceedsTarget() {
        String sessionId = createSession();

        String body = """
                {
                    "goalName": "Test Goal",
                    "goalType": "custom",
                    "targetAmount": 100000,
                    "durationMonths": 12,
                    "existingSavings": 150000,
                    "expectedReturnPercent": 5.0
                }
                """;

        given()
                .header("X-Session-Id", sessionId)
                .contentType("application/json")
                .body(body)
                .when().post("/api/sessions/" + sessionId + "/goals")
                .then()
                .statusCode(400)
                .body("message", is("Existing savings must not exceed target amount"));
    }

    @Test
    void testCreateGoal_sessionNotFound() {
        UUID randomId = UUID.randomUUID();

        String body = """
                {
                    "goalName": "Test Goal",
                    "goalType": "custom",
                    "targetAmount": 100000,
                    "durationMonths": 12,
                    "existingSavings": 0,
                    "expectedReturnPercent": 5.0
                }
                """;

        given()
                .header("X-Session-Id", randomId.toString())
                .contentType("application/json")
                .body(body)
                .when().post("/api/sessions/" + randomId + "/goals")
                .then()
                .statusCode(404)
                .body("message", is("Session not found"));
    }

    // ==================== GET /api/sessions/{id}/goals ====================

    @Test
    void testListGoals_empty() {
        String sessionId = createSession();

        given()
                .header("X-Session-Id", sessionId)
                .when().get("/api/sessions/" + sessionId + "/goals")
                .then()
                .statusCode(200)
                .body("$", hasSize(0));
    }

    @Test
    void testListGoals_afterCreatingMultiple() {
        String sessionId = createSession();

        // Create two goals
        String body1 = """
                {
                    "goalName": "Goal One",
                    "goalType": "custom",
                    "targetAmount": 100000,
                    "durationMonths": 12,
                    "existingSavings": 0,
                    "expectedReturnPercent": 0
                }
                """;
        String body2 = """
                {
                    "goalName": "Goal Two",
                    "goalType": "custom",
                    "targetAmount": 200000,
                    "durationMonths": 24,
                    "existingSavings": 0,
                    "expectedReturnPercent": 5
                }
                """;

        given()
                .header("X-Session-Id", sessionId)
                .contentType("application/json")
                .body(body1)
                .when().post("/api/sessions/" + sessionId + "/goals")
                .then()
                .statusCode(201);

        given()
                .header("X-Session-Id", sessionId)
                .contentType("application/json")
                .body(body2)
                .when().post("/api/sessions/" + sessionId + "/goals")
                .then()
                .statusCode(201);

        given()
                .header("X-Session-Id", sessionId)
                .when().get("/api/sessions/" + sessionId + "/goals")
                .then()
                .statusCode(200)
                .body("$", hasSize(2));
    }

    @Test
    void testListGoals_sessionNotFound() {
        UUID randomId = UUID.randomUUID();

        given()
                .header("X-Session-Id", randomId.toString())
                .when().get("/api/sessions/" + randomId + "/goals")
                .then()
                .statusCode(404)
                .body("message", is("Session not found"));
    }

    // ==================== GET /api/sessions/{id}/goals/{goalId} ====================

    @Test
    void testGetGoal_success() {
        String sessionId = createSession();

        String body = """
                {
                    "goalName": "Retirement Fund",
                    "goalType": "retirement",
                    "targetAmount": 500000,
                    "durationMonths": 60,
                    "existingSavings": 100000,
                    "expectedReturnPercent": 10.0
                }
                """;

        String goalId = given()
                .header("X-Session-Id", sessionId)
                .contentType("application/json")
                .body(body)
                .when().post("/api/sessions/" + sessionId + "/goals")
                .then()
                .statusCode(201)
                .extract().path("id");

        given()
                .header("X-Session-Id", sessionId)
                .when().get("/api/sessions/" + sessionId + "/goals/" + goalId)
                .then()
                .statusCode(200)
                .body("id", is(goalId))
                .body("goalName", is("Retirement Fund"))
                .body("targetAmount", is(500000.0F))
                .body("durationMonths", is(60))
                .body("existingSavings", is(100000.0F))
                .body("expectedReturnPercent", is(10.0F));
    }

    @Test
    void testGetGoal_notFound() {
        String sessionId = createSession();
        UUID randomGoalId = UUID.randomUUID();

        given()
                .header("X-Session-Id", sessionId)
                .when().get("/api/sessions/" + sessionId + "/goals/" + randomGoalId)
                .then()
                .statusCode(404)
                .body("message", is("Goal not found"));
    }

    @Test
    void testGetGoal_wrongSession() {
        String sessionId1 = createSession();
        String sessionId2 = createSession();

        String body = """
                {
                    "goalName": "My Goal",
                    "goalType": "custom",
                    "targetAmount": 100000,
                    "durationMonths": 12,
                    "existingSavings": 0,
                    "expectedReturnPercent": 0
                }
                """;

        // Create goal in session 1
        String goalId = given()
                .header("X-Session-Id", sessionId1)
                .contentType("application/json")
                .body(body)
                .when().post("/api/sessions/" + sessionId1 + "/goals")
                .then()
                .statusCode(201)
                .extract().path("id");

        // Try to access from session 2
        given()
                .header("X-Session-Id", sessionId2)
                .when().get("/api/sessions/" + sessionId2 + "/goals/" + goalId)
                .then()
                .statusCode(404)
                .body("message", is("Goal not found"));
    }

    // ==================== DELETE /api/sessions/{id}/goals/{goalId} ====================

    @Test
    void testDeleteGoal_success() {
        String sessionId = createSession();

        String body = """
                {
                    "goalName": "Temp Goal",
                    "goalType": "custom",
                    "targetAmount": 50000,
                    "durationMonths": 6,
                    "existingSavings": 0,
                    "expectedReturnPercent": 0
                }
                """;

        String goalId = given()
                .header("X-Session-Id", sessionId)
                .contentType("application/json")
                .body(body)
                .when().post("/api/sessions/" + sessionId + "/goals")
                .then()
                .statusCode(201)
                .extract().path("id");

        // Delete the goal
        given()
                .header("X-Session-Id", sessionId)
                .when().delete("/api/sessions/" + sessionId + "/goals/" + goalId)
                .then()
                .statusCode(204);

        // Verify it's gone
        given()
                .header("X-Session-Id", sessionId)
                .when().get("/api/sessions/" + sessionId + "/goals/" + goalId)
                .then()
                .statusCode(404);
    }

    @Test
    void testDeleteGoal_notFound() {
        String sessionId = createSession();
        UUID randomGoalId = UUID.randomUUID();

        given()
                .header("X-Session-Id", sessionId)
                .when().delete("/api/sessions/" + sessionId + "/goals/" + randomGoalId)
                .then()
                .statusCode(404)
                .body("message", is("Goal not found"));
    }

    @Test
    void testDeleteGoal_sessionNotFound() {
        UUID randomSessionId = UUID.randomUUID();
        UUID randomGoalId = UUID.randomUUID();

        given()
                .header("X-Session-Id", randomSessionId.toString())
                .when().delete("/api/sessions/" + randomSessionId + "/goals/" + randomGoalId)
                .then()
                .statusCode(404)
                .body("message", is("Session not found"));
    }

    // ==================== Calculation Verification Tests ====================

    @Test
    void testCreateGoal_compoundInterestCalculation() {
        String sessionId = createSession();

        // Verify compound interest formula is used correctly
        // Target: ₹1,000,000, Duration: 12 months, Existing: 0, Return: 12%
        // Monthly rate = 12 / 12 / 100 = 0.01
        // (1+0.01)^12 = 1.12682503...
        // Required = 1000000 * 0.01 / (1.12682503 - 1) = 10000 / 0.12682503 ≈ ₹78,848.79
        String body = """
                {
                    "goalName": "Investment Target",
                    "goalType": "custom",
                    "targetAmount": 1000000,
                    "durationMonths": 12,
                    "existingSavings": 0,
                    "expectedReturnPercent": 12.0
                }
                """;

        given()
                .header("X-Session-Id", sessionId)
                .contentType("application/json")
                .body(body)
                .when().post("/api/sessions/" + sessionId + "/goals")
                .then()
                .statusCode(201)
                .body("requiredMonthlySavings", greaterThan(78000.0F));
    }

    @Test
    void testCreateGoal_existingSavingsGrowWithCompoundInterest() {
        String sessionId = createSession();

        // Existing savings should grow with compound interest, reducing required monthly savings
        // Target: ₹200,000, Duration: 12 months, Existing: ₹100,000, Return: 12%
        // Monthly rate = 0.01
        // Existing will grow to: 100000 * (1.01)^12 = ₹112,682.50
        // Remaining needed: 200000 - 112682.50 = ₹87,317.50
        // Required monthly = 87317.50 * 0.01 / ((1.01)^12 - 1) = 873.175 / 0.12682503 ≈ ₹6,884
        String body = """
                {
                    "goalName": "Growth Test",
                    "goalType": "custom",
                    "targetAmount": 200000,
                    "durationMonths": 12,
                    "existingSavings": 100000,
                    "expectedReturnPercent": 12.0
                }
                """;

        given()
                .header("X-Session-Id", sessionId)
                .contentType("application/json")
                .body(body)
                .when().post("/api/sessions/" + sessionId + "/goals")
                .then()
                .statusCode(201)
                .body("requiredMonthlySavings", greaterThan(6000.0F));
    }

    @Test
    void testCreateGoal_existingSavingsGrowToMeetTarget() {
        String sessionId = createSession();

        // If existing savings grow enough with compound interest to meet target,
        // required monthly savings should be ₹0
        // Target: ₹110,000, Duration: 120 months (10 years), Existing: ₹100,000, Return: 12%
        // Monthly rate = 0.01
        // Existing will grow to: 100000 * (1.01)^120 = ₹330,038.68
        // Since 330,038.68 > 110,000 → no additional savings needed → ₹0
        String body = """
                {
                    "goalName": "Growth Covers Target",
                    "goalType": "custom",
                    "targetAmount": 110000,
                    "durationMonths": 120,
                    "existingSavings": 100000,
                    "expectedReturnPercent": 12.0
                }
                """;

        given()
                .header("X-Session-Id", sessionId)
                .contentType("application/json")
                .body(body)
                .when().post("/api/sessions/" + sessionId + "/goals")
                .then()
                .statusCode(201)
                .body("requiredMonthlySavings", is(0.0F));
    }
}
