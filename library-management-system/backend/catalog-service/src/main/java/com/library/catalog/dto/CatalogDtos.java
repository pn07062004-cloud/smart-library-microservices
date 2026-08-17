package com.library.catalog.dto;
import jakarta.validation.constraints.*; import java.time.*; import java.util.List; import java.util.Map;
public final class CatalogDtos{private CatalogDtos(){}
 public record BookRequest(@NotBlank String isbn,@NotBlank String title,String description,Integer publicationYear,String language,Integer pageCount,String coverUrl,String shelfLocation,@NotNull Long authorId,@NotNull Long categoryId,Long publisherId,Boolean featured){}
 public record BookResponse(Long id,String isbn,String title,String description,Integer publicationYear,String language,Integer pageCount,String coverUrl,String shelfLocation,Long authorId,String authorName,Long categoryId,String categoryName,Long publisherId,String publisherName,Integer totalCopies,Integer availableCopies,Boolean featured,Double rating,List<CopyResponse> copies,EBookResponse ebook){}
 public record CopyRequest(@NotBlank String barcode,String status,LocalDate acquiredDate,String conditionNote){}
 public record CopyResponse(Long id,String barcode,String status,LocalDate acquiredDate,String conditionNote,Long bookId,String bookTitle){}
 public record NameRequest(@NotBlank String name,String description,String biography,String photoUrl,String address,String website){}
 public record LookupResponse(Long id,String name,String description){}
 public record RatingRequest(@Min(1) @Max(5) int stars,@Size(max=1000) String comment,String userName){}
 public record RatingSummary(double average,long count,Integer myRating,String myComment,Map<Integer,Long> distribution){}
 public record ReviewResponse(Long id,String userName,Integer stars,String comment,LocalDateTime createdAt,boolean mine){}
 public record FavoriteResponse(Long id,Long bookId,String title,String authorName,String categoryName,String coverUrl,Integer availableCopies,LocalDateTime addedAt){}
 public record SearchSuggestion(Long id,String title,String authorName,String categoryName,String coverUrl,Integer availableCopies){}
 public record EBookResponse(Long id,Long bookId,String originalFilename,Long sizeBytes,Boolean publicAccess,LocalDateTime uploadedAt,LocalDateTime updatedAt){}
}
