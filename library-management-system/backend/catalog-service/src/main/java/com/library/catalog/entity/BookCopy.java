package com.library.catalog.entity; import jakarta.persistence.*; import lombok.*; import java.time.LocalDate;
@Entity @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder @Table(uniqueConstraints=@UniqueConstraint(columnNames="barcode"))
public class BookCopy{public enum Status{AVAILABLE,BORROWED,RESERVED,LOST,DAMAGED,MAINTENANCE}@Id @GeneratedValue(strategy=GenerationType.IDENTITY)private Long id;@Column(nullable=false)private String barcode;@ManyToOne(optional=false)private Book book;@Enumerated(EnumType.STRING)@Column(nullable=false)private Status status;private LocalDate acquiredDate;private String conditionNote;}

