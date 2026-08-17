package com.library.circulation.controller;

import com.library.circulation.dto.CirculationDtos.SettingsRequest;
import com.library.circulation.entity.LibrarySetting;
import com.library.circulation.service.CirculationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
public class SettingsController {
    private final CirculationService service;

    // Công khai cho mọi người xem quy định thư viện (trang "Quy định",
    // và chatbot Libby dùng để trả lời đúng số liệu hiện hành).
    // Không cần đăng nhập, chỉ đọc — không có endpoint sửa nào ở đây.
    @GetMapping("/public")
    public LibrarySetting getPublicSettings() {
        return service.getSettings();
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public LibrarySetting getSettings() {
        return service.getSettings();
    }

    @PutMapping
    @PreAuthorize("hasRole('ADMIN')")
    public LibrarySetting updateSettings(
            @Valid @RequestBody SettingsRequest request
    ) {
        return service.updateSettings(request);
    }
}