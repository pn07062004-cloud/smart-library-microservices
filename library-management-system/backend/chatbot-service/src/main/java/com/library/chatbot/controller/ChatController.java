package com.library.chatbot.controller;

import com.library.chatbot.dto.ChatDtos.ChatRequest;
import com.library.chatbot.dto.ChatDtos.ChatResponse;
import com.library.chatbot.service.ChatbotService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {
    private static final int MAX_MESSAGE_LENGTH = 1000;
    private static final int MAX_HISTORY_ITEMS = 20;

    private final ChatbotService service;

    @PostMapping
    ChatResponse chat(
            @RequestBody ChatRequest request,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) {
        validate(request);
        return service.answer(request.message(), request.history(), request.previousInteractionId(), authorization);
    }

    @PostMapping(value = "/stream", produces = MediaType.APPLICATION_NDJSON_VALUE)
    ResponseEntity<StreamingResponseBody> stream(
            @RequestBody ChatRequest request,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) {
        validate(request);
        StreamingResponseBody body = outputStream ->
                service.streamAnswer(request.message(), request.history(), request.previousInteractionId(), authorization, outputStream);

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_NDJSON)
                .cacheControl(CacheControl.noStore())
                .header("X-Accel-Buffering", "no")
                .body(body);
    }

    @GetMapping("/health")
    String health() {
        return "Libby sẵn sàng";
    }

    private void validate(ChatRequest request) {
        if (request == null || request.message() == null || request.message().length() > MAX_MESSAGE_LENGTH) {
            throw new IllegalArgumentException("Tin nhắn không hợp lệ hoặc quá dài");
        }
        if (request.history() != null && request.history().size() > MAX_HISTORY_ITEMS) {
            throw new IllegalArgumentException("Lịch sử hội thoại quá dài");
        }
    }
}