package com.smartwealth.resource;

import com.smartwealth.client.AiServiceClientWrapper;
import com.smartwealth.client.dto.ChatRequest;
import com.smartwealth.client.dto.ChatResponse;
import com.smartwealth.entity.*;

import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

/**
 * REST resource for chatbot interaction.
 * Handles sending messages, persisting Q&A pairs, and retrieving chat history.
 */
@Path("/api/sessions/{id}/chat")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ChatResource {

    private static final int MAX_MESSAGE_LENGTH = 500;
    private static final int MAX_CHAT_PAIRS = 50;
    private static final String DISCLAIMER = "This is informational guidance only. Consult a certified financial advisor for professional advice.";

    @Inject
    AiServiceClientWrapper aiServiceClientWrapper;

    /**
     * POST /api/sessions/{id}/chat
     * Send a chat message, get AI response, persist Q&A pair.
     */
    @POST
    @Transactional
    public Response sendMessage(@PathParam("id") UUID sessionId, ChatMessageRequest request) {
        // Validate session exists
        Session session = Session.findById(sessionId);
        if (session == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(new ErrorResponse("Session not found"))
                    .build();
        }

        // Validate input: non-null, non-empty, non-whitespace-only, max 500 chars
        if (request == null || request.message == null || request.message.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(new ErrorResponse("Message is required and cannot be empty or whitespace-only."))
                    .build();
        }

        if (request.message.length() > MAX_MESSAGE_LENGTH) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(new ErrorResponse("Message must not exceed " + MAX_MESSAGE_LENGTH + " characters."))
                    .build();
        }

        String trimmedMessage = request.message.trim();

        // Check if user has financial data
        FinancialSummary summary = FinancialSummary.findBySessionId(sessionId);
        List<Transaction> transactions = Transaction.findBySessionId(sessionId);
        List<Goal> goals = Goal.findBySessionId(sessionId);
        HealthScore healthScore = HealthScore.findBySessionId(sessionId);

        boolean hasFinancialData = summary != null || !transactions.isEmpty() || !goals.isEmpty() || healthScore != null;

        if (!hasFinancialData) {
            // No financial data: respond with message to upload documents without calling AI
            String noDataAnswer = "I don't have any financial data to work with yet. Please upload your salary slips or bank statements, or try loading the demo data to get started.";

            // Persist Q&A pair
            ChatMessage chatMessage = persistChatMessage(session, sessionId, trimmedMessage, noDataAnswer);

            return Response.ok(new ChatMessageResponse(
                    chatMessage.id,
                    chatMessage.question,
                    chatMessage.answer,
                    chatMessage.createdAt.toInstant().toString(),
                    DISCLAIMER
            )).build();
        }

        // Build financial context for AI service
        ChatRequest.FinancialContext context = buildFinancialContext(summary, transactions, goals, healthScore);

        // Forward to AI service
        ChatRequest chatRequest = new ChatRequest(trimmedMessage, context);
        ChatResponse aiResponse;
        try {
            aiResponse = aiServiceClientWrapper.processChat(chatRequest);
        } catch (Exception e) {
            return Response.status(Response.Status.SERVICE_UNAVAILABLE)
                    .entity(new ErrorResponse("AI service is currently unavailable. Please try again later."))
                    .build();
        }

        String answer = aiResponse.answer != null ? aiResponse.answer : "I'm sorry, I couldn't process your question. Please try again.";

        // Persist Q&A pair
        ChatMessage chatMessage = persistChatMessage(session, sessionId, trimmedMessage, answer);

        return Response.ok(new ChatMessageResponse(
                chatMessage.id,
                chatMessage.question,
                chatMessage.answer,
                chatMessage.createdAt.toInstant().toString(),
                aiResponse.disclaimer != null ? aiResponse.disclaimer : DISCLAIMER
        )).build();
    }

    /**
     * GET /api/sessions/{id}/chat/history
     * Retrieve all chat messages ordered by sequence number.
     */
    @GET
    @Path("/history")
    public Response getChatHistory(@PathParam("id") UUID sessionId) {
        // Validate session exists
        Session session = Session.findById(sessionId);
        if (session == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(new ErrorResponse("Session not found"))
                    .build();
        }

        List<ChatMessage> messages = ChatMessage.findBySessionId(sessionId);
        List<ChatMessageResponse> responseList = messages.stream()
                .map(msg -> new ChatMessageResponse(
                        msg.id,
                        msg.question,
                        msg.answer,
                        msg.createdAt.toInstant().toString(),
                        DISCLAIMER
                ))
                .toList();

        return Response.ok(responseList).build();
    }

    /**
     * Persist a chat Q&A pair with the next sequence number.
     * Implements FIFO eviction if count exceeds MAX_CHAT_PAIRS.
     */
    private ChatMessage persistChatMessage(Session session, UUID sessionId, String question, String answer) {
        // FIFO eviction: if at limit, delete oldest
        long currentCount = ChatMessage.countBySessionId(sessionId);
        while (currentCount >= MAX_CHAT_PAIRS) {
            ChatMessage.deleteOldestBySessionId(sessionId);
            currentCount--;
        }

        // Get next sequence number
        int nextSequence = ChatMessage.getMaxSequenceNumber(sessionId) + 1;

        // Persist new message
        ChatMessage chatMessage = new ChatMessage();
        chatMessage.session = session;
        chatMessage.sequenceNumber = nextSequence;
        chatMessage.question = question;
        chatMessage.answer = answer;
        chatMessage.createdAt = Timestamp.from(Instant.now());
        chatMessage.persist();

        return chatMessage;
    }

    /**
     * Build the financial context to send to the AI service.
     */
    private ChatRequest.FinancialContext buildFinancialContext(
            FinancialSummary summary,
            List<Transaction> transactions,
            List<Goal> goals,
            HealthScore healthScore) {

        ChatRequest.FinancialContext context = new ChatRequest.FinancialContext();

        // Summary
        if (summary != null) {
            Map<String, Object> summaryMap = new LinkedHashMap<>();
            summaryMap.put("monthlyIncome", summary.monthlyIncome);
            summaryMap.put("totalExpenses", summary.totalExpenses);
            summaryMap.put("monthlySavings", summary.monthlySavings);
            summaryMap.put("savingsPercentage", summary.savingsPercentage);
            summaryMap.put("expensesByCategory", summary.expensesByCategory);
            context.summary = summaryMap;
        }

        // Transactions (limit to recent 50 for context size)
        if (transactions != null && !transactions.isEmpty()) {
            List<Map<String, Object>> txList = transactions.stream()
                    .sorted(Comparator.comparing(t -> t.transactionDate, Comparator.reverseOrder()))
                    .limit(50)
                    .map(t -> {
                        Map<String, Object> txMap = new LinkedHashMap<>();
                        txMap.put("date", t.transactionDate.toString());
                        txMap.put("description", t.description);
                        txMap.put("amount", t.amount);
                        txMap.put("type", t.type);
                        txMap.put("category", t.category);
                        return txMap;
                    })
                    .toList();
            context.transactions = txList;
        }

        // Goals
        if (goals != null && !goals.isEmpty()) {
            List<Map<String, Object>> goalList = goals.stream()
                    .map(g -> {
                        Map<String, Object> goalMap = new LinkedHashMap<>();
                        goalMap.put("goalName", g.goalName);
                        goalMap.put("targetAmount", g.targetAmount);
                        goalMap.put("durationMonths", g.durationMonths);
                        goalMap.put("existingSavings", g.existingSavings);
                        goalMap.put("requiredMonthlySavings", g.requiredMonthlySavings);
                        goalMap.put("feasibilityStatus", g.feasibilityStatus);
                        return goalMap;
                    })
                    .toList();
            context.goals = goalList;
        }

        // Health Score
        if (healthScore != null) {
            Map<String, Object> scoreMap = new LinkedHashMap<>();
            scoreMap.put("totalScore", healthScore.totalScore);
            scoreMap.put("statusLabel", healthScore.statusLabel);
            scoreMap.put("savingsRatioScore", healthScore.savingsRatioScore);
            scoreMap.put("expenseControlScore", healthScore.expenseControlScore);
            scoreMap.put("emiBurdenScore", healthScore.emiBurdenScore);
            scoreMap.put("investmentAllocationScore", healthScore.investmentAllocationScore);
            scoreMap.put("emergencyFundScore", healthScore.emergencyFundScore);
            context.score = scoreMap;
        }

        return context;
    }

    /**
     * Request DTO for chat messages.
     */
    public static class ChatMessageRequest {
        public String message;
    }

    /**
     * Response DTO for chat messages.
     */
    public record ChatMessageResponse(
            UUID id,
            String question,
            String answer,
            String timestamp,
            String disclaimer
    ) {}

    /**
     * Simple error response record.
     */
    public record ErrorResponse(String message) {}
}
