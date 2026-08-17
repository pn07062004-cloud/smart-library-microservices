package com.library.common.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
  private final JwtService jwtService;
  public JwtAuthenticationFilter(JwtService jwtService) { this.jwtService = jwtService; }
  @Override protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
    String header = req.getHeader("Authorization");
    if (header != null && header.startsWith("Bearer ")) try {
      Claims c = jwtService.parse(header.substring(7));
      var auth = new UsernamePasswordAuthenticationToken(c.getSubject(), null, List.of(new SimpleGrantedAuthority("ROLE_" + c.get("role", String.class))));
      auth.setDetails(c); SecurityContextHolder.getContext().setAuthentication(auth);
    } catch (Exception ignored) { SecurityContextHolder.clearContext(); }
    chain.doFilter(req, res);
  }
  public static Long currentUserId() {
    Object details = SecurityContextHolder.getContext().getAuthentication().getDetails();
    if (details instanceof Claims c) return ((Number)c.get("uid")).longValue();
    throw new IllegalStateException("Chưa đăng nhập");
  }

  public static String currentUserName() {
    Object details = SecurityContextHolder.getContext().getAuthentication().getDetails();
    if (details instanceof Claims c) return c.get("name", String.class);
    throw new IllegalStateException("Chưa đăng nhập");
  }
}


