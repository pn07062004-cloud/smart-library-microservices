package com.library.payment.service;

import com.library.payment.config.VnpayProperties;
import com.library.payment.entity.Payment;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.Map;
import java.util.TreeMap;

@Service
@RequiredArgsConstructor
public class VnpayService {
    private static final DateTimeFormatter VNPAY_DATE = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private final VnpayProperties properties;

    public String buildPaymentUrl(Payment payment, String bookTitle, String clientIp) {
        requireConfigured();

        LocalDateTime now = LocalDateTime.now();
        Map<String, String> params = new TreeMap<>();
        params.put("vnp_Version", properties.getVersion());
        params.put("vnp_Command", properties.getCommand());
        params.put("vnp_TmnCode", properties.getTmnCode());
        params.put("vnp_Amount", String.valueOf(payment.getAmount() * 100));
        params.put("vnp_CurrCode", properties.getCurrencyCode());
        params.put("vnp_TxnRef", payment.getTransactionCode());
        params.put("vnp_OrderInfo", "Thanh toan khoan phat #" + payment.getFineId() + " - " + safeText(bookTitle));
        params.put("vnp_OrderType", properties.getOrderType());
        params.put("vnp_Locale", properties.getLocale());
        params.put("vnp_ReturnUrl", properties.getReturnUrl());
        params.put("vnp_IpAddr", normalizeIp(clientIp));
        params.put("vnp_CreateDate", now.format(VNPAY_DATE));
        params.put("vnp_ExpireDate", now.plusMinutes(Math.max(1, properties.getExpireMinutes())).format(VNPAY_DATE));



        String secureHash = hmacSha512(buildHashData(params));
        params.put("vnp_SecureHash", secureHash);
        return properties.getPayUrl() + "?" + buildHashData(params);
    }

    public boolean isValidSignature(Map<String, String> rawParams) {
        requireConfigured();
        String receivedHash = rawParams.get("vnp_SecureHash");
        if (receivedHash == null || receivedHash.isBlank()) {
            return false;
        }

        Map<String, String> params = new TreeMap<>(rawParams);
        params.remove("vnp_SecureHash");
        params.remove("vnp_SecureHashType");

        return hmacSha512(buildHashData(params)).equalsIgnoreCase(receivedHash);
    }

    private void requireConfigured() {
        if (properties.getTmnCode() == null || properties.getTmnCode().isBlank()
                || properties.getHashSecret() == null || properties.getHashSecret().isBlank()) {
            throw new IllegalStateException("Chưa cấu hình thông tin VNPay sandbox");
        }
    }

    private String hmacSha512(String data) {
        try {
            Mac hmac = Mac.getInstance("HmacSHA512");
            hmac.init(new SecretKeySpec(properties.getHashSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
            return HexFormat.of().formatHex(hmac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Không thể tạo chữ ký VNPay");
        }
    }

    private String buildHashData(Map<String, String> params) {
        StringBuilder builder = new StringBuilder();
        params.forEach((key, value) -> {
            if (value == null || value.isBlank()) return;
            if (builder.length() > 0) builder.append('&');
            builder.append(encode(key)).append('=').append(encode(value));
        });
        return builder.toString();
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String normalizeIp(String value) {
        if (value == null || value.isBlank() || "0:0:0:0:0:0:0:1".equals(value)) {
            return "127.0.0.1";
        }
        return value;
    }

    private String safeText(String value) {
        return value == null || value.isBlank() ? "Smart Library" : value;
    }
}
