"""
Who may see or reply to which story. Every read path goes through this class, so the rules
live in exactly one place and are enforced on the server, never by the browser.

A story is visible to a viewer when ALL of these hold:
  1. the story has not expired (checked by the callers' queries, or `include_expired` for the owner),
  2. the viewer is the owner, OR
       - the viewer is not on the owner's "hide my story from" list, and
       - the viewer was @mentioned in that story (always allowed), or otherwise
       - for Close Friends stories: the viewer is on the owner's Close Friends list;
         for everyone-stories: the owner's "who can see" is everyone, or the viewer follows the owner.
"""
import uuid
from typing import Dict, Optional, Set

from sqlalchemy.orm import Session

from .auth import Principal
from .graph import PostGraph, Relationship
from .models import (
    Audience, CloseFriend, Story, StoryHidden, StoryMention, StorySettings,
)

DEFAULT_SETTINGS = StorySettings(
    owner_id=None, who_can_see="everyone", allow_replies="everyone", allow_mentions="everyone",
    save_to_archive=True, notify_replies=True, notify_reactions=True, notify_mentions=True, notify_poll_votes=True,
)


class Access:
    """Answers privacy questions for one viewer; caches lookups for the lifetime of a request."""

    def __init__(self, db: Session, viewer: Principal, graph: PostGraph):
        self.db = db
        self.viewer = viewer
        self.graph = graph
        self._settings: Dict[uuid.UUID, StorySettings] = {}
        self._hidden: Dict[uuid.UUID, bool] = {}
        self._close: Dict[uuid.UUID, bool] = {}
        self._relationship: Dict[uuid.UUID, Relationship] = {}
        self._mentioned: Optional[Set[uuid.UUID]] = None

    # -- cached lookups ---------------------------------------------------
    def settings(self, owner: uuid.UUID) -> StorySettings:
        if owner not in self._settings:
            row = self.db.get(StorySettings, owner)
            self._settings[owner] = row or DEFAULT_SETTINGS
        return self._settings[owner]

    def preload(self, owners: Set[uuid.UUID]) -> None:
        """Load settings, hidden and close-friend flags for many owners in a few queries."""
        owners = {o for o in owners if o != self.viewer.user_id}
        todo = owners - set(self._settings)
        if todo:
            found = {s.owner_id: s for s in self.db.query(StorySettings).filter(StorySettings.owner_id.in_(todo))}
            for o in todo:
                self._settings[o] = found.get(o, DEFAULT_SETTINGS)
        todo = owners - set(self._hidden)
        if todo:
            hidden = {h.owner_id for h in self.db.query(StoryHidden).filter(
                StoryHidden.owner_id.in_(todo), StoryHidden.hidden_id == self.viewer.user_id)}
            for o in todo:
                self._hidden[o] = o in hidden
        todo = owners - set(self._close)
        if todo:
            close = {c.owner_id for c in self.db.query(CloseFriend).filter(
                CloseFriend.owner_id.in_(todo), CloseFriend.friend_id == self.viewer.user_id)}
            for o in todo:
                self._close[o] = o in close

    def is_hidden_from_me(self, owner: uuid.UUID) -> bool:
        self.preload({owner})
        return self._hidden.get(owner, False)

    def is_close_friend_of(self, owner: uuid.UUID) -> bool:
        self.preload({owner})
        return self._close.get(owner, False)

    def relationship(self, owner: uuid.UUID) -> Relationship:
        if owner not in self._relationship:
            self._relationship[owner] = self.graph.relationship(self.viewer, owner)
        return self._relationship[owner]

    def known_following(self, owner: uuid.UUID) -> None:
        """Record that the viewer is known to follow `owner` (saves a lookup when building the tray)."""
        prev = self._relationship.get(owner, Relationship())
        self._relationship[owner] = Relationship(True, prev.owner_follows_viewer)

    def mentioned_story_ids(self) -> Set[uuid.UUID]:
        if self._mentioned is None:
            self._mentioned = {m.story_id for m in self.db.query(StoryMention).filter(
                StoryMention.user_id == self.viewer.user_id)}
        return self._mentioned

    # -- rules ------------------------------------------------------------
    def can_view(self, story: Story) -> bool:
        owner = story.user_id
        if owner == self.viewer.user_id:
            return True
        if self.is_hidden_from_me(owner):
            return False
        if story.id in self.mentioned_story_ids():
            return True
        if story.audience == Audience.close_friends.value:
            return self.is_close_friend_of(owner)
        if self.settings(owner).who_can_see == "followers":
            return self.relationship(owner).viewer_follows_owner
        return True

    def can_reply(self, story: Story) -> bool:
        owner = story.user_id
        if owner == self.viewer.user_id:
            return False
        mode = self.settings(owner).allow_replies
        if mode == "off":
            return False
        if mode == "following":
            return self.relationship(owner).owner_follows_viewer
        return True
