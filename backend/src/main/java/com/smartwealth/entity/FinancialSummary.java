package com.smartwealth.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Entity representing the calculated financial summary for a session.
 * One summary per session (unique constraint on session_id).
 */
@Entity
@Table(name = "financial_summaries")
public class FinancialSummary extends PanacheEntityBase {

    @Id
    @Column(name = "id", updatable = false, nullable = false)
    public UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false, unique = true)
    @NotNull
    public Session session;

    @NotNull
    @DecimalMin(value = "0.00")
    @Column(name = "monthly_income", nullable = false, precision = 12, scale = 2)
    public BigDecimal monthlyIncome;

    @NotNull
    @DecimalMin(value = "0.00")
    @Column(name = "total_expenses", nullable = false, precision = 12, scale = 2)
    public BigDecimal totalExpenses;

    @NotNull
    @Column(name = "monthly_savings", nullable = false, precision = 12, scale = 2)
    public BigDecimal monthlySavings;

    @NotNull
    @Column(name = "savings_percentage", nullable = false, precision = 5, scale = 2)
    public BigDecimal savingsPercentage;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "expenses_by_category", nullable = false, columnDefinition = "jsonb")
    public Map<String, Double> expensesByCategory;

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
     * Find financial summary by session ID.
     */
    public static FinancialSummary findBySessionId(UUID sessionId) {
        return find("session.id", sessionId).firstResult();
    }
}
