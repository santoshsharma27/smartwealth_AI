package com.smartwealth.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Entity representing a detected spending anomaly (transaction exceeding 2× category average).
 */
@Entity
@Table(name = "spending_anomalies")
public class SpendingAnomaly extends PanacheEntityBase {

    @Id
    @Column(name = "id", updatable = false, nullable = false)
    public UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    @NotNull
    public Session session;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transaction_id", nullable = false)
    @NotNull
    public Transaction transaction;

    @NotNull
    @Size(min = 1, max = 500)
    @Column(name = "description", nullable = false, length = 500)
    public String description;

    @NotNull
    @DecimalMin(value = "0.00")
    @Column(name = "transaction_amount", nullable = false, precision = 12, scale = 2)
    public BigDecimal transactionAmount;

    @NotNull
    @Size(min = 1, max = 20)
    @Column(name = "category", nullable = false, length = 20)
    public String category;

    @NotNull
    @DecimalMin(value = "0.00")
    @Column(name = "category_average", nullable = false, precision = 12, scale = 2)
    public BigDecimal categoryAverage;

    @NotNull
    @Column(name = "detected_at", nullable = false)
    public Timestamp detectedAt;

    @PrePersist
    public void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        if (detectedAt == null) {
            detectedAt = Timestamp.from(Instant.now());
        }
    }

    /**
     * Find all spending anomalies for a session.
     */
    public static List<SpendingAnomaly> findBySessionId(UUID sessionId) {
        return list("session.id", sessionId);
    }

    /**
     * Delete all spending anomalies for a session (before re-detection).
     */
    public static long deleteBySessionId(UUID sessionId) {
        return delete("session.id", sessionId);
    }
}
