import { redirectToOwnBeach } from '@/lib/beach'

export default async function LegacyKitchenRedirect() {
  await redirectToOwnBeach('kitchen')
}
