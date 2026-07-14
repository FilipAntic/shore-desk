import { redirectToOwnBeach } from '@/lib/beach'

export default async function LegacyAdminRedirect() {
  await redirectToOwnBeach('admin')
}
