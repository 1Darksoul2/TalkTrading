package com.talktrading.community.repository;

import com.talktrading.community.entity.CommunityMember;
import com.talktrading.community.enums.CommunityRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CommunityMemberRepository extends JpaRepository<CommunityMember, Long> {
    Optional<CommunityMember> findByCommunityIdAndUserId(Long communityId, Long userId);
    boolean existsByCommunityIdAndUserId(Long communityId, Long userId);
    Page<CommunityMember> findByCommunityId(Long communityId, Pageable pageable);
    List<CommunityMember> findByUserId(Long userId);
    Page<CommunityMember> findByUserId(Long userId, Pageable pageable);
    long countByCommunityId(Long communityId);
    void deleteByCommunityIdAndUserId(Long communityId, Long userId);
    void deleteByCommunityId(Long communityId);
    List<CommunityMember> findByCommunityIdAndRole(Long communityId, CommunityRole role);
}
