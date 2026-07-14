import { redirectToOwnBeach } from '@/lib/beach'

export default async function LegacyWaiterRedirect() {
  await redirectToOwnBeach('waiter')
}
