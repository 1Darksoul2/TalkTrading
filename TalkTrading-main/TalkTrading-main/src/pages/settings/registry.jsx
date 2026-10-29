import AccountSettings from './AccountSettings'
import AppearanceSettings from './AppearanceSettings'
import NotificationSettings from './NotificationSettings'
import PeopleListSettings from './PeopleListSettings'
import StoryPrivacySettings from './StoryPrivacySettings'
import YourInformation from './YourInformation'

// Every entry is a settings page that reads and changes something real. To add one, add a page here.
export const SECTIONS = [
  { id: 'account', title: 'Your account', icon: 'person' },
  { id: 'privacy', title: 'Who can see your content', icon: 'lock' },
  { id: 'notifications', title: 'Notifications', icon: 'notifications' },
  { id: 'device', title: 'This device', icon: 'devices' },
]

export const PAGES = [
  { id: 'account', section: 'account', icon: 'manage_accounts', label: 'Account', description: 'Edit profile and log out', element: <AccountSettings /> },
  { id: 'your-information', section: 'account', icon: 'download', label: 'Your information', description: 'Download your data or delete your story data', element: <YourInformation /> },
  { id: 'story-privacy', section: 'privacy', icon: 'auto_stories', label: 'Story privacy', description: 'Who can see, reply to and mention you in stories; story archive', element: <StoryPrivacySettings /> },
  { id: 'close-friends', section: 'privacy', icon: 'star', label: 'Close Friends', description: 'The list for Close Friends stories', element: <PeopleListSettings kind="close-friends" /> },
  { id: 'story-hidden', section: 'privacy', icon: 'visibility_off', label: 'Hide story from', description: 'People who never see your stories', element: <PeopleListSettings kind="story-hidden" /> },
  { id: 'story-mutes', section: 'privacy', icon: 'volume_off', label: 'Muted stories', description: 'People whose stories you do not want to watch', element: <PeopleListSettings kind="story-mutes" /> },
  { id: 'story-notifications', section: 'notifications', icon: 'notifications_active', label: 'Story notifications', description: 'Replies, reactions, mentions and poll votes', element: <NotificationSettings /> },
  { id: 'appearance', section: 'device', icon: 'dark_mode', label: 'Appearance & accessibility', description: 'Theme, high contrast, reduce motion, video autoplay', element: <AppearanceSettings /> },
]

export const findPage = id => PAGES.find(p => p.id === id)
