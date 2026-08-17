package com.library.circulation.repository;import com.library.circulation.entity.*;import org.springframework.data.domain.*;import org.springframework.data.jpa.repository.*;import org.springframework.data.repository.query.Param;import org.springframework.stereotype.Repository;import java.time.*;import java.util.*;
public final class CirculationRepositories{private CirculationRepositories(){}
 @Repository public interface Loans extends JpaRepository<Loan,Long>{
  Page<Loan> findByUserId(Long id,Pageable p);
  long countByStatusIn(Collection<Loan.Status> s);
  boolean existsByCopyIdAndStatusIn(Long id,Collection<Loan.Status> s);
  boolean existsByUserIdAndBookIdAndStatusIn(Long userId,Long bookId,Collection<Loan.Status> s);
  Optional<Loan> findFirstByCopyIdAndStatusInOrderByCreatedAtDesc(Long copyId,Collection<Loan.Status> statuses);
  List<Loan> findByStatusIn(Collection<Loan.Status> s);
  List<Loan> findByBorrowedDateBetween(LocalDate from, LocalDate to);
  @Query("SELECT l FROM Loan l WHERE l.borrowedDate >= :from ORDER BY l.borrowedDate DESC")
  List<Loan> findSince(@Param("from") LocalDate from);
  @Query("SELECT l.bookId, l.bookTitle, COUNT(l) as cnt FROM Loan l GROUP BY l.bookId, l.bookTitle ORDER BY cnt DESC")
  List<Object[]> findTopBorrowedBooks(Pageable p);
 }
 @Repository public interface Reservations extends JpaRepository<Reservation,Long>{Page<Reservation> findByUserId(Long id,Pageable p);long countByBookIdAndStatus(Long id,Reservation.Status s);boolean existsByUserIdAndBookIdAndStatusIn(Long userId,Long bookId,Collection<Reservation.Status> s);List<Reservation> findByBookIdAndStatusOrderByReservedAtAsc(Long bookId,Reservation.Status status);List<Reservation> findByStatusInAndExpiresAtBefore(Collection<Reservation.Status> statuses,LocalDateTime time);}
 @Repository public interface Fines extends JpaRepository<Fine,Long>{Page<Fine> findByUserId(Long id,Pageable p);List<Fine> findByUserIdAndStatusOrderByCreatedAtDesc(Long id,Fine.Status s);List<Fine> findByStatus(Fine.Status s);List<Fine> findAllByLoanIdAndTypeOrderByCreatedAtAsc(Long loanId,Fine.Type type);Optional<Fine> findFirstByLoanIdAndType(Long loanId,Fine.Type type);}
 @Repository public interface Notifications extends JpaRepository<Notification,Long>{List<Notification> findTop20ByUserIdOrderByCreatedAtDesc(Long id);List<Notification> findTop20ByUserIdIsNullOrderByCreatedAtDesc();}
 @Repository public interface Settings extends JpaRepository<LibrarySetting,Long>{}
}

