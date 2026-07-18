package com.smartwealth.client;

import com.smartwealth.client.dto.CategorizeRequest;
import com.smartwealth.client.dto.CategorizeResponse;
import com.smartwealth.client.dto.ChatRequest;
import com.smartwealth.client.dto.ChatResponse;
import com.smartwealth.client.dto.DetectPatternsRequest;
import com.smartwealth.client.dto.DetectPatternsResponse;
import com.smartwealth.client.dto.ParseRequest;
import com.smartwealth.client.dto.ParseResponse;
import com.smartwealth.client.dto.RecommendRequest;
import com.smartwealth.client.dto.RecommendResponse;
import com.smartwealth.client.dto.ReportRequest;
import com.smartwealth.client.dto.ScoreRequest;
import com.smartwealth.client.dto.ScoreResponse;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import org.eclipse.microprofile.faulttolerance.CircuitBreaker;
import org.eclipse.microprofile.faulttolerance.Retry;
import org.eclipse.microprofile.faulttolerance.Timeout;
import org.eclipse.microprofile.rest.client.inject.RestClient;

/**
 * CDI bean wrapping the AI service REST client with MicroProfile Fault Tolerance.
 * <p>
 * Circuit breaker opens after 5 consecutive failures within 60s window,
 * stays open for 30s before half-open, and requires 2 successes to close.
 * Retries up to 3 times with 30s delay between attempts.
 * Each call times out after 30 seconds.
 */
@ApplicationScoped
public class AiServiceClientWrapper {

    @Inject
    @RestClient
    AiServiceClient aiServiceClient;

    @CircuitBreaker(requestVolumeThreshold = 5, failureRatio = 1.0, delay = 30000, successThreshold = 2)
    @Retry(maxRetries = 3, delay = 30000)
    @Timeout(30000)
    public ParseResponse parseDocument(ParseRequest request) {
        return aiServiceClient.parseDocument(request);
    }

    @CircuitBreaker(requestVolumeThreshold = 5, failureRatio = 1.0, delay = 30000, successThreshold = 2)
    @Retry(maxRetries = 3, delay = 30000)
    @Timeout(30000)
    public CategorizeResponse categorizeTransactions(CategorizeRequest request) {
        return aiServiceClient.categorizeTransactions(request);
    }

    @CircuitBreaker(requestVolumeThreshold = 5, failureRatio = 1.0, delay = 30000, successThreshold = 2)
    @Retry(maxRetries = 3, delay = 30000)
    @Timeout(30000)
    public ScoreResponse calculateScore(ScoreRequest request) {
        return aiServiceClient.calculateScore(request);
    }

    @CircuitBreaker(requestVolumeThreshold = 5, failureRatio = 1.0, delay = 30000, successThreshold = 2)
    @Retry(maxRetries = 3, delay = 30000)
    @Timeout(30000)
    public RecommendResponse generateRecommendations(RecommendRequest request) {
        return aiServiceClient.generateRecommendations(request);
    }

    @CircuitBreaker(requestVolumeThreshold = 5, failureRatio = 1.0, delay = 30000, successThreshold = 2)
    @Retry(maxRetries = 3, delay = 30000)
    @Timeout(30000)
    public ChatResponse processChat(ChatRequest request) {
        return aiServiceClient.processChat(request);
    }

    @CircuitBreaker(requestVolumeThreshold = 5, failureRatio = 1.0, delay = 30000, successThreshold = 2)
    @Retry(maxRetries = 3, delay = 30000)
    @Timeout(30000)
    public DetectPatternsResponse detectPatterns(DetectPatternsRequest request) {
        return aiServiceClient.detectPatterns(request);
    }

    @CircuitBreaker(requestVolumeThreshold = 5, failureRatio = 1.0, delay = 30000, successThreshold = 2)
    @Retry(maxRetries = 3, delay = 30000)
    @Timeout(15000)
    public byte[] generateReport(ReportRequest request) {
        return aiServiceClient.generateReport(request);
    }
}
