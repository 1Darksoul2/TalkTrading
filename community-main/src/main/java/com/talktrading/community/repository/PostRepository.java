package com.talktrading.community.repository;

import com.talktrading.community.entity.Post;
import com.talktrading.community.enums.PostType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PostRepository extends JpaRepository<Post, Long> {
    Page<Post> findByUserId(Long userId, Pageable pageable);
    Page<Post> findByCommunityId(Long communityId, Pageable pageable);
    Page<Post> findByPostType(PostType postType, Pageable pageable);
    Page<Post> findByUserIdAndPostType(Long userId, PostType postType, Pageable pageable);
    Page<Post> findByTitleContainingIgnoreCaseOrContentContainingIgnoreCaseOrSymbolContainingIgnoreCase(String titleQuery, String contentQuery, String symbolQuery, Pageable pageable);
    Page<Post> findByUserIdInOrCommunityIdIn(List<Long> userIds, List<Long> communityIds, Pageable pageable);

    @Query("SELECT p FROM Post p WHERE p.communityId IS NULL OR p.communityId IN :communityIds")
    Page<Post> findGlobalAndJoinedCommunityPosts(@Param("communityIds") List<Long> communityIds, Pageable pageable);

    @Query("SELECT p FROM Post p ORDER BY ((p.likeCount * 2.0) + (p.commentCount * 3.0) + (p.score * 1.5)) DESC, p.createdAt DESC")
    Page<Post> findTopPosts(Pageable pageable);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Post p SET p.commentCount = p.commentCount + 1 WHERE p.id = :postId")
    void incrementCommentCount(@Param("postId") Long postId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Post p SET p.commentCount = CASE WHEN p.commentCount > 0 THEN p.commentCount - 1 ELSE 0 END WHERE p.id = :postId")
    void decrementCommentCount(@Param("postId") Long postId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Post p SET p.likeCount = p.likeCount + 1 WHERE p.id = :postId")
    void incrementLikeCount(@Param("postId") Long postId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Post p SET p.likeCount = CASE WHEN p.likeCount > 0 THEN p.likeCount - 1 ELSE 0 END WHERE p.id = :postId")
    void decrementLikeCount(@Param("postId") Long postId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Post p SET p.upvoteCount = p.upvoteCount + 1, p.score = (p.upvoteCount + 1) - p.downvoteCount WHERE p.id = :postId")
    void incrementUpvoteCount(@Param("postId") Long postId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Post p SET p.upvoteCount = CASE WHEN p.upvoteCount > 0 THEN p.upvoteCount - 1 ELSE 0 END, p.score = (CASE WHEN p.upvoteCount > 0 THEN p.upvoteCount - 1 ELSE 0 END) - p.downvoteCount WHERE p.id = :postId")
    void decrementUpvoteCount(@Param("postId") Long postId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Post p SET p.downvoteCount = p.downvoteCount + 1, p.score = p.upvoteCount - (p.downvoteCount + 1) WHERE p.id = :postId")
    void incrementDownvoteCount(@Param("postId") Long postId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Post p SET p.downvoteCount = CASE WHEN p.downvoteCount > 0 THEN p.downvoteCount - 1 ELSE 0 END, p.score = p.upvoteCount - (CASE WHEN p.downvoteCount > 0 THEN p.downvoteCount - 1 ELSE 0 END) WHERE p.id = :postId")
    void decrementDownvoteCount(@Param("postId") Long postId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Post p SET p.upvoteCount = p.upvoteCount + 1, p.downvoteCount = CASE WHEN p.downvoteCount > 0 THEN p.downvoteCount - 1 ELSE 0 END, p.score = (p.upvoteCount + 1) - (CASE WHEN p.downvoteCount > 0 THEN p.downvoteCount - 1 ELSE 0 END) WHERE p.id = :postId")
    void switchDownvoteToUpvote(@Param("postId") Long postId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Post p SET p.downvoteCount = p.downvoteCount + 1, p.upvoteCount = CASE WHEN p.upvoteCount > 0 THEN p.upvoteCount - 1 ELSE 0 END, p.score = (CASE WHEN p.upvoteCount > 0 THEN p.upvoteCount - 1 ELSE 0 END) - (p.downvoteCount + 1) WHERE p.id = :postId")
    void switchUpvoteToDownvote(@Param("postId") Long postId);
}
