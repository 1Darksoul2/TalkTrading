import SettingsRow from '../../components/settings/SettingsRow'
import Toggle from '../../components/settings/Toggle'
import { useTheme } from '../../context/ThemeContext'
import { usePreferences } from '../../context/PreferencesContext'
import SettingsPage, { Choice, Group } from './SettingsPage'

/** Interface preferences for this device. Each one changes the app immediately. */
export default function AppearanceSettings() {
  const { theme, toggleTheme } = useTheme()
  const { autoplayVideos, reduceMotion, highContrast, setPref } = usePreferences()
  return (
    <SettingsPage title="Appearance & accessibility" intro="These preferences are saved on this device, so each screen can be set up the way you like it.">
      <Group title="Theme">
        <div role="radiogroup">
          <Choice label="Dark" description="Easier on the eyes at night" selected={theme === 'dark'} onSelect={() => theme !== 'dark' && toggleTheme()} />
          <Choice label="Light" selected={theme === 'light'} onSelect={() => theme !== 'light' && toggleTheme()} />
        </div>
      </Group>
      <Group title="Accessibility">
        <SettingsRow icon="contrast" label="High contrast" description="Stronger text and border contrast, and a clear focus outline"
          trailing={<Toggle checked={highContrast} onChange={v => setPref('highContrast', v)} />} />
        <SettingsRow icon="motion_photos_off" label="Reduce motion" description="Turn off animations and transitions throughout the app"
          trailing={<Toggle checked={reduceMotion} onChange={v => setPref('reduceMotion', v)} />} />
      </Group>
      <Group title="Media">
        <SettingsRow icon="play_circle" label="Autoplay story videos" description="When off, a video story waits until you press play"
          trailing={<Toggle checked={autoplayVideos} onChange={v => setPref('autoplayVideos', v)} />} />
      </Group>
    </SettingsPage>
  )
}
