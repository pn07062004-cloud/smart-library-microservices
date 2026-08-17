package com.library.auth.controller;

import com.library.auth.dto.AuthDtos.UserResponse;
import com.library.auth.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.Objects;

@RestController
@RequiredArgsConstructor
public class InternalUserController {
    private final AuthService service;

    @Value("${internal.api-key}")
    private String internalApiKey;

    @GetMapping("/internal/auth/users/{id}")
    UserResponse internalUser(
            @RequestHeader("X-Internal-Key") String providedKey,
            @PathVariable Long id
    ) {
        if (!Objects.equals(internalApiKey, providedKey)) {
            throw new IllegalStateException("Không có quyền gọi API nội bộ");
        }

        return service.view(service.get(id));
    }
}
