import { useCallback, useEffect, useState } from 'react'
import { storyService } from '../services/storyService'

/**
 * The account's story settings, stored by the Story Service. Changes apply immediately in the UI and are rolled
 * back (with an error message) if the server refuses them.
 */
export function useStorySettings() {
  const [settings, setSettings] = useState(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const load = useCallback(() => {
    setError('')
    storyService.settings().then(setSettings).catch(err => setError(err.message))
  }, [])

  useEffect(() => { load() }, [load])

  const update = useCallback(async changes => {
    const before = settings
    setSettings(prev => ({ ...prev, ...changes }))
    setError('')
    try {
      setSettings(await storyService.updateSettings(changes))
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (err) {
      setSettings(before)
      setError(err.message)
    }
  }, [settings])

  return { settings, error, saved, update, reload: load }
}
