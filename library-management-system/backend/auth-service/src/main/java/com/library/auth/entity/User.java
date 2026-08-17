package com.library.auth.entity;
import jakarta.persistence.*; import lombok.*; import java.time.*;
@Entity @Table(name="users") @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class User {
  public enum Role { ADMIN, LIBRARIAN, MEMBER }
  public enum Status { ACTIVE, LOCKED }
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
  @Column(nullable=false) private String fullName;
  @Column(nullable=false,unique=true) private String email;
  @Column(nullable=false) private String password;
  @Column(unique=true) private String phone;
  private String address;
  @Enumerated(EnumType.STRING) @Column(nullable=false) private Role role;
  @Enumerated(EnumType.STRING) @Column(nullable=false) private Status status;
  @Column(unique=true) private String memberCode;
  private String avatarUrl;
  @Column(unique=true) private String googleSubject;
  private String resetToken;
  private LocalDateTime resetTokenExpiry;
  private LocalDateTime createdAt;
  private LocalDateTime updatedAt;
  @PrePersist void create(){createdAt=updatedAt=LocalDateTime.now(); if(status==null)status=Status.ACTIVE; if(role==null)role=Role.MEMBER;}
  @PreUpdate void update(){updatedAt=LocalDateTime.now();}
}
