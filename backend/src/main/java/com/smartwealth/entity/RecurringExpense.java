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
 * Entity representing a detected recurring expense pattern.
 */
@Entity
@Table(name = "recurring_expenses")
public class RecurringExpense extends PanacheEntityBase {

    @Id
    @Column(name = "id", updatable = false, nullable = false)
    public UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    @NotNull
    public Session session;

    @NotNull
    @Size(min = 1, max = 500)
    @Column(name = "description", nullable = false, length = 500)
    public String description;

    @NotNull
    @DecimalMin(value = "0.00")
    @Column(name = "recurring_amount", nullable = false, precision = 12, scale = 2)
    public BigDecimal recurringAmount;

    @NotNull
    @Min(2)
    @Column(name = "consecutive_months", nullable = false)
    public int consecutiveMonths;

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
     * Find all recurring expenses for a session.
     */
    public static List<RecurringExpense> findBySessionId(UUID sessionId) {
        return list("session.id", sessionId);
    }

    /**
     * Delete all recurring expenses for a session (before re-detection).
     */
    public static long deleteBySessionId(UUID sessionId) {
        return delete("session.id", sessionId);
    }
}
