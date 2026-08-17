package com.library.catalog.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Guards every /internal/** endpoint with a shared secret header
 * (X-Internal-Key) so that only other backend services — which know
 * the internal.api-key value — can call them. Without this, anyone
 * who can reach catalog-service directly (e.g. http://localhost:8082
 * when running services individually from IntelliJ instead of via
 * Docker) could call /internal/catalog/copies/{id}/borrow or /return
 * and change a copy's status without going through circulation-service's
 * real borrow/return business logic.
 */
@Component
public class InternalApiKeyFilter extends OncePerRequestFilter {

 @Value("${internal.api-key}")
 private String internalApiKey;

 @Override
 protected void doFilterInternal(
         HttpServletRequest request,
         HttpServletResponse response,
         FilterChain chain
 ) throws ServletException, IOException {
  if (request.getRequestURI().startsWith("/internal/")) {
   String providedKey = request.getHeader("X-Internal-Key");
   if (internalApiKey == null
           || internalApiKey.isBlank()
           || !internalApiKey.equals(providedKey)) {
    response.sendError(
            HttpServletResponse.SC_FORBIDDEN,
            "Missing or invalid internal service key"
    );
    return;
   }
  }
  chain.doFilter(request, response);
 }
}
