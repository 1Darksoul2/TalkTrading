package com.talktrading.community.repository;

import com.talktrading.community.entity.Comment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CommentRepository extends JpaRepository<Comment, Long> {
    Page<Comment> findByPostIdAndParentCommentIdIsNull(Long postId, Pageable pageable);
    List<Comment> findByPostIdAndParentCommentId(Long postId, Long parentCommentId);
    List<Comment> findByPostId(Long postId);
    List<Comment> findByPostIdOrderByCreatedAtAsc(Long postId);
    boolean existsByParentCommentId(Long parentCommentId);
    long countByPostId(Long postId);
    void deleteByPostId(Long postId);
}
