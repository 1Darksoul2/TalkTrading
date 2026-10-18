import { useNavigate } from 'react-router-dom'
import SettingsRow from '../../components/settings/SettingsRow'
import Toggle from '../../components/settings/Toggle'
import { useStorySettings } from '../../hooks/useStorySettings'
import SettingsPage, { Choice, Group } from './SettingsPage'

const WHO_CAN_SEE = [
  ['everyone', 'Everyone', 'Anyone on TalkTrading can watch your stories.'],
  ['followers', 'Only my followers', 'People who do not follow you cannot open your stories.'],
]
const REPLIES = [
  ['everyone', 'Everyone who can see my story', null],
  ['following', 'People I follow', 'Only accounts you follow can reply.'],
  ['off', 'Off', 'Nobody can reply to your stories.'],
]
const MENTIONS = [
  ['everyone', 'Everyone', null],
  ['following', 'People I follow', 'Only accounts you follow can @mention you in a story.'],
  ['none', 'No one', 'Nobody can @mention you in a story.'],
]

function Choices({ options, value, onPick, busy }) {
  return (
    <div role="radiogroup" className="divide-y divide-white/[0.06]">
      {options.map(([id, label, description]) => (
        <Choice key={id} label={label} description={description} selected={value === id} disabled={busy} onSelect={() => value !== id && onPick(id)} />
      ))}
    </div>
  )
}

/** Who can watch, reply to and @mention you in stories. All of it is enforced by the Story Service. */
export default function StoryPrivacySettings() {
  const navigate = useNavigate()
  const { settings, error, saved, update, reload } = useStorySettings()

  if (!settings) {
    return (
      <SettingsPage title="Story privacy" error={error}>
        {error ? <button onClick={reload} className="self-start text-sm font-semibold text-primary">Try again</button> : <p className="text-sm text-on-surface-muted">Loading…</p>}
      </SettingsPage>
    )
  }

  return (
    <SettingsPage title="Story privacy" intro="These rules are checked by the server every time someone opens, replies to or mentions your story." error={error} saved={saved}>
      <Group title="Who can see your stories">
        <Choices options={WHO_CAN_SEE} value={settings.who_can_see} onPick={v => update({ who_can_see: v })} />
      </Group>
      <Group title="Who can reply">
        <Choices options={REPLIES} value={settings.allow_replies} onPick={v => update({ allow_replies: v })} />
      </Group>
      <Group title="Who can @mention you in their story">
        <Choices options={MENTIONS} value={settings.allow_mentions} onPick={v => update({ allow_mentions: v })} />
      </Group>
      <Group title="Archive">
        <SettingsRow icon="inventory_2" label="Save stories to archive"
          description="Keep your stories in a private archive after they expire (stories in a highlight are always kept). When off, expired stories are deleted."
          trailing={<Toggle checked={settings.save_to_archive} onChange={v => update({ save_to_archive: v })} />} />
        <SettingsRow icon="history" label="Story archive" description="Browse, delete or turn old stories into highlights"
          onClick={() => navigate('/stories/archive')} trailing={<span className="material-symbols-outlined text-on-surface-muted text-[20px]">chevron_right</span>} />
      </Group>
      <Group title="People">
        {[['close-friends', 'star', 'Close Friends', 'Share stories with a chosen list'], ['story-hidden', 'visibility_off', 'Hide story from', 'People who never see your stories'], ['story-mutes', 'volume_off', 'Muted stories', 'People whose stories you do not want to watch']].map(([id, icon, label, description]) => (
          <SettingsRow key={id} icon={icon} label={label} description={description} onClick={() => navigate(`/settings/${id}`)}
            trailing={<span className="material-symbols-outlined text-on-surface-muted text-[20px]">chevron_right</span>} />
        ))}
      </Group>
    </SettingsPage>
  )
}
