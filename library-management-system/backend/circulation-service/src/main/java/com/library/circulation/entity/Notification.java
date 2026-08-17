package com.library.circulation.entity;import jakarta.persistence.*;import lombok.*;import java.time.*;
@Entity @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder public class Notification{@Id @GeneratedValue(strategy=GenerationType.IDENTITY)private Long id;private Long userId;private String title;@Column(length=1000)private String message;@Builder.Default private Boolean isRead=false;private LocalDateTime createdAt;@PrePersist void c(){createdAt=LocalDateTime.now();}}

