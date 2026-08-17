package com.library.circulation.controller;

import com.library.circulation.dto.CirculationDtos.*;
import com.library.circulation.entity.*;
import com.library.circulation.repository.CirculationRepositories.*;
import com.library.circulation.service.CirculationService;
import com.library.common.security.JwtAuthenticationFilter;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.*;
import java.util.*;

@RestController
@RequiredArgsConstructor
public class CirculationController {
 private final CirculationService service;
 private final Loans loans;
 private final Reservations reservations;
 private final Fines fines;
 private final Notifications notifications;

 @Value("${internal.api-key}")
 private String internalApiKey;


 @GetMapping("/internal/circulation/loans/active")
 boolean activeLoan(
         @RequestHeader("X-Internal-Key") String providedKey,
         @RequestParam Long userId,
         @RequestParam Long bookId
 ) {
  if (!Objects.equals(internalApiKey, providedKey)) {
   throw new IllegalStateException("Không có quyền gọi API nội bộ");
  }
  return loans.existsByUserIdAndBookIdAndStatusIn(
          userId,
          bookId,
          List.of(Loan.Status.BORROWED, Loan.Status.OVERDUE)
  );
 }

 @GetMapping("/internal/circulation/fines/unpaid")
 List<Fine> unpaidFines(
         @RequestHeader("X-Internal-Key") String providedKey,
         @RequestParam Long userId
 ) {
  if (!Objects.equals(internalApiKey, providedKey)) {
   throw new IllegalStateException("Không có quyền gọi API nội bộ");
  }
  service.refreshOverdueLoans();
  return fines.findByUserIdAndStatusOrderByCreatedAtDesc(userId, Fine.Status.UNPAID);
 }

 @PatchMapping("/internal/circulation/fines/{id}/paid")
 Fine markFinePaid(
         @RequestHeader("X-Internal-Key") String providedKey,
         @PathVariable Long id
 ) {
  if (!Objects.equals(internalApiKey, providedKey)) {
   throw new IllegalStateException("Không có quyền gọi API nội bộ");
  }

  Fine fine = fines.findById(id)
          .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy khoản phạt"));

  if (fine.getStatus() == Fine.Status.PAID) {
   return fine;
  }

  fine.setStatus(Fine.Status.PAID);
  fine.setPaidAt(LocalDateTime.now());
  return fines.save(fine);
 }
 @GetMapping("/api/loans")
 @PreAuthorize("hasAnyRole('ADMIN','LIBRARIAN')")
 Page<Loan> loans(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
  service.refreshOverdueLoans();
  return loans.findAll(PageRequest.of(page, size, Sort.by("createdAt").descending()));
 }

 @GetMapping("/api/loans/me")
 Page<Loan> myLoans(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
  service.refreshOverdueLoans();
  return loans.findByUserId(JwtAuthenticationFilter.currentUserId(), PageRequest.of(page, size, Sort.by("createdAt").descending()));
 }

 @PostMapping("/api/loans")
 @PreAuthorize("hasAnyRole('ADMIN','LIBRARIAN')")
 Loan checkout(@Valid @RequestBody CheckoutRequest r) {
  return service.checkout(r);
 }


 @PostMapping("/api/qr/borrow-return")
 @PreAuthorize("hasAnyRole('ADMIN','LIBRARIAN')")
 QrBorrowReturnResponse qrBorrowReturn(@Valid @RequestBody QrBorrowReturnRequest request) {
  return service.processQrBorrowReturn(request);
 }
 @PostMapping("/api/loans/{id}/return")
 @PreAuthorize("hasAnyRole('ADMIN','LIBRARIAN')")
 Loan returned(@PathVariable Long id, @RequestBody ReturnRequest r) {
  return service.returnBook(id, r);
 }

 @PostMapping("/api/loans/{id}/renew")
 Loan renew(@PathVariable Long id) {
  service.refreshOverdueLoans();
  Loan l = service.getLoan(id);
  if (!isStaff() && !l.getUserId().equals(JwtAuthenticationFilter.currentUserId())) throw new IllegalStateException("Không có quyền");
  return service.renew(id);
 }

 @GetMapping("/api/reservations")
 @PreAuthorize("hasAnyRole('ADMIN','LIBRARIAN')")
 Page<Reservation> reservations(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
  return reservations.findAll(PageRequest.of(page, size, Sort.by("reservedAt").descending()));
 }

 @GetMapping("/api/reservations/me")
 Page<Reservation> myReservations(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
  return reservations.findByUserId(JwtAuthenticationFilter.currentUserId(), PageRequest.of(page, size, Sort.by("reservedAt").descending()));
 }

 @PostMapping("/api/reservations")
 Reservation reserve(@Valid @RequestBody ReservationRequest r) {
  return service.reserve(JwtAuthenticationFilter.currentUserId(), new ReservationRequest(r.bookId(), r.bookTitle(), JwtAuthenticationFilter.currentUserName()));
 }

 @PatchMapping("/api/reservations/{id}")
 Reservation reservationStatus(@PathVariable Long id, @RequestParam Reservation.Status status) {
  Reservation r = reservations.findById(id).orElseThrow();
  if (status == Reservation.Status.CANCELLED && r.getUserId().equals(JwtAuthenticationFilter.currentUserId())) return service.reservationStatus(id, status);
  if (!isStaff()) throw new IllegalStateException("Không có quyền");
  return service.reservationStatus(id, status);
 }

 @PostMapping("/api/reservations/{id}/checkout")
 @PreAuthorize("hasAnyRole('ADMIN','LIBRARIAN')")
 Loan checkoutReservation(@PathVariable Long id, @Valid @RequestBody ReservationFulfillRequest r) {
  return service.fulfillReservation(id, r);
 }

 @GetMapping("/api/fines")
 @PreAuthorize("hasAnyRole('ADMIN','LIBRARIAN')")
 Page<Fine> fines(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
  service.refreshOverdueLoans();
  return fines.findAll(PageRequest.of(page, size, Sort.by("createdAt").descending()));
 }

 @GetMapping("/api/fines/me")
 Page<Fine> myFines(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
  service.refreshOverdueLoans();
  return fines.findByUserId(JwtAuthenticationFilter.currentUserId(), PageRequest.of(page, size, Sort.by("createdAt").descending()));
 }

 @PatchMapping("/api/fines/{id}")
 @PreAuthorize("hasAnyRole('ADMIN','LIBRARIAN')")
 Fine fineStatus(@PathVariable Long id, @RequestParam Fine.Status status) {
  return service.fineStatus(id, status);
 }

 @GetMapping("/api/dashboard")
 @PreAuthorize("hasAnyRole('ADMIN','LIBRARIAN')")
 DashboardResponse dashboard() {
  return service.dashboard();
 }

 @GetMapping("/api/dashboard/stats")
 @PreAuthorize("hasAnyRole('ADMIN','LIBRARIAN')")
 StatsResponse stats() {
  return service.stats();
 }

 @GetMapping("/api/dashboard/notifications")
 List<Notification> notifications() {
  service.refreshOverdueLoans();
  return isStaff()
          ? notifications.findTop20ByUserIdIsNullOrderByCreatedAtDesc()
          : notifications.findTop20ByUserIdOrderByCreatedAtDesc(JwtAuthenticationFilter.currentUserId());
 }

 @PatchMapping("/api/dashboard/notifications/{id}/read")
 void read(@PathVariable Long id) {
  Notification n = notifications.findById(id).orElseThrow();
  if (n.getUserId() == null) {
   if (!isStaff()) throw new IllegalStateException("Không có quyền");
  } else if (!n.getUserId().equals(JwtAuthenticationFilter.currentUserId())) {
   throw new IllegalStateException("Không có quyền");
  }
  n.setIsRead(true);
  notifications.save(n);
 }

 private boolean isStaff() {
  return SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
          .anyMatch(x -> x.getAuthority().matches("ROLE_(ADMIN|LIBRARIAN)"));
 }
}