package com.library.chatbot.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Configuration
public class AppConfig {

    @Bean
    RestClient catalog(@Value("${catalog.base-url}") String url) {
        return RestClient.builder()
                .baseUrl(url)
                .requestFactory(requestFactory(Duration.ofSeconds(3), Duration.ofSeconds(10)))
                .build();
    }

    @Bean
    RestClient circulation(@Value("${circulation.base-url}") String url) {
        return RestClient.builder()
                .baseUrl(url)
                .requestFactory(requestFactory(Duration.ofSeconds(3), Duration.ofSeconds(10)))
                .build();
    }

    private SimpleClientHttpRequestFactory requestFactory(Duration connectTimeout, Duration readTimeout) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeout);
        factory.setReadTimeout(readTimeout);
        return factory;
    }

    @Bean
    SecurityFilterChain security(HttpSecurity http) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> {})
                .authorizeHttpRequests(requests -> requests.anyRequest().permitAll())
                .build();
    }
}