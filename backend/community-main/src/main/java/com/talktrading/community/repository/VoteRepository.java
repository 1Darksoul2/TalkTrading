package com.talktrading.community.repository;

import com.talktrading.community.entity.Vote;
import com.talktrading.community.enums.VoteType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface VoteRepository extends JpaRepository<Vote, Long> {
    boolean existsByUserIdAndPostId(Long userId, Long postId);
    Optional<Vote> findByUserIdAndPostId(Long userId, Long postId);
    long countByPostIdAndVoteType(Long postId, VoteType voteType);
    void deleteByPostId(Long postId);
}
