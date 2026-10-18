import SettingsRow from '../../components/settings/SettingsRow'
import Toggle from '../../components/settings/Toggle'
import { useStorySettings } from '../../hooks/useStorySettings'
import SettingsPage, { Group } from './SettingsPage'

const ROWS = [
  ['notify_replies', 'reply', 'Story replies', 'Someone replies to one of your stories'],
  ['notify_reactions', 'add_reaction', 'Story reactions', 'Someone reacts to one of your stories'],
  ['notify_mentions', 'alternate_email', 'Story mentions', 'Someone @mentions you in their story'],
  ['notify_poll_votes', 'poll', 'Poll votes', 'Someone votes in a poll on your story'],
]

/** Which story events create an in-app notification for you. The Story Service checks this when it creates one. */
export default function NotificationSettings() {
  const { settings, error, saved, update, reload } = useStorySettings()
  return (
    <SettingsPage title="Story notifications" error={error} saved={saved}
      intro="Choose which story activity shows up in the bell. When a kind is off, that notification is never created.">
      {!settings ? (
        error ? <button onClick={reload} className="self-start text-sm font-semibold text-primary">Try again</button> : <p className="text-sm text-on-surface-muted">Loading…</p>
      ) : (
        <Group>
          {ROWS.map(([key, icon, label, description]) => (
            <SettingsRow key={key} icon={icon} label={label} description={description}
              trailing={<Toggle checked={settings[key]} onChange={v => update({ [key]: v })} />} />
          ))}
        </Group>
      )}
      <p className="text-xs text-on-surface-muted px-1">
        Notifications about new followers, likes, comments and @mentions in posts come from the posts service, which
        has no per-type switches yet, so they cannot be turned off here. Push and email notifications are not available.
      </p>
    </SettingsPage>
  )
}
