package com.talktrading.explore.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Security utility for resolving caller identity within the TalkTrading microservice architecture.
 *
 * ARCHITECTURAL CONTRACT:
 * - The Explore Service is an INTERNAL microservice situated strictly behind the TalkTrading API Gateway.
 * - Explore Service MUST NEVER be directly exposed to the public Internet.
 * - In production (app.security.dev-mode: false), only the trusted gateway header "X-User-Id" is accepted.
 *   The "userId" query parameter is strictly ignored in production to prevent caller spoofing.
 * - In development mode (app.security.dev-mode: true), if "X-User-Id" is absent, the "userId" query parameter
 *   is accepted as a convenience fallback for local testing and isolated Swagger/Postman use.
 */
@Component
public class SecurityUtils {

    public static final String USER_ID_HEADER = "X-User-Id";

    @Value("${app.security.dev-mode:false}")
    private boolean devMode;

    /**
     * Resolves the user ID for the current request.
     * When dev-mode is disabled (production default), only the trusted gateway header (X-User-Id) is accepted.
     * When dev-mode is enabled, the explicitly provided query parameter is accepted as a fallback.
     */
    public Optional<Long> resolveUserId(HttpServletRequest request, Long queryUserId) {
        String headerUserId = request.getHeader(USER_ID_HEADER);
        if (headerUserId != null && !headerUserId.isBlank()) {
            try {
                return Optional.of(Long.parseLong(headerUserId.trim()));
            } catch (NumberFormatException ignored) {
            }
        }

        if (devMode && queryUserId != null) {
            return Optional.of(queryUserId);
        }

        return Optional.empty();
    }

    public boolean isDevMode() {
        return devMode;
    }
}
