package com.library.chatbot.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.library.chatbot.dto.ChatDtos.BookSuggestion;
import com.library.chatbot.dto.ChatDtos.ChatTurn;
import com.library.chatbot.service.LibraryTools.ToolExecution;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class GeminiClient {

    private static final int MAX_TOOL_ROUNDS = 3;

    private final ObjectMapper mapper;
    private final LibraryTools libraryTools;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    @Value("${gemini.base-url:https://generativelanguage.googleapis.com}")
    private String baseUrl;

    @Value("${gemini.api-version:v1}")
    private String apiVersion;

    @Value("${gemini.api-key:}")
    private String apiKey;

    @Value("${gemini.model:gemini-3.5-flash-lite}")
    private String model;

    @Value("${gemini.enabled:true}")
    private boolean enabled;

    @Value("${gemini.max-output-tokens:320}")
    private int maxOutputTokens;

    @Value("${gemini.thinking-level:low}")
    private String thinkingLevel;

    @Value("${gemini.read-timeout:45s}")
    private Duration readTimeout;

    public boolean isConfigured() {
        return enabled && apiKey != null && !apiKey.isBlank();
    }

    public AgentResult chat(
            String systemPrompt,
            List<ChatTurn> history,
            String message,
            String previousInteractionId,
            String authorization
    ) {
        ensureConfigured();
        Map<Long, BookSuggestion> books = new LinkedHashMap<>();
        List<String> quickReplies = new ArrayList<>();

        JsonNode interaction;
        try {
            interaction = postUnary(initialRequest(systemPrompt, history, message, previousInteractionId, false));
        } catch (GeminiHttpException exception) {
            if (hasText(previousInteractionId) && (exception.status() == 400 || exception.status() == 404)) {
                interaction = postUnary(initialRequest(systemPrompt, history, message, null, false));
            } else {
                throw exception;
            }
        }

        for (int round = 0; round < MAX_TOOL_ROUNDS; round++) {
            List<FunctionCall> calls = functionCalls(interaction);
            if (calls.isEmpty()) {
                String reply = extractLastModelText(interaction).trim();
                if (reply.isBlank()) throw new IllegalStateException("Gemini không tạo được câu trả lời");
                return new AgentResult(reply, List.copyOf(books.values()), List.copyOf(quickReplies), interaction.path("id").asText(""));
            }

            ArrayNode functionResults = executeTools(calls, authorization, books, quickReplies);
            String id = interaction.path("id").asText("");
            if (id.isBlank()) throw new IllegalStateException("Gemini không trả về interaction id");
            interaction = postUnary(continueRequest(systemPrompt, id, functionResults, false));
        }

        throw new IllegalStateException("Gemini gọi công cụ quá nhiều vòng");
    }

    public AgentResult streamChat(
            String systemPrompt,
            List<ChatTurn> history,
            String message,
            String previousInteractionId,
            String authorization,
            StreamObserver observer
    ) {
        ensureConfigured();
        Map<Long, BookSuggestion> books = new LinkedHashMap<>();
        List<String> quickReplies = new ArrayList<>();
        ObjectNode request = initialRequest(systemPrompt, history, message, previousInteractionId, true);
        boolean retriedWithoutPrevious = false;
        String finalInteractionId = previousInteractionId == null ? "" : previousInteractionId;
        StringBuilder fullReply = new StringBuilder();

        for (int round = 0; round < MAX_TOOL_ROUNDS; round++) {
            StreamRound streamed;
            try {
                streamed = postStream(request, observer, fullReply);
            } catch (GeminiHttpException exception) {
                if (!retriedWithoutPrevious && hasText(previousInteractionId)
                        && (exception.status() == 400 || exception.status() == 404)) {
                    retriedWithoutPrevious = true;
                    request = initialRequest(systemPrompt, history, message, null, true);
                    continue;
                }
                throw exception;
            }

            if (hasText(streamed.interactionId())) {
                finalInteractionId = streamed.interactionId();
                observer.onInteractionId(finalInteractionId);
            }

            if (streamed.calls().isEmpty()) {
                String reply = fullReply.toString().trim();
                if (reply.isBlank()) throw new IllegalStateException("Gemini không tạo được câu trả lời");
                return new AgentResult(reply, List.copyOf(books.values()), List.copyOf(quickReplies), finalInteractionId);
            }

            ArrayNode functionResults = executeTools(streamed.calls(), authorization, books, quickReplies);
            observer.onMeta(List.copyOf(books.values()), List.copyOf(quickReplies), finalInteractionId);
            if (!hasText(finalInteractionId)) throw new IllegalStateException("Gemini không trả về interaction id");
            request = continueRequest(systemPrompt, finalInteractionId, functionResults, true);
        }

        throw new IllegalStateException("Gemini gọi công cụ quá nhiều vòng");
    }

    private ArrayNode executeTools(
            List<FunctionCall> calls,
            String authorization,
            Map<Long, BookSuggestion> books,
            List<String> quickReplies
    ) {
        ArrayNode functionResults = mapper.createArrayNode();
        for (FunctionCall call : calls) {
            ToolExecution execution = libraryTools.execute(call.name(), call.arguments(), authorization);
            execution.books().forEach(book -> books.put(book.id(), book));
            if (!execution.quickReplies().isEmpty()) {
                quickReplies.clear();
                quickReplies.addAll(execution.quickReplies());
            }

            ObjectNode result = functionResults.addObject();
            result.put("type", "function_result");
            result.put("name", call.name());
            result.put("call_id", call.id());
            result.putObject("result")
                    .putArray("content")
                    .addObject()
                    .put("type", "text")
                    .put("text", execution.payload().toString());
        }
        return functionResults;
    }

    private ObjectNode initialRequest(
            String systemPrompt,
            List<ChatTurn> history,
            String message,
            String previousInteractionId,
            boolean stream
    ) {
        ObjectNode body = baseRequest(systemPrompt, stream);
        ArrayNode input = body.putArray("input");

        if (hasText(previousInteractionId)) {
            body.put("previous_interaction_id", previousInteractionId.trim());
        } else if (history != null) {
            for (ChatTurn turn : history) {
                if (turn == null || !hasText(turn.content())) continue;
                ObjectNode step = input.addObject();
                step.put("type", "model".equalsIgnoreCase(turn.role()) ? "model_output" : "user_input");
                step.putArray("content").addObject().put("type", "text").put("text", turn.content());
            }
        }

        input.addObject()
                .put("type", "user_input")
                .putArray("content")
                .addObject()
                .put("type", "text")
                .put("text", message);
        return body;
    }

    private ObjectNode continueRequest(String systemPrompt, String previousInteractionId, ArrayNode results, boolean stream) {
        ObjectNode body = baseRequest(systemPrompt, stream);
        body.put("previous_interaction_id", previousInteractionId);
        body.set("input", results);
        return body;
    }

    private ObjectNode baseRequest(String systemPrompt, boolean stream) {
        ObjectNode body = mapper.createObjectNode();
        body.put("model", model);
        body.put("store", true);
        body.put("stream", stream);
        body.put("system_instruction", systemPrompt);
        body.set("tools", libraryTools.declarations());

        ObjectNode config = body.putObject("generation_config");
        config.put("max_output_tokens", Math.max(120, maxOutputTokens));
        config.put("thinking_level", validThinkingLevel(thinkingLevel));
        config.put("thinking_summaries", "none");
        config.put("temperature", 0.25);
        config.put("tool_choice", "auto");
        return body;
    }

    private JsonNode postUnary(ObjectNode body) {
        HttpResponse<String> response = send(body, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw httpError(response.statusCode(), response.body());
        }
        try {
            JsonNode json = mapper.readTree(response.body());
            if (json == null || json.isNull()) throw new IllegalStateException("Gemini trả về dữ liệu rỗng");
            return json;
        } catch (IOException exception) {
            throw new IllegalStateException("Không đọc được phản hồi Gemini", exception);
        }
    }

    private StreamRound postStream(ObjectNode body, StreamObserver observer, StringBuilder fullReply) {
        HttpResponse<InputStream> response = send(body, HttpResponse.BodyHandlers.ofInputStream());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            try (InputStream input = response.body()) {
                throw httpError(response.statusCode(), new String(input.readAllBytes(), StandardCharsets.UTF_8));
            } catch (IOException exception) {
                throw httpError(response.statusCode(), "");
            }
        }

        Map<Integer, MutableFunctionCall> calls = new LinkedHashMap<>();
        String interactionId = "";

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(response.body(), StandardCharsets.UTF_8))) {
            String eventName = "";
            StringBuilder data = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isEmpty()) {
                    if (!data.isEmpty()) {
                        StreamEventResult result = handleStreamEvent(eventName, data.toString(), calls, observer, fullReply);
                        if (hasText(result.interactionId())) interactionId = result.interactionId();
                    }
                    eventName = "";
                    data.setLength(0);
                    continue;
                }
                if (line.startsWith("event:")) {
                    eventName = line.substring(6).trim();
                } else if (line.startsWith("data:")) {
                    if (!data.isEmpty()) data.append('\n');
                    data.append(line.substring(5).trim());
                }
            }
            if (!data.isEmpty()) {
                StreamEventResult result = handleStreamEvent(eventName, data.toString(), calls, observer, fullReply);
                if (hasText(result.interactionId())) interactionId = result.interactionId();
            }
        } catch (IOException exception) {
            throw new IllegalStateException("Luồng Gemini bị ngắt", exception);
        }

        List<FunctionCall> completeCalls = new ArrayList<>();
        for (MutableFunctionCall call : calls.values()) {
            if (!hasText(call.id) || !hasText(call.name)) continue;
            JsonNode args = mapper.createObjectNode();
            String rawArgs = call.arguments.toString().trim();
            if (!rawArgs.isBlank()) {
                try {
                    args = mapper.readTree(rawArgs);
                } catch (IOException ignored) {
                    args = call.initialArguments == null ? mapper.createObjectNode() : call.initialArguments;
                }
            } else if (call.initialArguments != null) {
                args = call.initialArguments;
            }
            completeCalls.add(new FunctionCall(call.id, call.name, args));
        }
        return new StreamRound(interactionId, completeCalls);
    }

    private StreamEventResult handleStreamEvent(
            String sseEventName,
            String rawData,
            Map<Integer, MutableFunctionCall> calls,
            StreamObserver observer,
            StringBuilder fullReply
    ) throws IOException {
        if ("[DONE]".equals(rawData)) return new StreamEventResult("");
        JsonNode event = mapper.readTree(rawData);
        String type = event.path("event_type").asText(sseEventName);
        String interactionId = "";

        if ("error".equals(type)) {
            throw new IllegalStateException(event.path("error").path("message").asText("Gemini stream error"));
        }

        if (type.startsWith("interaction.")) {
            JsonNode interaction = event.path("interaction");
            interactionId = interaction.path("id").asText(event.path("interaction_id").asText(""));
        }

        if ("step.start".equals(type) && "function_call".equals(event.path("step").path("type").asText())) {
            int index = event.path("index").asInt(calls.size());
            JsonNode step = event.path("step");
            MutableFunctionCall call = new MutableFunctionCall();
            call.id = step.path("id").asText("");
            call.name = step.path("name").asText("");
            call.initialArguments = step.path("arguments").isObject() ? step.path("arguments") : mapper.createObjectNode();
            calls.put(index, call);
        }

        if ("step.delta".equals(type)) {
            int index = event.path("index").asInt(-1);
            JsonNode delta = event.path("delta");
            String deltaType = delta.path("type").asText("");
            if ("text".equals(deltaType)) {
                String text = delta.path("text").asText("");
                if (!text.isEmpty()) {
                    fullReply.append(text);
                    observer.onText(text);
                }
            } else if ("arguments_delta".equals(deltaType)) {
                MutableFunctionCall call = calls.get(index);
                if (call != null) call.arguments.append(delta.path("arguments").asText(""));
            }
        }

        return new StreamEventResult(interactionId);
    }

    private <T> HttpResponse<T> send(ObjectNode body, HttpResponse.BodyHandler<T> handler) {
        try {
            String endpoint = baseUrl.replaceAll("/+$", "") + "/" + apiVersion + "/interactions";
            HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint))
                    .timeout(readTimeout)
                    .header("Content-Type", "application/json")
                    .header("Accept", body.path("stream").asBoolean(false) ? "text/event-stream" : "application/json")
                    .header("x-goog-api-key", apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body), StandardCharsets.UTF_8))
                    .build();
            return httpClient.send(request, handler);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Yêu cầu Gemini bị gián đoạn", exception);
        } catch (IOException exception) {
            throw new IllegalStateException("Không kết nối được Gemini", exception);
        }
    }

    private GeminiHttpException httpError(int status, String body) {
        String message = "Gemini HTTP " + status;
        try {
            JsonNode json = mapper.readTree(body == null ? "" : body);
            String apiMessage = json.path("error").path("message").asText("");
            if (!apiMessage.isBlank()) message = apiMessage;
        } catch (Exception ignored) {
        }
        return new GeminiHttpException(status, message);
    }

    private List<FunctionCall> functionCalls(JsonNode interaction) {
        List<FunctionCall> calls = new ArrayList<>();
        for (JsonNode step : interaction.path("steps")) {
            if (!"function_call".equals(step.path("type").asText())) continue;
            String id = step.path("id").asText("");
            String name = step.path("name").asText("");
            if (!id.isBlank() && !name.isBlank()) calls.add(new FunctionCall(id, name, step.path("arguments")));
        }
        return calls;
    }

    private String extractLastModelText(JsonNode interaction) {
        StringBuilder last = new StringBuilder();
        for (JsonNode step : interaction.path("steps")) {
            if (!"model_output".equals(step.path("type").asText())) continue;
            StringBuilder current = new StringBuilder();
            for (JsonNode content : step.path("content")) {
                if ("text".equals(content.path("type").asText())) current.append(content.path("text").asText(""));
            }
            if (!current.isEmpty()) {
                last.setLength(0);
                last.append(current);
            }
        }
        return last.toString();
    }

    private String validThinkingLevel(String value) {
        if (value == null) return "low";
        return switch (value.trim().toLowerCase()) {
            case "minimal", "low", "medium", "high" -> value.trim().toLowerCase();
            default -> "low";
        };
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private void ensureConfigured() {
        if (!isConfigured()) {
            throw new IllegalStateException("Chưa cấu hình GEMINI_API_KEY trong Run Configuration của IntelliJ");
        }
    }

    public interface StreamObserver {
        void onText(String text);
        void onMeta(List<BookSuggestion> books, List<String> quickReplies, String interactionId);
        void onInteractionId(String interactionId);
    }

    private static final class MutableFunctionCall {
        String id;
        String name;
        JsonNode initialArguments;
        StringBuilder arguments = new StringBuilder();
    }

    private record FunctionCall(String id, String name, JsonNode arguments) {}
    private record StreamRound(String interactionId, List<FunctionCall> calls) {}
    private record StreamEventResult(String interactionId) {}

    public record AgentResult(
            String reply,
            List<BookSuggestion> books,
            List<String> quickReplies,
            String interactionId
    ) {}

    public static final class GeminiHttpException extends RuntimeException {
        private final int status;
        public GeminiHttpException(int status, String message) {
            super(message);
            this.status = status;
        }
        public int status() { return status; }
    }
}