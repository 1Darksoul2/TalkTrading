package com.talktrading.explore.exception;

import com.talktrading.explore.dto.ErrorResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

    private GlobalExceptionHandler exceptionHandler;
    private MockHttpServletRequest request;

    @BeforeEach
    void setUp() {
        exceptionHandler = new GlobalExceptionHandler();
        request = new MockHttpServletRequest();
        request.setRequestURI("/api/v1/explore");
    }

    @Test
    @DisplayName("handleInvalidParameter returns 400 Bad Request")
    void handleInvalidParameter_ReturnsBadRequest() {
        InvalidParameterException ex = new InvalidParameterException("Invalid page parameter");
        ResponseEntity<ErrorResponse> response = exceptionHandler.handleInvalidParameter(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getStatus()).isEqualTo(400);
        assertThat(response.getBody().getError()).isEqualTo("BAD_REQUEST");
        assertThat(response.getBody().getMessage()).isEqualTo("Invalid page parameter");
        assertThat(response.getBody().getPath()).isEqualTo("/api/v1/explore");
    }

    @Test
    @DisplayName("handleNotFound returns 404 Not Found")
    void handleNotFound_ReturnsNotFound() {
        ResourceNotFoundException ex = new ResourceNotFoundException("Resource with ID 999 not found");
        ResponseEntity<ErrorResponse> response = exceptionHandler.handleNotFound(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getStatus()).isEqualTo(404);
        assertThat(response.getBody().getError()).isEqualTo("NOT_FOUND");
        assertThat(response.getBody().getMessage()).isEqualTo("Resource with ID 999 not found");
    }

    @Test
    @DisplayName("handleDownstreamError returns 503 Service Unavailable")
    void handleDownstreamError_ReturnsServiceUnavailable() {
        DownstreamServiceException ex = new DownstreamServiceException("Post service unreachable");
        ResponseEntity<ErrorResponse> response = exceptionHandler.handleDownstreamError(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getStatus()).isEqualTo(503);
        assertThat(response.getBody().getError()).isEqualTo("SERVICE_UNAVAILABLE");
        assertThat(response.getBody().getMessage()).isEqualTo("Post service unreachable");
    }

    @Test
    @DisplayName("handleGeneralException returns 500 Internal Server Error")
    void handleGeneralException_ReturnsInternalServerError() {
        RuntimeException ex = new RuntimeException("Unexpected database outage");
        ResponseEntity<ErrorResponse> response = exceptionHandler.handleGeneralException(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getStatus()).isEqualTo(500);
        assertThat(response.getBody().getError()).isEqualTo("INTERNAL_SERVER_ERROR");
    }
}
