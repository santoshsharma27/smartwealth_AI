package com.smartwealth.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

/**
 * DTO for creating a financial goal.
 * Contains input validation matching Requirement 8.1 and 8.6.
 */
public class CreateGoalRequest {

    @NotNull(message = "Goal name is required")
    @Size(min = 1, max = 100, message = "Goal name must be between 1 and 100 characters")
    public String goalName;

    @NotNull(message = "Goal type is required")
    @Size(min = 1, max = 30, message = "Goal type must be between 1 and 30 characters")
    public String goalType;

    @NotNull(message = "Target amount is required")
    @DecimalMin(value = "1", message = "Target amount must be at least ₹1")
    @DecimalMax(value = "999999999", message = "Target amount must not exceed ₹999,999,999")
    public BigDecimal targetAmount;

    @NotNull(message = "Duration in months is required")
    @Min(value = 1, message = "Duration must be at least 1 month")
    @Max(value = 360, message = "Duration must not exceed 360 months")
    public Integer durationMonths;

    @NotNull(message = "Existing savings is required")
    @DecimalMin(value = "0", message = "Existing savings must be at least ₹0")
    public BigDecimal existingSavings;

    @NotNull(message = "Expected return percent is required")
    @DecimalMin(value = "0", message = "Expected return must be at least 0%")
    @DecimalMax(value = "30", message = "Expected return must not exceed 30%")
    public BigDecimal expectedReturnPercent;
}
