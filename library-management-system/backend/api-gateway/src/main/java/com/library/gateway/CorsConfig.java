package com.library.gateway;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsWebFilter;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
public class CorsConfig {
 @Bean
 CorsWebFilter corsWebFilter(@Value("${app.cors.allowed-origins:http://localhost:*}") String allowedOrigins) {
  CorsConfiguration config = new CorsConfiguration();
  config.setAllowedOriginPatterns(split(allowedOrigins));
  config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
  config.setAllowedHeaders(List.of("*"));
  config.setAllowCredentials(true);

  UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
  source.registerCorsConfiguration("/**", config);
  return new CorsWebFilter(source);
 }

 private List<String> split(String value) {
  return Arrays.stream(value.split(","))
          .map(String::trim)
          .filter(item -> !item.isBlank())
          .toList();
 }
}
