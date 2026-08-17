package com.library.circulation.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;

public final class CirculationDtos {
    private CirculationDtos() {}

    public record CheckoutRequest(@NotNull Long userId, @NotBlank String userName, String memberCode, @NotNull Long bookId, @NotNull Long copyId, @NotBlank String bookTitle, @NotBlank String barcode, @Min(1) @Max(90) Integer loanDays, String issuedBy) {}
    public record ReturnRequest(String condition, String note) {}
    public record ReservationRequest(@NotNull Long bookId, @NotBlank String bookTitle, String userName) {}
    public record ReservationFulfillRequest(@NotNull Long copyId, @Min(1) @Max(90) Integer loanDays, String memberCode, String issuedBy) {}
    public record QrBorrowReturnRequest(@NotNull Long copyId, @NotNull Long userId) {}
    public record QrBorrowReturnResponse(String action, Long loanId, Long copyId, Long userId, String bookTitle, String userName, String message, LocalDate dueDate, LocalDate returnedDate) {}
    public record DashboardResponse(long totalLoans, long activeLoans, long overdueLoans, long returnedLoans, long reservations, long unpaidFines, long unpaidAmount) {}
    public record SettingsRequest(@NotBlank String libraryName, @Email String email, String phone, String address, String openingHours, @NotNull @Min(1) @Max(90) Integer defaultLoanDays, @NotNull @Min(1) @Max(30) Integer renewalDays, @NotNull @Min(0) @Max(10) Integer maxRenewals, @NotNull @Min(0) Long overdueFinePerDay, @NotNull @Min(0) Long damagedFine, @NotNull @Min(0) Long lostFine) {}
    public record DailyLoanPoint(String date, long borrowed, long returned) {}
    public record MonthlyLoanPoint(String month, long borrowed, long returned, long overdue) {}
    public record StatsResponse(
            DashboardResponse summary,
            List<DailyLoanPoint> last30Days,
            List<MonthlyLoanPoint> last12Months,
            List<TopBookEntry> topBorrowedBooks,
            long newLoansToday,
            long newLoanThisWeek,
            long newLoanThisMonth
    ) {}
    public record TopBookEntry(Long bookId, String bookTitle, long count) {}
}