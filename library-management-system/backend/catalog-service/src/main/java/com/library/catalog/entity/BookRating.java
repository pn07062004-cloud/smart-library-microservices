package com.library.catalog.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "book_rating",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_book_rating_book_user",
                columnNames = {"book_id", "user_id"}
        )
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookRating {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "book_id", nullable = false)
    private Long bookId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private Integer stars;

    @Column(name = "user_name")
    private String userName;

    @Column(length = 1000)
    private String comment;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    void create() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void update() {
        updatedAt = LocalDateTime.now();
    }
}