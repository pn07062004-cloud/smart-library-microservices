package com.library.auth.dto;
import jakarta.validation.constraints.*; import java.time.LocalDateTime;
public final class AuthDtos {
  private AuthDtos(){}
  public record LoginRequest(@Email @NotBlank String email,@NotBlank String password){}
  public record RegisterRequest(@NotBlank String fullName,@Email @NotBlank String email,@NotBlank @Size(min=8) String password,String phone,String address){}
  public record UpdateProfileRequest(@NotBlank String fullName,String phone,String address,String avatarUrl){}
  public record ChangePasswordRequest(@NotBlank String currentPassword,@NotBlank @Size(min=8) String newPassword){}
  public record ForgotPasswordRequest(@Email @NotBlank String email){}
  public record ResetPasswordRequest(@NotBlank String token,@NotBlank @Size(min=8) String newPassword){}
  public record GoogleAuthRequest(@NotBlank @Size(max=4096) String credential){}
  public record UserResponse(Long id,String fullName,String email,String phone,String address,String role,String status,String memberCode,String avatarUrl,LocalDateTime createdAt){}
  public record AuthResponse(String token,UserResponse user){}
}
