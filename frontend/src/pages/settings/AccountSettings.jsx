import { useNavigate } from 'react-router-dom'
import SettingsRow from '../../components/settings/SettingsRow'
import { useAuth } from '../../context/AuthContext'
import SettingsPage, { Group } from './SettingsPage'

/** Who you are signed in as, a shortcut to edit your profile, and logging out of this device. */
export default function AccountSettings() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const signOut = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <SettingsPage title="Account">
      <Group title="Signed in as">
        <SettingsRow icon="person" label={`@${user?.username}`} description={user?.email} />
        <SettingsRow icon="edit" label="Edit profile" description="Name, bio and profile photo" onClick={() => navigate('/profile?edit=1')}
          trailing={<span className="material-symbols-outlined text-on-surface-muted text-[20px]">chevron_right</span>} />
      </Group>
      <Group title="This device">
        <SettingsRow icon="logout" label="Log out" danger onClick={signOut}
          description="Signs you out on this device. Your login token stays valid until it expires (the accounts service has no remote sign-out yet)." />
      </Group>
    </SettingsPage>
  )
}
