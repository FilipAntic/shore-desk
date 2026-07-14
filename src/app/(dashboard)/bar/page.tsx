import { redirectToOwnBeach } from '@/lib/beach'

export default async function LegacyBarRedirect() {
  await redirectToOwnBeach('bar')
}
