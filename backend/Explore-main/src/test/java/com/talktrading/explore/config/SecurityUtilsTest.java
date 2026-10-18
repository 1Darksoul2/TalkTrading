package com.talktrading.explore.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class SecurityUtilsTest {

    @Test
    @DisplayName("In production (devMode=false), valid X-User-Id header resolves user ID")
    void resolveUserId_Production_HeaderPresent_ResolvesUser() {
        SecurityUtils securityUtils = new SecurityUtils();
        ReflectionTestUtils.setField(securityUtils, "devMode", false);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-User-Id", "42");

        Optional<Long> userId = securityUtils.resolveUserId(request, null);

        assertThat(userId).isPresent().contains(42L);
    }

    @Test
    @DisplayName("In production (devMode=false), query parameter userId is strictly ignored")
    void resolveUserId_Production_QueryParamIgnored() {
        SecurityUtils securityUtils = new SecurityUtils();
        ReflectionTestUtils.setField(securityUtils, "devMode", false);

        MockHttpServletRequest request = new MockHttpServletRequest();
        // Query param passed, but no gateway header
        Optional<Long> userId = securityUtils.resolveUserId(request, 999L);

        assertThat(userId).isEmpty();
    }

    @Test
    @DisplayName("In production (devMode=false), malformed X-User-Id header returns empty")
    void resolveUserId_Production_MalformedHeader_ReturnsEmpty() {
        SecurityUtils securityUtils = new SecurityUtils();
        ReflectionTestUtils.setField(securityUtils, "devMode", false);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-User-Id", "not-a-number");

        Optional<Long> userId = securityUtils.resolveUserId(request, 123L);

        assertThat(userId).isEmpty();
    }

    @Test
    @DisplayName("In dev-mode (devMode=true), query parameter is accepted as fallback when header is absent")
    void resolveUserId_DevMode_QueryParamFallback() {
        SecurityUtils securityUtils = new SecurityUtils();
        ReflectionTestUtils.setField(securityUtils, "devMode", true);

        MockHttpServletRequest request = new MockHttpServletRequest();
        Optional<Long> userId = securityUtils.resolveUserId(request, 88L);

        assertThat(userId).isPresent().contains(88L);
    }

    @Test
    @DisplayName("In dev-mode (devMode=true), header takes precedence over query parameter")
    void resolveUserId_DevMode_HeaderTakesPrecedence() {
        SecurityUtils securityUtils = new SecurityUtils();
        ReflectionTestUtils.setField(securityUtils, "devMode", true);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-User-Id", "42");

        Optional<Long> userId = securityUtils.resolveUserId(request, 999L);

        assertThat(userId).isPresent().contains(42L);
    }

    @Test
    @DisplayName("In dev-mode (devMode=true), returns empty when both header and query param are absent")
    void resolveUserId_DevMode_BothAbsent_ReturnsEmpty() {
        SecurityUtils securityUtils = new SecurityUtils();
        ReflectionTestUtils.setField(securityUtils, "devMode", true);

        MockHttpServletRequest request = new MockHttpServletRequest();
        Optional<Long> userId = securityUtils.resolveUserId(request, null);

        assertThat(userId).isEmpty();
    }
}
