package com.smartwealth.resource;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.Matchers.*;

/**
 * Integration tests for the financial data REST endpoints.
 * Tests GET /api/sessions/{id}/summary, /transactions, /score, /recommendations,
 * /recurring, and /anomalies.
 */
@QuarkusTest
class FinancialDataResourceTest {

    private String createSession() {
        return given()
                .when().post("/api/sessions")
                .then()
                .statusCode(201)
                .extract().path("id");
    }

    // --- Summary Endpoint Tests ---

    @Test
    void testGetSummary_sessionNotFound() {
        UUID randomId = UUID.randomUUID();
        given()
                .header("X-Session-Id", randomId.toString())
                .when().get("/api/sessions/" + randomId + "/summary")
                .then()
                .statusCode(404)
                .body("message", is("Session not found"));
    }

    @Test
    void testGetSummary_noData() {
        String sessionId = createSession();
        given()
                .header("X-Session-Id", sessionId)
                .when().get("/api/sessions/" + sessionId + "/summary")
                .then()
                .statusCode(200)
                .body("currencyMetadata.symbol", is("₹"))
                .body("currencyMetadata.code", is("INR"))
                .body("currencyMetadata.locale", is("en-IN"))
                .body("monthlyIncome", nullValue());
    }

    // --- Transactions Endpoint Tests ---

    @Test
    void testGetTransactions_sessionNotFound() {
        UUID randomId = UUID.randomUUID();
        given()
                .header("X-Session-Id", randomId.toString())
                .when().get("/api/sessions/" + randomId + "/transactions")
                .then()
                .statusCode(404)
                .body("message", is("Session not found"));
    }

    @Test
    void testGetTransactions_emptyList() {
        String sessionId = createSession();
        given()
                .header("X-Session-Id", sessionId)
                .when().get("/api/sessions/" + sessionId + "/transactions")
                .then()
                .statusCode(200)
                .body("transactions", hasSize(0))
                .body("page", is(0))
                .body("size", is(20))
                .body("totalItems", is(0))
                .body("totalPages", is(0));
    }

    @Test
    void testGetTransactions_defaultPagination() {
        String sessionId = createSession();
        given()
                .header("X-Session-Id", sessionId)
                .when().get("/api/sessions/" + sessionId + "/transactions")
                .then()
                .statusCode(200)
                .body("page", is(0))
                .body("size", is(20));
    }

    @Test
    void testGetTransactions_customPagination() {
        String sessionId = createSession();
        given()
                .header("X-Session-Id", sessionId)
                .queryParam("page", 1)
                .queryParam("size", 10)
                .when().get("/api/sessions/" + sessionId + "/transactions")
                .then()
                .statusCode(200)
                .body("page", is(1))
                .body("size", is(10));
    }

    @Test
    void testGetTransactions_negativePage() {
        String sessionId = createSession();
        given()
                .header("X-Session-Id", sessionId)
                .queryParam("page", -1)
                .when().get("/api/sessions/" + sessionId + "/transactions")
                .then()
                .statusCode(200)
                .body("page", is(0));
    }

    @Test
    void testGetTransactions_oversizedPageSize() {
        String sessionId = createSession();
        given()
                .header("X-Session-Id", sessionId)
                .queryParam("size", 200)
                .when().get("/api/sessions/" + sessionId + "/transactions")
                .then()
                .statusCode(200)
                .body("size", is(100));
    }

    // --- Score Endpoint Tests ---

    @Test
    void testGetScore_sessionNotFound() {
        UUID randomId = UUID.randomUUID();
        given()
                .header("X-Session-Id", randomId.toString())
                .when().get("/api/sessions/" + randomId + "/score")
                .then()
                .statusCode(404)
                .body("message", is("Session not found"));
    }

    @Test
    void testGetScore_noData() {
        String sessionId = createSession();
        given()
                .header("X-Session-Id", sessionId)
                .when().get("/api/sessions/" + sessionId + "/score")
                .then()
                .statusCode(200);
        // Returns null body when no score exists
    }

    // --- Recommendations Endpoint Tests ---

    @Test
    void testGetRecommendations_sessionNotFound() {
        UUID randomId = UUID.randomUUID();
        given()
                .header("X-Session-Id", randomId.toString())
                .when().get("/api/sessions/" + randomId + "/recommendations")
                .then()
                .statusCode(404)
                .body("message", is("Session not found"));
    }

    @Test
    void testGetRecommendations_emptyList() {
        String sessionId = createSession();
        given()
                .header("X-Session-Id", sessionId)
                .when().get("/api/sessions/" + sessionId + "/recommendations")
                .then()
                .statusCode(200)
                .body("$", hasSize(0));
    }

    // --- Recurring Expenses Endpoint Tests ---

    @Test
    void testGetRecurring_sessionNotFound() {
        UUID randomId = UUID.randomUUID();
        given()
                .header("X-Session-Id", randomId.toString())
                .when().get("/api/sessions/" + randomId + "/recurring")
                .then()
                .statusCode(404)
                .body("message", is("Session not found"));
    }

    @Test
    void testGetRecurring_emptyList() {
        String sessionId = createSession();
        given()
                .header("X-Session-Id", sessionId)
                .when().get("/api/sessions/" + sessionId + "/recurring")
                .then()
                .statusCode(200)
                .body("$", hasSize(0));
    }

    // --- Spending Anomalies Endpoint Tests ---

    @Test
    void testGetAnomalies_sessionNotFound() {
        UUID randomId = UUID.randomUUID();
        given()
                .header("X-Session-Id", randomId.toString())
                .when().get("/api/sessions/" + randomId + "/anomalies")
                .then()
                .statusCode(404)
                .body("message", is("Session not found"));
    }

    @Test
    void testGetAnomalies_emptyList() {
        String sessionId = createSession();
        given()
                .header("X-Session-Id", sessionId)
                .when().get("/api/sessions/" + sessionId + "/anomalies")
                .then()
                .statusCode(200)
                .body("$", hasSize(0));
    }
}
