package com.library.auth.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class GoogleTokenVerifier {
    private final JwtDecoder googleJwtDecoder;

    @Value("${app.google.client-id:}")
    private String clientId;

    public GoogleProfile verify(String credential) {
        if (clientId == null || clientId.isBlank()) {
            throw new IllegalStateException("Đăng nhập Google chưa được cấu hình ở máy chủ.");
        }

        try {
            Jwt token = googleJwtDecoder.decode(credential);
            List<String> audiences = token.getAudience() == null ? List.of() : token.getAudience();
            String issuer = token.getIssuer() == null ? "" : token.getIssuer().toString();
            String authorizedParty = token.getClaimAsString("azp");
            Boolean emailVerified = token.getClaimAsBoolean("email_verified");
            String email = token.getClaimAsString("email");
            String subject = token.getSubject();

            boolean audienceValid = audiences.contains(clientId)
                    && (authorizedParty == null || authorizedParty.isBlank() || clientId.equals(authorizedParty));
            if (!audienceValid
                    || !("https://accounts.google.com".equals(issuer) || "accounts.google.com".equals(issuer))
                    || !Boolean.TRUE.equals(emailVerified)
                    || subject == null || subject.isBlank()
                    || email == null || email.isBlank()) {
                throw new IllegalArgumentException("Thông tin xác thực Google không hợp lệ.");
            }

            return new GoogleProfile(
                    subject,
                    email.trim().toLowerCase(),
                    valueOrDefault(token.getClaimAsString("name"), email),
                    token.getClaimAsString("picture"),
                    token.getClaimAsString("hd")
            );
        } catch (JwtException | IllegalArgumentException e) {
            throw new IllegalArgumentException("Thông tin xác thực Google không hợp lệ.");
        }
    }

    private String valueOrDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    public record GoogleProfile(String subject, String email, String name, String picture, String hostedDomain) {
        public boolean hasAuthoritativeEmail() {
            return email.endsWith("@gmail.com")
                    || (hostedDomain != null && !hostedDomain.isBlank());
        }
    }
}
