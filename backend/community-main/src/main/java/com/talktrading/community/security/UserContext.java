package com.talktrading.community.security;

import java.util.Collections;
import java.util.List;

public class UserContext {

    private static final ThreadLocal<Long> CURRENT_USER_ID = new ThreadLocal<>();
    private static final ThreadLocal<List<String>> CURRENT_ROLES = ThreadLocal.withInitial(Collections::emptyList);

    public static void setUserId(Long userId) {
        CURRENT_USER_ID.set(userId);
    }

    public static Long getUserId() {
        return CURRENT_USER_ID.get();
    }

    public static void setRoles(List<String> roles) {
        CURRENT_ROLES.set(roles != null ? roles : Collections.emptyList());
    }

    public static List<String> getRoles() {
        return CURRENT_ROLES.get();
    }

    public static void clear() {
        CURRENT_USER_ID.remove();
        CURRENT_ROLES.remove();
    }
}
