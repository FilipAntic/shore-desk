-- ============================================================
-- Shore Desk — Sample Menu Seed
-- Run this after 0001_initial_schema.sql
-- ============================================================

insert into public.menu_items (name, description, price, category, type, sort_order) values
  -- Food
  ('Cheeseburger',      'Beef patty, cheddar, lettuce, tomato',     12.00, 'Burgers',  'food', 1),
  ('Club Sandwich',     'Chicken, bacon, egg, mayo',                10.00, 'Sandwiches','food', 2),
  ('Caesar Salad',      'Romaine, croutons, parmesan, caesar dressing', 9.00, 'Salads', 'food', 3),
  ('Greek Salad',       'Tomato, cucumber, feta, olives',            8.00, 'Salads',   'food', 4),
  ('Fish & Chips',      'Battered cod, fries, tartar sauce',        14.00, 'Mains',    'food', 5),
  ('Margherita Pizza',  'Tomato, mozzarella, basil',                11.00, 'Pizza',    'food', 6),
  ('Nachos',            'Tortilla chips, cheese, salsa, guacamole',  8.00, 'Snacks',   'food', 7),
  ('French Fries',      'Crispy golden fries with sea salt',         4.50, 'Snacks',   'food', 8),
  ('Onion Rings',       'Beer-battered onion rings',                 5.00, 'Snacks',   'food', 9),
  ('Ice Cream',         'Two scoops, choose your flavour',           4.00, 'Desserts', 'food', 10),

  -- Drinks
  ('Corona Beer',       '330ml bottle',                              4.00, 'Beer',     'drink', 1),
  ('Heineken',          '330ml bottle',                              4.00, 'Beer',     'drink', 2),
  ('Local Draft Beer',  'Fresh draft, 400ml',                        3.50, 'Beer',     'drink', 3),
  ('Mojito',            'Rum, lime, mint, soda',                     8.00, 'Cocktails','drink', 4),
  ('Aperol Spritz',     'Aperol, prosecco, orange',                  8.00, 'Cocktails','drink', 5),
  ('Pina Colada',       'Rum, coconut cream, pineapple',             8.50, 'Cocktails','drink', 6),
  ('Sex on the Beach',  'Vodka, peach schnapps, OJ, cranberry',      8.00, 'Cocktails','drink', 7),
  ('Lemonade',          'Fresh squeezed, with mint',                 4.00, 'Soft Drinks','drink', 8),
  ('Coca-Cola',         '330ml can',                                 3.00, 'Soft Drinks','drink', 9),
  ('Water',             'Still or sparkling, 500ml',                 2.00, 'Soft Drinks','drink', 10),
  ('Orange Juice',      'Fresh squeezed',                            4.50, 'Soft Drinks','drink', 11),
  ('Coffee',            'Espresso, cappuccino or americano',          3.00, 'Hot Drinks','drink', 12);
