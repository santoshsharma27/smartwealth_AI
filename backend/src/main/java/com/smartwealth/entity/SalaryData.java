package com.smartwealth.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Entity representing extracted salary data from a salary slip document.
 */
@Entity
@Table(name = "salary_data")
public class SalaryData extends PanacheEntityBase {

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
    @DecimalMin(value = "0.00")
    @Column(name = "gross_salary", nullable = false, precision = 12, scale = 2)
    public BigDecimal grossSalary;

    @NotNull
    @DecimalMin(value = "0.00")
    @Column(name = "net_salary", nullable = false, precision = 12, scale = 2)
    public BigDecimal netSalary;

    @Size(max = 255)
    @Column(name = "employer_name", length = 255)
    public String employerName;

    @Size(max = 20)
    @Column(name = "month_year", length = 20)
    public String monthYear;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "deductions", columnDefinition = "jsonb")
    public List<Map<String, Object>> deductions;

    @PrePersist
    public void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
    }

    /**
     * Find salary data by session ID.
     */
    public static List<SalaryData> findBySessionId(UUID sessionId) {
        return list("session.id", sessionId);
    }

    /**
     * Find salary data by document ID.
     */
    public static SalaryData findByDocumentId(UUID documentId) {
        return find("document.id", documentId).firstResult();
    }
}
