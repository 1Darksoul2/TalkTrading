package com.talktrading.community.service;

import com.talktrading.community.dto.CommentResponse;
import com.talktrading.community.dto.CreateCommentRequest;
import com.talktrading.community.dto.PageResponse;
import com.talktrading.community.dto.UpdateCommentRequest;
import com.talktrading.community.entity.Comment;
import com.talktrading.community.exception.BadRequestException;
import com.talktrading.community.exception.ResourceNotFoundException;
import com.talktrading.community.exception.UnauthorizedException;
import com.talktrading.community.mapper.CommentMapper;
import com.talktrading.community.repository.CommentRepository;
import com.talktrading.community.repository.PostRepository;
import com.talktrading.community.repository.UserProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CommentServiceImplTest {

    @Mock
    private CommentRepository commentRepository;

    @Mock
    private PostRepository postRepository;

    @Mock
    private UserProfileRepository userProfileRepository;

    @Spy
    private CommentMapper commentMapper = new CommentMapper();

    @InjectMocks
    private CommentServiceImpl commentService;

    private Comment rootComment;
    private Comment replyComment;

    @BeforeEach
    void setUp() {
        rootComment = Comment.builder()
                .id(1L)
                .postId(100L)
                .userId(101L)
                .content("Great analysis!")
                .parentCommentId(null)
                .build();

        replyComment = Comment.builder()
                .id(2L)
                .postId(100L)
                .userId(102L)
                .content("Thanks!")
                .parentCommentId(1L)
                .build();
    }

    @Test
    void createRootComment_success() {
        CreateCommentRequest req = CreateCommentRequest.builder().content("Great analysis!").build();
        when(postRepository.existsById(100L)).thenReturn(true);
        when(commentRepository.save(any(Comment.class))).thenReturn(rootComment);

        CommentResponse res = commentService.createComment(101L, 100L, req);

        assertNotNull(res);
        assertEquals("Great analysis!", res.getContent());
        assertNull(res.getParentCommentId());
        verify(postRepository, times(1)).incrementCommentCount(100L);
    }

    @Test
    void createReply_success() {
        CreateCommentRequest req = CreateCommentRequest.builder().content("Thanks!").parentCommentId(1L).build();
        when(postRepository.existsById(100L)).thenReturn(true);
        when(commentRepository.findById(1L)).thenReturn(Optional.of(rootComment));
        when(commentRepository.save(any(Comment.class))).thenReturn(replyComment);

        CommentResponse res = commentService.createComment(102L, 100L, req);

        assertNotNull(res);
        assertEquals(1L, res.getParentCommentId());
    }

    @Test
    void createReply_parentBelongsToDifferentPost_throwsBadRequestException() {
        Comment parentFromOtherPost = Comment.builder().id(5L).postId(999L).build();
        CreateCommentRequest req = CreateCommentRequest.builder().content("Reply").parentCommentId(5L).build();

        when(postRepository.existsById(100L)).thenReturn(true);
        when(commentRepository.findById(5L)).thenReturn(Optional.of(parentFromOtherPost));

        assertThrows(BadRequestException.class, () -> commentService.createComment(101L, 100L, req));
    }

    @Test
    void updateComment_ownComment_success() {
        UpdateCommentRequest req = UpdateCommentRequest.builder().content("Updated content").build();
        when(commentRepository.findById(1L)).thenReturn(Optional.of(rootComment));
        when(commentRepository.save(any(Comment.class))).thenReturn(rootComment);

        CommentResponse res = commentService.updateComment(101L, 1L, req);

        assertNotNull(res);
        verify(commentRepository, times(1)).save(rootComment);
    }

    @Test
    void updateComment_unauthorized_throwsUnauthorizedException() {
        UpdateCommentRequest req = UpdateCommentRequest.builder().content("Hacked content").build();
        when(commentRepository.findById(1L)).thenReturn(Optional.of(rootComment));

        assertThrows(UnauthorizedException.class, () -> commentService.updateComment(999L, 1L, req));
    }

    @Test
    void deleteComment_withReplies_softDeletesContent() {
        when(commentRepository.findById(1L)).thenReturn(Optional.of(rootComment));
        when(commentRepository.existsByParentCommentId(1L)).thenReturn(true);

        commentService.deleteComment(101L, 1L);

        assertEquals("[deleted]", rootComment.getContent());
        verify(commentRepository, times(1)).save(rootComment);
        verify(commentRepository, never()).delete(any());
        verify(postRepository, times(1)).decrementCommentCount(100L);
    }

    @Test
    void getCommentsForPost_nestedTreeStructure() {
        Pageable pageable = PageRequest.of(0, 10);
        when(postRepository.existsById(100L)).thenReturn(true);
        when(commentRepository.findByPostIdAndParentCommentIdIsNull(100L, pageable))
                .thenReturn(new PageImpl<>(List.of(rootComment)));
        when(commentRepository.findByPostIdOrderByCreatedAtAsc(100L))
                .thenReturn(List.of(rootComment, replyComment));

        PageResponse<CommentResponse> res = commentService.getCommentsForPost(100L, pageable);

        assertNotNull(res);
        assertEquals(1, res.getContent().size());
        CommentResponse rootNode = res.getContent().get(0);
        assertEquals(1, rootNode.getReplies().size());
        assertEquals("Thanks!", rootNode.getReplies().get(0).getContent());
    }
}
