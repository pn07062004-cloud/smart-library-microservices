package com.library.payment.controller;

import com.library.payment.dto.PaymentDtos.*;
import com.library.payment.service.PaymentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/payments")
public class PaymentController {
    private final PaymentService service;

    @GetMapping("/fines/unpaid")
    List<UnpaidFineResponse> unpaidFines() {
        return service.unpaidFinesForCurrentUser();
    }

    @PostMapping("/transactions")
    CreatePaymentResponse createTransaction(
            @Valid @RequestBody CreatePaymentRequest request,
            HttpServletRequest servletRequest
    ) {
        return service.createTransaction(request, clientIp(servletRequest));
    }

    @GetMapping("/me/history")
    List<PaymentHistoryResponse> myHistory() {
        return service.historyForCurrentUser();
    }

    @GetMapping("/vnpay/return")
    ResponseEntity<Void> vnpayReturn(@RequestParam Map<String, String> params) {
        URI redirect;
        try {
            redirect = service.resultRedirect(service.processVnpayCallback(params));
        } catch (RuntimeException exception) {
            redirect = service.errorRedirect(params.get("vnp_TxnRef"), exception.getMessage());
        }

        return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.LOCATION, redirect.toString())
                .build();
    }

    @GetMapping("/vnpay/ipn")
    Map<String, String> vnpayIpn(@RequestParam Map<String, String> params) {
        try {
            service.processVnpayCallback(params);
            return Map.of("RspCode", "00", "Message", "Confirm Success");
        } catch (IllegalArgumentException exception) {
            return Map.of("RspCode", "01", "Message", exception.getMessage());
        } catch (IllegalStateException exception) {
            return Map.of("RspCode", "97", "Message", exception.getMessage());
        } catch (RuntimeException exception) {
            return Map.of("RspCode", "99", "Message", "Unknown error");
        }
    }

    private String clientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
