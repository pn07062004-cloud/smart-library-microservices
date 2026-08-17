package com.library.catalog.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class CatalogAppConfig {
 @Bean
 RestClient circulationClient(
         @Value("${circulation.base-url}") String url,
         @Value("${internal.api-key}") String internalApiKey
 ) {
  return RestClient.builder()
          .baseUrl(url)
          .defaultHeader("X-Internal-Key", internalApiKey)
          .build();
 }
}