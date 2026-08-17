package com.library.auth.controller;

import com.library.auth.dto.AuthDtos.*;
import com.library.auth.service.AuthService;
import com.library.common.security.JwtAuthenticationFilter;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService service;

    @PostMapping("/login")
    AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return service.login(request);
    }

    @PostMapping("/google")
    AuthResponse google(@Valid @RequestBody GoogleAuthRequest request) {
        return service.googleLogin(request);
    }

    @PostMapping("/register")
    ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(201).body(service.register(request));
    }

    @GetMapping("/me")
    UserResponse me() {
        return service.view(service.get(JwtAuthenticationFilter.currentUserId()));
    }

    @PutMapping("/me")
    AuthResponse update(@Valid @RequestBody UpdateProfileRequest request) {
        return service.update(
                JwtAuthenticationFilter.currentUserId(),
                request
        );
    }

    @PostMapping("/change-password")
    void change(@Valid @RequestBody ChangePasswordRequest request) {
        service.changePassword(JwtAuthenticationFilter.currentUserId(), request);
    }

    @PostMapping("/forgot-password")
    ResponseEntity<Map<String, String>> forgot(@Valid @RequestBody ForgotPasswordRequest request) {
        return service.forgot(request.email())
                .map(resetUrl -> ResponseEntity.accepted().body(Map.of(
                        "message", "Nếu email đã đăng ký, liên kết đặt lại mật khẩu sẽ được gửi trong ít phút. Khi chạy local, bạn có thể dùng liên kết bên dưới để test ngay.",
                        "resetUrl", resetUrl
                )))
                .orElseGet(() -> ResponseEntity.accepted().body(Map.of(
                        "message", "Nếu email đã đăng ký, liên kết đặt lại mật khẩu sẽ được gửi trong ít phút."
                )));
    }

    @PostMapping("/reset-password")
    ResponseEntity<Void> reset(@Valid @RequestBody ResetPasswordRequest request) {
        service.reset(request);
        return ResponseEntity.noContent().build();
    }
}
