package com.talktrading.community.service;

import com.talktrading.community.dto.*;
import com.talktrading.community.entity.Community;
import com.talktrading.community.entity.CommunityMember;
import com.talktrading.community.entity.UserProfile;
import com.talktrading.community.enums.CommunityRole;
import com.talktrading.community.exception.BadRequestException;
import com.talktrading.community.exception.ConflictException;
import com.talktrading.community.exception.ResourceNotFoundException;
import com.talktrading.community.exception.UnauthorizedException;
import com.talktrading.community.mapper.CommunityMapper;
import com.talktrading.community.mapper.CommunityMemberMapper;
import com.talktrading.community.repository.CommunityMemberRepository;
import com.talktrading.community.repository.CommunityRepository;
import com.talktrading.community.repository.UserProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CommunityServiceImpl implements CommunityService {

    private final CommunityRepository communityRepository;
    private final CommunityMemberRepository communityMemberRepository;
    private final UserProfileRepository userProfileRepository;
    private final PostService postService;
    private final CommunityMapper communityMapper;
    private final CommunityMemberMapper communityMemberMapper;

    @Override
    @Transactional
    public CommunityResponse createCommunity(Long authenticatedUserId, CreateCommunityRequest request) {
        if (authenticatedUserId == null) {
            throw new UnauthorizedException("User ID is required to create a community");
        }

        if (communityRepository.existsByNameIgnoreCase(request.getName())) {
            throw new ConflictException("Community with name '" + request.getName() + "' already exists");
        }

        Community community = Community.builder()
                .name(request.getName())
                .description(request.getDescription())
                .icon(request.getIcon())
                .createdBy(authenticatedUserId)
                .memberCount(1L)
                .build();

        try {
            community = communityRepository.saveAndFlush(community);
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException("Community name already exists");
        }

        // Creator automatically becomes OWNER
        CommunityMember ownerMember = CommunityMember.builder()
                .communityId(community.getId())
                .userId(authenticatedUserId)
                .role(CommunityRole.OWNER)
                .build();
        communityMemberRepository.save(ownerMember);

        return communityMapper.toResponse(community, CommunityRole.OWNER);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<CommunityResponse> getCommunities(Long currentUserId, String search, Pageable pageable) {
        Page<Community> page;
        if (search != null && !search.isBlank()) {
            page = communityRepository.findByNameContainingIgnoreCaseOrDescriptionContainingIgnoreCase(search, search, pageable);
        } else {
            page = communityRepository.findAll(pageable);
        }

        Page<CommunityResponse> responsePage = page.map(community -> {
            CommunityRole role = null;
            if (currentUserId != null) {
                role = communityMemberRepository.findByCommunityIdAndUserId(community.getId(), currentUserId)
                        .map(CommunityMember::getRole)
                        .orElse(null);
            }
            return communityMapper.toResponse(community, role);
        });

        return PageResponse.fromPage(responsePage);
    }

    @Override
    @Transactional(readOnly = true)
    public CommunityResponse getCommunityById(Long currentUserId, Long communityId) {
        Community community = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Community not found with ID: " + communityId));

        CommunityRole role = null;
        if (currentUserId != null) {
            role = communityMemberRepository.findByCommunityIdAndUserId(communityId, currentUserId)
                    .map(CommunityMember::getRole)
                    .orElse(null);
        }

        return communityMapper.toResponse(community, role);
    }

    @Override
    @Transactional
    public CommunityResponse updateCommunity(Long authenticatedUserId, Long communityId, UpdateCommunityRequest request) {
        if (authenticatedUserId == null) {
            throw new UnauthorizedException("User ID is required to update a community");
        }

        Community community = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Community not found with ID: " + communityId));

        CommunityMember member = communityMemberRepository.findByCommunityIdAndUserId(communityId, authenticatedUserId)
                .orElseThrow(() -> new UnauthorizedException("You do not have permission to update this community"));

        if (member.getRole() != CommunityRole.OWNER && member.getRole() != CommunityRole.MODERATOR) {
            throw new UnauthorizedException("Only community OWNER or MODERATOR can update community details");
        }

        if (request.getName() != null && !request.getName().isBlank() && !request.getName().equalsIgnoreCase(community.getName())) {
            if (communityRepository.existsByNameIgnoreCase(request.getName())) {
                throw new ConflictException("Community with name '" + request.getName() + "' already exists");
            }
            community.setName(request.getName());
        }

        if (request.getDescription() != null) {
            community.setDescription(request.getDescription());
        }
        if (request.getIcon() != null) {
            community.setIcon(request.getIcon());
        }

        Community updatedCommunity = communityRepository.save(community);
        return communityMapper.toResponse(updatedCommunity, member.getRole());
    }

    @Override
    @Transactional
    public void deleteCommunity(Long authenticatedUserId, Long communityId) {
        if (authenticatedUserId == null) {
            throw new UnauthorizedException("User ID is required to delete a community");
        }

        Community community = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Community not found with ID: " + communityId));

        CommunityMember member = communityMemberRepository.findByCommunityIdAndUserId(communityId, authenticatedUserId)
                .orElseThrow(() -> new UnauthorizedException("Only the community OWNER can delete the community"));

        if (member.getRole() != CommunityRole.OWNER) {
            throw new UnauthorizedException("Only the community OWNER can delete the community");
        }

        communityMemberRepository.deleteByCommunityId(communityId);
        communityRepository.delete(community);
    }

    @Override
    @Transactional
    public CommunityMemberResponse joinCommunity(Long authenticatedUserId, Long communityId) {
        if (authenticatedUserId == null) {
            throw new UnauthorizedException("User ID is required to join a community");
        }

        Community community = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Community not found with ID: " + communityId));

        if (communityMemberRepository.existsByCommunityIdAndUserId(communityId, authenticatedUserId)) {
            throw new ConflictException("You are already a member of this community");
        }

        CommunityMember member = CommunityMember.builder()
                .communityId(communityId)
                .userId(authenticatedUserId)
                .role(CommunityRole.MEMBER)
                .build();

        try {
            member = communityMemberRepository.saveAndFlush(member);
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException("You are already a member of this community");
        }

        // Increment member count
        communityRepository.incrementMemberCount(communityId);

        UserProfile userProfile = userProfileRepository.findByUserId(authenticatedUserId).orElse(null);
        return communityMemberMapper.toResponse(member, userProfile);
    }

    @Override
    @Transactional
    public void leaveCommunity(Long authenticatedUserId, Long communityId) {
        if (authenticatedUserId == null) {
            throw new UnauthorizedException("User ID is required to leave a community");
        }

        if (!communityRepository.existsById(communityId)) {
            throw new ResourceNotFoundException("Community not found with ID: " + communityId);
        }

        CommunityMember member = communityMemberRepository.findByCommunityIdAndUserId(communityId, authenticatedUserId)
                .orElseThrow(() -> new ResourceNotFoundException("You are not a member of this community"));

        if (member.getRole() == CommunityRole.OWNER) {
            throw new BadRequestException("Community owner cannot leave without transferring ownership or deleting the community");
        }

        communityMemberRepository.delete(member);
        communityRepository.decrementMemberCount(communityId);
    }

    @Override
    @Transactional
    public void removeMember(Long authenticatedUserId, Long communityId, Long targetUserId) {
        if (authenticatedUserId == null) {
            throw new UnauthorizedException("User ID is required to remove a member");
        }

        if (authenticatedUserId.equals(targetUserId)) {
            leaveCommunity(authenticatedUserId, communityId);
            return;
        }

        if (!communityRepository.existsById(communityId)) {
            throw new ResourceNotFoundException("Community not found with ID: " + communityId);
        }

        CommunityMember requester = communityMemberRepository.findByCommunityIdAndUserId(communityId, authenticatedUserId)
                .orElseThrow(() -> new UnauthorizedException("You are not a member of this community"));

        CommunityMember target = communityMemberRepository.findByCommunityIdAndUserId(communityId, targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User is not a member of this community"));

        if (requester.getRole() == CommunityRole.MEMBER) {
            throw new UnauthorizedException("You do not have permission to remove members");
        }

        if (requester.getRole() == CommunityRole.MODERATOR && (target.getRole() == CommunityRole.MODERATOR || target.getRole() == CommunityRole.OWNER)) {
            throw new UnauthorizedException("Moderators cannot remove other moderators or the owner");
        }

        communityMemberRepository.delete(target);
        communityRepository.decrementMemberCount(communityId);
    }

    @Override
    @Transactional
    public CommunityMemberResponse updateMemberRole(Long authenticatedUserId, Long communityId, Long targetUserId, CommunityRole newRole) {
        if (authenticatedUserId == null) {
            throw new UnauthorizedException("User ID is required to update member roles");
        }

        if (newRole == null) {
            throw new BadRequestException("Role cannot be null");
        }

        if (!communityRepository.existsById(communityId)) {
            throw new ResourceNotFoundException("Community not found with ID: " + communityId);
        }

        CommunityMember requester = communityMemberRepository.findByCommunityIdAndUserId(communityId, authenticatedUserId)
                .orElseThrow(() -> new UnauthorizedException("You are not a member of this community"));

        if (requester.getRole() != CommunityRole.OWNER) {
            throw new UnauthorizedException("Only the community OWNER can manage member roles");
        }

        CommunityMember target = communityMemberRepository.findByCommunityIdAndUserId(communityId, targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User is not a member of this community"));

        if (newRole == CommunityRole.OWNER) {
            if (targetUserId.equals(authenticatedUserId)) {
                throw new BadRequestException("Cannot assign yourself as OWNER");
            }
            // Transfer ownership: requester becomes MODERATOR, target becomes OWNER
            requester.setRole(CommunityRole.MODERATOR);
            communityMemberRepository.save(requester);
        }

        target.setRole(newRole);
        CommunityMember updatedTarget = communityMemberRepository.save(target);

        UserProfile targetProfile = userProfileRepository.findByUserId(targetUserId).orElse(null);
        return communityMemberMapper.toResponse(updatedTarget, targetProfile);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<CommunityMemberResponse> getCommunityMembers(Long communityId, Pageable pageable) {
        if (!communityRepository.existsById(communityId)) {
            throw new ResourceNotFoundException("Community not found with ID: " + communityId);
        }

        Page<CommunityMember> memberPage = communityMemberRepository.findByCommunityId(communityId, pageable);
        Page<CommunityMemberResponse> responsePage = memberPage.map(member -> {
            UserProfile profile = userProfileRepository.findByUserId(member.getUserId()).orElse(null);
            return communityMemberMapper.toResponse(member, profile);
        });

        return PageResponse.fromPage(responsePage);
    }

    @Override
    @Transactional
    public PostResponse createCommunityPost(Long authenticatedUserId, Long communityId, CreatePostRequest request) {
        if (authenticatedUserId == null) {
            throw new UnauthorizedException("User ID is required to create a community post");
        }

        if (!communityRepository.existsById(communityId)) {
            throw new ResourceNotFoundException("Community not found with ID: " + communityId);
        }

        if (!communityMemberRepository.existsByCommunityIdAndUserId(communityId, authenticatedUserId)) {
            throw new UnauthorizedException("You must be a member of this community to create a post");
        }

        request.setCommunityId(communityId);
        return postService.createPost(authenticatedUserId, request);
    }
}
