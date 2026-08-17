package com.library.circulation.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.*;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LibrarySetting {
    @Id
    private Long id;
    private String libraryName;
    private String email;
    private String phone;
    private String address;
    private String openingHours;
    private Integer defaultLoanDays;
    private Integer renewalDays;
    private Integer maxRenewals;
    private Long overdueFinePerDay;
    private Long damagedFine;
    private Long lostFine;
}
