export type UserRole = 'owner' | 'manager' | 'seller' | 'waiter' | 'kitchen' | 'bar'

export type BedStatus = 'available' | 'occupied' | 'reserved' | 'disabled'

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivering' | 'delivered' | 'cancelled'

export type OrderItemType = 'food' | 'drink'

export type RentalDuration = 'full_day'

// ── Database row types ──────────────────────────────────────────────────────

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface Bed {
  id: string
  label: string        // e.g. "A3"
  row: number
  col: number
  section: string | null
  status: BedStatus
  is_active: boolean
  created_at: string
}

export interface Rental {
  id: string
  bed_id: string
  seller_id: string
  started_at: string
  ends_at: string
  amount_paid: number
  duration_type: RentalDuration
  notes: string | null
  created_at: string
  // joins
  bed?: Bed
  seller?: Profile
}

export interface MenuItem {
  id: string
  name: string
  description: string | null
  price: number
  category: string
  type: OrderItemType
  image_url: string | null
  is_available: boolean
  sort_order: number
}

export interface Order {
  id: string
  bed_id: string
  rental_id: string | null
  customer_name: string | null
  status: OrderStatus
  notes: string | null
  order_number: number
  created_at: string
  updated_at: string
  // joins
  bed?: Bed
  items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  menu_item_id: string
  quantity: number
  unit_price: number
  notes: string | null
  // joins
  menu_item?: MenuItem
}

// ── View / enriched types ───────────────────────────────────────────────────

export interface BedWithState extends Bed {
  active_rental: Rental | null
  pending_orders: Order[]
}