package com.library.auth.controller;

import com.library.auth.dto.AuthDtos.UserResponse;
import com.library.auth.entity.User;
import com.library.auth.repository.UserRepository;
import com.library.auth.service.AuthService;
import com.library.common.qr.QrCodeUtils;
import com.library.common.security.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@PreAuthorize(
        "hasAnyRole('ADMIN','LIBRARIAN')"
)
public class UserController {

    private final UserRepository repo;
    private final AuthService service;


    @GetMapping
    Page<UserResponse> all(
            @RequestParam(
                    defaultValue = "0"
            )
            int page,

            @RequestParam(
                    defaultValue = "20"
            )
            int size
    ) {

        int safeSize =
                Math.max(
                        1,

                        Math.min(
                                size,
                                200
                        )
                );


        return repo.findAll(
                        PageRequest.of(
                                Math.max(
                                        0,
                                        page
                                ),

                                safeSize,

                                Sort.by(
                                                "createdAt"
                                        )
                                        .descending()
                        )
                )
                .map(
                        service::view
                );
    }


    @GetMapping("/{id}")
    UserResponse one(
            @PathVariable
            Long id
    ) {

        return service.view(
                service.get(
                        id
                )
        );
    }


    @GetMapping("/{id}/qr")
    ResponseEntity<byte[]> qr(
            @PathVariable
            Long id
    ) {

        User user =
                service.get(
                        id
                );


        byte[] qr =
                QrCodeUtils.png(
                        String.valueOf(
                                user.getId()
                        ),

                        320
                );


        return ResponseEntity.ok()
                .contentType(
                        MediaType.IMAGE_PNG
                )
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,

                        ContentDisposition
                                .inline()
                                .filename(
                                        "user-" +
                                                user.getId() +
                                                "-qr.png"
                                )
                                .build()
                                .toString()
                )
                .header(
                        HttpHeaders.CACHE_CONTROL,
                        "no-store"
                )
                .body(
                        qr
                );
    }


    /*
     * Chỉ ADMIN được đổi trạng thái.
     *
     * Backend lấy ID thật của người đang đăng nhập
     * từ JWT và truyền vào service để kiểm tra.
     */
    @PatchMapping("/{id}/status")
    @PreAuthorize(
            "hasRole('ADMIN')"
    )
    UserResponse status(
            @PathVariable
            Long id,

            @RequestParam
            User.Status status
    ) {

        return service.changeStatus(
                JwtAuthenticationFilter
                        .currentUserId(),

                id,

                status
        );
    }


    /*
     * Chỉ ADMIN được phân quyền.
     */
    @PatchMapping("/{id}/role")
    @PreAuthorize(
            "hasRole('ADMIN')"
    )
    UserResponse role(
            @PathVariable
            Long id,

            @RequestParam
            User.Role role
    ) {

        return service.changeRole(
                JwtAuthenticationFilter
                        .currentUserId(),

                id,

                role
        );
    }
}