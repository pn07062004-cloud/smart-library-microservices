package com.library.payment.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "payments",
        indexes = {
                @Index(name = "idx_payment_user", columnList = "user_id"),
                @Index(name = "idx_payment_fine", columnList = "fine_id")
        },
        uniqueConstraints = @UniqueConstraint(
                name = "uk_payment_transaction",
                columnNames = "transaction_code"
        )
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Payment {

    public enum Status {
        PENDING,
        SUCCESS,
        FAILED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "fine_id", nullable = false)
    private Long fineId;

    @Column(nullable = false)
    private Long amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status;

    @Column(
            name = "transaction_code",
            nullable = false,
            unique = true,
            length = 80
    )
    private String transactionCode;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @PrePersist
    void created() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }

        if (status == null) {
            status = Status.PENDING;
        }
    }
}