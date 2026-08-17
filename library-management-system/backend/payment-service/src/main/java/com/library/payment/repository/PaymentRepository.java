package com.library.payment.repository;

import com.library.payment.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {
    Optional<Payment> findByTransactionCode(String transactionCode);
    Optional<Payment> findFirstByFineIdOrderByCreatedAtDesc(Long fineId);
    List<Payment> findByUserIdOrderByCreatedAtDesc(Long userId);
}
