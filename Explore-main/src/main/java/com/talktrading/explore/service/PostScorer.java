package com.talktrading.explore.service;

import com.talktrading.explore.client.dto.ExternalPostDto;

/**
 * Strategy interface for scoring posts.
 * Allows easy plug-in replacement with ML model / embedding ranking in the future.
 */
public interface PostScorer {
    double calculateScore(ExternalPostDto post);
}
