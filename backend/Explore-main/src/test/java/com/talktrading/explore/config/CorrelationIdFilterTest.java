package com.talktrading.explore.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class CorrelationIdFilterTest {

    private CorrelationIdFilter filter;
    private FilterChain filterChain;

    @BeforeEach
    void setUp() {
        filter = new CorrelationIdFilter();
        filterChain = mock(FilterChain.class);
    }

    @Test
    @DisplayName("doFilterInternal preserves existing X-Correlation-Id header")
    void doFilterInternal_PreservesExistingHeader() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Correlation-Id", "corr-12345");
        MockHttpServletResponse response = new MockHttpServletResponse();

        doAnswer(invocation -> {
            assertThat(MDC.get("correlationId")).isEqualTo("corr-12345");
            return null;
        }).when(filterChain).doFilter(request, response);

        filter.doFilterInternal(request, response, filterChain);

        assertThat(response.getHeader("X-Correlation-Id")).isEqualTo("corr-12345");
        assertThat(MDC.get("correlationId")).isNull(); // Cleaned up in finally block
        verify(filterChain).doFilter(request, response);
    }

    @Test
    @DisplayName("doFilterInternal falls back to X-Request-Id if X-Correlation-Id is missing")
    void doFilterInternal_FallsBackToRequestId() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Request-Id", "req-67890");
        MockHttpServletResponse response = new MockHttpServletResponse();

        doAnswer(invocation -> {
            assertThat(MDC.get("correlationId")).isEqualTo("req-67890");
            return null;
        }).when(filterChain).doFilter(request, response);

        filter.doFilterInternal(request, response, filterChain);

        assertThat(response.getHeader("X-Correlation-Id")).isEqualTo("req-67890");
        assertThat(MDC.get("correlationId")).isNull();
        verify(filterChain).doFilter(request, response);
    }

    @Test
    @DisplayName("doFilterInternal generates UUID if no correlation header is provided")
    void doFilterInternal_GeneratesUuidWhenAbsent() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilterInternal(request, response, filterChain);

        String generated = response.getHeader("X-Correlation-Id");
        assertThat(generated).isNotBlank();
        assertThat(MDC.get("correlationId")).isNull();
        verify(filterChain).doFilter(request, response);
    }
}
