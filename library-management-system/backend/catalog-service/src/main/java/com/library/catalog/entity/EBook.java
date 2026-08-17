package com.library.catalog.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EBook {
 @Id
 @GeneratedValue(strategy = GenerationType.IDENTITY)
 private Long id;

 @OneToOne(optional = false, fetch = FetchType.LAZY)
 @JoinColumn(name = "book_id", nullable = false, unique = true)
 private Book book;

 @Column(nullable = false)
 private String originalFilename;

 @Column(nullable = false, unique = true)
 private String storedFilename;

 @Column(nullable = false)
 private String contentType;

 @Column(nullable = false)
 private Long sizeBytes;

 @Builder.Default
 private Boolean publicAccess = false;

 private LocalDateTime uploadedAt;
 private LocalDateTime updatedAt;

 @PrePersist
 void c() {
  uploadedAt = updatedAt = LocalDateTime.now();
  if (contentType == null || contentType.isBlank()) contentType = "application/pdf";
  if (publicAccess == null) publicAccess = false;
 }

 @PreUpdate
 void u() {
  updatedAt = LocalDateTime.now();
  if (publicAccess == null) publicAccess = false;
 }
}