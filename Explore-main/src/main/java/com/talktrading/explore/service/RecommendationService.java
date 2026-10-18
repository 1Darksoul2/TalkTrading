package com.talktrading.explore.service;

import com.talktrading.explore.client.dto.ExternalPostDto;
import com.talktrading.explore.entity.InteractionType;
import com.talktrading.explore.entity.UserInteraction;
import com.talktrading.explore.entity.UserInterest;
import com.talktrading.explore.repository.UserInteractionRepository;
import com.talktrading.explore.repository.UserInterestRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class RecommendationService {

    private static final Logger log = LoggerFactory.getLogger(RecommendationService.class);

    private final UserInterestRepository userInterestRepository;
    private final UserInteractionRepository userInteractionRepository;

    public RecommendationService(UserInterestRepository userInterestRepository,
                                 UserInteractionRepository userInteractionRepository) {
        this.userInterestRepository = userInterestRepository;
        this.userInteractionRepository = userInteractionRepository;
    }

    /**
     * Retrieves post IDs the user has recently viewed or dismissed (last 48 hours)
     * so they can optionally be deprioritized or filtered out of the explore feed.
     */
    @Transactional(readOnly = true)
    public Set<Long> getRecentlySeenPostIds(Long userId) {
        if (userId == null) {
            return Collections.emptySet();
        }
        Instant since = Instant.now().minus(48, ChronoUnit.HOURS);
        return userInteractionRepository.findRecentlyInteractedPostIds(userId, since);
    }

    /**
     * Calculates personalized affinity multiplier for a post based on user interests.
     * Returns a multiplier between 1.0 (neutral) and 1.5 (high affinity).
     */
    @Transactional(readOnly = true)
    public double calculatePersonalizationBoost(Long userId, ExternalPostDto post, String requestedCategory) {
        if (userId == null || post == null) {
            return 1.0;
        }

        List<UserInterest> interests = userInterestRepository.findByUserId(userId);
        if (interests.isEmpty()) {
            return 1.0;
        }

        Map<String, Double> interestWeights = interests.stream()
                .collect(Collectors.toMap(
                        i -> i.getTopic().toLowerCase(),
                        UserInterest::getWeight,
                        Double::max
                ));

        double boost = 0.0;

        // Check matching hashtags
        List<String> postTags = post.getHashtags();
        if (postTags != null) {
            for (String tag : postTags) {
                Double weight = interestWeights.get(tag.toLowerCase());
                if (weight != null) {
                    boost += weight * 0.15;
                }
            }
        }

        // Check matching requested category
        if (requestedCategory != null && !requestedCategory.isBlank()) {
            Double weight = interestWeights.get(requestedCategory.toLowerCase().trim());
            if (weight != null) {
                boost += weight * 0.20;
            }
        }

        // Maximum boost ceiling is 1.50 (+50% score boost)
        return Math.min(1.50, 1.0 + boost);
    }

    /**
     * Records a user interaction (VIEW, CLICK, LIKE, etc.) and dynamically adjusts interest weights.
     */
    @Transactional
    public void recordInteraction(Long userId, Long postId, InteractionType type, String category) {
        if (userId == null || postId == null || type == null) {
            return;
        }

        UserInteraction interaction = new UserInteraction(userId, postId, type, category);
        userInteractionRepository.save(interaction);
        log.debug("Recorded user interaction: user={}, post={}, type={}", userId, postId, type);

        // Dynamically increment interest weight if category or topic is present
        if (category != null && !category.isBlank()) {
            String cleanCategory = category.toLowerCase().trim();
            Optional<UserInterest> existingInterest = userInterestRepository.findByUserIdAndTopic(userId, cleanCategory);
            if (existingInterest.isPresent()) {
                UserInterest interest = existingInterest.get();
                double increment = switch (type) {
                    case LIKE -> 0.10;
                    case COMMENT, SHARE -> 0.15;
                    case CLICK -> 0.05;
                    case VIEW -> 0.02;
                    case DISMISS -> -0.10;
                };
                interest.setWeight(Math.max(0.1, Math.min(3.0, interest.getWeight() + increment)));
                userInterestRepository.save(interest);
            } else if (type != InteractionType.DISMISS) {
                UserInterest newInterest = new UserInterest(userId, cleanCategory, 1.0);
                userInterestRepository.save(newInterest);
            }
        }
    }
}
