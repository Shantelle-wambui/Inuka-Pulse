package com.inukapulse.common.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtUtil {

    private static final Logger log = LoggerFactory.getLogger(JwtUtil.class);
    
    /**
     * The default secret is intentionally obvious so it's clear when it hasn't
     * been overridden. In production, set inuka.jwt.secret to a secure random value.
     */
    private static final String INSECURE_DEFAULT_SECRET = 
            "inuka-secret-key-must-be-at-least-32-characters-long";

    @Value("${inuka.jwt.secret:" + INSECURE_DEFAULT_SECRET + "}")
    private String secret;

    @Value("${inuka.jwt.expiration-ms:86400000}") // 24 hours
    private long expirationMs;
    
    @Value("${spring.profiles.active:default}")
    private String activeProfile;

    /**
     * Validates that a secure JWT secret is configured in production.
     * 
     * SECURITY: Using the default secret in production would allow any attacker
     * who reads this codebase to forge valid JWTs and impersonate any user.
     * 
     * This check runs on startup and will:
     * - FAIL the application startup in production if the default secret is used
     * - Log a WARNING in development/local profiles (allows easier local testing)
     */
    @PostConstruct
    public void validateSecretConfiguration() {
        boolean isProduction = activeProfile != null && 
                (activeProfile.contains("prod") || activeProfile.contains("railway") || 
                 activeProfile.contains("cloud") || activeProfile.contains("staging"));
        
        if (INSECURE_DEFAULT_SECRET.equals(secret)) {
            String message = "SECURITY WARNING: inuka.jwt.secret is using the insecure default value. " +
                    "Set a secure random secret (min 32 chars) via environment variable or application.yml";
            
            if (isProduction) {
                log.error(message);
                throw new IllegalStateException(
                        "SECURITY: Cannot start in production mode with default JWT secret. " +
                        "Set INUKA_JWT_SECRET environment variable to a secure random value."
                );
            } else {
                log.warn(message + " (Allowed in {} profile for local development)", activeProfile);
            }
        } else if (secret.length() < 32) {
            throw new IllegalStateException(
                    "SECURITY: JWT secret must be at least 32 characters long. " +
                    "Current length: " + secret.length()
            );
        } else {
            log.info("JWT secret configured (length: {} chars)", secret.length());
        }
    }

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(String email, String role, Long userId) {
        return Jwts.builder()
                .subject(email)
                .claim("role", role)
                .claim("userId", userId)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(getSigningKey())
                .compact();
    }

    public Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String extractEmail(String token) {
        return parseToken(token).getSubject();
    }

    public boolean isValid(String token) {
        try {
            Claims claims = parseToken(token);
            return claims.getExpiration().after(new Date());
        } catch (Exception e) {
            return false;
        }
    }
}
