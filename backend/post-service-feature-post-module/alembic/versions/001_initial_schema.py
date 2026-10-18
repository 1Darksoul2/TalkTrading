"""Initial schema migration with full DDL statements

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-09-08 16:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create posts table
    op.create_table(
        'posts',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('author_id', sa.Integer(), nullable=False),
        sa.Column('caption', sa.Text(), nullable=True),
        sa.Column('visibility', sa.Enum('PUBLIC', 'FOLLOWERS', 'PRIVATE', name='postvisibility'), nullable=False, server_default='PUBLIC'),
        sa.Column('status', sa.Enum('ACTIVE', 'HIDDEN', 'DELETED', 'UNDER_REVIEW', name='poststatus'), nullable=False, server_default='ACTIVE'),
        sa.Column('like_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('comment_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('save_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('share_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )
    op.create_index('idx_posts_author_created', 'posts', ['author_id', 'created_at'])
    op.create_index('idx_posts_visibility_status', 'posts', ['visibility', 'status'])
    op.create_index('ix_posts_id', 'posts', ['id'])
    op.create_index('ix_posts_author_id', 'posts', ['author_id'])
    op.create_index('ix_posts_created_at', 'posts', ['created_at'])

    # 2. Create comments table
    op.create_table(
        'comments',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('post_id', sa.Integer(), sa.ForeignKey('posts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('author_id', sa.Integer(), nullable=False),
        sa.Column('parent_comment_id', sa.Integer(), sa.ForeignKey('comments.id', ondelete='CASCADE'), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('status', sa.Enum('ACTIVE', 'HIDDEN', 'DELETED', 'UNDER_REVIEW', name='commentstatus'), nullable=False, server_default='ACTIVE'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )
    op.create_index('idx_comments_post_created', 'comments', ['post_id', 'created_at'])
    op.create_index('ix_comments_id', 'comments', ['id'])
    op.create_index('ix_comments_post_id', 'comments', ['post_id'])

    # 3. Create likes table
    op.create_table(
        'likes',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('post_id', sa.Integer(), sa.ForeignKey('posts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.UniqueConstraint('user_id', 'post_id', name='uq_user_post_like'),
    )
    op.create_index('idx_likes_post_user', 'likes', ['post_id', 'user_id'])
    op.create_index('ix_likes_id', 'likes', ['id'])

    # 4. Create saves table
    op.create_table(
        'saves',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('post_id', sa.Integer(), sa.ForeignKey('posts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.UniqueConstraint('user_id', 'post_id', name='uq_user_post_save'),
    )
    op.create_index('idx_saves_user_created', 'saves', ['user_id', 'created_at'])
    op.create_index('ix_saves_id', 'saves', ['id'])

    # 5. Create post_media table
    op.create_table(
        'post_media',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('post_id', sa.Integer(), sa.ForeignKey('posts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('media_type', sa.Enum('IMAGE', 'VIDEO', name='mediatype'), nullable=False),
        sa.Column('storage_key', sa.String(length=500), nullable=False),
        sa.Column('url', sa.String(length=1000), nullable=False),
        sa.Column('thumbnail_url', sa.String(length=1000), nullable=True),
        sa.Column('width', sa.Integer(), nullable=True),
        sa.Column('height', sa.Integer(), nullable=True),
        sa.Column('duration', sa.Float(), nullable=True),
        sa.Column('position', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )
    op.create_index('ix_post_media_id', 'post_media', ['id'])
    op.create_index('ix_post_media_post_id', 'post_media', ['post_id'])

    # 6. Create shares table
    op.create_table(
        'shares',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('post_id', sa.Integer(), sa.ForeignKey('posts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )
    op.create_index('ix_shares_id', 'shares', ['id'])

    # 7. Create hashtags table
    op.create_table(
        'hashtags',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('tag', sa.String(length=100), nullable=False, unique=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )
    op.create_index('ix_hashtags_id', 'hashtags', ['id'])
    op.create_index('ix_hashtags_tag', 'hashtags', ['tag'])

    # 8. Create post_hashtags table
    op.create_table(
        'post_hashtags',
        sa.Column('post_id', sa.Integer(), sa.ForeignKey('posts.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('hashtag_id', sa.Integer(), sa.ForeignKey('hashtags.id', ondelete='CASCADE'), primary_key=True),
    )

    # 9. Create mentions table
    op.create_table(
        'mentions',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('post_id', sa.Integer(), sa.ForeignKey('posts.id', ondelete='CASCADE'), nullable=True),
        sa.Column('comment_id', sa.Integer(), sa.ForeignKey('comments.id', ondelete='CASCADE'), nullable=True),
        sa.Column('mentioned_user_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )
    op.create_index('ix_mentions_id', 'mentions', ['id'])


def downgrade() -> None:
    op.drop_table('mentions')
    op.drop_table('post_hashtags')
    op.drop_table('hashtags')
    op.drop_table('shares')
    op.drop_table('post_media')
    op.drop_table('saves')
    op.drop_table('likes')
    op.drop_table('comments')
    op.drop_table('posts')
