package com.talktrading.explore.service;

import com.talktrading.explore.client.dto.ExternalPostDto;
import com.talktrading.explore.entity.InteractionType;
import com.talktrading.explore.entity.UserInteraction;
import com.talktrading.explore.entity.UserInterest;
import com.talktrading.explore.repository.UserInteractionRepository;
import com.talktrading.explore.repository.UserInterestRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RecommendationServiceTest {

    @Mock
    private UserInterestRepository userInterestRepository;

    @Mock
    private UserInteractionRepository userInteractionRepository;

    @InjectMocks
    private RecommendationService recommendationService;

    private Long userId;

    @BeforeEach
    void setUp() {
        userId = 42L;
    }

    @Test
    @DisplayName("getRecentlySeenPostIds returns empty set when userId is null")
    void getRecentlySeenPostIds_NullUser_ReturnsEmpty() {
        Set<Long> result = recommendationService.getRecentlySeenPostIds(null);
        assertThat(result).isEmpty();
        verifyNoInteractions(userInteractionRepository);
    }

    @Test
    @DisplayName("getRecentlySeenPostIds delegates to repository with 48-hour cutoff")
    void getRecentlySeenPostIds_ValidUser_ReturnsIds() {
        when(userInteractionRepository.findRecentlyInteractedPostIds(eq(userId), any(Instant.class)))
                .thenReturn(Set.of(101L, 102L));

        Set<Long> result = recommendationService.getRecentlySeenPostIds(userId);

        assertThat(result).containsExactlyInAnyOrder(101L, 102L);
        verify(userInteractionRepository).findRecentlyInteractedPostIds(eq(userId), any(Instant.class));
    }

    @Test
    @DisplayName("calculatePersonalizationBoost returns 1.0 when user or post is null")
    void calculatePersonalizationBoost_NullArgs_ReturnsNeutral() {
        assertThat(recommendationService.calculatePersonalizationBoost(null, new ExternalPostDto(), "crypto")).isEqualTo(1.0);
        assertThat(recommendationService.calculatePersonalizationBoost(userId, null, "crypto")).isEqualTo(1.0);
    }

    @Test
    @DisplayName("calculatePersonalizationBoost returns 1.0 when user has no interests")
    void calculatePersonalizationBoost_NoInterests_ReturnsNeutral() {
        when(userInterestRepository.findByUserId(userId)).thenReturn(Collections.emptyList());

        ExternalPostDto post = new ExternalPostDto();
        post.setHashtags(List.of("crypto", "btc"));

        double boost = recommendationService.calculatePersonalizationBoost(userId, post, "crypto");
        assertThat(boost).isEqualTo(1.0);
    }

    @Test
    @DisplayName("calculatePersonalizationBoost applies hashtag and category weights")
    void calculatePersonalizationBoost_MatchingTagsAndCategory_BoostsScore() {
        UserInterest interestCrypto = new UserInterest(userId, "crypto", 1.5);
        UserInterest interestBtc = new UserInterest(userId, "btc", 1.0);
        when(userInterestRepository.findByUserId(userId)).thenReturn(List.of(interestCrypto, interestBtc));

        ExternalPostDto post = new ExternalPostDto();
        post.setHashtags(List.of("crypto", "btc"));

        // hashtags: (1.5 * 0.15) + (1.0 * 0.15) = 0.225 + 0.15 = 0.375
        // category match: 1.5 * 0.20 = 0.30
        // total boost: 1.0 + 0.375 + 0.30 = 1.675 -> capped at 1.50
        double boost = recommendationService.calculatePersonalizationBoost(userId, post, "crypto");
        assertThat(boost).isEqualTo(1.50);
    }

    @Test
    @DisplayName("recordInteraction saves interaction and adjusts existing interest weight")
    void recordInteraction_ExistingInterest_AdjustsWeight() {
        UserInterest existing = new UserInterest(userId, "trading", 1.0);
        when(userInterestRepository.findByUserIdAndTopic(userId, "trading")).thenReturn(Optional.of(existing));

        recommendationService.recordInteraction(userId, 500L, InteractionType.LIKE, "trading");

        verify(userInteractionRepository).save(any(UserInteraction.class));
        verify(userInterestRepository).save(existing);
        assertThat(existing.getWeight()).isCloseTo(1.10, org.assertj.core.data.Offset.offset(0.001));
    }

    @Test
    @DisplayName("recordInteraction creates new interest with default weight if topic not recorded")
    void recordInteraction_NewInterest_CreatesWithDefaultWeight() {
        when(userInterestRepository.findByUserIdAndTopic(userId, "forex")).thenReturn(Optional.empty());

        recommendationService.recordInteraction(userId, 501L, InteractionType.CLICK, "forex");

        ArgumentCaptor<UserInterest> captor = ArgumentCaptor.forClass(UserInterest.class);
        verify(userInterestRepository).save(captor.capture());
        UserInterest saved = captor.getValue();
        assertThat(saved.getTopic()).isEqualTo("forex");
        assertThat(saved.getWeight()).isEqualTo(1.0);
    }

    @Test
    @DisplayName("recordInteraction does not create new interest on DISMISS")
    void recordInteraction_DismissNewCategory_DoesNotCreate() {
        when(userInterestRepository.findByUserIdAndTopic(userId, "memes")).thenReturn(Optional.empty());

        recommendationService.recordInteraction(userId, 502L, InteractionType.DISMISS, "memes");

        verify(userInteractionRepository).save(any(UserInteraction.class));
        verify(userInterestRepository, never()).save(any(UserInterest.class));
    }

    @Test
    @DisplayName("recordInteraction clamps weight between 0.1 and 3.0")
    void recordInteraction_ClampsWeight() {
        UserInterest lowInterest = new UserInterest(userId, "penny-stocks", 0.15);
        when(userInterestRepository.findByUserIdAndTopic(userId, "penny-stocks")).thenReturn(Optional.of(lowInterest));

        // Dismiss decrements by 0.10 -> 0.05 -> clamped to 0.1
        recommendationService.recordInteraction(userId, 503L, InteractionType.DISMISS, "penny-stocks");
        assertThat(lowInterest.getWeight()).isEqualTo(0.1);

        UserInterest highInterest = new UserInterest(userId, "options", 2.95);
        when(userInterestRepository.findByUserIdAndTopic(userId, "options")).thenReturn(Optional.of(highInterest));

        // Share increments by 0.15 -> 3.10 -> clamped to 3.0
        recommendationService.recordInteraction(userId, 504L, InteractionType.SHARE, "options");
        assertThat(highInterest.getWeight()).isEqualTo(3.0);
    }
}
