package com.library.payment.dto;

import com.library.payment.entity.Payment;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

public final class PaymentDtos {
    private PaymentDtos() {}

    public record UnpaidFineResponse(
            Long fineId,
            Long loanId,
            String bookTitle,
            String type,
            String reason,
            Long amount,
            LocalDateTime createdAt
    ) {}

    public record CreatePaymentRequest(@NotNull Long fineId) {}

    public record CreatePaymentResponse(
            Long paymentId,
            Long fineId,
            Long amount,
            String transactionCode,
            String paymentUrl
    ) {}

    public record PaymentHistoryResponse(
            Long id,
            Long fineId,
            Long amount,
            Payment.Status status,
            String transactionCode,
            LocalDateTime createdAt,
            LocalDateTime paidAt
    ) {}

    public record PaymentCallbackResponse(
            String transactionCode,
            Long fineId,
            Long amount,
            Payment.Status status,
            String message
    ) {}
}
