package com.talktrading.community;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("dev")
class CommunityApplicationTests {

    @Test
    void contextLoads() {
        // Verify Spring context and JPA mappings load without errors
    }
}
