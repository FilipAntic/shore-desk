import { redirectToOwnBeach } from '@/lib/beach'

export default async function LegacyManagerRedirect() {
  await redirectToOwnBeach('manager')
}
