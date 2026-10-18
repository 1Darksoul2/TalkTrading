package com.talktrading.community.service;

import com.talktrading.community.dto.VoteRequest;
import com.talktrading.community.dto.VoteResponse;

public interface VoteService {

    VoteResponse votePost(Long authenticatedUserId, Long postId, VoteRequest request);

    VoteResponse removeVote(Long authenticatedUserId, Long postId);

    VoteResponse getVoteStatus(Long currentUserId, Long postId);
}
