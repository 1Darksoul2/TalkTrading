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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VoteServiceImplTest {

    @Mock
    private VoteRepository voteRepository;

    @Mock
    private PostRepository postRepository;

    @InjectMocks
    private VoteServiceImpl voteService;

    private Post post;

    @BeforeEach
    void setUp() {
        post = Post.builder()
                .id(100L)
                .upvoteCount(0L)
                .downvoteCount(0L)
                .score(0L)
                .build();
    }

    @Test
    void votePost_upvote_success() {
        VoteRequest req = VoteRequest.builder().voteType(VoteType.UPVOTE).build();
        Post updatedPost = Post.builder().id(100L).upvoteCount(1L).downvoteCount(0L).score(1L).build();

        when(postRepository.findById(100L)).thenReturn(Optional.of(post)).thenReturn(Optional.of(updatedPost));
        when(voteRepository.findByUserIdAndPostId(101L, 100L)).thenReturn(Optional.empty()).thenReturn(Optional.of(Vote.builder().voteType(VoteType.UPVOTE).build()));

        VoteResponse res = voteService.votePost(101L, 100L, req);

        assertNotNull(res);
        assertEquals(VoteType.UPVOTE, res.getCurrentUserVote());
        assertEquals(1L, res.getScore());
        verify(postRepository, times(1)).incrementUpvoteCount(100L);
    }

    @Test
    void votePost_switchUpvoteToDownvote() {
        Vote existingUpvote = Vote.builder().id(1L).userId(101L).postId(100L).voteType(VoteType.UPVOTE).build();
        VoteRequest req = VoteRequest.builder().voteType(VoteType.DOWNVOTE).build();
        Post updatedPost = Post.builder().id(100L).upvoteCount(0L).downvoteCount(1L).score(-1L).build();

        when(postRepository.findById(100L)).thenReturn(Optional.of(post)).thenReturn(Optional.of(updatedPost));
        when(voteRepository.findByUserIdAndPostId(101L, 100L)).thenReturn(Optional.of(existingUpvote)).thenReturn(Optional.of(Vote.builder().voteType(VoteType.DOWNVOTE).build()));

        VoteResponse res = voteService.votePost(101L, 100L, req);

        assertNotNull(res);
        assertEquals(VoteType.DOWNVOTE, res.getCurrentUserVote());
        verify(postRepository, times(1)).switchUpvoteToDownvote(100L);
    }

    @Test
    void removeVote_success() {
        Vote existingVote = Vote.builder().id(1L).userId(101L).postId(100L).voteType(VoteType.UPVOTE).build();
        Post updatedPost = Post.builder().id(100L).upvoteCount(0L).downvoteCount(0L).score(0L).build();

        when(postRepository.existsById(100L)).thenReturn(true);
        when(voteRepository.findByUserIdAndPostId(101L, 100L)).thenReturn(Optional.of(existingVote)).thenReturn(Optional.empty());
        when(postRepository.findById(100L)).thenReturn(Optional.of(updatedPost));

        VoteResponse res = voteService.removeVote(101L, 100L);

        assertNotNull(res);
        assertNull(res.getCurrentUserVote());
        verify(voteRepository, times(1)).delete(existingVote);
        verify(postRepository, times(1)).decrementUpvoteCount(100L);
    }

    @Test
    void votePost_unauthenticated_throwsUnauthorizedException() {
        VoteRequest req = VoteRequest.builder().voteType(VoteType.UPVOTE).build();
        assertThrows(UnauthorizedException.class, () -> voteService.votePost(null, 100L, req));
    }
}
