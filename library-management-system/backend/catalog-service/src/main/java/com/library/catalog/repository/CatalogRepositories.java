package com.library.catalog.repository;
import com.library.catalog.entity.*; import org.springframework.data.jpa.repository.*; import org.springframework.stereotype.Repository; import java.util.*;
public final class CatalogRepositories{private CatalogRepositories(){}
 @Repository public interface Authors extends JpaRepository<Author,Long>{Optional<Author> findByNameIgnoreCase(String name);}
 @Repository public interface Categories extends JpaRepository<Category,Long>{Optional<Category> findByNameIgnoreCase(String name);}
 @Repository public interface Publishers extends JpaRepository<Publisher,Long>{Optional<Publisher> findByNameIgnoreCase(String name);}
 @Repository public interface Books extends JpaRepository<Book,Long>,JpaSpecificationExecutor<Book>{Optional<Book> findByIsbn(String isbn);}
 @Repository public interface Copies extends JpaRepository<BookCopy,Long>{List<BookCopy> findByBookId(Long bookId);Optional<BookCopy> findByBarcode(String barcode);void deleteByBookId(Long bookId);}
 @Repository public interface BookRatings extends JpaRepository<BookRating,Long>{Optional<BookRating> findByBookIdAndUserId(Long bookId,Long userId);List<BookRating> findByBookId(Long bookId);List<BookRating> findByBookIdOrderByUpdatedAtDesc(Long bookId);long countByBookId(Long bookId);void deleteByBookId(Long bookId);}
 @Repository public interface FavoriteBooks extends JpaRepository<FavoriteBook,Long>{List<FavoriteBook> findByUserIdOrderByAddedAtDesc(Long userId);Optional<FavoriteBook> findByUserIdAndBookId(Long userId,Long bookId);void deleteByUserIdAndBookId(Long userId,Long bookId);void deleteByBookId(Long bookId);}
 @Repository public interface EBooks extends JpaRepository<EBook,Long>{Optional<EBook> findByBookId(Long bookId);boolean existsByBookId(Long bookId);void deleteByBookId(Long bookId);}
}
