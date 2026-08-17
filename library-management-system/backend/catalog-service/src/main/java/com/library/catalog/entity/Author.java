package com.library.catalog.entity; import jakarta.persistence.*; import lombok.*;
@Entity @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder public class Author{@Id @GeneratedValue(strategy=GenerationType.IDENTITY)private Long id;@Column(nullable=false,unique=true)private String name;@Column(length=2000)private String biography;private String photoUrl;}

