package com.talktrading.explore.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Configuration
public class RestClientConfig {

    @Value("${app.clients.post-service.url:http://localhost:8000}")
    private String postServiceUrl;

    @Value("${app.clients.post-service.connect-timeout-ms:3000}")
    private int connectTimeoutMs;

    @Value("${app.clients.post-service.read-timeout-ms:5000}")
    private int readTimeoutMs;

    @Bean
    public RestClient postServiceRestClient() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofMillis(connectTimeoutMs));
        requestFactory.setReadTimeout(Duration.ofMillis(readTimeoutMs));

        return RestClient.builder()
                .baseUrl(postServiceUrl)
                .requestFactory(requestFactory)
                .defaultHeader("User-Agent", "ExploreService/1.0")
                .defaultHeader("Accept", "application/json")
                .build();
    }
}
