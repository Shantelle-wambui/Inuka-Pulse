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
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

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

    /**
     * Returns HTTP 401 (Unauthorized) — not 403 — when a request arrives with
     * no authentication token at all.  Spring Security's default behaviour on a
     * stateless filter chain is to return 403 for both "no token" and
     * "wrong role", which confuses clients and breaks the noAuth→401 tests.
     * This entry point restores the correct RFC 9110 semantics:
     *   401 = you didn't authenticate
     *   403 = you authenticated but lack permission
     */
    @Bean
    public AuthenticationEntryPoint unauthorizedEntryPoint() {
        return (request, response, authException) -> {
            response.setStatus(HttpStatus.UNAUTHORIZED.value());
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Unauthorized\",\"message\":\"Authentication required\"}");
        };
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
            // Return 401 (not 403) when no auth token is present
            .exceptionHandling(ex -> ex.authenticationEntryPoint(unauthorizedEntryPoint()))
            .authorizeHttpRequests(auth -> auth
                // ══════════════════════════════════════════════════════════════
                // PUBLIC ENDPOINTS — No auth required
                // ══════════════════════════════════════════════════════════════
                .requestMatchers(
                    "/api/auth/**",
                    "/actuator/health",
                    "/h2-console/**",
                    "/swagger-ui/**",
                    "/v3/api-docs/**",
                    "/api/etl/push"        // ETL push — authenticated via X-ETL-Api-Key header
                ).permitAll()
                
                // Public API for Foundation website embed — NO PII, aggregated/cached.
                // Only /api/v1/public/** is intentionally open; no beneficiary data exposed.
                .requestMatchers("/api/v1/public/**").permitAll()

                // ETL config polling — needed by the frontend to set its refresh interval.
                // Returns non-sensitive timing values only (no data, no predictions).
                .requestMatchers("/api/config/**").permitAll()

                // ══════════════════════════════════════════════════════════════
                // SECURITY HARDENING (Phase 7): previously permitAll endpoints
                // now require authentication. Role-level enforcement via @PreAuthorize
                // is layered on top where needed.
                // ══════════════════════════════════════════════════════════════
                .requestMatchers("/api/alerts/**", "/api/alerts").authenticated()
                .requestMatchers("/api/sites/**").authenticated()
                .requestMatchers("/api/quality/**").authenticated()
                .requestMatchers("/api/ingestion/**").authenticated()
                .requestMatchers("/api/analytics/**").authenticated()
                .requestMatchers("/api/ml/champion-artifact-path").authenticated()
                .requestMatchers("/api/ml/decision-threshold").permitAll()
                
                // ══════════════════════════════════════════════════════════════
                // V1 ANALYTICS API — Requires auth, role-scoped via @PreAuthorize
                // ══════════════════════════════════════════════════════════════
                .requestMatchers("/api/v1/analytics/**").authenticated()

                // ══════════════════════════════════════════════════════════════
                // BENEFICIARY PREDICTIONS — Role-scoped (fine-grained via @PreAuthorize)
                // All /api/beneficiaries/** require authentication at minimum.
                // Role enforcement is layered on top via @PreAuthorize in each controller.
                // ══════════════════════════════════════════════════════════════
                .requestMatchers("/api/beneficiaries/**").authenticated()

                // ══════════════════════════════════════════════════════════════
                // DIRECTOR DEEPER VIEWS — authenticated; role checks via @PreAuthorize
                // ══════════════════════════════════════════════════════════════
                .requestMatchers("/api/director/**").authenticated()

                // ══════════════════════════════════════════════════════════════
                // ADMIN — Assignment management and admin-only ops
                // Role enforcement via @PreAuthorize(hasRole('ADMIN'))
                // ══════════════════════════════════════════════════════════════
                .requestMatchers("/api/admin/**").authenticated()
                
                // ══════════════════════════════════════════════════════════════
                // PROGRAM & DONOR MANAGEMENT
                // ══════════════════════════════════════════════════════════════
                .requestMatchers(HttpMethod.GET, "/api/v1/programs/**").hasAnyRole("ADMIN", "PROGRAMME_DIRECTOR", "DATA_ANALYST", "EXECUTIVE", "DONOR")
                .requestMatchers(HttpMethod.POST, "/api/v1/programs/**").hasAnyRole("ADMIN", "PROGRAMME_DIRECTOR")
                .requestMatchers(HttpMethod.PATCH, "/api/v1/programs/**").hasAnyRole("ADMIN", "PROGRAMME_DIRECTOR")
                
                .requestMatchers(HttpMethod.GET, "/api/v1/donors/**").hasAnyRole("ADMIN", "PROGRAMME_DIRECTOR", "EXECUTIVE", "DONOR")
                
                // ══════════════════════════════════════════════════════════════
                // RESOURCE ALLOCATION (Model 5 workflow)
                // ══════════════════════════════════════════════════════════════
                .requestMatchers(HttpMethod.GET, "/api/v1/allocations/**").hasAnyRole("ADMIN", "PROGRAMME_DIRECTOR", "EXECUTIVE")
                .requestMatchers(HttpMethod.POST, "/api/v1/allocations/*/approve").hasAnyRole("ADMIN", "PROGRAMME_DIRECTOR", "EXECUTIVE")
                .requestMatchers(HttpMethod.POST, "/api/v1/allocations/*/reject").hasAnyRole("ADMIN", "PROGRAMME_DIRECTOR", "EXECUTIVE")
                .requestMatchers(HttpMethod.POST, "/api/v1/allocations/generate").hasRole("ADMIN")
                
                // ══════════════════════════════════════════════════════════════
                // EXISTING ENDPOINTS (unchanged)
                // ══════════════════════════════════════════════════════════════
                // Welfare reports
                .requestMatchers(HttpMethod.POST, "/api/hazard-reports").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/hazard-reports/**").authenticated()
                .requestMatchers(HttpMethod.PATCH, "/api/hazard-reports/**").authenticated()
                
                // CAPAs (Programme Interventions)
                .requestMatchers(HttpMethod.POST, "/api/capas").hasAnyRole("ADMIN", "PROGRAMME_DIRECTOR", "COORDINATOR")
                .requestMatchers("/api/capas/**").authenticated()
                
                // Work Orders (Field Visit Scheduling)
                .requestMatchers(HttpMethod.POST, "/api/work-orders").hasAnyRole("ADMIN", "PROGRAMME_DIRECTOR", "COORDINATOR", "CASE_MANAGER")
                .requestMatchers(HttpMethod.PATCH, "/api/work-orders/**").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/work-orders/**").authenticated()
                
                // Field Officers
                // Case Manager profiles (formerly Field Officers — kept for structural compatibility)
                .requestMatchers("/api/technicians/**").hasAnyRole("ADMIN", "PROGRAMME_DIRECTOR", "COORDINATOR")
                
                // ML Admin
                .requestMatchers("/api/ml/**").hasAnyRole("ADMIN", "ML_ADMIN")
                
                // User management
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
