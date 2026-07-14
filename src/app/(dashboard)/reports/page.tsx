import { redirectToOwnBeach } from '@/lib/beach'

export default async function LegacyReportsRedirect() {
  await redirectToOwnBeach('reports')
}
