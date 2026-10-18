package com.talktrading.explore.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.Instant;

@Component
public class PostServiceHealthIndicator implements HealthIndicator {

    private final RestClient restClient;
    private final String postServiceUrl;

    public PostServiceHealthIndicator(RestClient postServiceRestClient,
                                      @Value("${app.clients.post-service.url:http://localhost:8000}") String postServiceUrl) {
        this.restClient = postServiceRestClient;
        this.postServiceUrl = postServiceUrl;
    }

    @Override
    public Health health() {
        Instant start = Instant.now();
        try {
            // Attempt to hit health endpoint on Post Service
            restClient.get()
                    .uri("/api/v1/health/live")
                    .retrieve()
                    .toBodilessEntity();

            long latencyMs = Duration.between(start, Instant.now()).toMillis();
            return Health.up()
                    .withDetail("postServiceUrl", postServiceUrl)
                    .withDetail("latencyMs", latencyMs)
                    .build();
        } catch (Exception ex) {
            long latencyMs = Duration.between(start, Instant.now()).toMillis();
            return Health.down()
                    .withDetail("postServiceUrl", postServiceUrl)
                    .withDetail("latencyMs", latencyMs)
                    .withDetail("error", ex.getMessage())
                    .build();
        }
    }
}
