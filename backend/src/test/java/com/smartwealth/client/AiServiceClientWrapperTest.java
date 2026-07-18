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

import io.quarkus.test.junit.QuarkusTest;

import jakarta.inject.Inject;

import org.eclipse.microprofile.faulttolerance.CircuitBreaker;
import org.eclipse.microprofile.faulttolerance.Retry;
import org.eclipse.microprofile.faulttolerance.Timeout;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests verifying that the AiServiceClientWrapper is properly configured
 * with fault tolerance annotations.
 */
@QuarkusTest
class AiServiceClientWrapperTest {

    @Inject
    AiServiceClientWrapper wrapper;

    @Test
    void wrapperBeanIsInjectable() {
        assertNotNull(wrapper, "AiServiceClientWrapper should be injectable as a CDI bean");
    }

    @Test
    void parseDocumentHasFaultToleranceAnnotations() throws NoSuchMethodException {
        Method method = AiServiceClientWrapper.class.getMethod("parseDocument", ParseRequest.class);
        assertFaultToleranceAnnotations(method);
    }

    @Test
    void categorizeTransactionsHasFaultToleranceAnnotations() throws NoSuchMethodException {
        Method method = AiServiceClientWrapper.class.getMethod("categorizeTransactions", CategorizeRequest.class);
        assertFaultToleranceAnnotations(method);
    }

    @Test
    void calculateScoreHasFaultToleranceAnnotations() throws NoSuchMethodException {
        Method method = AiServiceClientWrapper.class.getMethod("calculateScore", ScoreRequest.class);
        assertFaultToleranceAnnotations(method);
    }

    @Test
    void generateRecommendationsHasFaultToleranceAnnotations() throws NoSuchMethodException {
        Method method = AiServiceClientWrapper.class.getMethod("generateRecommendations", RecommendRequest.class);
        assertFaultToleranceAnnotations(method);
    }

    @Test
    void processChatHasFaultToleranceAnnotations() throws NoSuchMethodException {
        Method method = AiServiceClientWrapper.class.getMethod("processChat", ChatRequest.class);
        assertFaultToleranceAnnotations(method);
    }

    @Test
    void detectPatternsHasFaultToleranceAnnotations() throws NoSuchMethodException {
        Method method = AiServiceClientWrapper.class.getMethod("detectPatterns", DetectPatternsRequest.class);
        assertFaultToleranceAnnotations(method);
    }

    @Test
    void generateReportHasFaultToleranceAnnotations() throws NoSuchMethodException {
        Method method = AiServiceClientWrapper.class.getMethod("generateReport", ReportRequest.class);
        assertFaultToleranceAnnotations(method);
    }

    @Test
    void circuitBreakerHasCorrectConfiguration() throws NoSuchMethodException {
        Method method = AiServiceClientWrapper.class.getMethod("parseDocument", ParseRequest.class);
        CircuitBreaker cb = method.getAnnotation(CircuitBreaker.class);
        assertNotNull(cb);
        assertEquals(5, cb.requestVolumeThreshold(), "Circuit breaker should open after 5 failures");
        assertEquals(1.0, cb.failureRatio(), "Failure ratio should be 1.0 (all requests must fail)");
        assertEquals(30000, cb.delay(), "Circuit breaker delay should be 30 seconds");
        assertEquals(2, cb.successThreshold(), "Success threshold should be 2");
    }

    @Test
    void retryHasCorrectConfiguration() throws NoSuchMethodException {
        Method method = AiServiceClientWrapper.class.getMethod("parseDocument", ParseRequest.class);
        Retry retry = method.getAnnotation(Retry.class);
        assertNotNull(retry);
        assertEquals(3, retry.maxRetries(), "Should retry up to 3 times");
        assertEquals(30000, retry.delay(), "Retry delay should be 30 seconds");
    }

    @Test
    void timeoutHasCorrectConfiguration() throws NoSuchMethodException {
        Method method = AiServiceClientWrapper.class.getMethod("parseDocument", ParseRequest.class);
        Timeout timeout = method.getAnnotation(Timeout.class);
        assertNotNull(timeout);
        assertEquals(30000, timeout.value(), "Timeout should be 30 seconds");
    }

    private void assertFaultToleranceAnnotations(Method method) {
        assertNotNull(method.getAnnotation(CircuitBreaker.class),
                method.getName() + " should have @CircuitBreaker");
        assertNotNull(method.getAnnotation(Retry.class),
                method.getName() + " should have @Retry");
        assertNotNull(method.getAnnotation(Timeout.class),
                method.getName() + " should have @Timeout");
    }
}
