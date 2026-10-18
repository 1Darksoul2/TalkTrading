import { useState } from 'react'
import { storyService } from '../../services/storyService'
import { collectMyData, downloadJson } from '../../utils/exportData'
import SettingsPage, { Group } from './SettingsPage'

/** Download a copy of your data, or permanently delete everything the Story Service holds about you. */
export default function YourInformation() {
  const [working, setWorking] = useState('')
  const [report, setReport] = useState(null)       // { errors } after a download
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [phrase, setPhrase] = useState('')
  const [deleted, setDeleted] = useState(null)

  const download = async () => {
    setError('')
    setReport(null)
    try {
      const data = await collectMyData(setWorking)
      downloadJson(data)
      setReport({ errors: data.errors })
    } catch (err) {
      setError(err.message)
    } finally {
      setWorking('')
    }
  }

  const wipe = async () => {
    setError('')
    setWorking('Deleting')
    try {
      setDeleted(await storyService.deleteAllData())
      setConfirming(false)
      setPhrase('')
    } catch (err) {
      setError(err.message)
    } finally {
      setWorking('')
    }
  }

  return (
    <SettingsPage title="Your information" error={error}
      intro="Download what TalkTrading holds about you, or permanently remove your stories.">
      <Group title="Download your information">
        <div className="px-4 py-4 flex flex-col gap-3">
          <p className="text-sm text-on-surface-muted">
            A single JSON file with your profile, posts, saved and tagged posts, followers and following, notifications,
            and your stories, highlights, lists and story settings. Messages are end-to-end encrypted and are not included.
          </p>
          <button onClick={download} disabled={Boolean(working)} className="self-start px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold disabled:opacity-50">
            {working && working !== 'Deleting' ? `Collecting: ${working}…` : 'Download my information'}
          </button>
          {report && (report.errors.length === 0
            ? <p className="text-xs text-bullish">Your file was downloaded.</p>
            : <p className="text-xs text-error">Downloaded, but some parts could not be collected: {report.errors.join('; ')}</p>)}
        </div>
      </Group>

      <Group title="Delete your story data">
        <div className="px-4 py-4 flex flex-col gap-3">
          <p className="text-sm text-on-surface-muted">
            Permanently deletes every story (and its photo or video), highlight, reply, reaction, Close Friends / hidden / muted list,
            story setting and story notification of yours. This cannot be undone. Your posts, profile and chat are not affected.
          </p>
          {deleted && <p className="text-xs text-bullish">Done. {deleted.stories_deleted} {deleted.stories_deleted === 1 ? 'story was' : 'stories were'} deleted.</p>}
          {!confirming ? (
            <button onClick={() => { setConfirming(true); setDeleted(null) }} className="self-start px-5 py-2.5 rounded-xl border border-error/50 text-error text-sm font-bold hover:bg-error/10">Delete my story data…</button>
          ) : (
            <div className="flex flex-col gap-2">
              <label htmlFor="confirm-delete" className="text-sm text-on-surface">Type <span className="font-mono font-bold">DELETE</span> to confirm</label>
              <input id="confirm-delete" value={phrase} onChange={e => setPhrase(e.target.value)} autoComplete="off"
                className="bg-surface-container-low border border-white/10 rounded-lg px-3 py-2 text-sm text-on-surface font-mono focus:outline-none focus:border-error/60" />
              <div className="flex gap-2">
                <button onClick={() => { setConfirming(false); setPhrase('') }} className="px-4 py-2 rounded-lg bg-surface-container-high text-sm font-semibold text-on-surface">Cancel</button>
                <button onClick={wipe} disabled={phrase !== 'DELETE' || Boolean(working)} className="px-4 py-2 rounded-lg bg-error/90 text-black text-sm font-bold disabled:opacity-40">
                  {working === 'Deleting' ? 'Deleting…' : 'Delete permanently'}
                </button>
              </div>
            </div>
          )}
        </div>
      </Group>
    </SettingsPage>
  )
}
