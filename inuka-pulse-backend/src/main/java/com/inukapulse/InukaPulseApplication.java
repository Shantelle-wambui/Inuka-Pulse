package com.inukapulse;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class InukaPulseApplication {

    public static void main(String[] args) {
        SpringApplication.run(InukaPulseApplication.class, args);
    }
}
