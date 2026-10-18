package com.talktrading.explore.repository;

import com.talktrading.explore.entity.UserInterest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserInterestRepository extends JpaRepository<UserInterest, Long> {

    List<UserInterest> findByUserId(Long userId);

    Optional<UserInterest> findByUserIdAndTopic(Long userId, String topic);

    List<UserInterest> findByUserIdOrderByWeightDesc(Long userId);

    void deleteByUserIdAndTopic(Long userId, String topic);
}
