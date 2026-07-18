package com.smartwealth.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Entity representing the calculated Financial Health Score for a session.
 * One score per session (unique constraint on session_id).
 */
@Entity
@Table(name = "health_scores")
public class HealthScore extends PanacheEntityBase {

    @Id
    @Column(name = "id", updatable = false, nullable = false)
    public UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false, unique = true)
    @NotNull
    public Session session;

    @NotNull
    @Min(0)
    @Max(100)
    @Column(name = "total_score", nullable = false)
    public int totalScore;

    @NotNull
    @Size(max = 20)
    @Column(name = "status_label", nullable = false, length = 20)
    public String statusLabel;

    @Min(0)
    @Max(30)
    @Column(name = "savings_ratio_score", nullable = false)
    public int savingsRatioScore;

    @Min(0)
    @Max(25)
    @Column(name = "expense_control_score", nullable = false)
    public int expenseControlScore;

    @Min(0)
    @Max(15)
    @Column(name = "emi_burden_score", nullable = false)
    public int emiBurdenScore;

    @Min(0)
    @Max(15)
    @Column(name = "investment_allocation_score", nullable = false)
    public int investmentAllocationScore;

    @Min(0)
    @Max(15)
    @Column(name = "emergency_fund_score", nullable = false)
    public int emergencyFundScore;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "component_details", nullable = false, columnDefinition = "jsonb")
    public Map<String, Object> componentDetails;

    @NotNull
    @Column(name = "calculated_at", nullable = false)
    public Timestamp calculatedAt;

    @PrePersist
    public void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        if (calculatedAt == null) {
            calculatedAt = Timestamp.from(Instant.now());
        }
    }

    /**
     * Find health score by session ID.
     */
    public static HealthScore findBySessionId(UUID sessionId) {
        return find("session.id", sessionId).firstResult();
    }
}
