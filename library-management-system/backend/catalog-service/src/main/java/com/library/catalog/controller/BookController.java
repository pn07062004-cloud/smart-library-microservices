package com.library.catalog.controller;

import com.library.catalog.dto.CatalogDtos.*;
import com.library.catalog.entity.BookCopy;
import com.library.catalog.service.CatalogService;
import com.library.common.security.JwtAuthenticationFilter;
import com.library.common.qr.QrCodeUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class BookController {

 private final CatalogService service;

 @GetMapping("/api/books")
 Page<BookResponse> all(
         @RequestParam(required = false) String q,
         @RequestParam(required = false) Long categoryId,
         @RequestParam(required = false) Boolean available,
         @RequestParam(defaultValue = "0") int page,
         @RequestParam(defaultValue = "12") int size,
         @RequestParam(defaultValue = "createdAt,desc") String sort
 ) {
  String[] sortParts = sort.split(",");
  Sort.Direction direction = sortParts.length > 1 &&
          sortParts[1].equalsIgnoreCase("asc")
          ? Sort.Direction.ASC
          : Sort.Direction.DESC;

  return service.search(
          q,
          categoryId,
          available,
          PageRequest.of(page, size, Sort.by(direction, sortParts[0]))
  );
 }

 @GetMapping("/api/books/featured")
 List<BookResponse> featured(@RequestParam(defaultValue = "8") int limit) {
  return service.featured(limit);
 }
 @GetMapping("/api/books/suggestions")
 List<SearchSuggestion> suggestions(
         @RequestParam(required = false) String q,
         @RequestParam(defaultValue = "6") int limit
 ) {
  return service.suggestions(q, limit);
 }
 @GetMapping("/api/books/{id}/ebook")
 @PreAuthorize("isAuthenticated()")
 EBookResponse ebook(@PathVariable Long id) {
  return service.ebookInfo(id);
 }

 @PostMapping(value = "/api/books/{id}/ebook", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
 @PreAuthorize("hasAnyRole('ADMIN','LIBRARIAN')")
 EBookResponse uploadEBook(
         @PathVariable Long id,
         @RequestPart("file") MultipartFile file,
         @RequestParam(defaultValue = "false") boolean publicAccess
 ) {
  return service.uploadEBook(id, file, publicAccess);
 }

 @PutMapping(value = "/api/books/{id}/ebook", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
 @PreAuthorize("hasAnyRole('ADMIN','LIBRARIAN')")
 EBookResponse replaceEBook(
         @PathVariable Long id,
         @RequestPart("file") MultipartFile file,
         @RequestParam(defaultValue = "false") boolean publicAccess
 ) {
  return service.uploadEBook(id, file, publicAccess);
 }


 @RequestMapping(value = "/api/books/{id}/ebook/access", method = { RequestMethod.POST, RequestMethod.PUT, RequestMethod.PATCH })
 @PreAuthorize("hasAnyRole('ADMIN','LIBRARIAN')")
 EBookResponse updateEBookAccess(
         @PathVariable Long id,
         @RequestParam(defaultValue = "false") boolean publicAccess
 ) {
  return service.updateEBookAccess(id, publicAccess);
 }

 @DeleteMapping("/api/books/{id}/ebook")
 @PreAuthorize("hasAnyRole('ADMIN','LIBRARIAN')")
 void deleteEBook(@PathVariable Long id) {
  service.deleteEBook(id);
 }

 @GetMapping("/api/books/{id}/ebook/read")
 ResponseEntity<Resource> readEBook(@PathVariable Long id) {
  CatalogService.EBookFile file = service.readEBook(
          id,
          JwtAuthenticationFilter.currentUserId(),
          isStaff()
  );

  return ResponseEntity.ok()
          .contentType(MediaType.APPLICATION_PDF)
          .contentLength(file.contentLength())
          .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                  .filename(file.ebook().getOriginalFilename())
                  .build()
                  .toString())
          .header(HttpHeaders.CACHE_CONTROL, "no-store")
          .header("X-Content-Type-Options", "nosniff")
          .body(file.resource());
 }


 @GetMapping("/api/books/{id}/ebook/preview")
 ResponseEntity<Resource> previewEBook(@PathVariable Long id) {
  CatalogService.EBookFile file = service.previewEBook(id);

  return ResponseEntity.ok()
          .contentType(MediaType.APPLICATION_PDF)
          .contentLength(file.contentLength())
          .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                  .filename("preview-" + file.ebook().getOriginalFilename())
                  .build()
                  .toString())
          .header(HttpHeaders.CACHE_CONTROL, "no-store")
          .header("X-Content-Type-Options", "nosniff")
          .body(file.resource());
 }
 @GetMapping("/api/books/{id}")
 BookResponse one(@PathVariable Long id) {
  return service.one(id);
 }

 @GetMapping("/api/books/{id}/rating")
 RatingSummary rating(@PathVariable Long id) {
  return service.getRatingSummary(
          id,
          optionalCurrentUserId()
  );
 }

 @GetMapping("/api/books/{id}/reviews")
 List<ReviewResponse> reviews(@PathVariable Long id) {
  return service.getReviews(id, optionalCurrentUserId());
 }

 @PostMapping("/api/books/{id}/rating")
 @PreAuthorize("isAuthenticated()")
 RatingSummary rate(
         @PathVariable Long id,
         @Valid @RequestBody RatingRequest request
 ) {
  return service.rateBook(
          id,
          JwtAuthenticationFilter.currentUserId(),
          new RatingRequest(request.stars(), request.comment(), JwtAuthenticationFilter.currentUserName())
  );
 }

 @PostMapping("/api/books")
 @PreAuthorize("hasAnyRole('ADMIN','LIBRARIAN')")
 ResponseEntity<BookResponse> add(@Valid @RequestBody BookRequest request) {
  return ResponseEntity.status(201).body(service.save(null, request));
 }

 @PutMapping("/api/books/{id}")
 @PreAuthorize("hasAnyRole('ADMIN','LIBRARIAN')")
 BookResponse edit(
         @PathVariable Long id,
         @Valid @RequestBody BookRequest request
 ) {
  return service.save(id, request);
 }

 @DeleteMapping("/api/books/{id}")
 @PreAuthorize("hasAnyRole('ADMIN','LIBRARIAN')")
 void delete(@PathVariable Long id) {
  service.delete(id);
 }

 @PostMapping("/api/books/{id}/copies")
 @PreAuthorize("hasAnyRole('ADMIN','LIBRARIAN')")
 CopyResponse copy(
         @PathVariable Long id,
         @Valid @RequestBody CopyRequest request
 ) {
  return service.addCopy(id, request);
 }


 @GetMapping("/api/copies/{id}/qr")
 @PreAuthorize("hasAnyRole('ADMIN','LIBRARIAN')")
 ResponseEntity<byte[]> copyQr(@PathVariable Long id) {
  CopyResponse copy = service.copy(id);
  byte[] qr = QrCodeUtils.png(String.valueOf(copy.id()), 320);

  return ResponseEntity.ok()
          .contentType(MediaType.IMAGE_PNG)
          .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                  .filename("book-copy-" + copy.id() + ".png")
                  .build()
                  .toString())
          .header(HttpHeaders.CACHE_CONTROL, "no-store")
          .body(qr);
 }

 @PatchMapping("/api/copies/{id}/status")
 @PreAuthorize("hasAnyRole('ADMIN','LIBRARIAN')")
 CopyResponse status(
         @PathVariable Long id,
         @RequestParam BookCopy.Status status
 ) {
  return service.copyStatus(id, status);
 }

 @DeleteMapping("/api/copies/{id}")
 @PreAuthorize("hasAnyRole('ADMIN','LIBRARIAN')")
 void deleteCopy(@PathVariable Long id) {
  service.deleteCopy(id);
 }

 @GetMapping("/api/favorites")
 @PreAuthorize("isAuthenticated()")
 List<FavoriteResponse> favorites() {
  return service.favorites(JwtAuthenticationFilter.currentUserId());
 }

 @PostMapping("/api/favorites/{bookId}")
 @PreAuthorize("isAuthenticated()")
 FavoriteResponse favorite(@PathVariable Long bookId) {
  return service.addFavorite(JwtAuthenticationFilter.currentUserId(), bookId);
 }

 @DeleteMapping("/api/favorites/{bookId}")
 @PreAuthorize("isAuthenticated()")
 void unfavorite(@PathVariable Long bookId) {
  service.removeFavorite(JwtAuthenticationFilter.currentUserId(), bookId);
 }

 @DeleteMapping("/api/favorites")
 @PreAuthorize("isAuthenticated()")
 void clearFavorites() {
  service.clearFavorites(JwtAuthenticationFilter.currentUserId());
 }

 @PostMapping("/internal/catalog/copies/{id}/borrow")
 CopyResponse borrow(@PathVariable Long id) {
  return service.borrowCopy(id);
 }

 @GetMapping("/internal/catalog/copies/{id}")
 CopyResponse internalCopy(@PathVariable Long id) {
  return service.copy(id);
 }

 @GetMapping("/internal/catalog/copies/by-barcode/{barcode}")
 CopyResponse internalCopyByBarcode(@PathVariable String barcode) {
  return service.copyByBarcode(barcode);
 }

 @PostMapping("/internal/catalog/copies/{id}/return")
 CopyResponse returned(
         @PathVariable Long id,
         @RequestParam(required = false) String status
 ) {
  BookCopy.Status target = status == null
          ? BookCopy.Status.AVAILABLE
          : BookCopy.Status.valueOf(status);
  return service.copyStatus(id, target);
 }


 private boolean isStaff() {
  return SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
          .anyMatch(authority -> authority.getAuthority().matches("ROLE_(ADMIN|LIBRARIAN)"));
 }
 private Long optionalCurrentUserId() {
  try {
   return JwtAuthenticationFilter.currentUserId();
  } catch (RuntimeException ignored) {
   return null;
  }
 }
}




