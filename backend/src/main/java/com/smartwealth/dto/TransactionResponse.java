package com.smartwealth.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * DTO for individual transaction items in the paginated transactions response.
 */
public record TransactionResponse(
        UUID id,
        LocalDate transactionDate,
        String description,
        BigDecimal amount,
        String type,
        String category,
        BigDecimal confidence,
        String categorizationMethod
) {
}
