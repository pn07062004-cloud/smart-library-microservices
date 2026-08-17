package com.library.chatbot.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.library.chatbot.dto.ChatDtos.BookSuggestion;
import com.library.chatbot.dto.ChatDtos.ChatResponse;
import com.library.chatbot.dto.ChatDtos.ChatTurn;
import com.library.chatbot.service.GeminiClient.AgentResult;
import com.library.chatbot.service.GeminiClient.GeminiHttpException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.OutputStream;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ChatbotService {

    private static final int MAX_HISTORY_ITEMS = 12;
    private static final int MAX_HISTORY_TEXT = 900;
    private static final int MAX_PRESENTED_BOOKS = 3;

    private static final String SYSTEM_PROMPT = """
            Bạn là Libby, trợ lý AI của Smart Library. Hãy hiểu ngôn ngữ tự nhiên, lỗi chính tả, viết tắt và ngữ cảnh; trả lời bằng tiếng Việt tự nhiên, chính xác, ngắn gọn và đúng trọng tâm.

            NGUYÊN TẮC LÀM VIỆC:
            1. Hiểu ý định thay vì bám từ khóa. Các cách nói như “cuốn này”, “cuốn vừa rồi”, “còn mấy bản”, “nó” phải tham chiếu đúng thực thể gần nhất trong hội thoại khi ngữ cảnh đủ rõ. Nếu có nhiều khả năng hợp lý thì hỏi lại ngắn gọn.
            2. Ghi nhớ các thông tin người dùng tự cung cấp trong cùng chuỗi hội thoại, ví dụ tên gọi. Không tự suy ra hoặc thay đổi thông tin đó khi người dùng chưa nói rõ.
            3. Mọi dữ liệu thuộc Smart Library phải được kiểm chứng bằng công cụ phù hợp trước khi trả lời: sách, tác giả, thể loại, số bản còn lại, đánh giá, quy định, phí, giờ mở cửa, liên hệ, dữ liệu tài khoản và số liệu thống kê. Không dùng trí nhớ của mô hình để tạo các dữ kiện này.
            4. Nếu công cụ không có dữ liệu, báo lỗi, không đủ quyền hoặc hiện chưa có công cụ để kiểm chứng loại thông tin được hỏi, hãy nói rõ giới hạn đó theo ngữ cảnh. Tuyệt đối không bù phần thiếu bằng suy đoán hoặc dựng thông tin có vẻ hợp lý.
            5. Libby là trợ lý AI, không phải thủ thư hay nhân viên con người. Không tự nhận mình là thủ thư. Không khẳng định thư viện có hay không có nhân viên, cũng không nêu tên nhân sự nếu chưa có dữ liệu công cụ xác nhận.
            6. Nếu người dùng hỏi trạng thái phát triển, mức độ hoàn thiện, mã nguồn hoặc chức năng đã triển khai của dự án, không suy ra chỉ từ những chức năng Libby đang sử dụng. Chỉ khẳng định khi có dữ liệu/công cụ xác minh; nếu không thì nói rằng bạn không thể xác nhận trạng thái toàn bộ mã nguồn.
            7. Với câu hỏi thống kê của thư viện như tổng số phiếu, quá hạn, top sách được mượn nhiều hoặc xu hướng mượn/trả, dùng get_library_statistics. Nếu tài khoản không có quyền xem số liệu quản trị, giải thích đúng lỗi quyền truy cập thay vì thay bằng gợi ý ngẫu nhiên.
            8. Với dữ liệu cá nhân như “tôi đang mượn gì”, “sách tôi đặt”, “tiền phạt của tôi”, dùng get_my_library. Nếu chưa đăng nhập thì yêu cầu đăng nhập; không suy đoán dữ liệu tài khoản.
            9. Khi tìm hoặc gợi ý sách, dùng search_books; khi đã biết book_id và cần thông tin chính xác của một cuốn, dùng get_book_details. Chỉ giới thiệu sách thực sự có trong kết quả công cụ. Thông thường chọn tối đa 3 cuốn phù hợp nhất và giải thích ngắn gọn lý do.
            10. Với quy định, gia hạn, phí, giờ mở cửa, liên hệ hoặc đặt trước, dùng get_library_settings. Không tự tạo quy định hoặc tiện ích ngoài dữ liệu trả về.
            11. Trò chuyện đời thường hoặc kiến thức chung không phụ thuộc Smart Library thì trả lời trực tiếp, tự nhiên. Không ép mọi câu hỏi quay về chủ đề sách và không thêm cảnh báo không cần thiết.
            12. Không tự thực hiện mượn, trả, gia hạn, đặt sách hay thay đổi dữ liệu trong chat nếu không có công cụ hành động tương ứng. Có thể hướng dẫn người dùng thao tác trên hệ thống.
            13. Trả lời thường trong 1-4 câu; có thể dài hơn khi câu hỏi cần giải thích. Không lặp lại câu hỏi, không xã giao dài và không giả vờ biết điều chưa được xác minh.
            """;

    private final GeminiClient gemini;
    private final LibraryTools libraryTools;
    private final ObjectMapper mapper;

    public ChatResponse answer(
            String raw,
            List<ChatTurn> history,
            String previousInteractionId,
            String authorization
    ) {
        String message = raw == null ? "" : raw.trim();

        if (message.isBlank()) {
            return new ChatResponse(
                    "Bạn hãy nhập câu hỏi nhé.",
                    defaultQuickReplies(),
                    List.of(),
                    previousInteractionId
            );
        }

        try {
            AgentResult result = gemini.chat(
                    SYSTEM_PROMPT,
                    sanitizeHistory(history),
                    message,
                    previousInteractionId,
                    authorization
            );

            List<BookSuggestion> presentedBooks =
                    filterPresentedBooks(
                            result.reply(),
                            result.books()
                    );

            List<String> quickReplies =
                    resolveQuickReplies(
                            presentedBooks,
                            result.books(),
                            result.quickReplies()
                    );

            return new ChatResponse(
                    result.reply(),
                    quickReplies,
                    presentedBooks,
                    result.interactionId()
            );

        } catch (GeminiHttpException exception) {
            return geminiHttpFallback(
                    exception,
                    previousInteractionId
            );

        } catch (Exception exception) {
            log(exception);

            return new ChatResponse(
                    "Libby đang tạm thời không kết nối được với AI hoặc một dịch vụ thư viện. Bạn thử lại sau một chút nhé.",
                    defaultQuickReplies(),
                    List.of(),
                    previousInteractionId
            );
        }
    }

    public void streamAnswer(
            String raw,
            List<ChatTurn> history,
            String previousInteractionId,
            String authorization,
            OutputStream outputStream
    ) throws IOException {

        String message =
                raw == null
                        ? ""
                        : raw.trim();

        if (message.isBlank()) {
            ChatResponse empty =
                    new ChatResponse(
                            "Bạn hãy nhập câu hỏi nhé.",
                            defaultQuickReplies(),
                            List.of(),
                            previousInteractionId
                    );

            writeMeta(
                    outputStream,
                    empty.books(),
                    empty.quickReplies(),
                    empty.interactionId()
            );

            writeDelta(
                    outputStream,
                    empty.reply()
            );

            writeDone(
                    outputStream,
                    empty.reply(),
                    empty.interactionId()
            );

            return;
        }

        StringBuilder streamedReply =
                new StringBuilder();

        final String[] lastInteractionId =
                new String[]{
                        previousInteractionId
                };

        try {
            AgentResult result =
                    gemini.streamChat(
                            SYSTEM_PROMPT,
                            sanitizeHistory(history),
                            message,
                            previousInteractionId,
                            authorization,

                            new GeminiClient.StreamObserver() {

                                @Override
                                public void onText(
                                        String text
                                ) {
                                    try {
                                        streamedReply.append(
                                                text
                                        );

                                        writeDelta(
                                                outputStream,
                                                text
                                        );

                                    } catch (
                                            IOException exception
                                    ) {
                                        throw new StreamWriteException(
                                                exception
                                        );
                                    }
                                }

                                @Override
                                public void onMeta(
                                        List<BookSuggestion> books,
                                        List<String> quickReplies,
                                        String interactionId
                                ) {
                                    /*
                                     * Không đẩy card sách trung gian
                                     * lên giao diện.
                                     *
                                     * Gemini có thể tìm nhiều lần
                                     * trước khi chốt câu trả lời.
                                     *
                                     * Chỉ card thực sự được nhắc
                                     * trong câu trả lời cuối
                                     * mới được gửi xuống frontend.
                                     */

                                    if (
                                            interactionId != null &&
                                                    !interactionId.isBlank()
                                    ) {
                                        lastInteractionId[0] =
                                                interactionId;
                                    }
                                }

                                @Override
                                public void onInteractionId(
                                        String interactionId
                                ) {
                                    if (
                                            interactionId != null &&
                                                    !interactionId.isBlank()
                                    ) {
                                        lastInteractionId[0] =
                                                interactionId;
                                    }
                                }
                            }
                    );

            List<BookSuggestion> presentedBooks =
                    filterPresentedBooks(
                            result.reply(),
                            result.books()
                    );

            List<String> quickReplies =
                    resolveQuickReplies(
                            presentedBooks,
                            result.books(),
                            result.quickReplies()
                    );

            lastInteractionId[0] =
                    result.interactionId();

            writeMeta(
                    outputStream,
                    presentedBooks,
                    quickReplies,
                    lastInteractionId[0]
            );

            writeDone(
                    outputStream,
                    result.reply(),
                    lastInteractionId[0]
            );

        } catch (
                StreamWriteException exception
        ) {
            throw exception.ioException();

        } catch (
                GeminiHttpException exception
        ) {
            ChatResponse fallback =
                    geminiHttpFallback(
                            exception,
                            previousInteractionId
                    );

            writeMeta(
                    outputStream,
                    fallback.books(),
                    fallback.quickReplies(),
                    fallback.interactionId()
            );

            if (streamedReply.isEmpty()) {
                writeDelta(
                        outputStream,
                        fallback.reply()
                );
            }

            writeDone(
                    outputStream,

                    streamedReply.isEmpty()
                            ? fallback.reply()
                            : streamedReply.toString(),

                    fallback.interactionId()
            );

        } catch (
                Exception exception
        ) {
            log(exception);

            String text =
                    "Libby đang tạm thời không kết nối được. Bạn thử lại sau một chút nhé.";

            if (streamedReply.isEmpty()) {
                writeDelta(
                        outputStream,
                        text
                );
            }

            writeDone(
                    outputStream,

                    streamedReply.isEmpty()
                            ? text
                            : streamedReply.toString(),

                    lastInteractionId[0]
            );
        }
    }

    /*
     * Card sách trả về frontend
     * phải thực sự xuất hiện trong
     * câu trả lời cuối của Gemini.
     *
     * Đây là xử lý tổng quát,
     * không fix cứng tên sách.
     */
    private List<BookSuggestion> filterPresentedBooks(
            String reply,
            List<BookSuggestion> candidates
    ) {

        if (
                reply == null ||
                        reply.isBlank() ||
                        candidates == null ||
                        candidates.isEmpty()
        ) {
            return List.of();
        }

        String normalizedReply =
                normalizeForMatch(
                        reply
                );

        Set<String> replyWords =
                new LinkedHashSet<>(
                        List.of(
                                normalizedReply.split(
                                        "\\s+"
                                )
                        )
                );

        List<BookSuggestion> selected =
                new ArrayList<>();

        for (
                BookSuggestion book :
                candidates
        ) {
            if (
                    book == null ||
                            book.id() == null ||
                            book.title() == null ||
                            book.title().isBlank()
            ) {
                continue;
            }

            if (
                    !mentionsBook(
                            normalizedReply,
                            replyWords,
                            book.title()
                    )
            ) {
                continue;
            }

            selected.add(
                    book
            );

            if (
                    selected.size() >=
                            MAX_PRESENTED_BOOKS
            ) {
                break;
            }
        }

        return List.copyOf(
                selected
        );
    }

    private boolean mentionsBook(
            String normalizedReply,
            Set<String> replyWords,
            String title
    ) {

        String normalizedTitle =
                normalizeForMatch(
                        title
                );

        if (
                normalizedTitle.isBlank()
        ) {
            return false;
        }

        /*
         * Trường hợp model nhắc đầy đủ tên sách.
         */
        if (
                normalizedReply.contains(
                        normalizedTitle
                )
        ) {
            return true;
        }

        String[] titleWords =
                normalizedTitle.split(
                        "\\s+"
                );

        List<String> meaningfulWords =
                new ArrayList<>();

        for (
                String word :
                titleWords
        ) {
            if (
                    word.length() >= 3
            ) {
                meaningfulWords.add(
                        word
                );
            }
        }

        if (
                meaningfulWords.isEmpty()
        ) {
            return false;
        }

        int matched = 0;

        for (
                String word :
                meaningfulWords
        ) {
            if (
                    replyWords.contains(
                            word
                    )
            ) {
                matched++;
            }
        }

        int required =
                meaningfulWords.size() <= 2

                        ? meaningfulWords.size()

                        : Math.max(
                        2,

                        (int) Math.ceil(
                                meaningfulWords.size()
                                * 0.6
                        )
                );

        if (
                matched >= required
        ) {
            return true;
        }

        /*
         * Một số tên sách dài có thể
         * được Gemini gọi bằng từ định danh
         * nổi bật, ví dụ "Sapiens".
         *
         * Chỉ cho phép khi từ đó đủ dài,
         * tránh khớp nhầm từ chung.
         */
        String first =
                meaningfulWords.getFirst();

        return
                first.length() >= 6 &&
                        replyWords.contains(
                                first
                        );
    }

    private List<String> resolveQuickReplies(
            List<BookSuggestion> presentedBooks,
            List<BookSuggestion> candidateBooks,
            List<String> toolQuickReplies
    ) {

        /*
         * Nếu có sách thực sự được chọn,
         * quick reply dựa đúng cuốn đó.
         */
        if (
                presentedBooks != null &&
                        !presentedBooks.isEmpty()
        ) {
            return libraryTools
                    .quickRepliesForBooks(
                            presentedBooks
                    );
        }

        /*
         * Tool trả ứng viên sách nhưng
         * Gemini không hề chọn/nhắc cuốn đó.
         *
         * Không để quick reply cũ
         * kéo sang cuốn không liên quan.
         */
        if (
                candidateBooks != null &&
                        !candidateBooks.isEmpty()
        ) {
            return defaultQuickReplies();
        }

        if (
                toolQuickReplies == null ||
                        toolQuickReplies.isEmpty()
        ) {
            return defaultQuickReplies();
        }

        return List.copyOf(
                toolQuickReplies
        );
    }

    private String normalizeForMatch(
            String value
    ) {

        if (
                value == null ||
                        value.isBlank()
        ) {
            return "";
        }

        return Normalizer
                .normalize(
                        value,
                        Normalizer.Form.NFD
                )
                .replaceAll(
                        "\\p{M}+",
                        ""
                )
                .replace(
                        'đ',
                        'd'
                )
                .replace(
                        'Đ',
                        'D'
                )
                .toLowerCase(
                        Locale.ROOT
                )
                .replaceAll(
                        "[^a-z0-9\\s]",
                        " "
                )
                .replaceAll(
                        "\\s+",
                        " "
                )
                .trim();
    }

    private ChatResponse geminiHttpFallback(
            GeminiHttpException exception,
            String previousInteractionId
    ) {

        log(
                exception
        );

        String text =
                switch (
                        exception.status()
                        ) {
                    case 429 ->
                            "Libby đang chạm giới hạn Gemini tạm thời. Bạn đợi một chút rồi thử lại nhé.";

                    case 401, 403 ->
                            "Gemini API key hiện không hợp lệ hoặc không có quyền dùng model này.";

                    default ->
                            "Gemini đang tạm thời không phản hồi. Bạn thử lại sau một chút nhé.";
                };

        return new ChatResponse(
                text,
                defaultQuickReplies(),
                List.of(),
                previousInteractionId
        );
    }

    private List<ChatTurn> sanitizeHistory(
            List<ChatTurn> history
    ) {

        if (
                history == null ||
                        history.isEmpty()
        ) {
            return List.of();
        }

        int from =
                Math.max(
                        0,
                        history.size() -
                                MAX_HISTORY_ITEMS
                );

        List<ChatTurn> cleaned =
                new ArrayList<>();

        for (
                ChatTurn turn :
                history.subList(
                        from,
                        history.size()
                )
        ) {
            if (
                    turn == null ||
                            turn.content() == null ||
                            turn.content().isBlank()
            ) {
                continue;
            }

            String role =
                    "model".equalsIgnoreCase(
                            turn.role()
                    )
                            ? "model"
                            : "user";

            String content =
                    turn.content().trim();

            if (
                    content.length() >
                            MAX_HISTORY_TEXT
            ) {
                content =
                        content.substring(
                                0,
                                MAX_HISTORY_TEXT
                        ) +
                                "…";
            }

            cleaned.add(
                    new ChatTurn(
                            role,
                            content
                    )
            );
        }

        return cleaned;
    }

    private List<String> defaultQuickReplies() {
        return List.of(
                "Gợi ý sách đang có sẵn",
                "Sách thiếu nhi",
                "Quy định mượn sách"
        );
    }

    private void writeMeta(
            OutputStream outputStream,
            List<BookSuggestion> books,
            List<String> quickReplies,
            String interactionId
    ) throws IOException {

        ObjectNode event =
                mapper.createObjectNode();

        event.put(
                "type",
                "meta"
        );

        event.set(
                "books",

                mapper.valueToTree(
                        books == null
                                ? List.of()
                                : books
                )
        );

        event.set(
                "quickReplies",

                mapper.valueToTree(
                        quickReplies == null
                                ? List.of()
                                : quickReplies
                )
        );

        if (
                interactionId != null &&
                        !interactionId.isBlank()
        ) {
            event.put(
                    "interactionId",
                    interactionId
            );
        }

        writeEvent(
                outputStream,
                event
        );
    }

    private void writeDelta(
            OutputStream outputStream,
            String delta
    ) throws IOException {

        ObjectNode event =
                mapper.createObjectNode();

        event.put(
                "type",
                "delta"
        );

        event.put(
                "delta",

                delta == null
                        ? ""
                        : delta
        );

        writeEvent(
                outputStream,
                event
        );
    }

    private void writeDone(
            OutputStream outputStream,
            String reply,
            String interactionId
    ) throws IOException {

        ObjectNode event =
                mapper.createObjectNode();

        event.put(
                "type",
                "done"
        );

        event.put(
                "reply",

                reply == null
                        ? ""
                        : reply
        );

        if (
                interactionId != null &&
                        !interactionId.isBlank()
        ) {
            event.put(
                    "interactionId",
                    interactionId
            );
        }

        writeEvent(
                outputStream,
                event
        );
    }

    private void writeEvent(
            OutputStream outputStream,
            ObjectNode event
    ) throws IOException {

        outputStream.write(
                mapper.writeValueAsBytes(
                        event
                )
        );

        outputStream.write(
                '\n'
        );

        outputStream.flush();
    }

    private void log(
            Exception exception
    ) {

        System.err.printf(
                "[Libby] %s - %s%n",
                exception
                        .getClass()
                        .getSimpleName(),
                exception
                        .getMessage()
        );
    }

    private static final class StreamWriteException
            extends RuntimeException {

        private final IOException ioException;

        StreamWriteException(
                IOException ioException
        ) {
            super(
                    ioException
            );

            this.ioException =
                    ioException;
        }

        IOException ioException() {
            return ioException;
        }
    }
}