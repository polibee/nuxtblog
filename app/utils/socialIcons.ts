import {
  GithubIcon,
  TwitterIcon,
  LinkedinIcon,
  MailIcon,
  GlobeIcon,
  YoutubeIcon,
  SendIcon,
  MessageCircleIcon,
  RssIcon,
  LinkIcon
} from 'lucide-vue-next'
import type { Component } from 'vue'

/* platform → icon, shared by AuthorCardView + /profile page */
const SOCIAL_ICONS: Record<string, Component> = {
  github: GithubIcon,
  x: TwitterIcon,
  linkedin: LinkedinIcon,
  website: GlobeIcon,
  email: MailIcon,
  youtube: YoutubeIcon,
  telegram: SendIcon,
  discord: MessageCircleIcon,
  rss: RssIcon,
  custom: LinkIcon
}

export function socialIcon(platform: string): Component {
  return SOCIAL_ICONS[platform] ?? LinkIcon
}
