package com.smartwealth.resource;

import com.smartwealth.client.AiServiceClientWrapper;
import com.smartwealth.client.dto.ChatRequest;
import com.smartwealth.client.dto.ChatResponse;
import com.smartwealth.entity.*;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Integration tests for ChatResource.
 * Tests chat message sending, validation, history retrieval, and FIFO eviction.
 */
@QuarkusTest
public class ChatResourceTest {

    @InjectMock
    AiServiceClientWrapper aiServiceClientWrapper;

    @Inject
    EntityManager entityManager;

    private UUID sessionId;

    @BeforeEach
    @Transactional
    public void setUp() {
        // Create a session for testing
        Session session = new Session();
        session.persist();
        sessionId = session.id;
    }

    @Test
    public void testSendMessage_NoFinancialData_InformsUser() {
        given()
                .header("X-Session-Id", sessionId.toString())
                .contentType("application/json")
                .body("{\"message\": \"How can I save more?\"}")
                .when()
                .post("/api/sessions/" + sessionId + "/chat")
                .then()
                .statusCode(200)
                .body("question", equalTo("How can I save more?"))
                .body("answer", containsString("upload"))
                .body("disclaimer", notNullValue())
                .body("id", notNullValue())
                .body("timestamp", notNullValue());
    }

    @Test
    public void testSendMessage_WithFinancialData_ForwardsToAi() {
        // Set up financial data
        createFinancialSummary();

        // Mock AI service response
        ChatResponse mockResponse = new ChatResponse();
        mockResponse.answer = "Based on your data, you can save more by reducing food expenses.";
        mockResponse.disclaimer = "This is informational guidance only.";
        when(aiServiceClientWrapper.processChat(any(ChatRequest.class))).thenReturn(mockResponse);

        given()
                .header("X-Session-Id", sessionId.toString())
                .contentType("application/json")
                .body("{\"message\": \"How can I reduce expenses?\"}")
                .when()
                .post("/api/sessions/" + sessionId + "/chat")
                .then()
                .statusCode(200)
                .body("question", equalTo("How can I reduce expenses?"))
                .body("answer", equalTo("Based on your data, you can save more by reducing food expenses."))
                .body("disclaimer", equalTo("This is informational guidance only."))
                .body("id", notNullValue())
                .body("timestamp", notNullValue());
    }

    @Test
    public void testSendMessage_EmptyMessage_Rejected() {
        given()
                .header("X-Session-Id", sessionId.toString())
                .contentType("application/json")
                .body("{\"message\": \"\"}")
                .when()
                .post("/api/sessions/" + sessionId + "/chat")
                .then()
                .statusCode(400)
                .body("message", containsString("empty"));
    }

    @Test
    public void testSendMessage_NullMessage_Rejected() {
        given()
                .header("X-Session-Id", sessionId.toString())
                .contentType("application/json")
                .body("{}")
                .when()
                .post("/api/sessions/" + sessionId + "/chat")
                .then()
                .statusCode(400)
                .body("message", containsString("required"));
    }

    @Test
    public void testSendMessage_WhitespaceOnly_Rejected() {
        given()
                .header("X-Session-Id", sessionId.toString())
                .contentType("application/json")
                .body("{\"message\": \"   \\t\\n  \"}")
                .when()
                .post("/api/sessions/" + sessionId + "/chat")
                .then()
                .statusCode(400)
                .body("message", containsString("empty"));
    }

    @Test
    public void testSendMessage_ExceedsMaxLength_Rejected() {
        String longMessage = "a".repeat(501);

        given()
                .header("X-Session-Id", sessionId.toString())
                .contentType("application/json")
                .body("{\"message\": \"" + longMessage + "\"}")
                .when()
                .post("/api/sessions/" + sessionId + "/chat")
                .then()
                .statusCode(400)
                .body("message", containsString("500"));
    }

    @Test
    public void testSendMessage_ExactlyMaxLength_Accepted() {
        String maxMessage = "a".repeat(500);

        given()
                .header("X-Session-Id", sessionId.toString())
                .contentType("application/json")
                .body("{\"message\": \"" + maxMessage + "\"}")
                .when()
                .post("/api/sessions/" + sessionId + "/chat")
                .then()
                .statusCode(200)
                .body("question", equalTo(maxMessage));
    }

    @Test
    public void testSendMessage_SessionNotFound() {
        UUID nonExistentSession = UUID.randomUUID();

        given()
                .header("X-Session-Id", nonExistentSession.toString())
                .contentType("application/json")
                .body("{\"message\": \"Hello\"}")
                .when()
                .post("/api/sessions/" + nonExistentSession + "/chat")
                .then()
                .statusCode(404)
                .body("message", containsString("Session not found"));
    }

    @Test
    public void testSendMessage_AiServiceUnavailable() {
        // Set up financial data so we actually call the AI service
        createFinancialSummary();

        // Mock AI service throwing exception
        when(aiServiceClientWrapper.processChat(any(ChatRequest.class)))
                .thenThrow(new RuntimeException("AI service unavailable"));

        given()
                .header("X-Session-Id", sessionId.toString())
                .contentType("application/json")
                .body("{\"message\": \"How can I save?\"}")
                .when()
                .post("/api/sessions/" + sessionId + "/chat")
                .then()
                .statusCode(503)
                .body("message", containsString("unavailable"));
    }

    @Test
    public void testGetChatHistory_Empty() {
        given()
                .header("X-Session-Id", sessionId.toString())
                .when()
                .get("/api/sessions/" + sessionId + "/chat/history")
                .then()
                .statusCode(200)
                .body("$", hasSize(0));
    }

    @Test
    public void testGetChatHistory_WithMessages() {
        // Send a message first (no financial data, so it will use the default response)
        given()
                .header("X-Session-Id", sessionId.toString())
                .contentType("application/json")
                .body("{\"message\": \"First question\"}")
                .when()
                .post("/api/sessions/" + sessionId + "/chat")
                .then()
                .statusCode(200);

        given()
                .header("X-Session-Id", sessionId.toString())
                .contentType("application/json")
                .body("{\"message\": \"Second question\"}")
                .when()
                .post("/api/sessions/" + sessionId + "/chat")
                .then()
                .statusCode(200);

        // Get history
        given()
                .header("X-Session-Id", sessionId.toString())
                .when()
                .get("/api/sessions/" + sessionId + "/chat/history")
                .then()
                .statusCode(200)
                .body("$", hasSize(2))
                .body("[0].question", equalTo("First question"))
                .body("[1].question", equalTo("Second question"));
    }

    @Test
    public void testGetChatHistory_SessionNotFound() {
        UUID nonExistentSession = UUID.randomUUID();

        given()
                .header("X-Session-Id", nonExistentSession.toString())
                .when()
                .get("/api/sessions/" + nonExistentSession + "/chat/history")
                .then()
                .statusCode(404)
                .body("message", containsString("Session not found"));
    }

    @Test
    public void testFIFOEviction_At50PairsLimit() {
        // Pre-populate 50 chat messages directly in database
        populateChatMessages(50);

        // Send one more message (should evict the oldest)
        given()
                .header("X-Session-Id", sessionId.toString())
                .contentType("application/json")
                .body("{\"message\": \"Message after limit\"}")
                .when()
                .post("/api/sessions/" + sessionId + "/chat")
                .then()
                .statusCode(200);

        // Verify we still have exactly 50 messages, not 51
        given()
                .header("X-Session-Id", sessionId.toString())
                .when()
                .get("/api/sessions/" + sessionId + "/chat/history")
                .then()
                .statusCode(200)
                .body("$", hasSize(50));
    }

    @Test
    public void testChatHistory_OrderedBySequenceNumber() {
        // Send multiple messages
        for (int i = 1; i <= 3; i++) {
            given()
                    .header("X-Session-Id", sessionId.toString())
                    .contentType("application/json")
                    .body("{\"message\": \"Question " + i + "\"}")
                    .when()
                    .post("/api/sessions/" + sessionId + "/chat")
                    .then()
                    .statusCode(200);
        }

        // Get history and verify order
        given()
                .header("X-Session-Id", sessionId.toString())
                .when()
                .get("/api/sessions/" + sessionId + "/chat/history")
                .then()
                .statusCode(200)
                .body("$", hasSize(3))
                .body("[0].question", equalTo("Question 1"))
                .body("[1].question", equalTo("Question 2"))
                .body("[2].question", equalTo("Question 3"));
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
    void populateChatMessages(int count) {
        Session session = Session.findById(sessionId);
        for (int i = 1; i <= count; i++) {
            ChatMessage msg = new ChatMessage();
            msg.session = session;
            msg.sequenceNumber = i;
            msg.question = "Question " + i;
            msg.answer = "Answer " + i;
            msg.createdAt = Timestamp.from(Instant.now());
            msg.persist();
        }
    }
}
