package com.library.catalog.config;
import com.library.catalog.security.InternalApiKeyFilter;
import com.library.common.security.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration @EnableMethodSecurity @RequiredArgsConstructor public class SecurityConfig{
    private final JwtAuthenticationFilter filter;
    private final InternalApiKeyFilter internalApiKeyFilter;
    @Bean SecurityFilterChain chain(HttpSecurity h)throws Exception{
        return h.csrf(x->x.disable())
                .cors(x->{})
                .sessionManagement(x->x.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(x->x
                        .requestMatchers(HttpMethod.GET,"/api/books/**","/api/authors/**","/api/categories/**","/api/publishers/**").permitAll()
                        .requestMatchers("/internal/catalog/**").permitAll()
                        .anyRequest().authenticated())
                .addFilterBefore(internalApiKeyFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(filter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }
}