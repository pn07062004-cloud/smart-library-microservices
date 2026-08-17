package com.library.catalog.service;

import com.library.catalog.dto.CatalogDtos.*;
import com.library.catalog.entity.*;
import com.library.catalog.repository.CatalogRepositories.*;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.Normalizer;
import java.time.LocalDate;
import java.util.*;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Transactional
public class CatalogService {

 private static final Pattern DIACRITICS = Pattern.compile("\\p{M}+");
 private static final long MAX_EBOOK_SIZE = 50L * 1024L * 1024L;
 private static final byte[] PDF_SIGNATURE = new byte[]{37, 80, 68, 70, 45};
 private static final int PREVIEW_PAGE_COUNT = 4;

 private final Books books;
 private final Authors authors;
 private final Categories categories;
 private final Publishers publishers;
 private final Copies copies;
 private final BookRatings ratings;
 private final FavoriteBooks favorites;
 private final EBooks ebooks;
 private final RestClient circulationClient;

 @Value("${ebook.storage-dir}")
 private String ebookStorageDir;

 public Page<BookResponse> search(
         String query,
         Long categoryId,
         Boolean available,
         Pageable pageable
 ) {
  if (query == null || query.isBlank()) {
   Specification<Book> specification = filterSpecification(
           categoryId,
           available
   );
   return books.findAll(specification, pageable).map(this::view);
  }

  String normalizedQuery = normalize(query);
  List<String> expandedQueries = expandQueries(normalizedQuery);

  List<Book> eligibleBooks = books.findAll().stream()
          .filter(book -> categoryId == null ||
                  Objects.equals(book.getCategory().getId(), categoryId))
          .filter(book -> !Boolean.TRUE.equals(available) ||
                  book.getAvailableCopies() > 0)
          .toList();

  List<Book> exactMatches = eligibleBooks.stream()
          .filter(book -> normalize(book.getTitle()).equals(normalizedQuery) ||
                  normalize(book.getIsbn()).equals(normalizedQuery))
          .sorted(Comparator.comparing(Book::getTitle))
          .toList();

  List<Book> matchedBooks = exactMatches.isEmpty()
          ? eligibleBooks.stream()
            .map(book -> new ScoredBook(book, searchScore(book, expandedQueries)))
            .filter(result -> result.score() >= 120)
            .sorted(Comparator
                    .comparingInt(ScoredBook::score)
                    .reversed()
                    .thenComparing(result -> result.book().getTitle()))
            .map(ScoredBook::book)
            .toList()
          : exactMatches;

  int start = Math.min((int) pageable.getOffset(), matchedBooks.size());
  int end = Math.min(start + pageable.getPageSize(), matchedBooks.size());

  List<BookResponse> pageContent = matchedBooks
          .subList(start, end)
          .stream()
          .map(this::view)
          .toList();

  return new PageImpl<>(pageContent, pageable, matchedBooks.size());
 }

 private Specification<Book> filterSpecification(
         Long categoryId,
         Boolean available
 ) {
  return (root, criteriaQuery, criteriaBuilder) -> {
   List<Predicate> predicates = new ArrayList<>();

   if (categoryId != null) {
    predicates.add(criteriaBuilder.equal(
            root.get("category").get("id"),
            categoryId
    ));
   }

   if (Boolean.TRUE.equals(available)) {
    predicates.add(criteriaBuilder.greaterThan(
            root.get("availableCopies"),
            0
    ));
   }

   return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
  };
 }

 private int searchScore(Book book, List<String> normalizedQueries) {
  int bestScore = 0;

  for (String query : normalizedQueries) {
   bestScore = Math.max(bestScore, searchScoreSingle(book, query));
  }

  return bestScore;
 }

 private int searchScoreSingle(Book book, String normalizedQuery) {
  if (normalizedQuery == null || normalizedQuery.isBlank()) return 0;

  String title = normalize(book.getTitle());
  String author = normalize(book.getAuthor().getName());
  String category = normalize(book.getCategory().getName());
  String publisher = book.getPublisher() == null ? "" : normalize(book.getPublisher().getName());
  String isbn = normalize(book.getIsbn());
  String description = normalize(book.getDescription());

  if (title.equals(normalizedQuery)) return 1200;
  if (title.startsWith(normalizedQuery)) return 1050;
  if (title.contains(normalizedQuery)) return 950;
  if (author.equals(normalizedQuery)) return 900;
  if (author.contains(normalizedQuery)) return 820;
  if (isbn.contains(normalizedQuery)) return 780;
  if (category.equals(normalizedQuery)) return 740;
  if (category.contains(normalizedQuery)) return 700;

  String primaryText = String.join(" ", title, author, isbn);
  String secondaryText = String.join(" ", category, publisher);

  String[] queryWords = significantWords(normalizedQuery);
  if (queryWords.length == 0) return 0;

  MatchResult primaryMatch = matchWords(queryWords, primaryText);
  MatchResult secondaryMatch = matchWords(queryWords, secondaryText);
  MatchResult descriptionMatch = matchWords(queryWords, description);

  int primaryWords = primaryMatch.matchedWords();
  int phraseBonus = primaryText.contains(normalizedQuery) ? 180 : 0;

  if (queryWords.length >= 3) {
   double primaryCoverage = primaryWords / (double) queryWords.length;
   if (primaryWords == queryWords.length) {
    return 620 + primaryWords * 70 + primaryMatch.distanceBonus() + phraseBonus;
   }
   if (primaryCoverage >= 0.75 && primaryText.contains(queryWords[0])) {
    return 460 + primaryWords * 58 + primaryMatch.distanceBonus() + phraseBonus;
   }

   double secondaryCoverage = secondaryMatch.matchedWords() / (double) queryWords.length;
   if (secondaryCoverage >= 0.60) {
    return 330 + secondaryMatch.matchedWords() * 36 + secondaryMatch.distanceBonus();
   }

   /*
    * Truy vấn theo nhu cầu thường không chứa tên sách, ví dụ:
    * "sách dễ hiểu về quản lý tài chính cá nhân". Khi ít nhất một nửa số từ
    * quan trọng xuất hiện trong mô tả, vẫn đưa sách vào tập ứng viên RAG.
    */
   int minimumDescriptionWords = Math.max(2, (int) Math.ceil(queryWords.length * 0.5));
   if (descriptionMatch.matchedWords() >= minimumDescriptionWords) {
    return 220 + descriptionMatch.matchedWords() * 30 + descriptionMatch.distanceBonus();
   }
   return 0;
  }

  if (primaryWords == queryWords.length) {
   return 430 + primaryWords * 52 + primaryMatch.distanceBonus() + phraseBonus;
  }

  if (queryWords.length == 1 && queryWords[0].length() >= 3 && primaryWords == 1) {
   return 260 + primaryMatch.distanceBonus();
  }

  if (secondaryMatch.matchedWords() == queryWords.length) {
   return 180 + secondaryMatch.distanceBonus();
  }

  if (descriptionMatch.matchedWords() == queryWords.length) {
   return 130 + descriptionMatch.distanceBonus();
  }

  if (queryWords.length == 1 && queryWords[0].length() >= 4 && descriptionMatch.matchedWords() == 1) {
   return 90 + descriptionMatch.distanceBonus();
  }

  return 0;
 }

 private List<String> expandQueries(String normalizedQuery) {
  String cleaned = cleanNaturalQuery(normalizedQuery);
  List<String> expanded = new ArrayList<>();

  addQuery(expanded, normalizedQuery);
  addQuery(expanded, cleaned);

  // Chỉ mở rộng bằng tên thể loại/từ đồng nghĩa chung. Không gắn truy vấn
  // với tên một cuốn sách cụ thể, nhờ vậy tìm kiếm trực tiếp trên Kho sách
  // vẫn thân thiện nhưng không kéo kết quả sai chủ đề.
  if (containsAny(cleaned, "tre em", "tre con", "nhi dong", "cho be", "cho tre", "thieu nien")) {
   addQuery(expanded, "thieu nhi");
  }
  if (containsAny(cleaned, "lap trinh", "code", "coding", "cntt", "phan mem", "may tinh")) {
   addQuery(expanded, "cong nghe thong tin");
  }
  if (containsAny(cleaned, "ai", "tri tue nhan tao", "machine learning", "hoc may", "deep learning")) {
   addQuery(expanded, "tri tue nhan tao");
  }
  if (containsAny(cleaned, "trinh tham", "tham tu", "pha an", "vu an", "an mang")) {
   addQuery(expanded, "trinh tham");
  }
  if (containsAny(cleaned, "kinh te", "tai chinh", "dau tu", "kinh doanh", "lam giau")) {
   addQuery(expanded, "kinh te tai chinh");
  }
  if (containsAny(cleaned, "tam ly", "hanh vi")) {
   addQuery(expanded, "tam ly hoc");
  }
  if (containsAny(cleaned, "ky nang", "phat trien ban than", "self help", "thoi quen", "giao tiep")) {
   addQuery(expanded, "ky nang song");
  }
  if (containsAny(cleaned, "tieng anh", "anh van", "ngoai ngu", "grammar", "tu vung")) {
   addQuery(expanded, "ngoai ngu");
  }

  return expanded.stream().distinct().toList();
 }

 private void addQuery(List<String> queries, String value) {
  if (value != null && !value.isBlank()) queries.add(value.trim());
 }

 private String cleanNaturalQuery(String normalizedQuery) {
  String cleaned = " " + normalizedQuery + " ";
  String[] phrases = {
          " tim sach ", " tim kiem sach ", " tra cuu sach ", " cho toi ", " cho minh ",
          " minh muon ", " toi muon ", " co sach ", " co cuon ", " co quyen ",
          " nao khong ", " khong ", " trong thu vien ", " giup minh ", " giup toi ",
          " goi y ", " nen doc ", " sach ve ", " sach cua ", " tac gia "
  };

  for (String phrase : phrases) {
   cleaned = cleaned.replace(phrase, " ");
  }

  return cleaned.replaceAll("\\s+", " ").trim();
 }

 private String[] significantWords(String query) {
  return Arrays.stream(query.split("\\s+"))
          .filter(token -> !token.isBlank())
          .filter(token -> !Set.of(
                  "sach", "cuon", "quyen", "tim", "kiem", "tra", "cuu", "toi", "minh", "ban",
                  "muon", "can", "co", "khong", "ko", "k", "cua", "tac", "gia", "ve", "cho",
                  "goi", "y", "nen", "doc", "nao", "trong", "thu", "vien", "giup"
          ).contains(token))
          .filter(token -> token.length() >= 3)
          .toArray(String[]::new);
 }

 private MatchResult matchWords(String[] queryWords, String searchableText) {
  String[] searchableWords = searchableText.split("\\s+");
  int matchedWords = 0;
  int distanceBonus = 0;

  for (String queryWord : queryWords) {
   int bestDistance = Integer.MAX_VALUE;
   boolean wordMatched = false;

   for (String searchableWord : searchableWords) {
    if (searchableWord.isBlank()) continue;

    if (searchableWord.equals(queryWord) || searchableWord.startsWith(queryWord) || queryWord.startsWith(searchableWord)) {
     wordMatched = true;
     bestDistance = 0;
     break;
    }

    if (queryWord.length() >= 4 && searchableWord.contains(queryWord)) {
     wordMatched = true;
     bestDistance = 0;
     break;
    }

    // Chỉ sửa lỗi gõ nhẹ với từ đủ dài. Không cho các từ ngắn như
    // "nang" khớp nhầm "mang" hoặc "chinh" khớp "trinh".
    if (queryWord.length() >= 6 && searchableWord.length() >= 6) {
     int distance = levenshtein(queryWord, searchableWord);
     if (distance <= 1 && distance < bestDistance) {
      wordMatched = true;
      bestDistance = distance;
     }
    }
   }

   if (wordMatched) {
    matchedWords++;
    distanceBonus += Math.max(0, 24 - bestDistance * 7);
   }
  }

  return new MatchResult(matchedWords, distanceBonus);
 }

 private boolean containsAny(String value, String... keys) {
  return Arrays.stream(keys).anyMatch(value::contains);
 }

 private String normalize(String value) {
  if (value == null) return "";

  String normalized = Normalizer.normalize(value, Normalizer.Form.NFD);
  normalized = DIACRITICS.matcher(normalized).replaceAll("");

  return normalized
          .replace('đ', 'd')
          .replace('Đ', 'D')
          .toLowerCase(Locale.ROOT)
          .replaceAll("[^a-z0-9\\s]", " ")
          .replaceAll("\\s+", " ")
          .trim();
 }

 private int levenshtein(String left, String right) {
  int[] previous = new int[right.length() + 1];
  int[] current = new int[right.length() + 1];

  for (int index = 0; index <= right.length(); index++) {
   previous[index] = index;
  }

  for (int leftIndex = 1; leftIndex <= left.length(); leftIndex++) {
   current[0] = leftIndex;

   for (int rightIndex = 1; rightIndex <= right.length(); rightIndex++) {
    int cost = left.charAt(leftIndex - 1) == right.charAt(rightIndex - 1)
            ? 0
            : 1;

    current[rightIndex] = Math.min(
            Math.min(
                    current[rightIndex - 1] + 1,
                    previous[rightIndex] + 1
            ),
            previous[rightIndex - 1] + cost
    );
   }

   int[] temporary = previous;
   previous = current;
   current = temporary;
  }

  return previous[right.length()];
 }

 public List<BookResponse> featured(int limit) {
  int safeLimit = Math.max(1, Math.min(limit, 12));
  Pageable pageable = PageRequest.of(0, safeLimit, Sort.by(Sort.Direction.DESC, "rating"));

  List<BookResponse> featuredBooks = books.findAll(
          (root, query, criteriaBuilder) -> criteriaBuilder.isTrue(root.get("featured")),
          pageable
  ).map(this::view).getContent();

  if (featuredBooks.size() >= Math.min(4, safeLimit)) {
   return featuredBooks;
  }

  return books.findAll(PageRequest.of(0, safeLimit, Sort.by(Sort.Direction.DESC, "rating")))
          .map(this::view)
          .getContent();
 }
 public List<SearchSuggestion> suggestions(String query, int limit) {
  String safeQuery = query == null ? "" : query.trim();
  Pageable pageable = PageRequest.of(0, Math.max(1, Math.min(limit, 8)), Sort.by(Sort.Direction.DESC, "rating"));
  Page<BookResponse> result = safeQuery.isBlank()
          ? books.findAll(pageable).map(this::view)
          : search(safeQuery, null, null, pageable);

  return result.getContent().stream()
          .map(book -> new SearchSuggestion(
                  book.id(),
                  book.title(),
                  book.authorName(),
                  book.categoryName(),
                  book.coverUrl(),
                  book.availableCopies()
          ))
          .toList();
 }
 public BookResponse one(Long id) {
  return view(get(id));
 }

 public Book get(Long id) {
  return books.findById(id)
          .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy sách"));
 }

 public BookResponse save(Long id, BookRequest request) {
  Book book = id == null ? new Book() : get(id);

  book.setIsbn(request.isbn());
  book.setTitle(request.title());
  book.setDescription(request.description());
  book.setPublicationYear(request.publicationYear());
  book.setLanguage(request.language());
  book.setPageCount(request.pageCount());
  book.setCoverUrl(request.coverUrl());
  book.setShelfLocation(request.shelfLocation());
  book.setFeatured(Boolean.TRUE.equals(request.featured()));
  book.setAuthor(authors.findById(request.authorId())
          .orElseThrow(() -> new IllegalArgumentException("Tác giả không tồn tại")));
  book.setCategory(categories.findById(request.categoryId())
          .orElseThrow(() -> new IllegalArgumentException("Thể loại không tồn tại")));
  book.setPublisher(request.publisherId() == null
          ? null
          : publishers.findById(request.publisherId())
            .orElseThrow(() -> new IllegalArgumentException("Nhà xuất bản không tồn tại")));

  if (book.getRating() == null) {
   book.setRating(0.0);
  }

  return view(books.save(book));
 }


 public EBookResponse ebookInfo(Long bookId) {
  return ebookView(ebooks.findByBookId(bookId)
          .orElseThrow(() -> new IllegalArgumentException("Sách chưa có e-book")));
 }

 public EBookResponse uploadEBook(Long bookId, MultipartFile file, boolean publicAccess) {
  Book book = get(bookId);
  validatePdf(file);

  EBook current = ebooks.findByBookId(bookId).orElse(null);
  String storedFilename = UUID.randomUUID() + ".pdf";
  Path target = storageRoot().resolve(storedFilename).normalize();

  try {
   Files.createDirectories(storageRoot());
   file.transferTo(target);
  } catch (IOException exception) {
   throw new IllegalStateException("Không thể lưu file e-book", exception);
  }

  EBook ebook = current == null ? new EBook() : current;
  String oldStoredFilename = current == null ? null : current.getStoredFilename();

  ebook.setBook(book);
  ebook.setOriginalFilename(cleanFilename(file.getOriginalFilename()));
  ebook.setStoredFilename(storedFilename);
  ebook.setContentType("application/pdf");
  ebook.setSizeBytes(file.getSize());
  ebook.setPublicAccess(publicAccess);

  EBook saved = ebooks.save(ebook);
  deleteStoredFile(oldStoredFilename);
  return ebookView(saved);
 }


 public EBookResponse updateEBookAccess(Long bookId, boolean publicAccess) {
  EBook ebook = ebooks.findByBookId(bookId)
          .orElseThrow(() -> new IllegalArgumentException("Sách chưa có e-book"));
  ebook.setPublicAccess(publicAccess);
  return ebookView(ebooks.save(ebook));
 }

 public void deleteEBook(Long bookId) {
  EBook ebook = ebooks.findByBookId(bookId)
          .orElseThrow(() -> new IllegalArgumentException("Sách chưa có e-book"));
  String storedFilename = ebook.getStoredFilename();
  ebooks.delete(ebook);
  deleteStoredFile(storedFilename);
 }

 public EBookFile readEBook(Long bookId, Long userId, boolean staff) {
  EBook ebook = ebooks.findByBookId(bookId)
          .orElseThrow(() -> new IllegalArgumentException("Sách chưa có e-book"));

  if (!canReadEBook(ebook, userId, staff)) {
   throw new IllegalStateException("Bạn chưa đủ điều kiện đọc e-book này");
  }

  Path file = resolveEBookPath(ebook);
  if (!file.startsWith(storageRoot()) || !Files.exists(file)) {
   throw new IllegalStateException("File e-book không còn tồn tại trên máy chủ");
  }

  try {
   return new EBookFile(new FileSystemResource(file), ebook, Files.size(file));
  } catch (IOException exception) {
   throw new IllegalStateException("Không thể mở file e-book", exception);
  }
 }

 public EBookFile previewEBook(Long bookId) {
  EBook ebook = ebooks.findByBookId(bookId)
          .orElseThrow(() -> new IllegalArgumentException("Sách chưa có e-book"));

  Path file = resolveEBookPath(ebook);
  if (!file.startsWith(storageRoot()) || !Files.exists(file)) {
   throw new IllegalStateException("File e-book không còn tồn tại trên máy chủ");
  }

  try (PDDocument source = Loader.loadPDF(file.toFile());
       PDDocument preview = new PDDocument();
       ByteArrayOutputStream output = new ByteArrayOutputStream()) {
   int previewPages = Math.min(PREVIEW_PAGE_COUNT, source.getNumberOfPages());
   for (int pageIndex = 0; pageIndex < previewPages; pageIndex++) {
    preview.importPage(source.getPage(pageIndex));
   }
   preview.save(output);
   return new EBookFile(new ByteArrayResource(output.toByteArray()), ebook, output.size());
  } catch (IOException exception) {
   throw new IllegalStateException("Không thể tạo bản xem trước e-book", exception);
  }
 }

 private boolean canReadEBook(EBook ebook, Long userId, boolean staff) {

  if (staff || Boolean.TRUE.equals(ebook.getPublicAccess())) return true;
  if (userId == null) return false;

  Boolean allowed = circulationClient.get()
          .uri(uriBuilder -> uriBuilder
                  .path("/internal/circulation/loans/active")
                  .queryParam("userId", userId)
                  .queryParam("bookId", ebook.getBook().getId())
                  .build())
          .retrieve()
          .body(Boolean.class);
  return Boolean.TRUE.equals(allowed);
 }

 private void validatePdf(MultipartFile file) {
  if (file == null || file.isEmpty()) {
   throw new IllegalArgumentException("Vui lòng chọn file PDF");
  }
  if (file.getSize() > MAX_EBOOK_SIZE) {
   throw new IllegalArgumentException("File PDF không được vượt quá 50MB");
  }

  String filename = cleanFilename(file.getOriginalFilename()).toLowerCase(Locale.ROOT);
  String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
  if (!filename.endsWith(".pdf") || !contentType.contains("pdf")) {
   throw new IllegalArgumentException("Chỉ chấp nhận file PDF");
  }

  byte[] signature = new byte[PDF_SIGNATURE.length];
  try (InputStream input = file.getInputStream()) {
   int read = input.read(signature);
   if (read != PDF_SIGNATURE.length || !Arrays.equals(signature, PDF_SIGNATURE)) {
    throw new IllegalArgumentException("File không đúng định dạng PDF");
   }
  } catch (IOException exception) {
   throw new IllegalArgumentException("Không thể kiểm tra file PDF");
  }
 }

 private Path storageRoot() {
  return Path.of(ebookStorageDir).toAbsolutePath().normalize();
 }

 private Path resolveEBookPath(EBook ebook) {
  return storageRoot().resolve(ebook.getStoredFilename()).normalize();
 }

 private String cleanFilename(String value) {
  String filename = value == null || value.isBlank() ? "ebook.pdf" : Path.of(value).getFileName().toString();
  return filename.replaceAll("[\\r\\n]", "");
 }

 private void deleteStoredFile(String storedFilename) {
  if (storedFilename == null || storedFilename.isBlank()) return;
  try {
   Path file = storageRoot().resolve(storedFilename).normalize();
   if (file.startsWith(storageRoot())) Files.deleteIfExists(file);
  } catch (IOException ignored) {
  }
 }

 private EBookResponse ebookView(EBook ebook) {
  if (ebook == null) return null;
  return new EBookResponse(
          ebook.getId(),
          ebook.getBook().getId(),
          ebook.getOriginalFilename(),
          ebook.getSizeBytes(),
          ebook.getPublicAccess(),
          ebook.getUploadedAt(),
          ebook.getUpdatedAt()
  );
 }

 public record EBookFile(Resource resource, EBook ebook, long contentLength) {}
 public void delete(Long id) {
  Book book = get(id);

  if (book.getCopies().stream()
          .anyMatch(copy -> copy.getStatus() == BookCopy.Status.BORROWED)) {
   throw new IllegalStateException("Không thể xóa sách đang được mượn");
  }

  ratings.deleteAll(ratings.findByBookId(id));
  books.delete(book);
 }

 public CopyResponse addCopy(Long bookId, CopyRequest request) {
  Book book = get(bookId);

  BookCopy copy = BookCopy.builder()
          .book(book)
          .barcode(request.barcode())
          .status(request.status() == null
                  ? BookCopy.Status.AVAILABLE
                  : BookCopy.Status.valueOf(request.status()))
          .acquiredDate(request.acquiredDate() == null
                  ? LocalDate.now()
                  : request.acquiredDate())
          .conditionNote(request.conditionNote())
          .build();

  copies.save(copy);
  syncCopies(book);
  return copyView(copy);
 }

 public CopyResponse copyStatus(Long id, BookCopy.Status status) {
  BookCopy copy = copies.findById(id)
          .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bản sách"));

  copy.setStatus(status);
  syncCopies(copy.getBook());
  return copyView(copy);
 }

 public CopyResponse copy(Long id) {
  return copyView(
          copies.findById(id)
                  .orElseThrow(() ->
                          new IllegalArgumentException(
                                  "Không tìm thấy bản sách"
                          )
                  )
  );
 }

 public CopyResponse copyByBarcode(String barcode) {
  return copyView(
          copies.findByBarcode(barcode)
                  .orElseThrow(() ->
                          new IllegalArgumentException(
                                  "Không tìm thấy bản sách"
                          )
                  )
  );
 }

 public CopyResponse borrowCopy(Long id) {
  BookCopy copy = copies.findById(id)
          .orElseThrow(() ->
                  new IllegalArgumentException(
                          "Không tìm thấy bản sách"
                  ));

  if (copy.getStatus() != BookCopy.Status.AVAILABLE) {
   throw new IllegalStateException(
           "Bản sách không sẵn sàng để mượn"
   );
  }

  copy.setStatus(BookCopy.Status.BORROWED);
  syncCopies(copy.getBook());
  return copyView(copy);
 }

 public void deleteCopy(Long id) {
  BookCopy copy = copies.findById(id)
          .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bản sách"));

  if (copy.getStatus() == BookCopy.Status.BORROWED) {
   throw new IllegalStateException("Bản sách đang được mượn");
  }

  Book book = copy.getBook();
  copies.delete(copy);
  copies.flush();
  syncCopies(book);
 }

 public RatingSummary getRatingSummary(Long bookId, Long userId) {
  get(bookId);
  List<BookRating> bookRatings = ratings.findByBookId(bookId);

  double average = bookRatings.stream()
          .mapToInt(BookRating::getStars)
          .average()
          .orElse(0.0);

  Optional<BookRating> mine = userId == null
          ? Optional.empty()
          : ratings.findByBookIdAndUserId(bookId, userId);

  Map<Integer, Long> distribution = new LinkedHashMap<>();
  for (int star = 5; star >= 1; star--) {
   int currentStar = star;
   distribution.put(
           star,
           bookRatings.stream()
                   .filter(item -> item.getStars() == currentStar)
                   .count()
   );
  }

  return new RatingSummary(
          roundRating(average),
          bookRatings.size(),
          mine.map(BookRating::getStars).orElse(null),
          mine.map(BookRating::getComment).orElse(null),
          distribution
  );
 }

 public RatingSummary rateBook(Long bookId, Long userId, RatingRequest request) {
  Book book = get(bookId);

  BookRating rating = ratings.findByBookIdAndUserId(bookId, userId)
          .orElseGet(() -> BookRating.builder()
                  .bookId(bookId)
                  .userId(userId)
                  .build());

  rating.setStars(request.stars());
  rating.setComment(request.comment() == null ? "" : request.comment().trim());
  rating.setUserName(userDisplayName(userId, request.userName()));
  ratings.save(rating);

  RatingSummary summary = getRatingSummary(bookId, userId);
  book.setRating(summary.average());
  books.save(book);

  return summary;
 }

 public List<ReviewResponse> getReviews(Long bookId, Long userId) {
  get(bookId);

  return ratings.findByBookIdOrderByUpdatedAtDesc(bookId).stream()
          .map(item -> new ReviewResponse(
                  item.getId(),
                  item.getUserName() == null || item.getUserName().isBlank()
                          ? "Độc giả Smart Library"
                          : item.getUserName(),
                  item.getStars(),
                  item.getComment(),
                  item.getUpdatedAt() == null
                          ? item.getCreatedAt()
                          : item.getUpdatedAt(),
                  userId != null && Objects.equals(item.getUserId(), userId)
          ))
          .toList();
 }

 private double roundRating(double rating) {
  return Math.round(rating * 10.0) / 10.0;
 }

 private void syncCopies(Book book) {
  List<BookCopy> allCopies = copies.findByBookId(book.getId());

  book.setTotalCopies(allCopies.size());
  book.setAvailableCopies((int) allCopies.stream()
          .filter(copy -> copy.getStatus() == BookCopy.Status.AVAILABLE)
          .count());

  books.save(book);
 }

 public BookResponse view(Book book) {
  return new BookResponse(
          book.getId(),
          book.getIsbn(),
          book.getTitle(),
          book.getDescription(),
          book.getPublicationYear(),
          book.getLanguage(),
          book.getPageCount(),
          book.getCoverUrl(),
          book.getShelfLocation(),
          book.getAuthor().getId(),
          book.getAuthor().getName(),
          book.getCategory().getId(),
          book.getCategory().getName(),
          book.getPublisher() == null ? null : book.getPublisher().getId(),
          book.getPublisher() == null ? null : book.getPublisher().getName(),
          book.getTotalCopies(),
          book.getAvailableCopies(),
          book.getFeatured(),
          book.getRating(),
          book.getCopies().stream().map(this::copyView).toList(),
          ebooks.findByBookId(book.getId()).map(this::ebookView).orElse(null)
  );
 }

 public CopyResponse copyView(BookCopy copy) {
  return new CopyResponse(
          copy.getId(),
          copy.getBarcode(),
          copy.getStatus().name(),
          copy.getAcquiredDate(),
          copy.getConditionNote(),
          copy.getBook().getId(),
          copy.getBook().getTitle()
  );
 }

 public List<FavoriteResponse> favorites(Long userId) {
  return favorites.findByUserIdOrderByAddedAtDesc(userId).stream()
          .map(this::favoriteView)
          .toList();
 }

 public FavoriteResponse addFavorite(Long userId, Long bookId) {
  FavoriteBook favorite = favorites.findByUserIdAndBookId(userId, bookId)
          .orElseGet(() -> favorites.save(FavoriteBook.builder()
                  .userId(userId)
                  .bookId(bookId)
                  .build()));
  return favoriteView(favorite);
 }

 public void removeFavorite(Long userId, Long bookId) {
  favorites.deleteByUserIdAndBookId(userId, bookId);
 }

 public void clearFavorites(Long userId) {
  favorites.deleteAll(favorites.findByUserIdOrderByAddedAtDesc(userId));
 }

 private FavoriteResponse favoriteView(FavoriteBook favorite) {
  Book book = get(favorite.getBookId());
  return new FavoriteResponse(
          favorite.getId(),
          book.getId(),
          book.getTitle(),
          book.getAuthor().getName(),
          book.getCategory().getName(),
          book.getCoverUrl(),
          book.getAvailableCopies(),
          favorite.getAddedAt()
  );
 }

 private String userDisplayName(Long userId, String fallback) {
  String clean = fallback == null ? "" : fallback.trim();
  return clean.isBlank() ? "Độc giả #" + userId : clean;
 }

 private record ScoredBook(Book book, int score) {
 }

 private record MatchResult(int matchedWords, int distanceBonus) {
 }
}