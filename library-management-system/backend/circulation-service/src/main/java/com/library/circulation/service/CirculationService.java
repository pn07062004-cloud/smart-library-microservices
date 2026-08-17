package com.library.circulation.service;

import com.library.circulation.dto.CirculationDtos.*;
import com.library.circulation.entity.*;
import com.library.circulation.repository.CirculationRepositories.*;
import com.library.common.security.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional
public class CirculationService {
 private final Loans loans;
 private final Reservations reservations;
 private final Fines fines;
 private final Notifications notifications;
 private final Settings settings;
 private final RestClient catalogClient;

 @Value("${auth.base-url}")
 private String authBaseUrl;

 @Value("${internal.api-key}")
 private String internalApiKey;

 private record CatalogCopy(Long id, String barcode, String status, LocalDate acquiredDate, String conditionNote, Long bookId, String bookTitle) {}
 private record CatalogBook(Long id, String title, Integer availableCopies) {}
 private record AuthUser(Long id, String fullName, String email, String phone, String address, String role, String status, String memberCode, String avatarUrl, LocalDateTime createdAt) {}


 public QrBorrowReturnResponse processQrBorrowReturn(QrBorrowReturnRequest request) {
  if (request.copyId() == null || request.copyId() <= 0 || request.userId() == null || request.userId() <= 0) {
   throw new IllegalArgumentException("Mã QR không hợp lệ");
  }

  serviceRefreshForQr();
  AuthUser user = authUser(request.userId());
  validateQrUser(user);
  CatalogCopy copy = catalogCopy(request.copyId());

  Optional<Loan> activeLoan = loans.findFirstByCopyIdAndStatusInOrderByCreatedAtDesc(
          copy.id(),
          List.of(Loan.Status.BORROWED, Loan.Status.OVERDUE)
  );

  if (activeLoan.isEmpty()) {
   if (!"AVAILABLE".equals(copy.status())) {
    throw new IllegalStateException("Bản sách không sẵn sàng để mượn");
   }

   Loan loan = checkout(new CheckoutRequest(
           user.id(),
           user.fullName(),
           user.memberCode(),
           copy.bookId(),
           copy.id(),
           copy.bookTitle(),
           copy.barcode(),
           null,
           JwtAuthenticationFilter.currentUserName()
   ));

   return new QrBorrowReturnResponse(
           "BORROW",
           loan.getId(),
           loan.getCopyId(),
           loan.getUserId(),
           loan.getBookTitle(),
           loan.getUserName(),
           "Mượn sách thành công. Hạn trả: " + loan.getDueDate(),
           loan.getDueDate(),
           null
   );
  }

  Loan loan = activeLoan.get();
  if (!Objects.equals(loan.getUserId(), user.id())) {
   throw new IllegalStateException("Bản sách này đang được mượn bởi độc giả khác");
  }

  Loan returned = returnBook(loan.getId(), new ReturnRequest("GOOD", "Trả nhanh qua mã QR"));
  return new QrBorrowReturnResponse(
          "RETURN",
          returned.getId(),
          returned.getCopyId(),
          returned.getUserId(),
          returned.getBookTitle(),
          returned.getUserName(),
          "Trả sách thành công.",
          returned.getDueDate(),
          returned.getReturnedDate()
  );
 }
 public Loan checkout(CheckoutRequest request) {
  LibrarySetting policy = getSettings();
  CatalogCopy copy = catalogCopy(request.copyId());
  if (!Objects.equals(copy.bookId(), request.bookId())) {
   throw new IllegalArgumentException("Ban sach khong thuoc dung sach da chon");
  }
  if (!"AVAILABLE".equals(copy.status())) {
   throw new IllegalStateException("Ban sach khong san sang de muon");
  }

  if (loans.existsByCopyIdAndStatusIn(
          request.copyId(),
          List.of(Loan.Status.BORROWED, Loan.Status.OVERDUE)
  )) {
   throw new IllegalStateException("Bản sách này đang được mượn");
  }

  catalogClient.post()
          .uri("/internal/catalog/copies/{id}/borrow", request.copyId())
          .retrieve()
          .toBodilessEntity();

  try {
   LocalDate today = LocalDate.now();
   int loanDays = request.loanDays() == null
           ? policy.getDefaultLoanDays()
           : request.loanDays();

   Loan loan = loans.save(Loan.builder()
           .userId(request.userId())
           .userName(request.userName())
           .memberCode(request.memberCode())
           .bookId(copy.bookId())
           .copyId(copy.id())
           .bookTitle(copy.bookTitle())
           .barcode(copy.barcode())
           .borrowedDate(today)
           .dueDate(today.plusDays(loanDays))
           .status(Loan.Status.BORROWED)
           .issuedBy(request.issuedBy())
           .build());

   notify(
           request.userId(),
           "Mượn sách thành công",
           "Bạn đã mượn “" + copy.bookTitle() + "”, hạn trả " +
                   loan.getDueDate() + "."
   );

   return loan;
  } catch (RuntimeException exception) {
   restoreCopyStatus(request.copyId(), "AVAILABLE");
   throw exception;
  }
 }

 public Loan returnBook(Long id, ReturnRequest request) {
  LibrarySetting policy = getSettings();
  Loan loan = getLoan(id);
  ReturnRequest safeRequest = request == null ? new ReturnRequest(null, null) : request;

  if (loan.getStatus() == Loan.Status.RETURNED || loan.getStatus() == Loan.Status.LOST) {
   throw new IllegalStateException("Sách đã được trả");
  }

  CatalogCopy currentCopy = resolveLoanCopy(loan);

  loan.setCopyId(currentCopy.id());
  loan.setBookId(currentCopy.bookId());
  loan.setBarcode(currentCopy.barcode());

  loan.setReturnedDate(LocalDate.now());
  loan.setStatus(Loan.Status.RETURNED);
  loan.setReturnNote(safeRequest.note());

  long lateDays = Math.max(
          0,
          ChronoUnit.DAYS.between(loan.getDueDate(), LocalDate.now())
  );

  if (lateDays > 0) {
   syncOverdueFine(
           loan,
           lateDays,
           policy
   );
  }

  String condition = safeRequest.condition() == null
          ? "GOOD"
          : safeRequest.condition();

  if ("DAMAGED".equals(condition)) {
   addFine(
           loan,
           Fine.Type.DAMAGED,
           policy.getDamagedFine(),
           "Sách hư hỏng"
   );
  }

  if ("LOST".equals(condition)) {
   loan.setStatus(Loan.Status.LOST);
   addFine(
           loan,
           Fine.Type.LOST,
           policy.getLostFine(),
           "Làm mất sách"
   );
  }

  String copyTargetStatus = "LOST".equals(condition)
          ? "LOST"
          : "DAMAGED".equals(condition) ? "DAMAGED" : "AVAILABLE";

  catalogClient.post()
          .uri(uriBuilder -> uriBuilder
                  .path("/internal/catalog/copies/{id}/return")
                  .queryParam("status", copyTargetStatus)
                  .build(currentCopy.id()))
          .retrieve()
          .toBodilessEntity();

  notify(
          loan.getUserId(),
          "Đã trả sách",
          "Đã ghi nhận trả “" + loan.getBookTitle() + "”."
  );

  if (copyTargetStatus.equals("AVAILABLE")) {
   activateNextReservation(currentCopy.bookId());
  }

  return loan;
 }

 public Loan renew(Long id) {
  LibrarySetting policy = getSettings();
  Loan loan = getLoan(id);

  if (loan.getStatus() != Loan.Status.BORROWED) {
   throw new IllegalStateException("Không thể gia hạn phiếu này");
  }

  if (loan.getRenewalCount() >= policy.getMaxRenewals()) {
   throw new IllegalStateException(
           "Chỉ được gia hạn tối đa " + policy.getMaxRenewals() + " lần"
   );
  }

  if (reservations.countByBookIdAndStatus(
          loan.getBookId(),
          Reservation.Status.WAITING
  ) > 0) {
   throw new IllegalStateException("Sách đang có người đặt trước");
  }

  loan.setDueDate(loan.getDueDate().plusDays(policy.getRenewalDays()));
  loan.setRenewalCount(loan.getRenewalCount() + 1);

  notify(
          loan.getUserId(),
          "Gia hạn thành công",
          "Hạn trả mới của “" + loan.getBookTitle() + "” là " +
                  loan.getDueDate() + "."
  );

  return loan;
 }

 public Reservation reserve(Long userId, ReservationRequest request) {
  if (reservations.existsByUserIdAndBookIdAndStatusIn(
          userId,
          request.bookId(),
          List.of(Reservation.Status.WAITING, Reservation.Status.READY)
  )) {
   throw new IllegalStateException("Bạn đã có lượt đặt sách này đang chờ xử lý");
  }

  CatalogBook book = catalogBook(request.bookId());
  boolean readyNow = book.availableCopies() != null && book.availableCopies() > 0;
  long position = readyNow ? 1 : reservations.countByBookIdAndStatus(
          request.bookId(),
          Reservation.Status.WAITING
  ) + 1;

  Reservation reservation = reservations.save(Reservation.builder()
          .userId(userId)
          .userName(request.userName())
          .bookId(request.bookId())
          .bookTitle(book.title() == null || book.title().isBlank() ? request.bookTitle() : book.title())
          .status(readyNow ? Reservation.Status.READY : Reservation.Status.WAITING)
          .queuePosition((int) position)
          .expiresAt(LocalDateTime.now().plusDays(readyNow ? 2 : 7))
          .build());

  notify(
          userId,
          readyNow ? "Sách đã sẵn sàng" : "Đặt trước thành công",
          readyNow
                  ? "“" + reservation.getBookTitle() + "” đang chờ bạn nhận tại quầy trong 48 giờ."
                  : "Bạn đang ở vị trí #" + reservation.getQueuePosition() + " trong hàng chờ “" + reservation.getBookTitle() + "”."
  );

  return reservation;
 }

 public Reservation reservationStatus(Long id, Reservation.Status status) {
  Reservation reservation = reservations.findById(id)
          .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy lượt đặt"));

  reservation.setStatus(status);

  if (status == Reservation.Status.READY) {
   reservation.setExpiresAt(LocalDateTime.now().plusDays(2));
   notify(
           reservation.getUserId(),
           "Sách đã sẵn sàng",
           "“" + reservation.getBookTitle() +
                   "” đang chờ bạn nhận tại quầy trong 48 giờ."
   );
  }

  if (status == Reservation.Status.CANCELLED || status == Reservation.Status.EXPIRED || status == Reservation.Status.FULFILLED) {
   normalizeQueuePositions(reservation.getBookId());
  }

  return reservation;
 }

 public Loan fulfillReservation(Long id, ReservationFulfillRequest request) {
  Reservation reservation = reservations.findById(id)
          .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy lượt đặt"));
  if (reservation.getStatus() != Reservation.Status.READY) {
   throw new IllegalStateException("Chỉ có thể cho mượn lượt đặt đã sẵn sàng");
  }

  Loan loan = checkout(new CheckoutRequest(
          reservation.getUserId(),
          reservation.getUserName(),
          request.memberCode(),
          reservation.getBookId(),
          request.copyId(),
          reservation.getBookTitle(),
          "RESERVATION-" + reservation.getId(),
          request.loanDays(),
          request.issuedBy()
  ));
  reservation.setStatus(Reservation.Status.FULFILLED);
  normalizeQueuePositions(reservation.getBookId());
  return loan;
 }

 public Fine fineStatus(Long id, Fine.Status status) {
  Fine fine = fines.findById(id)
          .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy khoản phạt"));

  fine.setStatus(status);
  if (status == Fine.Status.PAID) {
   fine.setPaidAt(LocalDateTime.now());
  }
  return fine;
 }

 public LibrarySetting getSettings() {
  return settings.findById(1L).orElseGet(() -> settings.save(
          LibrarySetting.builder()
                  .id(1L)
                  .libraryName("Smart Library")
                  .email("hello@library.vn")
                  .phone("1900 2026")
                  .address("Thư viện trung tâm")
                  .openingHours("07:30–20:00, Thứ Hai–Thứ Bảy")
                  .defaultLoanDays(14)
                  .renewalDays(7)
                  .maxRenewals(2)
                  .overdueFinePerDay(5000L)
                  .damagedFine(50000L)
                  .lostFine(200000L)
                  .build()
  ));
 }

 public LibrarySetting updateSettings(SettingsRequest request) {
  LibrarySetting setting = getSettings();
  setting.setLibraryName(request.libraryName());
  setting.setEmail(request.email());
  setting.setPhone(request.phone());
  setting.setAddress(request.address());
  setting.setOpeningHours(request.openingHours());
  setting.setDefaultLoanDays(request.defaultLoanDays());
  setting.setRenewalDays(request.renewalDays());
  setting.setMaxRenewals(request.maxRenewals());
  setting.setOverdueFinePerDay(request.overdueFinePerDay());
  setting.setDamagedFine(request.damagedFine());
  setting.setLostFine(request.lostFine());
  return settings.save(setting);
 }

 private void addFine(Loan loan, Fine.Type type, long amount, String reason) {
  fines.save(Fine.builder()
          .loanId(loan.getId())
          .userId(loan.getUserId())
          .userName(loan.getUserName())
          .bookTitle(loan.getBookTitle())
          .type(type)
          .amount(amount)
          .reason(reason)
          .status(Fine.Status.UNPAID)
          .build());
 }

 private RestClient authClient() {
  return RestClient.builder()
          .baseUrl(authBaseUrl)
          .defaultHeader("X-Internal-Key", internalApiKey)
          .build();
 }

 private AuthUser authUser(Long userId) {
  AuthUser user = authClient().get()
          .uri("/internal/auth/users/{id}", userId)
          .retrieve()
          .body(AuthUser.class);

  if (user == null) {
   throw new IllegalArgumentException("Không tìm thấy độc giả");
  }

  return user;
 }

 private void validateQrUser(AuthUser user) {
  if (!"ACTIVE".equals(user.status())) {
   throw new IllegalStateException("Tài khoản độc giả đang bị khóa");
  }

  if (!fines.findByUserIdAndStatusOrderByCreatedAtDesc(user.id(), Fine.Status.UNPAID).isEmpty()) {
   throw new IllegalStateException("Độc giả còn khoản phạt chưa thanh toán");
  }
 }

 private void serviceRefreshForQr() {
  refreshOverdueLoans();
 }
 private CatalogCopy catalogCopy(Long copyId) {
  CatalogCopy copy = catalogClient.get()
          .uri("/internal/catalog/copies/{id}", copyId)
          .retrieve()
          .body(CatalogCopy.class);

  if (copy == null) {
   throw new IllegalArgumentException("Không tìm thấy bản sách");
  }

  return copy;
 }

 private CatalogCopy catalogCopyByBarcode(String barcode) {
  CatalogCopy copy = catalogClient.get()
          .uri(
                  "/internal/catalog/copies/by-barcode/{barcode}",
                  barcode
          )
          .retrieve()
          .body(CatalogCopy.class);

  if (copy == null) {
   throw new IllegalArgumentException("Không tìm thấy bản sách");
  }

  return copy;
 }

 private CatalogCopy resolveLoanCopy(Loan loan) {
  return catalogCopy(loan.getCopyId());
 }

 private CatalogBook catalogBook(Long bookId) {
  CatalogBook book = catalogClient.get()
          .uri("/api/books/{id}", bookId)
          .retrieve()
          .body(CatalogBook.class);
  if (book == null) {
   throw new IllegalArgumentException("Không tìm thấy sách");
  }
  return book;
 }

 private void restoreCopyStatus(Long copyId, String status) {
  try {
   catalogClient.post()
           .uri(uriBuilder -> uriBuilder
                   .path("/internal/catalog/copies/{id}/return")
                   .queryParam("status", status)
                   .build(copyId))
           .retrieve()
           .toBodilessEntity();
  } catch (RuntimeException ignored) {
  }
 }

 private void syncOverdueFine(Loan loan, long lateDays, LibrarySetting policy) {
  long amount = Math.max(0, lateDays) * policy.getOverdueFinePerDay();
  List<Fine> overdueFines = new java.util.ArrayList<>(
          fines.findAllByLoanIdAndTypeOrderByCreatedAtAsc(loan.getId(), Fine.Type.OVERDUE)
  );

  Fine fine = overdueFines.isEmpty()
          ? Fine.builder()
            .loanId(loan.getId())
            .userId(loan.getUserId())
            .userName(loan.getUserName())
            .bookTitle(loan.getBookTitle())
            .type(Fine.Type.OVERDUE)
            .status(Fine.Status.UNPAID)
            .build()
          : overdueFines.get(0);

  if (overdueFines.size() > 1) {
   fines.deleteAll(overdueFines.subList(1, overdueFines.size()));
  }

  if (fine.getStatus() == Fine.Status.PAID || fine.getStatus() == Fine.Status.WAIVED) {
   return;
  }

  fine.setLoanId(loan.getId());
  fine.setUserId(loan.getUserId());
  fine.setUserName(loan.getUserName());
  fine.setBookTitle(loan.getBookTitle());
  fine.setType(Fine.Type.OVERDUE);
  fine.setAmount(amount);
  fine.setReason("Quá hạn " + lateDays + " ngày");
  fine.setStatus(Fine.Status.UNPAID);
  fines.save(fine);
 }
 private void notify(Long userId, String title, String message) {
  notifications.save(Notification.builder()
          .userId(userId)
          .title(title)
          .message(message)
          .build());
 }

 private void notifyStaff(String title, String message) {
  notifications.save(Notification.builder()
          .userId(null)
          .title(title)
          .message(message)
          .build());
 }

 public Loan getLoan(Long id) {
  return loans.findById(id)
          .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy phiếu mượn"));
 }

 public DashboardResponse dashboard() {
  refreshOverdueLoans();
  List<Loan> allLoans = loans.findAll();
  List<Fine> unpaid = fines.findByStatus(Fine.Status.UNPAID);

  return new DashboardResponse(
          allLoans.size(),
          allLoans.stream().filter(item -> item.getStatus() == Loan.Status.BORROWED).count(),
          allLoans.stream().filter(item -> item.getStatus() == Loan.Status.OVERDUE).count(),
          allLoans.stream().filter(item -> item.getStatus() == Loan.Status.RETURNED).count(),
          reservations.count(),
          unpaid.size(),
          unpaid.stream().mapToLong(Fine::getAmount).sum()
  );
 }

 public StatsResponse stats() {
  refreshOverdueLoans();
  LocalDate today = LocalDate.now();

  // --- last 30 days daily data ---
  LocalDate from30 = today.minusDays(29);
  List<Loan> recent = loans.findByBorrowedDateBetween(from30, today);
  // also get returned within same window
  List<Loan> recentAll = loans.findSince(from30);

  List<DailyLoanPoint> last30Days = new java.util.ArrayList<>();
  for (int i = 29; i >= 0; i--) {
   LocalDate day = today.minusDays(i);
   String label = day.getMonthValue() + "/" + day.getDayOfMonth();
   final LocalDate d = day;
   long borrowed = recentAll.stream().filter(l -> d.equals(l.getBorrowedDate())).count();
   long returned = recentAll.stream().filter(l -> d.equals(l.getReturnedDate())).count();
   last30Days.add(new DailyLoanPoint(label, borrowed, returned));
  }

  // --- last 12 months ---
  List<MonthlyLoanPoint> last12Months = new java.util.ArrayList<>();
  for (int i = 11; i >= 0; i--) {
   LocalDate month = today.minusMonths(i).withDayOfMonth(1);
   LocalDate monthEnd = month.plusMonths(1).minusDays(1);
   String label = month.getYear() + "/" + String.format("%02d", month.getMonthValue());
   List<Loan> monthLoans = loans.findByBorrowedDateBetween(month, monthEnd);
   long borrowed = monthLoans.size();
   long returned = monthLoans.stream().filter(l -> l.getReturnedDate() != null).count();
   long overdue = monthLoans.stream().filter(l -> l.getStatus() == Loan.Status.OVERDUE).count();
   last12Months.add(new MonthlyLoanPoint(label, borrowed, returned, overdue));
  }

  // --- top 5 borrowed books ---
  List<Object[]> raw = loans.findTopBorrowedBooks(PageRequest.of(0, 5));
  List<TopBookEntry> top = raw.stream()
          .map(r -> new TopBookEntry((Long) r[0], (String) r[1], (Long) r[2]))
          .toList();

  // --- quick counts ---
  long newToday = loans.findByBorrowedDateBetween(today, today).size();
  LocalDate weekStart = today.minusDays(6);
  long newWeek = loans.findByBorrowedDateBetween(weekStart, today).size();
  LocalDate monthStart = today.withDayOfMonth(1);
  long newMonth = loans.findByBorrowedDateBetween(monthStart, today).size();

  return new StatsResponse(dashboard(), last30Days, last12Months, top, newToday, newWeek, newMonth);
 }

 private void activateNextReservation(Long bookId) {
  List<Reservation> waiting = reservations.findByBookIdAndStatusOrderByReservedAtAsc(
          bookId,
          Reservation.Status.WAITING
  );
  if (waiting.isEmpty()) return;

  Reservation next = waiting.get(0);
  next.setStatus(Reservation.Status.READY);
  next.setQueuePosition(1);
  next.setExpiresAt(LocalDateTime.now().plusDays(2));
  notify(
          next.getUserId(),
          "Sách đã sẵn sàng",
          "“" + next.getBookTitle() + "” vừa có bản trả về và đang chờ bạn nhận tại quầy trong 48 giờ."
  );
  normalizeQueuePositions(bookId);
 }

 private void normalizeQueuePositions(Long bookId) {
  List<Reservation> waiting = reservations.findByBookIdAndStatusOrderByReservedAtAsc(
          bookId,
          Reservation.Status.WAITING
  );
  for (int index = 0; index < waiting.size(); index++) {
   waiting.get(index).setQueuePosition(index + 1);
  }
 }

 @Scheduled(cron = "0 10 0 * * *")
 public void expireReservations() {
  List<Reservation> expired = reservations.findByStatusInAndExpiresAtBefore(
          List.of(Reservation.Status.WAITING, Reservation.Status.READY),
          LocalDateTime.now()
  );
  for (Reservation reservation : expired) {
   reservation.setStatus(Reservation.Status.EXPIRED);
   notify(
           reservation.getUserId(),
           "Lượt đặt đã hết hạn",
           "Lượt đặt “" + reservation.getBookTitle() + "” đã hết hạn. Bạn có thể đặt lại nếu vẫn cần sách."
   );
   normalizeQueuePositions(reservation.getBookId());
  }
 }

 public synchronized int refreshOverdueLoans() {
  int changed = 0;
  LocalDate today = LocalDate.now();
  LibrarySetting policy = getSettings();

  for (Loan loan : loans.findByStatusIn(List.of(Loan.Status.BORROWED, Loan.Status.OVERDUE))) {
   if (loan.getDueDate() != null && loan.getDueDate().isBefore(today)) {
    long lateDays = ChronoUnit.DAYS.between(loan.getDueDate(), today);
    syncOverdueFine(loan, lateDays, policy);

    if (loan.getStatus() == Loan.Status.BORROWED) {
     loan.setStatus(Loan.Status.OVERDUE);
     changed++;
     notify(
             loan.getUserId(),
             "Sách đã quá hạn",
             "Phiếu mượn “" + loan.getBookTitle() + "” đã quá hạn " + lateDays + " ngày. Vui lòng trả sách sớm nhất có thể."
     );
     notifyStaff(
             "Phiếu mượn quá hạn",
             loan.getUserName() + " (" + loan.getMemberCode() + ") quá hạn “" + loan.getBookTitle() + "” từ ngày " + loan.getDueDate() + "."
     );
    }
   }
  }

  return changed;
 }

 @Scheduled(cron = "0 5 0 * * *")
 public void updateOverdue() {
  refreshOverdueLoans();
 }
}


