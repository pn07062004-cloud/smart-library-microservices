package com.library.chatbot.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.library.chatbot.dto.ChatDtos.BookSuggestion;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Component
@RequiredArgsConstructor
public class LibraryTools {

    private static final int MAX_BOOK_CARDS = 3;

    private final RestClient catalog;
    private final RestClient circulation;
    private final ObjectMapper mapper;

    public ToolExecution execute(
            String name,
            JsonNode arguments,
            String authorization
    ) {

        return switch (name) {
            case "search_books" -> searchBooks(arguments);
            case "get_book_details" -> getBookDetails(arguments);
            case "get_library_settings" -> getLibrarySettings(arguments);
            case "get_my_library" -> getMyLibrary(arguments, authorization);
            case "get_library_statistics" -> getLibraryStatistics(arguments, authorization);
            case "get_current_time" -> getCurrentTime();
            default -> error(name, "Công cụ không tồn tại");
        };
    }

    /*
     * =====================================================
     * SEARCH BOOKS
     * =====================================================
     */
    private ToolExecution searchBooks(
            JsonNode arguments
    ) {

        String query =
                arguments
                        .path("query")
                        .asText("")
                        .trim();

        boolean availableOnly =
                arguments
                        .path("available_only")
                        .asBoolean(false);

        int limit =
                Math.max(
                        1,

                        Math.min(
                                arguments
                                        .path("limit")
                                        .asInt(
                                                MAX_BOOK_CARDS
                                        ),

                                MAX_BOOK_CARDS
                        )
                );

        try {
            JsonNode root =
                    catalog
                            .get()
                            .uri(
                                    builder -> {
                                        builder.path(
                                                "/api/books"
                                        );

                                        if (
                                                !query.isBlank()
                                        ) {
                                            builder.queryParam(
                                                    "q",
                                                    query
                                            );
                                        }

                                        if (
                                                availableOnly
                                        ) {
                                            builder.queryParam(
                                                    "available",
                                                    true
                                            );
                                        }

                                        builder.queryParam(
                                                "page",
                                                0
                                        );

                                        builder.queryParam(
                                                "size",
                                                limit
                                        );

                                        return builder.build();
                                    }
                            )
                            .retrieve()
                            .body(
                                    JsonNode.class
                            );

            List<BookSuggestion> books =
                    new ArrayList<>();

            if (root != null) {
                for (
                        JsonNode book :
                        root.path(
                                "content"
                        )
                ) {
                    if (
                            books.size() >=
                                    limit
                    ) {
                        break;
                    }

                    books.add(
                            toBook(
                                    book
                            )
                    );
                }
            }

            ObjectNode payload =
                    mapper.createObjectNode();

            payload.put(
                    "query",
                    query
            );

            payload.put(
                    "availableOnly",
                    availableOnly
            );

            payload.put(
                    "totalElements",

                    root == null
                            ? 0
                            : root
                              .path(
                                      "totalElements"
                              )
                              .asLong(
                                      books.size()
                              )
            );

            payload.set(
                    "books",
                    mapper.valueToTree(
                            books
                    )
            );

            payload.put(
                    "instruction",

                    "Chỉ được sử dụng các sách trong mảng books cho câu trả lời hiện tại. Nếu books rỗng, nói rõ chưa tìm thấy; không thay bằng một sách khác ngoài kết quả."
            );

            return new ToolExecution(
                    "search_books",
                    payload,
                    books,
                    quickRepliesForBooks(
                            books
                    )
            );

        } catch (
                Exception exception
        ) {
            return error(
                    "search_books",
                    "Không kết nối được kho sách"
            );
        }
    }

    /*
     * =====================================================
     * BOOK DETAILS
     * =====================================================
     */
    private ToolExecution getBookDetails(
            JsonNode arguments
    ) {

        long id =
                arguments
                        .path("book_id")
                        .asLong(0);

        if (id <= 0) {
            return error(
                    "get_book_details",
                    "book_id không hợp lệ"
            );
        }

        try {
            JsonNode book =
                    catalog
                            .get()
                            .uri(
                                    "/api/books/{id}",
                                    id
                            )
                            .retrieve()
                            .body(
                                    JsonNode.class
                            );

            if (
                    book == null ||
                            book.isNull()
            ) {
                return error(
                        "get_book_details",
                        "Không tìm thấy sách"
                );
            }

            BookSuggestion suggestion =
                    toBook(
                            book
                    );

            ObjectNode payload =
                    mapper.createObjectNode();

            payload.set(
                    "book",
                    mapper.valueToTree(
                            suggestion
                    )
            );

            payload.put(
                    "instruction",

                    "Dùng đúng dữ liệu của book; không tự thêm số bản, tác giả, mô tả, thể loại hoặc đánh giá không có trong dữ liệu."
            );

            return new ToolExecution(
                    "get_book_details",
                    payload,
                    List.of(
                            suggestion
                    ),
                    quickRepliesForBooks(
                            List.of(
                                    suggestion
                            )
                    )
            );

        } catch (
                Exception exception
        ) {
            return error(
                    "get_book_details",
                    "Không tải được chi tiết sách"
            );
        }
    }

    /*
     * =====================================================
     * LIBRARY SETTINGS
     * =====================================================
     */
    private ToolExecution getLibrarySettings(
            JsonNode arguments
    ) {

        String topic =
                arguments
                        .path("topic")
                        .asText("all");

        try {
            JsonNode settings =
                    circulation
                            .get()
                            .uri(
                                    "/api/settings/public"
                            )
                            .retrieve()
                            .body(
                                    JsonNode.class
                            );

            ObjectNode payload =
                    mapper.createObjectNode();

            payload.put(
                    "topic",
                    topic
            );

            if (
                    settings == null ||
                            settings.isNull()
            ) {
                payload.put(
                        "error",
                        "Chưa có dữ liệu quy định thư viện"
                );

                payload.put(
                        "instruction",

                        "Không suy đoán quy định khi dữ liệu settings không tồn tại."
                );

            } else {
                payload.set(
                        "settings",
                        settings
                );

                payload.put(
                        "instruction",

                        "Chỉ trả lời bằng các trường có trong settings. Không tự suy đoán quy định, tiện ích, giờ mở cửa hoặc thông tin liên hệ không được liệt kê."
                );
            }

            return new ToolExecution(
                    "get_library_settings",
                    payload,
                    List.of(),
                    List.of(
                            "Tìm sách đang có sẵn",
                            "Cách gia hạn sách",
                            "Phí trả chậm"
                    )
            );

        } catch (
                Exception exception
        ) {
            return error(
                    "get_library_settings",
                    "Không kết nối được dịch vụ quy định thư viện"
            );
        }
    }

    /*
     * =====================================================
     * PERSONAL LIBRARY DATA
     * =====================================================
     */
    private ToolExecution getMyLibrary(
            JsonNode arguments,
            String authorization
    ) {

        String topic =
                arguments
                        .path("topic")
                        .asText("loans");

        if (
                authorization == null ||
                        authorization.isBlank()
        ) {
            return error(
                    "get_my_library",

                    "Người dùng chưa đăng nhập. Cần đăng nhập trước khi tra cứu dữ liệu cá nhân."
            );
        }

        String path =
                switch (
                        topic
                        ) {
                    case "reservations" ->
                            "/api/reservations/me";

                    case "fines" ->
                            "/api/fines/me";

                    default ->
                            "/api/loans/me";
                };

        try {
            JsonNode data =
                    circulation
                            .get()
                            .uri(
                                    path
                            )
                            .header(
                                    HttpHeaders.AUTHORIZATION,
                                    authorization
                            )
                            .retrieve()
                            .body(
                                    JsonNode.class
                            );

            ObjectNode payload =
                    mapper.createObjectNode();

            payload.put(
                    "topic",
                    topic
            );

            payload.set(
                    "data",

                    data == null
                            ? mapper
                              .createArrayNode()
                            : data
            );

            payload.put(
                    "instruction",

                    "Đây là dữ liệu của tài khoản đang đăng nhập. Chỉ tóm tắt dữ liệu có thật; không suy đoán thêm khoản phạt, phiếu mượn hoặc đặt trước."
            );

            return new ToolExecution(
                    "get_my_library",
                    payload,
                    List.of(),
                    List.of(
                            "Sách tôi đang mượn",
                            "Sách tôi đặt trước",
                            "Tiền phạt của tôi"
                    )
            );

        } catch (
                RestClientResponseException exception
        ) {
            int status =
                    exception
                            .getStatusCode()
                            .value();

            if (
                    status == 401 ||
                            status == 403
            ) {
                return error(
                        "get_my_library",

                        "Phiên đăng nhập hiện tại không có quyền truy cập dữ liệu cá nhân này."
                );
            }

            return error(
                    "get_my_library",
                    "Không lấy được dữ liệu tài khoản hiện tại"
            );

        } catch (
                Exception exception
        ) {
            return error(
                    "get_my_library",
                    "Không lấy được dữ liệu tài khoản hiện tại"
            );
        }
    }

    /*
     * =====================================================
     * LIBRARY STATISTICS
     *
     * Không tính số liệu trong chatbot.
     * Lấy trực tiếp /api/dashboard/stats
     * của circulation-service.
     * =====================================================
     */
    private ToolExecution getLibraryStatistics(
            JsonNode arguments,
            String authorization
    ) {

        String topic =
                arguments
                        .path("topic")
                        .asText("overview");

        if (
                authorization == null ||
                        authorization.isBlank()
        ) {
            return error(
                    "get_library_statistics",

                    "Chưa có phiên đăng nhập để kiểm tra quyền xem thống kê thư viện."
            );
        }

        try {
            JsonNode stats =
                    circulation
                            .get()
                            .uri(
                                    "/api/dashboard/stats"
                            )
                            .header(
                                    HttpHeaders.AUTHORIZATION,
                                    authorization
                            )
                            .retrieve()
                            .body(
                                    JsonNode.class
                            );

            if (
                    stats == null ||
                            stats.isNull()
            ) {
                return error(
                        "get_library_statistics",

                        "Dịch vụ thống kê không trả về dữ liệu."
                );
            }

            ObjectNode payload =
                    mapper.createObjectNode();

            payload.put(
                    "topic",
                    topic
            );

            payload.set(
                    "stats",
                    stats
            );

            payload.put(
                    "instruction",

                    "Dùng đúng số liệu trong stats. Với top sách, giữ nguyên thứ hạng và số lượt mượn từ topBorrowedBooks. Không thay dữ liệu thiếu bằng gợi ý sách khác."
            );

            /*
             * Stats có bookId.
             *
             * Lấy tối đa 3 chi tiết sách
             * để frontend có card đẹp.
             *
             * Nội dung văn bản vẫn có thể
             * trả đủ top 5 từ stats.
             */
            List<BookSuggestion> cards =
                    loadTopBookCards(
                            stats.path(
                                    "topBorrowedBooks"
                            )
                    );

            return new ToolExecution(
                    "get_library_statistics",
                    payload,
                    cards,
                    List.of(
                            "Sách được mượn nhiều",
                            "Tình hình mượn trả",
                            "Quy định mượn sách"
                    )
            );

        } catch (
                RestClientResponseException exception
        ) {
            int status =
                    exception
                            .getStatusCode()
                            .value();

            if (
                    status == 401 ||
                            status == 403
            ) {
                return error(
                        "get_library_statistics",

                        "Tài khoản hiện tại không có quyền xem thống kê quản trị của thư viện."
                );
            }

            return error(
                    "get_library_statistics",

                    "Không lấy được số liệu thống kê thư viện."
            );

        } catch (
                Exception exception
        ) {
            return error(
                    "get_library_statistics",

                    "Không lấy được số liệu thống kê thư viện."
            );
        }
    }

    private List<BookSuggestion> loadTopBookCards(
            JsonNode topBorrowedBooks
    ) {

        List<BookSuggestion> cards =
                new ArrayList<>();

        if (
                topBorrowedBooks == null ||
                        !topBorrowedBooks.isArray()
        ) {
            return cards;
        }

        for (
                JsonNode entry :
                topBorrowedBooks
        ) {
            if (
                    cards.size() >=
                            MAX_BOOK_CARDS
            ) {
                break;
            }

            long bookId =
                    entry
                            .path("bookId")
                            .asLong(0);

            if (
                    bookId <= 0
            ) {
                continue;
            }

            try {
                JsonNode book =
                        catalog
                                .get()
                                .uri(
                                        "/api/books/{id}",
                                        bookId
                                )
                                .retrieve()
                                .body(
                                        JsonNode.class
                                );

                if (
                        book != null &&
                                !book.isNull()
                ) {
                    cards.add(
                            toBook(
                                    book
                            )
                    );
                }

            } catch (
                    Exception ignored
            ) {
                /*
                 * Nếu catalog tạm lỗi,
                 * dữ liệu thống kê vẫn hợp lệ.
                 *
                 * Chỉ bỏ card hình ảnh,
                 * không làm hỏng câu trả lời.
                 */
            }
        }

        return cards;
    }

    /*
     * =====================================================
     * CURRENT TIME
     * =====================================================
     */
    private ToolExecution getCurrentTime() {

        ZonedDateTime now =
                ZonedDateTime.now(
                        ZoneId.of(
                                "Asia/Ho_Chi_Minh"
                        )
                );

        ObjectNode payload =
                mapper.createObjectNode();

        payload.put(
                "timezone",
                "Asia/Ho_Chi_Minh"
        );

        payload.put(
                "iso",
                now.toString()
        );

        payload.put(
                "formatted",

                now.format(
                        DateTimeFormatter.ofPattern(
                                "HH:mm, dd/MM/yyyy"
                        )
                )
        );

        return new ToolExecution(
                "get_current_time",
                payload,
                List.of(),
                List.of()
        );
    }

    /*
     * =====================================================
     * QUICK REPLIES
     * =====================================================
     */
    public List<String> quickRepliesForBooks(
            List<BookSuggestion> books
    ) {

        if (
                books == null ||
                        books.isEmpty()
        ) {
            return List.of(
                    "Gợi ý sách đang có sẵn",
                    "Sách thiếu nhi",
                    "Sách được đánh giá cao"
            );
        }

        BookSuggestion first =
                books.getFirst();

        return List.of(
                "Sách tương tự " +
                        first.title(),

                "Sách của " +
                        first.authorName(),

                "Quy định mượn sách"
        );
    }

    /*
     * =====================================================
     * BOOK DTO
     * =====================================================
     */
    private BookSuggestion toBook(
            JsonNode book
    ) {

        return new BookSuggestion(
                book
                        .path("id")
                        .asLong(),

                book
                        .path("title")
                        .asText(""),

                book
                        .path("authorName")
                        .asText(
                                "Chưa rõ tác giả"
                        ),

                book
                        .path("categoryName")
                        .asText(
                                "Chưa phân loại"
                        ),

                book
                        .path("description")
                        .asText(""),

                nullableInt(
                        book,
                        "publicationYear"
                ),

                book
                        .path("language")
                        .asText(""),

                nullableInt(
                        book,
                        "pageCount"
                ),

                book
                        .path("rating")
                        .isNumber()

                        ? book
                          .path("rating")
                          .asDouble()

                        : null,

                book
                        .path("coverUrl")
                        .asText(""),

                book
                        .path("availableCopies")
                        .asInt(0)
        );
    }

    private Integer nullableInt(
            JsonNode node,
            String field
    ) {

        JsonNode value =
                node.path(
                        field
                );

        return value.isNumber()
                ? value.asInt()
                : null;
    }

    /*
     * =====================================================
     * TOOL ERROR
     *
     * Không trả câu trả lời fix cứng.
     * Chỉ trả trạng thái thực cho Gemini
     * để Gemini tự diễn đạt theo câu hỏi.
     * =====================================================
     */
    private ToolExecution error(
            String tool,
            String message
    ) {

        ObjectNode payload =
                mapper.createObjectNode();

        payload.put(
                "error",
                message
        );

        payload.put(
                "instruction",

                "Giải thích đúng lỗi/giới hạn này cho người dùng. Không suy đoán dữ liệu thay thế và không chuyển sang một kết luận khác không có căn cứ."
        );

        return new ToolExecution(
                tool,
                payload,
                List.of(),
                List.of()
        );
    }

    /*
     * =====================================================
     * GEMINI FUNCTION DECLARATIONS
     * =====================================================
     */
    public ArrayNode declarations() {

        ArrayNode tools =
                mapper.createArrayNode();

        /*
         * SEARCH BOOKS
         */
        ObjectNode search =
                tools.addObject();

        search.put(
                "type",
                "function"
        );

        search.put(
                "name",
                "search_books"
        );

        search.put(
                "description",

                "Tìm sách thật trong Smart Library. Dùng cho tên sách, tác giả, thể loại, chủ đề, gợi ý sách, đánh giá, số bản còn lại hoặc sách đang có sẵn. Tự sửa lỗi chính tả và viết query ngắn, sát ý. Nếu người dùng nói 'cuốn này' hoặc 'còn bao nhiêu', dùng ngữ cảnh để tạo query cho đúng cuốn gần nhất."
        );

        ObjectNode searchParameters =
                search.putObject(
                        "parameters"
                );

        searchParameters.put(
                "type",
                "object"
        );

        ObjectNode searchProperties =
                searchParameters.putObject(
                        "properties"
                );

        searchProperties
                .putObject(
                        "query"
                )
                .put(
                        "type",
                        "string"
                )
                .put(
                        "description",

                        "Tên sách, tác giả, thể loại, chủ đề hoặc nhu cầu đọc đã được viết lại ngắn gọn, chính xác."
                );

        searchProperties
                .putObject(
                        "available_only"
                )
                .put(
                        "type",
                        "boolean"
                )
                .put(
                        "description",

                        "true nếu người dùng chỉ muốn sách hiện còn bản để mượn"
                );

        searchProperties
                .putObject(
                        "limit"
                )
                .put(
                        "type",
                        "integer"
                )
                .put(
                        "description",

                        "Số kết quả cần lấy, từ 1 đến 3"
                );

        searchParameters
                .putArray(
                        "required"
                )
                .add(
                        "query"
                )
                .add(
                        "available_only"
                )
                .add(
                        "limit"
                );

        /*
         * BOOK DETAILS
         */
        ObjectNode details =
                tools.addObject();

        details.put(
                "type",
                "function"
        );

        details.put(
                "name",
                "get_book_details"
        );

        details.put(
                "description",

                "Lấy chi tiết chính xác của một sách khi đã biết book_id từ kết quả tìm kiếm."
        );

        ObjectNode detailsParams =
                details.putObject(
                        "parameters"
                );

        detailsParams.put(
                "type",
                "object"
        );

        detailsParams
                .putObject(
                        "properties"
                )
                .putObject(
                        "book_id"
                )
                .put(
                        "type",
                        "integer"
                );

        detailsParams
                .putArray(
                        "required"
                )
                .add(
                        "book_id"
                );

        /*
         * SETTINGS
         */
        ObjectNode settings =
                tools.addObject();

        settings.put(
                "type",
                "function"
        );

        settings.put(
                "name",
                "get_library_settings"
        );

        settings.put(
                "description",

                "Lấy dữ liệu chính thức về thời hạn mượn, gia hạn, phí quá hạn, phí mất/hỏng sách, giờ mở cửa, liên hệ và đặt trước. Dùng thay cho suy đoán."
        );

        ObjectNode settingsParameters =
                settings.putObject(
                        "parameters"
                );

        settingsParameters.put(
                "type",
                "object"
        );

        settingsParameters
                .putObject(
                        "properties"
                )
                .putObject(
                        "topic"
                )
                .put(
                        "type",
                        "string"
                )
                .putArray(
                        "enum"
                )
                .add(
                        "loan"
                )
                .add(
                        "renewal"
                )
                .add(
                        "overdue"
                )
                .add(
                        "lost_or_damaged"
                )
                .add(
                        "opening_hours"
                )
                .add(
                        "contact"
                )
                .add(
                        "reservation"
                )
                .add(
                        "all"
                );

        settingsParameters
                .putArray(
                        "required"
                )
                .add(
                        "topic"
                );

        /*
         * MY LIBRARY
         */
        ObjectNode mine =
                tools.addObject();

        mine.put(
                "type",
                "function"
        );

        mine.put(
                "name",
                "get_my_library"
        );

        mine.put(
                "description",

                "Lấy dữ liệu riêng của tài khoản đang đăng nhập: sách đang mượn, đặt trước hoặc tiền phạt. Chỉ dùng khi người dùng hỏi về chính tài khoản của họ."
        );

        ObjectNode mineParams =
                mine.putObject(
                        "parameters"
                );

        mineParams.put(
                "type",
                "object"
        );

        mineParams
                .putObject(
                        "properties"
                )
                .putObject(
                        "topic"
                )
                .put(
                        "type",
                        "string"
                )
                .putArray(
                        "enum"
                )
                .add(
                        "loans"
                )
                .add(
                        "reservations"
                )
                .add(
                        "fines"
                );

        mineParams
                .putArray(
                        "required"
                )
                .add(
                        "topic"
                );

        /*
         * STATISTICS
         */
        ObjectNode statistics =
                tools.addObject();

        statistics.put(
                "type",
                "function"
        );

        statistics.put(
                "name",
                "get_library_statistics"
        );

        statistics.put(
                "description",

                "Lấy số liệu thống kê thật của Smart Library: tổng phiếu mượn, đang mượn, quá hạn, đặt trước, tiền phạt, xu hướng mượn/trả và top sách được mượn nhiều. API thống kê có thể yêu cầu quyền ADMIN hoặc LIBRARIAN; nếu không đủ quyền, công cụ sẽ trả lỗi quyền và phải nói đúng lỗi đó."
        );

        ObjectNode statisticsParams =
                statistics.putObject(
                        "parameters"
                );

        statisticsParams.put(
                "type",
                "object"
        );

        statisticsParams
                .putObject(
                        "properties"
                )
                .putObject(
                        "topic"
                )
                .put(
                        "type",
                        "string"
                )
                .putArray(
                        "enum"
                )
                .add(
                        "overview"
                )
                .add(
                        "top_borrowed"
                )
                .add(
                        "trends"
                );

        statisticsParams
                .putArray(
                        "required"
                )
                .add(
                        "topic"
                );

        /*
         * CURRENT TIME
         */
        ObjectNode time =
                tools.addObject();

        time.put(
                "type",
                "function"
        );

        time.put(
                "name",
                "get_current_time"
        );

        time.put(
                "description",

                "Lấy giờ và ngày hiện tại chính xác theo múi giờ Việt Nam."
        );

        ObjectNode timeParameters =
                time.putObject(
                        "parameters"
                );

        timeParameters.put(
                "type",
                "object"
        );

        timeParameters.putObject(
                "properties"
        );

        return tools;
    }

    public record ToolExecution(
            String name,
            JsonNode payload,
            List<BookSuggestion> books,
            List<String> quickReplies
    ) {
    }
}