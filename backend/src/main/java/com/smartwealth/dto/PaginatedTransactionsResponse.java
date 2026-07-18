package com.smartwealth.dto;

import java.util.List;

/**
 * DTO for GET /api/sessions/{id}/transactions paginated response.
 */
public record PaginatedTransactionsResponse(
        List<TransactionResponse> transactions,
        int page,
        int size,
        long totalItems,
        int totalPages
) {
}
