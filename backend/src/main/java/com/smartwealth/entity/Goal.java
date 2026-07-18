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
 * Entity representing a user-defined financial goal with calculation results.
 */
@Entity
@Table(name = "goals")
public class Goal extends PanacheEntityBase {

    @Id
    @Column(name = "id", updatable = false, nullable = false)
    public UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    @NotNull
    public Session session;

    @NotNull
    @Size(min = 1, max = 100)
    @Column(name = "goal_name", nullable = false, length = 100)
    public String goalName;

    @NotNull
    @Size(min = 1, max = 30)
    @Column(name = "goal_type", nullable = false, length = 30)
    public String goalType;

    @NotNull
    @DecimalMin(value = "1")
    @DecimalMax(value = "999999999")
    @Column(name = "target_amount", nullable = false, precision = 12, scale = 2)
    public BigDecimal targetAmount;

    @NotNull
    @Min(1)
    @Max(360)
    @Column(name = "duration_months", nullable = false)
    public int durationMonths;

    @NotNull
    @DecimalMin(value = "0")
    @Column(name = "existing_savings", nullable = false, precision = 12, scale = 2)
    public BigDecimal existingSavings = BigDecimal.ZERO;

    @NotNull
    @DecimalMin(value = "0")
    @DecimalMax(value = "30")
    @Column(name = "expected_return_percent", nullable = false, precision = 5, scale = 2)
    public BigDecimal expectedReturnPercent;

    @NotNull
    @DecimalMin(value = "0")
    @Column(name = "required_monthly_savings", nullable = false, precision = 12, scale = 2)
    public BigDecimal requiredMonthlySavings;

    @NotNull
    @Size(max = 20)
    @Column(name = "feasibility_status", nullable = false, length = 20)
    public String feasibilityStatus;

    @NotNull
    @Column(name = "created_at", nullable = false)
    public Timestamp createdAt;

    @PrePersist
    public void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        if (createdAt == null) {
            createdAt = Timestamp.from(Instant.now());
        }
    }

    /**
     * Find all goals for a session.
     */
    public static List<Goal> findBySessionId(UUID sessionId) {
        return list("session.id", sessionId);
    }

    /**
     * Find a specific goal by ID and session ID.
     */
    public static Goal findByIdAndSessionId(UUID goalId, UUID sessionId) {
        return find("id = ?1 and session.id = ?2", goalId, sessionId).firstResult();
    }

    /**
     * Delete a specific goal by ID and session ID.
     */
    public static long deleteByIdAndSessionId(UUID goalId, UUID sessionId) {
        return delete("id = ?1 and session.id = ?2", goalId, sessionId);
    }

    /**
     * Delete all goals for a session.
     */
    public static long deleteBySessionId(UUID sessionId) {
        return delete("session.id", sessionId);
    }
}
