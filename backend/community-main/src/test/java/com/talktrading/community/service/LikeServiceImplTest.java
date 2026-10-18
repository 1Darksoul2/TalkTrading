package com.talktrading.community.service;

import com.talktrading.community.dto.LikeResponse;
import com.talktrading.community.entity.Like;
import com.talktrading.community.entity.Post;
import com.talktrading.community.exception.ResourceNotFoundException;
import com.talktrading.community.exception.UnauthorizedException;
import com.talktrading.community.repository.LikeRepository;
import com.talktrading.community.repository.PostRepository;
import com.talktrading.community.repository.UserProfileRepository;
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
class LikeServiceImplTest {

    @Mock
    private LikeRepository likeRepository;

    @Mock
    private PostRepository postRepository;

    @Mock
    private UserProfileRepository userProfileRepository;

    @InjectMocks
    private LikeServiceImpl likeService;

    private Post post;

    @BeforeEach
    void setUp() {
        post = Post.builder().id(100L).likeCount(0L).build();
    }

    @Test
    void likePost_success() {
        when(postRepository.findById(100L)).thenReturn(Optional.of(post));
        when(likeRepository.existsByUserIdAndPostId(101L, 100L)).thenReturn(false);
        when(likeRepository.countByPostId(100L)).thenReturn(1L);

        LikeResponse res = likeService.likePost(101L, 100L);

        assertNotNull(res);
        assertTrue(res.getHasLiked());
        assertEquals(1L, res.getLikeCount());
        verify(postRepository, times(1)).incrementLikeCount(100L);
    }

    @Test
    void likePost_duplicateLike_idempotent() {
        when(postRepository.findById(100L)).thenReturn(Optional.of(post));
        when(likeRepository.existsByUserIdAndPostId(101L, 100L)).thenReturn(true);
        when(likeRepository.countByPostId(100L)).thenReturn(1L);

        LikeResponse res = likeService.likePost(101L, 100L);

        assertNotNull(res);
        assertTrue(res.getHasLiked());
        verify(postRepository, never()).incrementLikeCount(any());
    }

    @Test
    void unlikePost_success() {
        Like like = Like.builder().id(1L).userId(101L).postId(100L).build();
        when(postRepository.existsById(100L)).thenReturn(true);
        when(likeRepository.findByUserIdAndPostId(101L, 100L)).thenReturn(Optional.of(like));
        when(likeRepository.countByPostId(100L)).thenReturn(0L);

        LikeResponse res = likeService.unlikePost(101L, 100L);

        assertNotNull(res);
        assertFalse(res.getHasLiked());
        verify(likeRepository, times(1)).delete(like);
        verify(postRepository, times(1)).decrementLikeCount(100L);
    }

    @Test
    void likePost_unauthenticated_throwsUnauthorizedException() {
        assertThrows(UnauthorizedException.class, () -> likeService.likePost(null, 100L));
    }
}
