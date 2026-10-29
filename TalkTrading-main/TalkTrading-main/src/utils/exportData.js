import { postService } from '../services/postService'
import { storyService } from '../services/storyService'

const PAGE = 100
const MAX_PAGES = 20

async function allPages(fetchPage, size = PAGE) {
  const out = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const batch = await fetchPage(page)
    out.push(...batch)
    if (batch.length < size) break
  }
  return out
}

const brief = p => ({ id: p.id, caption: p.caption, visibility: p.visibility, created_at: p.createdAt, likes: p.likes, comments: p.comments, shares: p.shares })

/**
 * Everything the app can read about the logged-in account, gathered from the services' own APIs.
 * Each part is collected independently: if one service is unreachable its part is listed under `errors`
 * instead of silently going missing. `onStep(label)` reports progress.
 */
export async function collectMyData(onStep = () => {}) {
  const data = { exported_at: new Date().toISOString(), errors: [] }
  const step = async (key, label, work) => {
    onStep(label)
    try { data[key] = await work() } catch (err) { data.errors.push(`${label}: ${err.message}`) }
  }

  await step('profile', 'Profile', () => postService.getMyProfile())
  if (!data.profile) return data
  const id = data.profile.author_id

  await step('posts', 'Posts', async () => (await allPages(page => postService.fetchPosts({ author_id: id, page, limit: PAGE }))).map(brief))
  await step('saved_posts', 'Saved posts', async () => (await postService.fetchSavedPosts(1, 100)).map(brief))
  await step('tagged_posts', 'Posts you are tagged in', async () => (await allPages(page => postService.getTaggedPosts(id, page, 50), 50)).map(brief))   // the mentions endpoint allows 50 per page
  await step('followers', 'Followers', async () => (await allPages(page => postService.getFollowList(id, 'followers', page, PAGE))).map(u => u.username))
  await step('following', 'Following', async () => (await allPages(page => postService.getFollowList(id, 'following', page, PAGE))).map(u => u.username))
  await step('post_notifications', 'Notifications', async () => (await postService.getNotifications()).notifications.map(n => ({ type: n.type, from: n.actor?.username, at: n.created_at })))
  await step('stories', 'Stories, highlights and story settings', () => storyService.exportData())
  return data
}

export function downloadJson(data, filename = 'talktrading-data.json') {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
