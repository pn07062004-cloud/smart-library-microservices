package com.library.payment.service;

import com.library.common.security.JwtAuthenticationFilter;
import com.library.payment.dto.PaymentDtos.*;
import com.library.payment.entity.Payment;
import com.library.payment.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional
public class PaymentService {
    private final PaymentRepository payments;
    private final RestClient circulationClient;
    private final VnpayService vnpayService;

    @Value("${frontend.base-url}")
    private String frontendBaseUrl;

    private record CirculationFine(
            Long id,
            Long loanId,
            Long userId,
            String userName,
            String bookTitle,
            String type,
            Long amount,
            String reason,
            String status,
            LocalDateTime createdAt,
            LocalDateTime paidAt
    ) {}

    public List<UnpaidFineResponse> unpaidFinesForCurrentUser() {
        Long userId = JwtAuthenticationFilter.currentUserId();
        return loadUnpaidFines(userId).stream()
                .map(this::toUnpaidFine)
                .toList();
    }

    public CreatePaymentResponse createTransaction(CreatePaymentRequest request, String clientIp) {
        Long userId = JwtAuthenticationFilter.currentUserId();
        CirculationFine fine = loadUnpaidFines(userId).stream()
                .filter(item -> Objects.equals(item.id(), request.fineId()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy khoản phạt chưa thanh toán"));

        expirePendingPayment(fine);

        Payment payment = payments.save(Payment.builder()
                .userId(userId)
                .fineId(fine.id())
                .amount(fine.amount())
                .status(Payment.Status.PENDING)
                .transactionCode(generateTransactionCode(fine.id()))
                .build());

        String paymentUrl = vnpayService.buildPaymentUrl(payment, fine.bookTitle(), clientIp);
        return new CreatePaymentResponse(
                payment.getId(),
                payment.getFineId(),
                payment.getAmount(),
                payment.getTransactionCode(),
                paymentUrl
        );
    }

    public List<PaymentHistoryResponse> historyForCurrentUser() {
        Long userId = JwtAuthenticationFilter.currentUserId();
        return payments.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toHistory)
                .toList();
    }

    public PaymentCallbackResponse processVnpayCallback(Map<String, String> params) {
        if (!vnpayService.isValidSignature(params)) {
            throw new IllegalStateException("Chữ ký VNPay không hợp lệ");
        }

        String transactionCode = required(params, "vnp_TxnRef");
        Payment payment = payments.findByTransactionCode(transactionCode)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy giao dịch"));

        long amount = parseVnpayAmount(required(params, "vnp_Amount"));
        if (!Objects.equals(payment.getAmount(), amount)) {
            throw new IllegalStateException("Số tiền giao dịch không khớp");
        }

        boolean success = "00".equals(params.get("vnp_ResponseCode"))
                && "00".equals(params.get("vnp_TransactionStatus"));

        if (success) {
            payment.setStatus(Payment.Status.SUCCESS);
            if (payment.getPaidAt() == null) {
                payment.setPaidAt(LocalDateTime.now());
            }
            markFinePaid(payment.getFineId());
            return new PaymentCallbackResponse(
                    payment.getTransactionCode(),
                    payment.getFineId(),
                    payment.getAmount(),
                    payment.getStatus(),
                    "Thanh toán thành công"
            );
        }

        if (payment.getStatus() == Payment.Status.PENDING) {
            payment.setStatus(Payment.Status.FAILED);
        }

        return new PaymentCallbackResponse(
                payment.getTransactionCode(),
                payment.getFineId(),
                payment.getAmount(),
                payment.getStatus(),
                "Giao dịch chưa thành công hoặc đã bị hủy"
        );
    }

    public URI resultRedirect(PaymentCallbackResponse result) {
        return resultRedirect(
                result.transactionCode(),
                result.status().name(),
                result.fineId(),
                result.amount(),
                result.message()
        );
    }

    public URI errorRedirect(String transactionCode, String message) {
        return resultRedirect(transactionCode, Payment.Status.FAILED.name(), null, null, message);
    }

    private URI resultRedirect(String transactionCode, String status, Long fineId, Long amount, String message) {
        String base = frontendBaseUrl == null ? "http://localhost:3000" : frontendBaseUrl.replaceAll("/+$", "");
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(base)
                .path("/payments/result")
                .queryParam("transactionCode", transactionCode == null ? "" : transactionCode)
                .queryParam("status", status)
                .queryParam("message", message);

        if (fineId != null) builder.queryParam("fineId", fineId);
        if (amount != null) builder.queryParam("amount", amount);
        return builder.build().encode().toUri();
    }

    private void expirePendingPayment(CirculationFine fine) {
        Optional<Payment> latest = payments.findFirstByFineIdOrderByCreatedAtDesc(fine.id());
        if (latest.isEmpty()) {
            return;
        }

        Payment payment = latest.get();
        if (payment.getStatus() == Payment.Status.SUCCESS) {
            throw new IllegalStateException("Khoản phạt này đã được thanh toán");
        }

        if (payment.getStatus() == Payment.Status.PENDING
                && Objects.equals(payment.getAmount(), fine.amount())
                && Objects.equals(payment.getUserId(), fine.userId())) {
            payment.setStatus(Payment.Status.FAILED);
        }
    }

    private List<CirculationFine> loadUnpaidFines(Long userId) {
        CirculationFine[] response = circulationClient.get()
                .uri(uri -> uri.path("/internal/circulation/fines/unpaid")
                        .queryParam("userId", userId)
                        .build())
                .retrieve()
                .body(CirculationFine[].class);

        return response == null ? List.of() : Arrays.asList(response);
    }

    private void markFinePaid(Long fineId) {
        circulationClient.patch()
                .uri("/internal/circulation/fines/{id}/paid", fineId)
                .retrieve()
                .toBodilessEntity();
    }

    private UnpaidFineResponse toUnpaidFine(CirculationFine fine) {
        return new UnpaidFineResponse(
                fine.id(),
                fine.loanId(),
                fine.bookTitle(),
                fine.type(),
                fine.reason(),
                fine.amount(),
                fine.createdAt()
        );
    }

    private PaymentHistoryResponse toHistory(Payment payment) {
        return new PaymentHistoryResponse(
                payment.getId(),
                payment.getFineId(),
                payment.getAmount(),
                payment.getStatus(),
                payment.getTransactionCode(),
                payment.getCreatedAt(),
                payment.getPaidAt()
        );
    }

    private String generateTransactionCode(Long fineId) {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase(Locale.ROOT);
        return "SL" + timestamp + "F" + fineId + suffix;
    }

    private String required(Map<String, String> params, String key) {
        String value = params.get(key);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Thiếu tham số VNPay: " + key);
        }
        return value;
    }

    private long parseVnpayAmount(String amount) {
        try {
            return Long.parseLong(amount) / 100;
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("Số tiền VNPay không hợp lệ");
        }
    }
}
