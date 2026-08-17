package com.library.common.security;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import org.springframework.security.access.AccessDeniedException;

import java.time.Instant;
import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {
  @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
  ResponseEntity<?> badRequest(RuntimeException e) {
    return response(HttpStatus.BAD_REQUEST, e.getMessage());
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<?> validation(MethodArgumentNotValidException e) {
    String message = e.getBindingResult().getFieldErrors().stream()
            .map(error -> error.getField() + ": " + error.getDefaultMessage())
            .toList()
            .toString();
    return response(HttpStatus.BAD_REQUEST, message);
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  ResponseEntity<?> conflict(DataIntegrityViolationException e) {
    return response(HttpStatus.CONFLICT, "Du lieu da ton tai hoac dang duoc su dung");
  }

  //Them moi bat loi 403
  @ExceptionHandler(AccessDeniedException.class)
  ResponseEntity<?> forbidden(AccessDeniedException e) {
    return response(HttpStatus.FORBIDDEN, "Access Denied");
  }

//  @ExceptionHandler(Exception.class)
//  ResponseEntity<?> error(Exception e) {
//    return response(HttpStatus.INTERNAL_SERVER_ERROR, "Loi he thong");
//  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<?> error(Exception e) {
    e.printStackTrace();

    String message = e.getMessage();

    if (message == null || message.isBlank()) {
      message = e.getClass().getSimpleName();
    }

    return response(HttpStatus.INTERNAL_SERVER_ERROR, message);
  }

  private ResponseEntity<?> response(HttpStatus status, String message) {
    return ResponseEntity.status(status)
            .body(Map.of("timestamp", Instant.now(), "status", status.value(), "message", message));
  }
}
