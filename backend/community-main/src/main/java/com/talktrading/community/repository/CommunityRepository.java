package com.talktrading.community.repository;

import com.talktrading.community.entity.Community;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CommunityRepository extends JpaRepository<Community, Long> {
    Optional<Community> findByName(String name);
    Optional<Community> findByNameIgnoreCase(String name);
    boolean existsByName(String name);
    boolean existsByNameIgnoreCase(String name);
    Page<Community> findByNameContainingIgnoreCaseOrDescriptionContainingIgnoreCase(String nameQuery, String descQuery, Pageable pageable);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Community c SET c.memberCount = c.memberCount + 1 WHERE c.id = :communityId")
    void incrementMemberCount(@Param("communityId") Long communityId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Community c SET c.memberCount = CASE WHEN c.memberCount > 0 THEN c.memberCount - 1 ELSE 0 END WHERE c.id = :communityId")
    void decrementMemberCount(@Param("communityId") Long communityId);
}
