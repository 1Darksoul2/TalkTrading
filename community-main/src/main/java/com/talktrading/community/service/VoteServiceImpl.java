package com.talktrading.community.service;

import com.talktrading.community.dto.VoteRequest;
import com.talktrading.community.dto.VoteResponse;
import com.talktrading.community.entity.Post;
import com.talktrading.community.entity.Vote;
import com.talktrading.community.enums.VoteType;
import com.talktrading.community.exception.ResourceNotFoundException;
import com.talktrading.community.exception.UnauthorizedException;
import com.talktrading.community.repository.PostRepository;
import com.talktrading.community.repository.VoteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class VoteServiceImpl implements VoteService {

    private final VoteRepository voteRepository;
    private final PostRepository postRepository;

    @Override
    @Transactional
    public VoteResponse votePost(Long authenticatedUserId, Long postId, VoteRequest request) {
        if (authenticatedUserId == null) {
            throw new UnauthorizedException("User ID is required to vote on a post");
        }

        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Post not found with ID: " + postId));

        VoteType targetType = request.getVoteType();
        Optional<Vote> existingVoteOpt = voteRepository.findByUserIdAndPostId(authenticatedUserId, postId);

        if (existingVoteOpt.isEmpty()) {
            Vote vote = Vote.builder()
                    .userId(authenticatedUserId)
                    .postId(postId)
                    .voteType(targetType)
                    .build();

            try {
                voteRepository.saveAndFlush(vote);
                if (targetType == VoteType.UPVOTE) {
                    postRepository.incrementUpvoteCount(postId);
                } else {
                    postRepository.incrementDownvoteCount(postId);
                }
            } catch (DataIntegrityViolationException e) {
                // Safe under concurrent duplicate requests
            }
        } else {
            Vote existingVote = existingVoteOpt.get();
            if (existingVote.getVoteType() != targetType) {
                existingVote.setVoteType(targetType);
                voteRepository.save(existingVote);

                if (targetType == VoteType.UPVOTE) {
                    postRepository.switchDownvoteToUpvote(postId);
                } else {
                    postRepository.switchUpvoteToDownvote(postId);
                }
            }
        }

        return fetchUpdatedVoteResponse(postId, authenticatedUserId);
    }

    @Override
    @Transactional
    public VoteResponse removeVote(Long authenticatedUserId, Long postId) {
        if (authenticatedUserId == null) {
            throw new UnauthorizedException("User ID is required to remove vote");
        }

        if (!postRepository.existsById(postId)) {
            throw new ResourceNotFoundException("Post not found with ID: " + postId);
        }

        Optional<Vote> existingVoteOpt = voteRepository.findByUserIdAndPostId(authenticatedUserId, postId);
        if (existingVoteOpt.isPresent()) {
            Vote existingVote = existingVoteOpt.get();
            VoteType oldType = existingVote.getVoteType();
            voteRepository.delete(existingVote);

            if (oldType == VoteType.UPVOTE) {
                postRepository.decrementUpvoteCount(postId);
            } else {
                postRepository.decrementDownvoteCount(postId);
            }
        }

        return fetchUpdatedVoteResponse(postId, authenticatedUserId);
    }

    @Override
    @Transactional(readOnly = true)
    public VoteResponse getVoteStatus(Long currentUserId, Long postId) {
        if (!postRepository.existsById(postId)) {
            throw new ResourceNotFoundException("Post not found with ID: " + postId);
        }
        return fetchUpdatedVoteResponse(postId, currentUserId);
    }

    private VoteResponse fetchUpdatedVoteResponse(Long postId, Long currentUserId) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Post not found with ID: " + postId));

        VoteType currentUserVote = currentUserId != null
                ? voteRepository.findByUserIdAndPostId(currentUserId, postId).map(Vote::getVoteType).orElse(null)
                : null;

        return VoteResponse.builder()
                .postId(postId)
                .upvoteCount(post.getUpvoteCount() != null ? post.getUpvoteCount() : 0L)
                .downvoteCount(post.getDownvoteCount() != null ? post.getDownvoteCount() : 0L)
                .score(post.getScore() != null ? post.getScore() : 0L)
                .currentUserVote(currentUserVote)
                .build();
    }
}
