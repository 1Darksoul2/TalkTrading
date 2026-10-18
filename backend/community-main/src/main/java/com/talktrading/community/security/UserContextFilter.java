package com.talktrading.community.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class UserContextFilter extends OncePerRequestFilter {

    public static final String USER_ID_HEADER = "X-User-Id";
    public static final String ROLES_HEADER = "X-User-Roles";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        try {
            String userIdHeader = request.getHeader(USER_ID_HEADER);
            if (userIdHeader != null && !userIdHeader.isBlank()) {
                try {
                    UserContext.setUserId(Long.parseLong(userIdHeader));
                } catch (NumberFormatException ignored) {
                }
            } else {
                // Fallback for dev / unauthenticated requests (defaults to user ID 1)
                UserContext.setUserId(1L);
            }

            String rolesHeader = request.getHeader(ROLES_HEADER);
            if (rolesHeader != null && !rolesHeader.isBlank()) {
                List<String> roles = Arrays.asList(rolesHeader.split(","));
                UserContext.setRoles(roles);
            }
            filterChain.doFilter(request, response);
        } finally {
            UserContext.clear();
        }
    }
}
