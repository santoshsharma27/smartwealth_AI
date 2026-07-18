package com.smartwealth.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Entity representing an individual financial transaction extracted from a bank statement.
 */
@Entity
@Table(name = "transactions")
public class Transaction extends PanacheEntityBase {

    @Id
    @Column(name = "id", updatable = false, nullable = false)
    public UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", nullable = false)
    @NotNull
    public Document document;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    @NotNull
    public Session session;

    @NotNull
    @Column(name = "transaction_date", nullable = false)
    public LocalDate transactionDate;

    @NotNull
    @Size(min = 1, max = 500)
    @Column(name = "description", nullable = false, length = 500)
    public String description;

    @NotNull
    @DecimalMin(value = "0.00")
    @Column(name = "amount", nullable = false, precision = 12, scale = 2)
    public BigDecimal amount;

    @NotNull
    @Size(max = 6)
    @Column(name = "type", nullable = false, length = 6)
    public String type;

    @Size(max = 20)
    @Column(name = "category", length = 20)
    public String category;

    @DecimalMin(value = "0.00")
    @DecimalMax(value = "1.00")
    @Column(name = "confidence", precision = 3, scale = 2)
    public BigDecimal confidence;

    @Size(max = 10)
    @Column(name = "categorization_method", length = 10)
    public String categorizationMethod;

    @PrePersist
    public void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
    }

    /**
     * Find all transactions for a session.
     */
    public static List<Transaction> findBySessionId(UUID sessionId) {
        return list("session.id", sessionId);
    }

    /**
     * Find all debit transactions for a session.
     */
    public static List<Transaction> findDebitsBySessionId(UUID sessionId) {
        return list("session.id = ?1 and type = 'debit'", sessionId);
    }

    /**
     * Find transactions by document ID.
     */
    public static List<Transaction> findByDocumentId(UUID documentId) {
        return list("document.id", documentId);
    }
}
