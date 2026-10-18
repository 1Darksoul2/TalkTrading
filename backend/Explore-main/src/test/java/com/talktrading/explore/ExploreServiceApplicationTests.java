package com.talktrading.explore;

import com.talktrading.explore.config.TestRedisConfig;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
@Import(TestRedisConfig.class)
class ExploreServiceApplicationTests {

    @Test
    void contextLoads() {
    }
}
