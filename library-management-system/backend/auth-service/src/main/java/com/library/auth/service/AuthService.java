package com.library.auth.service;

import com.library.auth.dto.AuthDtos.*;
import com.library.auth.entity.User;
import com.library.auth.repository.UserRepository;
import com.library.common.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class AuthService {

    private static final SecureRandom SECURE_RANDOM =
            new SecureRandom();


    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final GoogleTokenVerifier googleTokenVerifier;
    private final MailService mailService;


    /* =====================================================
       LOGIN
       ===================================================== */

    public AuthResponse login(
            LoginRequest request
    ) {

        String email =
                normalizeEmail(
                        request.email()
                );


        User user =
                users
                        .findByEmailIgnoreCase(
                                email
                        )
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Email hoặc mật khẩu không đúng"
                                        )
                        );


        if (user.getPassword() == null || !encoder.matches(request.password(),
                user.getPassword())) {
            throw new IllegalArgumentException(
                    "Email hoặc mật khẩu không đúng"
            );
        }

        ensureActive(user);
        return auth(user);
    }


    /* =====================================================
       REGISTER
       ===================================================== */

    public AuthResponse register(
            RegisterRequest request
    ) {

        String email =
                normalizeEmail(
                        request.email()
                );


        if (
                users.existsByEmailIgnoreCase(
                        email
                )
        ) {
            throw new IllegalArgumentException(
                    "Email đã được sử dụng"
            );
        }


        User user =
                User.builder()

                        .fullName(
                                request
                                        .fullName()
                                        .trim()
                        )

                        .email(
                                email
                        )

                        .password(
                                encoder.encode(
                                        request.password()
                                )
                        )

                        .phone(
                                request.phone()
                        )

                        .address(
                                request.address()
                        )

                        .role(
                                User.Role.MEMBER
                        )

                        .status(
                                User.Status.ACTIVE
                        )

                        .memberCode(
                                "DG" +
                                        System.currentTimeMillis()
                        )

                        .build();


        return auth(
                users.save(
                        user
                )
        );
    }


    /* =====================================================
       GOOGLE LOGIN
       ===================================================== */

    public AuthResponse googleLogin(
            GoogleAuthRequest request
    ) {

        GoogleTokenVerifier.GoogleProfile profile =
                googleTokenVerifier.verify(
                        request.credential()
                );


        User user =
                users
                        .findByGoogleSubject(
                                profile.subject()
                        )
                        .orElse(
                                null
                        );


        if (
                user == null
        ) {

            user =
                    users
                            .findByEmailIgnoreCase(
                                    profile.email()
                            )
                            .orElse(
                                    null
                            );


            if (
                    user == null
            ) {

                user =
                        User.builder()

                                .fullName(
                                        profile.name()
                                )

                                .email(
                                        profile.email()
                                )

                                .password(
                                        encoder.encode(
                                                UUID
                                                        .randomUUID()
                                                        .toString()
                                        )
                                )

                                .googleSubject(
                                        profile.subject()
                                )

                                .avatarUrl(
                                        profile.picture()
                                )

                                .role(
                                        User.Role.MEMBER
                                )

                                .status(
                                        User.Status.ACTIVE
                                )

                                .memberCode(
                                        "DG" +
                                                System.currentTimeMillis()
                                )

                                .build();

            } else {

                if (
                        user.getGoogleSubject() != null &&
                                !user
                                        .getGoogleSubject()
                                        .equals(
                                                profile.subject()
                                        )
                ) {
                    throw new IllegalArgumentException(
                            "Email Google này đã liên kết với tài khoản khác"
                    );
                }


                if (
                        user.getGoogleSubject() == null &&
                                !profile.hasAuthoritativeEmail()
                ) {
                    throw new IllegalArgumentException(
                            "Email này đã có tài khoản. Hãy đăng nhập bằng mật khẩu để bảo vệ tài khoản của bạn"
                    );
                }


                user.setGoogleSubject(
                        profile.subject()
                );


                if (
                        (
                                user.getAvatarUrl() == null ||
                                        user.getAvatarUrl().isBlank()
                        ) &&
                                profile.picture() != null &&
                                !profile.picture().isBlank()
                ) {

                    user.setAvatarUrl(
                            profile.picture()
                    );
                }
            }
        }


        ensureActive(
                user
        );


        return auth(
                users.save(
                        user
                )
        );
    }


    /* =====================================================
       PROFILE
       ===================================================== */

    public AuthResponse update(
            Long id,
            UpdateProfileRequest request
    ) {

        User user =
                get(
                        id
                );


        user.setFullName(
                request
                        .fullName()
                        .trim()
        );


        user.setPhone(
                request.phone()
        );


        user.setAddress(
                request.address()
        );


        user.setAvatarUrl(
                request.avatarUrl()
        );


        users.save(
                user
        );


        return auth(
                user
        );
    }


    /* =====================================================
       PASSWORD
       ===================================================== */

    public void changePassword(
            Long id,
            ChangePasswordRequest request
    ) {

        User user =
                get(
                        id
                );


        if (
                user.getPassword() == null ||
                        !encoder.matches(
                                request.currentPassword(),
                                user.getPassword()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Mật khẩu hiện tại không đúng"
            );
        }


        user.setPassword(
                encoder.encode(
                        request.newPassword()
                )
        );
    }


    /* =====================================================
       FORGOT PASSWORD
       ===================================================== */

    public Optional<String> forgot(
            String email
    ) {

        Optional<User> found =
                users.findByEmailIgnoreCase(
                        normalizeEmail(
                                email
                        )
                );


        if (
                found.isEmpty()
        ) {
            return Optional.empty();
        }


        User user =
                found.get();


        String rawToken =
                createResetToken();


        user.setResetToken(
                hashToken(
                        rawToken
                )
        );


        user.setResetTokenExpiry(
                LocalDateTime
                        .now()
                        .plusMinutes(
                                15
                        )
        );


        return mailService
                .sendPasswordReset(
                        user.getEmail(),
                        rawToken
                );
    }


    public void reset(
            ResetPasswordRequest request
    ) {

        User user =
                users
                        .findByResetToken(
                                hashToken(
                                        request.token()
                                )
                        )
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Mã khôi phục không hợp lệ"
                                        )
                        );


        if (
                user.getResetTokenExpiry() == null ||
                        user
                                .getResetTokenExpiry()
                                .isBefore(
                                        LocalDateTime.now()
                                )
        ) {
            throw new IllegalArgumentException(
                    "Mã khôi phục đã hết hạn"
            );
        }


        user.setPassword(
                encoder.encode(
                        request.newPassword()
                )
        );


        user.setResetToken(
                null
        );


        user.setResetTokenExpiry(
                null
        );
    }


    /* =====================================================
       ROLE MANAGEMENT
       ===================================================== */

    public UserResponse changeRole(
            Long actorId,
            Long targetId,
            User.Role nextRole
    ) {

        /*
         * Không chỉ tin role nằm trong JWT.
         *
         * Đọc lại user thật trong DB để chắc chắn
         * tài khoản hiện tại vẫn là ADMIN và ACTIVE.
         */
        requireActiveAdmin(
                actorId
        );


        /*
         * Luật quan trọng:
         * ADMIN không được tự hạ quyền mình.
         */
        if (
                actorId.equals(
                        targetId
                )
        ) {
            throw new IllegalArgumentException(
                    "Bạn không thể thay đổi vai trò của chính tài khoản đang đăng nhập."
            );
        }


        User target =
                get(
                        targetId
                );


        /*
         * Không thay đổi gì nếu role giống nhau.
         */
        if (
                target.getRole() ==
                        nextRole
        ) {
            return view(
                    target
            );
        }


        /*
         * Nếu đang hạ một ADMIN đang ACTIVE,
         * khóa danh sách ADMIN trong DB trước
         * khi kiểm tra để bảo vệ admin cuối cùng.
         */
        if (
                target.getRole() ==
                        User.Role.ADMIN

                        &&

                        nextRole !=
                                User.Role.ADMIN

                        &&

                        target.getStatus() ==
                                User.Status.ACTIVE
        ) {

            ensureAnotherActiveAdminRemains();
        }


        target.setRole(
                nextRole
        );


        return view(
                users.save(
                        target
                )
        );
    }


    /* =====================================================
       STATUS MANAGEMENT
       ===================================================== */

    public UserResponse changeStatus(
            Long actorId,
            Long targetId,
            User.Status nextStatus
    ) {

        requireActiveAdmin(
                actorId
        );


        /*
         * Không được tự khóa chính mình.
         */
        if (
                actorId.equals(
                        targetId
                )
        ) {
            throw new IllegalArgumentException(
                    "Bạn không thể khóa hoặc thay đổi trạng thái của chính tài khoản đang đăng nhập."
            );
        }


        User target =
                get(
                        targetId
                );


        if (
                target.getStatus() ==
                        nextStatus
        ) {
            return view(
                    target
            );
        }


        /*
         * Không khóa ADMIN ACTIVE cuối cùng.
         */
        if (
                target.getRole() ==
                        User.Role.ADMIN

                        &&

                        target.getStatus() ==
                                User.Status.ACTIVE

                        &&

                        nextStatus ==
                                User.Status.LOCKED
        ) {

            ensureAnotherActiveAdminRemains();
        }


        target.setStatus(
                nextStatus
        );


        return view(
                users.save(
                        target
                )
        );
    }


    /* =====================================================
       USER LOOKUP
       ===================================================== */

    public User get(
            Long id
    ) {

        return users
                .findById(
                        id
                )
                .orElseThrow(
                        () ->
                                new IllegalArgumentException(
                                        "Không tìm thấy người dùng"
                                )
                );
    }


    /* =====================================================
       AUTH RESPONSE
       ===================================================== */

    public AuthResponse auth(
            User user
    ) {

        return new AuthResponse(

                jwt.generate(
                        user.getId(),
                        user.getEmail(),
                        user.getFullName(),
                        user.getRole().name()
                ),

                view(
                        user
                )
        );
    }


    public UserResponse view(
            User user
    ) {

        return new UserResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone(),
                user.getAddress(),
                user.getRole().name(),
                user.getStatus().name(),
                user.getMemberCode(),
                user.getAvatarUrl(),
                user.getCreatedAt()
        );
    }


    /* =====================================================
       ADMIN SAFETY
       ===================================================== */

    private User requireActiveAdmin(
            Long userId
    ) {

        User actor =
                get(
                        userId
                );


        ensureActive(
                actor
        );


        /*
         * Defense in depth:
         *
         * kể cả JWT cũ còn chữ ADMIN,
         * nếu DB đã đổi role thì endpoint
         * phân quyền vẫn từ chối.
         */
        if (
                actor.getRole() !=
                        User.Role.ADMIN
        ) {
            throw new IllegalStateException(
                    "Tài khoản hiện tại không còn quyền quản trị."
            );
        }


        return actor;
    }


    private void ensureAnotherActiveAdminRemains() {

        /*
         * PESSIMISTIC_WRITE nằm ở repository.
         *
         * Các thao tác thay đổi admin đồng thời
         * sẽ không cùng vượt qua kiểm tra này.
         */
        List<User> activeAdmins =
                users.findAllByRoleAndStatusForUpdate(
                        User.Role.ADMIN,
                        User.Status.ACTIVE
                );


        if (
                activeAdmins.size() <=
                        1
        ) {
            throw new IllegalStateException(
                    "Không thể thực hiện thao tác này vì hệ thống phải luôn có ít nhất một quản trị viên đang hoạt động."
            );
        }
    }


    private void ensureActive(
            User user
    ) {

        if (
                user.getStatus() !=
                        User.Status.ACTIVE
        ) {
            throw new IllegalStateException(
                    "Tài khoản đã bị khóa"
            );
        }
    }


    /* =====================================================
       HELPERS
       ===================================================== */

    private String normalizeEmail(
            String email
    ) {

        return email == null

                ? ""

                : email
                  .trim()
                  .toLowerCase();
    }


    private String createResetToken() {

        byte[] bytes =
                new byte[32];


        SECURE_RANDOM.nextBytes(
                bytes
        );


        return Base64
                .getUrlEncoder()
                .withoutPadding()
                .encodeToString(
                        bytes
                );
    }


    private String hashToken(
            String token
    ) {

        try {

            byte[] digest =
                    MessageDigest
                            .getInstance(
                                    "SHA-256"
                            )
                            .digest(
                                    token.getBytes(
                                            StandardCharsets.UTF_8
                                    )
                            );


            return HexFormat
                    .of()
                    .formatHex(
                            digest
                    );

        } catch (
                NoSuchAlgorithmException exception
        ) {

            throw new IllegalStateException(
                    "Không thể tạo mã khôi phục an toàn",
                    exception
            );
        }
    }
}