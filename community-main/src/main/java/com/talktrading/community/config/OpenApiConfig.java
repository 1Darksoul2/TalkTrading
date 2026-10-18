package com.talktrading.community.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    private static final String USER_ID_HEADER_NAME = "X-User-Id";

    @Bean
    public OpenAPI communityServiceOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("TalkTrading Community Microservice API")
                        .description("Production-ready Community Microservice for TalkTrading combining Instagram social feeds & profiles, Reddit communities & voting, and trading-specific domain data.")
                        .version("v1.0")
                        .contact(new Contact().name("TalkTrading Team").email("engineering@talktrading.com"))
                        .license(new License().name("Apache 2.0").url("https://www.apache.org/licenses/LICENSE-2.0")))
                .addSecurityItem(new SecurityRequirement().addList(USER_ID_HEADER_NAME))
                .components(new Components()
                        .addSecuritySchemes(USER_ID_HEADER_NAME, new SecurityScheme()
                                .name(USER_ID_HEADER_NAME)
                                .type(SecurityScheme.Type.APIKEY)
                                .in(SecurityScheme.In.HEADER)
                                .description("Authenticated user ID header (e.g. X-User-Id: 101)")));
    }
}
