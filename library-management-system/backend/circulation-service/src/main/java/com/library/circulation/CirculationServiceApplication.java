package com.library.circulation;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(scanBasePackages = "com.library")
@EnableScheduling
@EnableJpaRepositories(
        basePackages = "com.library.circulation.repository",
        considerNestedRepositories = true
)
public class CirculationServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(CirculationServiceApplication.class, args);
    }
}