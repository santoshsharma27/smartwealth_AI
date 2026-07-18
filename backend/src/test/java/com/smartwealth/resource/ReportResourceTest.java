package com.smartwealth.resource;

import com.smartwealth.client.AiServiceClientWrapper;
import com.smartwealth.client.dto.ReportRequest;
import com.smartwealth.entity.*;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import org.eclipse.microprofile.faulttolerance.exceptions.TimeoutException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Integration tests for ReportResource.
 * Tests report generation (POST) and status (GET) endpoints.
 */
@QuarkusTest
public class ReportResourceTest {

    @InjectMock
    AiServiceClientWrapper aiServiceClientWrapper;

    @Inject
    EntityManager entityManager;

    private UUID sessionId;

    @BeforeEach
    @Transactional
    public void setUp() {
        Session session = new Session();
        session.persist();
        sessionId = session.id;
    }

    @Test
    public void testGenerateReport_Success_ReturnsPdf() {
        createFinancialSummary();
        createHealthScore();

        byte[] mockPdf = "%PDF-1.4 mock content".getBytes();
        when(aiServiceClientWrapper.generateReport(any(ReportRequest.class))).thenReturn(mockPdf);

        given()
                .header("X-Session-Id", sessionId.toString())
                .when()
                .post("/api/sessions/" + sessionId + "/report")
                .then()
                .statusCode(200)
                .contentType("application/pdf")
                .header("Content-Disposition", containsString("smartwealth-report.pdf"))
                .header("Content-Length", String.valueOf(mockPdf.length));
    }

    @Test
    public void testGenerateReport_SessionNotFound() {
        UUID nonExistentSession = UUID.randomUUID();

        given()
                .header("X-Session-Id", nonExistentSession.toString())
                .when()
                .post("/api/sessions/" + nonExistentSession + "/report")
                .then()
                .statusCode(404)
                .body("message", containsString("Session not found"));
    }

    @Test
    public void testGenerateReport_Timeout_Returns504() {
        createFinancialSummary();

        when(aiServiceClientWrapper.generateReport(any(ReportRequest.class)))
                .thenThrow(new TimeoutException("Timed out"));

        given()
                .header("X-Session-Id", sessionId.toString())
                .when()
                .post("/api/sessions/" + sessionId + "/report")
                .then()
                .statusCode(504)
                .body("message", containsString("timed out"));
    }

    @Test
    public void testGenerateReport_ServiceUnavailable_Returns503() {
        createFinancialSummary();

        when(aiServiceClientWrapper.generateReport(any(ReportRequest.class)))
                .thenThrow(new RuntimeException("Service unavailable"));

        given()
                .header("X-Session-Id", sessionId.toString())
                .when()
                .post("/api/sessions/" + sessionId + "/report")
                .then()
                .statusCode(503)
                .body("message", containsString("failed"))
                .body("message", containsString("retry"));
    }

    @Test
    public void testGenerateReport_EmptyResult_Returns500() {
        createFinancialSummary();

        when(aiServiceClientWrapper.generateReport(any(ReportRequest.class))).thenReturn(new byte[0]);

        given()
                .header("X-Session-Id", sessionId.toString())
                .when()
                .post("/api/sessions/" + sessionId + "/report")
                .then()
                .statusCode(500)
                .body("message", containsString("empty"));
    }

    @Test
    public void testGenerateReport_NullResult_Returns500() {
        createFinancialSummary();

        when(aiServiceClientWrapper.generateReport(any(ReportRequest.class))).thenReturn(null);

        given()
                .header("X-Session-Id", sessionId.toString())
                .when()
                .post("/api/sessions/" + sessionId + "/report")
                .then()
                .statusCode(500)
                .body("message", containsString("empty"));
    }

    @Test
    public void testGenerateReport_NoFinancialData_StillCallsAi() {
        // Even without financial data, the endpoint should still attempt generation
        byte[] mockPdf = "%PDF-1.4 empty report".getBytes();
        when(aiServiceClientWrapper.generateReport(any(ReportRequest.class))).thenReturn(mockPdf);

        given()
                .header("X-Session-Id", sessionId.toString())
                .when()
                .post("/api/sessions/" + sessionId + "/report")
                .then()
                .statusCode(200)
                .contentType("application/pdf");
    }

    @Test
    public void testGetReportStatus_Idle_NoData() {
        given()
                .header("X-Session-Id", sessionId.toString())
                .when()
                .get("/api/sessions/" + sessionId + "/report/status")
                .then()
                .statusCode(200)
                .body("status", equalTo("idle"))
                .body("hasFinancialData", equalTo(false))
                .body("message", containsString("No financial data"));
    }

    @Test
    public void testGetReportStatus_Idle_WithData() {
        createFinancialSummary();

        given()
                .header("X-Session-Id", sessionId.toString())
                .when()
                .get("/api/sessions/" + sessionId + "/report/status")
                .then()
                .statusCode(200)
                .body("status", equalTo("idle"))
                .body("hasFinancialData", equalTo(true))
                .body("message", containsString("available"));
    }

    @Test
    public void testGetReportStatus_SessionNotFound() {
        UUID nonExistentSession = UUID.randomUUID();

        given()
                .header("X-Session-Id", nonExistentSession.toString())
                .when()
                .get("/api/sessions/" + nonExistentSession + "/report/status")
                .then()
                .statusCode(404)
                .body("message", containsString("Session not found"));
    }

    @Test
    public void testGetReportStatus_AfterSuccessfulGeneration() {
        createFinancialSummary();

        byte[] mockPdf = "%PDF-1.4 mock".getBytes();
        when(aiServiceClientWrapper.generateReport(any(ReportRequest.class))).thenReturn(mockPdf);

        // Generate report first
        given()
                .header("X-Session-Id", sessionId.toString())
                .when()
                .post("/api/sessions/" + sessionId + "/report")
                .then()
                .statusCode(200);

        // Check status
        given()
                .header("X-Session-Id", sessionId.toString())
                .when()
                .get("/api/sessions/" + sessionId + "/report/status")
                .then()
                .statusCode(200)
                .body("status", equalTo("succeeded"))
                .body("message", containsString("successfully"));
    }

    @Test
    public void testGetReportStatus_AfterFailedGeneration_CanRetry() {
        createFinancialSummary();

        when(aiServiceClientWrapper.generateReport(any(ReportRequest.class)))
                .thenThrow(new RuntimeException("Failed"));

        // Trigger failed generation
        given()
                .header("X-Session-Id", sessionId.toString())
                .when()
                .post("/api/sessions/" + sessionId + "/report")
                .then()
                .statusCode(503);

        // Check status shows failed with canRetry
        given()
                .header("X-Session-Id", sessionId.toString())
                .when()
                .get("/api/sessions/" + sessionId + "/report/status")
                .then()
                .statusCode(200)
                .body("status", equalTo("failed"))
                .body("canRetry", equalTo(true))
                .body("message", containsString("retry"));
    }

    @Test
    public void testGenerateReport_RetryAfterFailure_Succeeds() {
        createFinancialSummary();

        // First call fails
        when(aiServiceClientWrapper.generateReport(any(ReportRequest.class)))
                .thenThrow(new RuntimeException("Temporary failure"))
                .thenReturn("%PDF-1.4 retry success".getBytes());

        // First attempt fails
        given()
                .header("X-Session-Id", sessionId.toString())
                .when()
                .post("/api/sessions/" + sessionId + "/report")
                .then()
                .statusCode(503);

        // Retry succeeds
        given()
                .header("X-Session-Id", sessionId.toString())
                .when()
                .post("/api/sessions/" + sessionId + "/report")
                .then()
                .statusCode(200)
                .contentType("application/pdf");
    }

    @Transactional
    void createFinancialSummary() {
        Session session = Session.findById(sessionId);
        FinancialSummary summary = new FinancialSummary();
        summary.session = session;
        summary.monthlyIncome = BigDecimal.valueOf(120000);
        summary.totalExpenses = BigDecimal.valueOf(78000);
        summary.monthlySavings = BigDecimal.valueOf(42000);
        summary.savingsPercentage = BigDecimal.valueOf(35);
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
        summary.calculatedAt = Timestamp.from(Instant.now());
        summary.persist();
    }

    @Transactional
    void createHealthScore() {
        Session session = Session.findById(sessionId);
        HealthScore score = new HealthScore();
        score.session = session;
        score.totalScore = 72;
        score.statusLabel = "Very Good";
        score.savingsRatioScore = 25;
        score.expenseControlScore = 18;
        score.emiBurdenScore = 12;
        score.investmentAllocationScore = 10;
        score.emergencyFundScore = 7;
        score.componentDetails = Map.of(
                "savingsRatio", Map.of("value", 0.35),
                "expenseControl", Map.of("value", 0.42),
                "emiBurden", Map.of("value", 0.10),
                "investmentAllocation", Map.of("value", 0.13),
                "emergencyFundReadiness", Map.of("value", 2.8)
        );
        score.calculatedAt = Timestamp.from(Instant.now());
        score.persist();
    }
}
