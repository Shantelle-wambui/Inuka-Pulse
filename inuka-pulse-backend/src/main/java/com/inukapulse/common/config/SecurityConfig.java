package com.inukapulse.common.config;

import com.inukapulse.common.security.JwtAuthFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.http.HttpMethod;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Value("${inuka.cors.allowed-origins:http://localhost:3000}")
    private String allowedOrigins;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.asList(allowedOrigins.split(",")));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"));
        config.setExposedHeaders(List.of("Authorization"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Public endpoints — auth flows, API docs, and health check
                .requestMatchers(
                    "/api/auth/**",
                    "/actuator/health",
                    "/h2-console/**",
                    "/swagger-ui/**",
                    "/v3/api-docs/**",
                    "/api/etl/push"        // ETL push — authenticated via X-ETL-Api-Key header
                ).permitAll()
                // Read-only dashboard endpoints — no auth required
                // (alerts, risk heatmap, sites, quality, ingestion, analytics)
                .requestMatchers(
                    "/api/alerts",
                    "/api/sites/**",
                    "/api/quality/**",
                    "/api/ingestion/**",
                    "/api/config/**",
                    "/api/analytics/**",
                    "/api/ml/champion-artifact-path"
                ).permitAll()
                // Welfare reports — any authenticated user can submit; Programme Directors can list
                .requestMatchers(HttpMethod.POST, "/api/hazard-reports").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/hazard-reports/**").authenticated()
                .requestMatchers(HttpMethod.PATCH, "/api/hazard-reports/**").authenticated()
                // CAPAs (Programme Interventions) — Programme Director and Coordinator create; any auth reads/updates
                .requestMatchers(HttpMethod.POST, "/api/capas").hasAnyRole("ADMIN", "PROGRAMME_DIRECTOR", "COORDINATOR")
                .requestMatchers("/api/capas/**").authenticated()
                // Work Orders (Field Visit Scheduling)
                .requestMatchers(HttpMethod.POST, "/api/work-orders").hasAnyRole("ADMIN", "PROGRAMME_DIRECTOR", "COORDINATOR", "FIELD_OFFICER")
                .requestMatchers(HttpMethod.PATCH, "/api/work-orders/**").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/work-orders/**").authenticated()
                // Field Officers (technician profiles — kept for structural compatibility)
                .requestMatchers("/api/technicians/**").hasAnyRole("ADMIN", "PROGRAMME_DIRECTOR", "COORDINATOR")
                // ML Admin — all endpoints require ML_ADMIN or ADMIN
                .requestMatchers("/api/ml/**").hasAnyRole("ADMIN", "ML_ADMIN")
                // User management requires Admin role
                .requestMatchers("/api/users/**").hasAnyRole("ADMIN")
                .requestMatchers("/api/roles/**").hasAnyRole("ADMIN")
                // Everything else requires auth
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            // Allow H2 console frames in dev
            .headers(h -> h.frameOptions(f -> f.sameOrigin()));

        return http.build();
    }
}
