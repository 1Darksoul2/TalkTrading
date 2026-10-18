package com.talktrading.community.service;

import com.talktrading.community.dto.GlobalSearchResponse;
import org.springframework.data.domain.Pageable;

public interface SearchService {

    GlobalSearchResponse searchGlobal(Long currentUserId, String query, Pageable pageable);
}
