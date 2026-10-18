-- Flyway V1: Initial Explore Service Schema

-- Table: user_interests
-- Tracks topics/hashtags/categories that individual users have affinity towards.
CREATE TABLE IF NOT EXISTS user_interests (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    topic VARCHAR(100) NOT NULL,
    weight DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_topic UNIQUE (user_id, topic)
);

CREATE INDEX IF NOT EXISTS idx_user_interests_user_id ON user_interests (user_id);
CREATE INDEX IF NOT EXISTS idx_user_interests_topic ON user_interests (topic);

-- Table: user_interactions
-- Historical user interactions used for personalization boosting and deduplicating already-seen posts.
CREATE TABLE IF NOT EXISTS user_interactions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    post_id BIGINT NOT NULL,
    interaction_type VARCHAR(50) NOT NULL,
    category VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_interactions_user_created ON user_interactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_interactions_user_post ON user_interactions (user_id, post_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_post_id ON user_interactions (post_id);

-- Table: explore_ranking_config
-- Dynamic configurable baselines and weight factors for Explore ranking.
CREATE TABLE IF NOT EXISTS explore_ranking_config (
    id BIGSERIAL PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value VARCHAR(255) NOT NULL,
    description VARCHAR(500),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial ranking baseline configuration
INSERT INTO explore_ranking_config (config_key, config_value, description)
VALUES 
    ('BASELINE_LIKES', '500', 'Normalization ceiling for post likes'),
    ('BASELINE_COMMENTS', '100', 'Normalization ceiling for post comments'),
    ('BASELINE_VIEWS', '5000', 'Normalization ceiling for post views'),
    ('RECENCY_HALF_LIFE_HOURS', '24.0', 'Half-life in hours for recency exponential decay')
ON CONFLICT (config_key) DO NOTHING;
