package com.talktrading.community.repository;

import com.talktrading.community.entity.UserProfile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserProfileRepository extends JpaRepository<UserProfile, Long> {
    Optional<UserProfile> findByUserId(Long userId);
    Optional<UserProfile> findByUsername(String username);
    Optional<UserProfile> findByUsernameIgnoreCase(String username);
    boolean existsByUserId(Long userId);
    boolean existsByUsername(String username);
    boolean existsByUsernameIgnoreCase(String username);
    Page<UserProfile> findByUsernameContainingIgnoreCaseOrDisplayNameContainingIgnoreCase(String usernameQuery, String nameQuery, Pageable pageable);

    @Modifying
    @Query("UPDATE UserProfile u SET u.followerCount = u.followerCount + 1 WHERE u.userId = :userId")
    void incrementFollowerCount(@Param("userId") Long userId);

    @Modifying
    @Query("UPDATE UserProfile u SET u.followerCount = CASE WHEN u.followerCount > 0 THEN u.followerCount - 1 ELSE 0 END WHERE u.userId = :userId")
    void decrementFollowerCount(@Param("userId") Long userId);

    @Modifying
    @Query("UPDATE UserProfile u SET u.followingCount = u.followingCount + 1 WHERE u.userId = :userId")
    void incrementFollowingCount(@Param("userId") Long userId);

    @Modifying
    @Query("UPDATE UserProfile u SET u.followingCount = CASE WHEN u.followingCount > 0 THEN u.followingCount - 1 ELSE 0 END WHERE u.userId = :userId")
    void decrementFollowingCount(@Param("userId") Long userId);

    @Modifying
    @Query("UPDATE UserProfile u SET u.postCount = u.postCount + 1 WHERE u.userId = :userId")
    void incrementPostCount(@Param("userId") Long userId);

    @Modifying
    @Query("UPDATE UserProfile u SET u.postCount = CASE WHEN u.postCount > 0 THEN u.postCount - 1 ELSE 0 END WHERE u.userId = :userId")
    void decrementPostCount(@Param("userId") Long userId);
}
