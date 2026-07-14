import { redirectToOwnBeach } from '@/lib/beach'

export default async function LegacySellerRedirect() {
  await redirectToOwnBeach('seller')
}
