export interface PublicBadgeView {
  key: string
  name: string
  description: string
  icon: string
  color: string
}

export interface UserIdentityView {
  userId: number
  displayName: string
  badges: PublicBadgeView[]
}
