package com.talktrading.explore.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "Standard API error response structure")
public class ErrorResponse {

    @Schema(description = "UTC timestamp when the error occurred", example = "2026-09-22T13:30:00Z")
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private Instant timestamp;

    @Schema(description = "HTTP status code", example = "400")
    private int status;

    @Schema(description = "Machine-readable error category", example = "BAD_REQUEST")
    private String error;

    @Schema(description = "Human-readable description of what went wrong", example = "Invalid parameter 'size'. Maximum allowed size is 50.")
    private String message;

    @Schema(description = "API request path that triggered the error", example = "/api/v1/explore")
    private String path;

    public ErrorResponse() {
    }

    public ErrorResponse(Instant timestamp, int status, String error, String message, String path) {
        this.timestamp = timestamp;
        this.status = status;
        this.error = error;
        this.message = message;
        this.path = path;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }

    public int getStatus() {
        return status;
    }

    public void setStatus(int status) {
        this.status = status;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }
}
