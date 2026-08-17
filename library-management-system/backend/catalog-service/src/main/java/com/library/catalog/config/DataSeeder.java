package com.library.catalog.config;

import com.library.catalog.dto.CatalogDtos.CopyRequest;
import com.library.catalog.entity.Author;
import com.library.catalog.entity.Book;
import com.library.catalog.entity.Category;
import com.library.catalog.entity.Publisher;
import com.library.catalog.repository.CatalogRepositories.Authors;
import com.library.catalog.repository.CatalogRepositories.Books;
import com.library.catalog.repository.CatalogRepositories.BookRatings;
import com.library.catalog.repository.CatalogRepositories.FavoriteBooks;
import com.library.catalog.repository.CatalogRepositories.Categories;
import com.library.catalog.repository.CatalogRepositories.Copies;
import com.library.catalog.repository.CatalogRepositories.Publishers;
import com.library.catalog.service.CatalogService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

 private final Authors authors;
 private final Categories categories;
 private final Publishers publishers;
 private final Books books;
 private final Copies copies;
 private final FavoriteBooks favorites;
 private final BookRatings ratings;
 private final CatalogService catalogService;

 private final Map<String, Author> authorCache = new HashMap<>();
 private final Map<String, Category> categoryCache = new HashMap<>();
 private final Map<String, Publisher> publisherCache = new HashMap<>();

 @Transactional
 @Override
 public void run(String... args) {
  List<BookSeed> seeds = List.of(
          seed("9786041123456", "Mắt Biếc", "Nguyễn Nhật Ánh", "Văn học Việt Nam", "NXB Trẻ", 1990, 300, "A-01", googleBooks("ngmRzQEACAAJ"), "Câu chuyện tình yêu trong trẻo và day dứt của Ngạn và Hà Lan.", true, 4.8),
          seed("9786041187654", "Cho Tôi Xin Một Vé Đi Tuổi Thơ", "Nguyễn Nhật Ánh", "Văn học Việt Nam", "NXB Trẻ", 2008, 208, "A-02", openLibrary("9786041188433"), "Chuyến tàu trở về miền ký ức tuổi thơ hồn nhiên, tinh nghịch và giàu suy ngẫm.", true, 4.7),
          seed("9786042081234", "Tôi Thấy Hoa Vàng Trên Cỏ Xanh", "Nguyễn Nhật Ánh", "Văn học Việt Nam", "NXB Trẻ", 2010, 378, "A-03", googleBooks("DRk3MQAACAAJ"), "Câu chuyện tuổi thơ tại một làng quê Việt Nam, trong veo nhưng không thiếu những va vấp trưởng thành.", true, 4.8),
          seed("9786041000004", "Chí Phèo", "Nam Cao", "Văn học Việt Nam", "NXB Văn học", 1941, 192, "A-04", googleBooks("Myns0AEACAAJ"), "Tác phẩm hiện thực kinh điển viết về bi kịch bị tha hóa và khát vọng làm người.", false, 4.6),
          seed("9786041000005", "Dế Mèn Phiêu Lưu Ký", "Tô Hoài", "Thiếu nhi", "NXB Kim Đồng", 1941, 224, "B-01", googleBooks("tysc0AEACAAJ"), "Cuộc phiêu lưu và trưởng thành của chú Dế Mèn qua thế giới loài vật sinh động.", true, 4.9),
          seed("9786041000006", "Tắt Đèn", "Ngô Tất Tố", "Văn học Việt Nam", "NXB Văn học", 1939, 216, "A-05", googleBooks("ufAD0QEACAAJ"), "Bức tranh chân thực về xã hội nông thôn Việt Nam trước Cách mạng tháng Tám.", false, 4.6),
          seed("9786041000007", "Truyện Kiều", "Nguyễn Du", "Văn học Việt Nam", "NXB Văn học", 1820, 264, "A-06", commons("Kim_V%C3%A2n_Ki%E1%BB%81u_t%C3%A2n_truy%E1%BB%87n.jpg"), "Kiệt tác thơ Nôm phản ánh số phận con người, chữ tài, chữ mệnh và lòng nhân đạo.", true, 4.9),
          seed("9780747532743", "Harry Potter và Hòn Đá Phù Thủy", "J. K. Rowling", "Thiếu nhi", "Bloomsbury", 1997, 366, "B-02", openLibrary("9780747532743"), "Hành trình đầu tiên của Harry Potter tại Hogwarts và cuộc đối đầu với thế lực hắc ám.", true, 4.9),
          seed("9780156012195", "Hoàng Tử Bé", "Antoine de Saint-Exupéry", "Thiếu nhi", "NXB Kim Đồng", 1943, 128, "B-03", openLibrary("9780156012195"), "Câu chuyện trong trẻo về tình bạn, tình yêu, trách nhiệm và cách nhìn thế giới bằng trái tim.", true, 4.9),
          seed("9780451419439", "Những Người Khốn Khổ", "Victor Hugo", "Văn học nước ngoài", "NXB Văn học", 1862, 1460, "C-01", openLibrary("9780451419439"), "Bản anh hùng ca về lòng nhân ái, công lý và hành trình chuộc lỗi của Jean Valjean.", true, 4.8),
          seed("9780061122415", "Nhà Giả Kim", "Paulo Coelho", "Văn học nước ngoài", "NXB Hội Nhà Văn", 1988, 228, "C-02", openLibrary("9780061122415"), "Hành trình đi tìm kho báu của Santiago và thông điệp lắng nghe giấc mơ đời mình.", true, 4.7),
          seed("9780375704024", "Rừng Na Uy", "Haruki Murakami", "Văn học nước ngoài", "NXB Hội Nhà Văn", 1987, 556, "C-03", openLibrary("9780375704024"), "Câu chuyện trưởng thành, tình yêu và mất mát trong không khí Nhật Bản thập niên 1960.", false, 4.6),
          seed("9780451524935", "1984", "George Orwell", "Văn học nước ngoài", "NXB Văn học", 1949, 368, "C-04", openLibrary("9780451524935"), "Tiểu thuyết phản địa đàng nổi tiếng về giám sát, quyền lực và tự do cá nhân.", true, 4.8),
          seed("9780062316097", "Sapiens: Lược Sử Loài Người", "Yuval Noah Harari", "Khoa học - Lịch sử", "NXB Tri Thức", 2014, 560, "D-01", openLibrary("9780062316097"), "Khám phá hành trình tiến hóa, văn hóa và các cấu trúc tưởng tượng định hình nhân loại.", true, 4.8),
          seed("9780062464316", "Homo Deus: Lược Sử Tương Lai", "Yuval Noah Harari", "Khoa học - Lịch sử", "NXB Tri Thức", 2016, 512, "D-02", openLibrary("9780062464316"), "Những dự báo và câu hỏi lớn về dữ liệu, công nghệ, ý thức và tương lai con người.", false, 4.6),
          seed("9780553380163", "Lược Sử Thời Gian", "Stephen Hawking", "Khoa học - Lịch sử", "NXB Trẻ", 1988, 256, "D-03", openLibrary("9780553380163"), "Giới thiệu dễ hiểu về vũ trụ, thời gian, hố đen và những câu hỏi nền tảng của vật lý hiện đại.", true, 4.8),
          seed("9780553802023", "Vũ Trụ Trong Vỏ Hạt Dẻ", "Stephen Hawking", "Khoa học - Lịch sử", "NXB Trẻ", 2001, 224, "D-04", openLibrary("9780553802023"), "Hành trình khám phá các ý tưởng hiện đại về không gian, thời gian và bản chất vũ trụ.", false, 4.7),
          seed("9780671027032", "Đắc Nhân Tâm", "Dale Carnegie", "Kỹ năng sống", "NXB Tổng hợp TP.HCM", 1936, 320, "E-01", openLibrary("9780671027032"), "Những nguyên tắc giao tiếp, thấu hiểu và ứng xử giúp xây dựng quan hệ tích cực.", true, 4.7),
          seed("9780735211292", "Atomic Habits - Thay Đổi Tí Hon", "James Clear", "Kỹ năng sống", "NXB Thế Giới", 2018, 320, "E-02", openLibrary("9780735211292"), "Phương pháp xây dựng thói quen tốt bằng những thay đổi nhỏ, đều đặn và dễ duy trì.", true, 4.9),
          seed("9781591846444", "Bắt Đầu Với Câu Hỏi Tại Sao", "Simon Sinek", "Kỹ năng sống", "NXB Công Thương", 2009, 348, "E-03", openLibrary("9781591846444"), "Tìm hiểu cách các tổ chức và nhà lãnh đạo truyền cảm hứng bằng mục đích rõ ràng.", false, 4.6),
          seed("9780345472328", "Mindset - Tâm Lý Học Thành Công", "Carol S. Dweck", "Tâm lý học", "NXB Lao Động", 2006, 480, "H-01", openLibrary("9780345472328"), "Sức mạnh của tư duy phát triển trong học tập, công việc và cách vượt qua giới hạn bản thân.", true, 4.8),
          seed("9780374533557", "Tư Duy Nhanh Và Chậm", "Daniel Kahneman", "Tâm lý học", "NXB Thế Giới", 2011, 612, "H-02", openLibrary("9780374533557"), "Khám phá hai hệ thống chi phối suy nghĩ, trực giác, phán đoán và quyết định của con người.", true, 4.8),
          seed("9781612680194", "Cha Giàu Cha Nghèo", "Robert T. Kiyosaki", "Kinh tế - Tài chính", "NXB Trẻ", 1997, 336, "F-01", openLibrary("9781612680194"), "Kiến thức nền tảng về tiền bạc, tài sản, nợ và tư duy tài chính cá nhân.", true, 4.6),
          seed("9780446541466", "Quốc Gia Khởi Nghiệp", "Dan Senor và Saul Singer", "Kinh tế - Tài chính", "NXB Thế Giới", 2009, 336, "F-02", openLibrary("9780446541466"), "Câu chuyện về hệ sinh thái đổi mới, giáo dục, quân đội và tinh thần khởi nghiệp Israel.", false, 4.6),
          seed("9780060555665", "Nhà Đầu Tư Thông Minh", "Benjamin Graham", "Kinh tế - Tài chính", "NXB Lao Động", 1949, 644, "F-03", openLibrary("9780060555665"), "Những nguyên tắc đầu tư giá trị bền vững, kiểm soát rủi ro và biên an toàn.", true, 4.8),
          seed("9780132350884", "Clean Code", "Robert C. Martin", "Công nghệ thông tin", "Prentice Hall", 2008, 464, "G-01", openLibrary("9780132350884"), "Nguyên tắc và thực hành viết mã nguồn sạch, dễ đọc, dễ bảo trì trong phát triển phần mềm.", true, 4.9),
          seed("9780201616224", "The Pragmatic Programmer", "Andrew Hunt và David Thomas", "Công nghệ thông tin", "Addison-Wesley", 1999, 352, "G-02", openLibrary("9780201616224"), "Kinh nghiệm thực tiễn để trở thành lập trình viên chuyên nghiệp, chủ động và hiệu quả.", true, 4.9),
          seed("9780201633610", "Design Patterns", "Erich Gamma và cộng sự", "Công nghệ thông tin", "Addison-Wesley", 1994, 416, "G-03", openLibrary("9780201633610"), "Các mẫu thiết kế hướng đối tượng kinh điển trong phát triển phần mềm.", false, 4.8),
          seed("9780141034355", "Những Cuộc Phiêu Lưu Của Sherlock Holmes", "Arthur Conan Doyle", "Trinh thám", "NXB Văn học", 1892, 384, "I-01", openLibrary("9780141034355"), "Các vụ án hấp dẫn của thám tử Sherlock Holmes và bác sĩ Watson.", true, 4.9),
          seed("9780007119318", "Án Mạng Trên Chuyến Tàu Tốc Hành Phương Đông", "Agatha Christie", "Trinh thám", "NXB Trẻ", 1934, 320, "I-02", openLibrary("9780007119318"), "Vụ án bí ẩn trên chuyến tàu tốc hành phương Đông và màn phá án sắc bén của Hercule Poirot.", true, 4.8),
          seed("9781250002693", "Phía Sau Nghi Can X", "Higashino Keigo", "Trinh thám", "NXB Hội Nhà Văn", 2005, 392, "I-03", openLibrary("9781250002693"), "Cuộc đấu trí giữa thiên tài toán học và nhà vật lý trong một vụ án tưởng như hoàn hảo.", true, 4.8),
          seed("9780140449228", "Không Gia Đình", "Hector Malot", "Văn học nước ngoài", "NXB Văn học", 1878, 584, "C-05", openLibrary("9782253006329"), "Hành trình trưởng thành đầy nghị lực của cậu bé Rémi qua nhiều miền đất và biến cố.", false, 4.7),
          seed("9781568363912", "Totto-chan Bên Cửa Sổ", "Tetsuko Kuroyanagi", "Thiếu nhi", "NXB Hội Nhà Văn", 1981, 356, "B-04", openLibrary("9781568363912"), "Câu chuyện về một ngôi trường đặc biệt, một cô bé hiếu động và tình yêu giáo dục trẻ thơ.", true, 4.8),
          seed("9780451205766", "Bố Già", "Mario Puzo", "Văn học nước ngoài", "NXB Văn học", 1969, 664, "C-06", openLibrary("9780451205766"), "Tiểu thuyết nổi tiếng về gia đình Corleone, quyền lực, lòng trung thành và thế giới ngầm.", true, 4.8),
          seed("9781108457651", "English Grammar in Use", "Raymond Murphy", "Ngoại ngữ", "Cambridge University Press", 2019, 396, "J-01", openLibrary("9781108457651"), "Tài liệu tự học ngữ pháp tiếng Anh từ cơ bản đến trung cấp với bài tập thực hành rõ ràng.", true, 4.9),
          seed("9780194620076", "Oxford Word Skills", "Ruth Gairns và Stuart Redman", "Ngoại ngữ", "Oxford University Press", 2020, 256, "J-02", openLibrary("9780194620076"), "Giáo trình phát triển vốn từ vựng tiếng Anh theo chủ đề và tình huống thực tế.", false, 4.7),
          seed("9786041000037", "Cây Cam Ngọt Của Tôi", "José Mauro de Vasconcelos", "Văn học nước ngoài", "NXB Hội Nhà Văn", 1968, 244, "C-07", openLibrary("9781782692454"), "Câu chuyện cảm động về tuổi thơ, tình thương và trí tưởng tượng của cậu bé Zezé.", true, 4.8),
          seed("9786041000038", "Tuổi Trẻ Đáng Giá Bao Nhiêu", "Rosie Nguyễn", "Kỹ năng sống", "NXB Hội Nhà Văn", 2016, 285, "E-04", openLibrary("9786047744596"), "Những chia sẻ gần gũi về học tập, trải nghiệm, đọc sách và tự định hướng tuổi trẻ.", true, 4.7),
          seed("9786041000039", "Muôn Kiếp Nhân Sinh", "Nguyên Phong", "Khoa học - Lịch sử", "NXB Tổng hợp TP.HCM", 2020, 408, "D-05", openLibrary("9786049970481"), "Tác phẩm kết hợp tự sự và suy ngẫm về nhân sinh, lịch sử, văn minh và trách nhiệm sống.", true, 4.6),
          seed("9786041000040", "Tôi Tài Giỏi, Bạn Cũng Thế!", "Adam Khoo", "Kỹ năng sống", "NXB Phụ Nữ", 1998, 272, "E-05", openLibrary("9786045664184"), "Phương pháp học tập, ghi nhớ và tạo động lực dành cho học sinh, sinh viên.", false, 4.6),
          seed("9780544002692", "Dữ Liệu Lớn", "Viktor Mayer-Schönberger và Kenneth Cukier", "Công nghệ thông tin", "Houghton Mifflin Harcourt", 2013, 256, "G-04", openLibrary("9780544002692"), "Giới thiệu tác động của big data đối với kinh doanh, khoa học, quản trị và đời sống.", true, 4.6),
          seed("9780134610993", "Artificial Intelligence: A Modern Approach", "Stuart Russell và Peter Norvig", "Công nghệ thông tin", "Pearson", 2020, 1136, "G-05", openLibrary("9780134610993"), "Giáo trình kinh điển về trí tuệ nhân tạo, tìm kiếm, học máy, suy luận và tác tử thông minh.", true, 4.9),
          seed("9780262035613", "Deep Learning", "Ian Goodfellow, Yoshua Bengio và Aaron Courville", "Công nghệ thông tin", "MIT Press", 2016, 800, "G-06", openLibrary("9780262035613"), "Nền tảng lý thuyết và thực hành về học sâu, mạng nơ-ron và các mô hình hiện đại.", true, 4.8),
          seed("9781617292231", "Grokking Algorithms", "Aditya Bhargava", "Công nghệ thông tin", "Manning", 2016, 256, "G-07", openLibrary("9781617292231"), "Giải thích thuật toán bằng hình minh họa dễ hiểu, phù hợp cho người học lập trình.", true, 4.8),
          seed("9780134757599", "Refactoring", "Martin Fowler", "Công nghệ thông tin", "Addison-Wesley", 2018, 448, "G-08", openLibrary("9780134757599"), "Kỹ thuật cải tiến cấu trúc mã nguồn để phần mềm dễ hiểu, dễ mở rộng và ít lỗi hơn.", false, 4.8),
          seed("9780596007126", "Head First Design Patterns", "Eric Freeman và Elisabeth Robson", "Công nghệ thông tin", "O'Reilly Media", 2004, 694, "G-09", openLibrary("9780596007126"), "Cách tiếp cận trực quan, dễ nhớ để học các mẫu thiết kế phần mềm hướng đối tượng.", true, 4.7),
          seed("9780201835953", "The Mythical Man-Month", "Frederick P. Brooks Jr.", "Công nghệ thông tin", "Addison-Wesley", 1975, 336, "G-10", openLibrary("9780201835953"), "Những bài học kinh điển về quản lý dự án phần mềm, con người và độ phức tạp kỹ thuật.", false, 4.7),
          seed("9781400079278", "Kafka Bên Bờ Biển", "Haruki Murakami", "Văn học nước ngoài", "NXB Hội Nhà Văn", 2002, 608, "C-08", openLibrary("9781400079278"), "Tiểu thuyết siêu thực đan xen số phận, ký ức, âm nhạc và những biểu tượng bí ẩn.", true, 4.7),
          seed("9780061120084", "Giết Con Chim Nhại", "Harper Lee", "Văn học nước ngoài", "Harper Perennial", 1960, 336, "C-09", openLibrary("9780061120084"), "Tác phẩm kinh điển về công lý, định kiến chủng tộc và sự trưởng thành của trẻ nhỏ.", true, 4.8),
          seed("9780446675536", "Cuốn Theo Chiều Gió", "Margaret Mitchell", "Văn học nước ngoài", "Warner Books", 1936, 1037, "C-10", openLibrary("9780446675536"), "Thiên tiểu thuyết về tình yêu, chiến tranh, biến động xã hội và sức sống của Scarlett O'Hara.", false, 4.7)
  );

  pruneStaleBooks(seeds);

  int addedBooks = 0;
  int updatedBooks = 0;

  for (BookSeed seed : seeds) {
   Book book = books.findByIsbn(seed.isbn()).orElseGet(Book::new);
   boolean isNew = book.getId() == null;

   Author author = getOrCreateAuthor(seed.author());
   Category category = getOrCreateCategory(seed.category());
   Publisher publisher = getOrCreatePublisher(seed.publisher());

   book.setIsbn(seed.isbn());
   book.setTitle(seed.title());
   book.setDescription(seed.description());
   book.setPublicationYear(seed.publicationYear());
   book.setLanguage("Tiếng Việt");
   book.setPageCount(seed.pageCount());
   book.setCoverUrl(stableCover(seed.isbn(), seed.coverUrl()));
   book.setShelfLocation(seed.shelfLocation());
   book.setAuthor(author);
   book.setCategory(category);
   book.setPublisher(publisher);
   book.setFeatured(seed.featured());
   book.setRating(seed.rating());

   book = books.save(book);

   if (copies.findByBookId(book.getId()).isEmpty()) {
    for (int copyNumber = 1; copyNumber <= 3; copyNumber++) {
     String barcode = String.format("BC%03d%02d", book.getId(), copyNumber);
     catalogService.addCopy(
             book.getId(),
             new CopyRequest(
                     barcode,
                     "AVAILABLE",
                     LocalDate.now().minusMonths(copyNumber),
                     copyNumber == 3 ? "Mới" : "Tốt"
             )
     );
    }
   }

   if (isNew) {
    addedBooks++;
   } else {
    updatedBooks++;
   }
  }

  pruneEmptyCategories();

  System.out.printf(
          "Smart Library seed hoàn tất: thêm %d sách, cập nhật %d sách, tổng cộng %d sách.%n",
          addedBooks,
          updatedBooks,
          books.count()
  );
 }

 private void pruneStaleBooks(List<BookSeed> seeds) {
  Set<String> allowedIsbns = seeds.stream()
          .map(BookSeed::isbn)
          .collect(java.util.stream.Collectors.toSet());

  for (Book book : books.findAll()) {
   if (allowedIsbns.contains(book.getIsbn())) continue;

   favorites.deleteByBookId(book.getId());
   ratings.deleteByBookId(book.getId());
   copies.deleteByBookId(book.getId());
   books.delete(book);
  }
 }

 private void pruneEmptyCategories() {
  Set<Long> usedCategoryIds = books.findAll().stream()
          .map(Book::getCategory)
          .filter(java.util.Objects::nonNull)
          .map(Category::getId)
          .collect(java.util.stream.Collectors.toSet());

  for (Category category : categories.findAll()) {
   if (!usedCategoryIds.contains(category.getId())) {
    categories.delete(category);
   }
  }
 }

    private String stableCover(String isbn, String fallback) {
  return switch (isbn) {
   case "9780061120084" -> localCover(isbn);
   case "9780134610993" -> localCover(isbn);
   case "9780134757599" -> localCover(isbn);
   case "9780132350884" -> localCover(isbn);
   case "9780141034355" -> localCover(isbn);
   case "9780194620076" -> localCover(isbn);
   case "9780201835953" -> localCover(isbn);
   case "9780201633610" -> localCover(isbn);
   case "9780201616224" -> localCover(isbn);
   case "9780262035613" -> localCover(isbn);
   case "9780345472328" -> localCover(isbn);
   case "9780446675536" -> localCover(isbn);
   case "9780451524935" -> localCover(isbn);
   case "9780544002692" -> localCover(isbn);
   case "9780553380163" -> localCover(isbn);
   case "9780553802023" -> localCover(isbn);
   case "9780596007126" -> localCover(isbn);
   case "9780671027032" -> localCover(isbn);
   case "9780735211292" -> localCoverPng(isbn);
   case "9781108457651" -> localCover(isbn);
   case "9781250002693" -> localCover(isbn);
   case "9781400079278" -> localCover(isbn);
   case "9781568363912" -> localCover(isbn);
   case "9781591846444" -> localCover(isbn);
   case "9781612680194" -> localCover(isbn);
   case "9781617292231" -> localCover(isbn);
   case "9780451205766" -> localCover(isbn);
   case "9780060555665" -> localCoverWebp(isbn);
   case "9780061122415" -> localCoverPng(isbn);
   case "9780062316097" -> localCover(isbn);
   case "9780062464316" -> localCover(isbn);
   case "9780140449228" -> localCover(isbn);
   case "9780156012195" -> localCoverWebp(isbn);
   case "9780374533557" -> localCoverWebp(isbn);
   case "9780375704024" -> localCover(isbn);
   case "9780446541466" -> localCoverWebp(isbn);
   case "9780747532743" -> localCoverWebp(isbn);
   case "9786041000004" -> localCover(isbn);
   case "9786041000005" -> localCover(isbn);
   case "9786041000006" -> localCover(isbn);
   case "9786041000007" -> localCover(isbn);
   case "9786041000037" -> localCover(isbn);
   case "9786041000038" -> localCover(isbn);
   case "9786041000039" -> localCover(isbn);
   case "9786041000040" -> localCover(isbn);
   case "9786041123456" -> localCover(isbn);
   case "9786041187654" -> localCover(isbn);
   case "9786042081234" -> localCoverWebp(isbn);
   default -> fallback;
  };
 }

 private String localCover(String isbn) {
  return "/covers-real/" + isbn + ".jpg";
 }

 private String localCoverWebp(String isbn) {
  return "/covers-real/" + isbn + ".webp";
 }

 private String localCoverPng(String isbn) {
  return "/covers-real/" + isbn + ".png";
 }
 private String openLibrary(String isbn) {
  return "https://covers.openlibrary.org/b/isbn/" + isbn + "-L.jpg";
 }

 private String googleBooks(String id) {
  return "https://books.google.com/books/content?id=" + id + "&printsec=frontcover&img=1&zoom=1&source=gbs_api";
 }

 private String commons(String fileName) {
  return "https://commons.wikimedia.org/wiki/Special:Redirect/file/" + fileName;
 }
 private Author getOrCreateAuthor(String name) {
  return authorCache.computeIfAbsent(name, key ->
          authors.findByNameIgnoreCase(key)
                  .orElseGet(() -> authors.save(Author.builder()
                          .name(key)
                          .biography("Tác giả của nhiều tác phẩm được độc giả yêu thích.")
                          .build()))
  );
 }

 private Category getOrCreateCategory(String name) {
  return categoryCache.computeIfAbsent(name, key ->
          categories.findByNameIgnoreCase(key)
                  .orElseGet(() -> categories.save(Category.builder()
                          .name(key)
                          .description("Danh mục " + key + " của Smart Library.")
                          .build()))
  );
 }

 private Publisher getOrCreatePublisher(String name) {
  return publisherCache.computeIfAbsent(name, key ->
          publishers.findByNameIgnoreCase(key)
                  .orElseGet(() -> publishers.save(Publisher.builder()
                          .name(key)
                          .address("Việt Nam")
                          .build()))
  );
 }

 private BookSeed seed(
         String isbn,
         String title,
         String author,
         String category,
         String publisher,
         int publicationYear,
         int pageCount,
         String shelfLocation,
         String coverUrl,
         String description,
         boolean featured,
         double rating
 ) {
  return new BookSeed(
          isbn,
          title,
          author,
          category,
          publisher,
          publicationYear,
          pageCount,
          shelfLocation,
          coverUrl,
          description,
          featured,
          rating
  );
 }

 private record BookSeed(
         String isbn,
         String title,
         String author,
         String category,
         String publisher,
         int publicationYear,
         int pageCount,
         String shelfLocation,
         String coverUrl,
         String description,
         boolean featured,
         double rating
 ) {
 }
}
