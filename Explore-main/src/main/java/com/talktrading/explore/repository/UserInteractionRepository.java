package com.talktrading.explore.repository;

import com.talktrading.explore.entity.InteractionType;
import com.talktrading.explore.entity.UserInteraction;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Set;

@Repository
public interface UserInteractionRepository extends JpaRepository<UserInteraction, Long> {

    List<UserInteraction> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    @Query("SELECT ui.postId FROM UserInteraction ui WHERE ui.userId = :userId AND ui.createdAt >= :since")
    Set<Long> findRecentlyInteractedPostIds(@Param("userId") Long userId, @Param("since") Instant since);

    @Query("SELECT ui.category, COUNT(ui) FROM UserInteraction ui WHERE ui.userId = :userId AND ui.category IS NOT NULL GROUP BY ui.category ORDER BY COUNT(ui) DESC")
    List<Object[]> findTopCategoriesByUserId(@Param("userId") Long userId, Pageable pageable);

    boolean existsByUserIdAndPostIdAndInteractionType(Long userId, Long postId, InteractionType interactionType);
}
