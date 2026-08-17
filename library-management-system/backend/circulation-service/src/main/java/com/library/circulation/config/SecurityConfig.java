package com.library.circulation.config;
import com.library.common.security.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.client.RestClient;

@Configuration @EnableMethodSecurity @RequiredArgsConstructor public class SecurityConfig{
    private final JwtAuthenticationFilter filter;

    @Bean SecurityFilterChain chain(HttpSecurity h)throws Exception{
        return h.csrf(x->x.disable())
                .cors(x->{})
                .sessionManagement(x->x.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(x->x
                        .requestMatchers("/actuator/**").permitAll()
                        .requestMatchers("/api/settings/public").permitAll()
                        .requestMatchers("/internal/circulation/**").permitAll()
                        .anyRequest().authenticated())
                .addFilterBefore(filter,UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean RestClient catalogClient(
            @Value("${catalog.base-url}") String url,
            @Value("${internal.api-key}") String internalApiKey
    ){
        return RestClient.builder()
                .baseUrl(url)
                .defaultHeader("X-Internal-Key", internalApiKey)
                .build();
    }
}