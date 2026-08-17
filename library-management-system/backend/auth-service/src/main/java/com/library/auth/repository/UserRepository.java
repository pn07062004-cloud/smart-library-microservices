package com.library.auth.repository;

import com.library.auth.entity.User;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository
        extends JpaRepository<User, Long> {

    Optional<User> findByEmailIgnoreCase(
            String email
    );

    Optional<User> findByGoogleSubject(
            String googleSubject
    );

    Optional<User> findByResetToken(
            String token
    );

    boolean existsByEmailIgnoreCase(
            String email
    );


    /*
     * Khóa các ADMIN đang hoạt động trong transaction.
     *
     * Mục đích:
     * tránh 2 quản trị viên đồng thời cùng hạ quyền /
     * khóa admin và vô tình làm hệ thống mất admin.
     */
    @Lock(
            LockModeType.PESSIMISTIC_WRITE
    )
    @Query("""
            select u
            from User u
            where u.role = :role
              and u.status = :status
            """)
    List<User> findAllByRoleAndStatusForUpdate(
            @Param("role")
            User.Role role,

            @Param("status")
            User.Status status
    );
}