package com.library.catalog.entity; import jakarta.persistence.*; import lombok.*;
@Entity @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder public class Publisher{@Id @GeneratedValue(strategy=GenerationType.IDENTITY)private Long id;@Column(nullable=false,unique=true)private String name;private String address;private String website;}

