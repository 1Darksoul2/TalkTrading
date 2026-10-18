import { storyService } from '../../services/storyService'

/** A small still of a story: the photo itself, or the first frame of a video. */
export default function StoryThumb({ story, className = '' }) {
  const src = storyService.mediaUrl(story.media_url)
  return story.media_type === 'video'
    ? <video src={`${src}#t=0.1`} muted playsInline preload="metadata" className={`object-cover ${className}`} />
    : <img src={src} alt={story.caption || 'Story'} loading="lazy" className={`object-cover ${className}`} />
}
