package com.library.chatbot.dto;

import java.util.List;

public final class ChatDtos {
    private ChatDtos() {
    }

    // role: "user" hoặc "model" (câu trả lời trước của Libby)
    public record ChatTurn(String role, String content) {
    }

    public record ChatRequest(
            String message,
            List<ChatTurn> history,
            String previousInteractionId
    ) {
    }

    /**
     * Dữ liệu sách dùng cho cả thẻ hiển thị ở frontend và ngữ cảnh RAG.
     * Các trường mô tả/thể loại/đánh giá giúp AI giải thích vì sao sách phù hợp,
     * thay vì chỉ lặp lại tên sách và tác giả.
     */
    public record BookSuggestion(
            Long id,
            String title,
            String authorName,
            String categoryName,
            String description,
            Integer publicationYear,
            String language,
            Integer pageCount,
            Double rating,
            String coverUrl,
            Integer availableCopies
    ) {
    }

    public record ChatResponse(
            String reply,
            List<String> quickReplies,
            List<BookSuggestion> books,
            String interactionId
    ) {
    }
}