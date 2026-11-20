-- GLAM catalog foundation for Cloudflare D1 (not yet applied).
-- Categories are employee-managed and can be nested.
CREATE TABLE IF NOT EXISTS categories (
 id TEXT PRIMARY KEY,
 parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
 slug TEXT NOT NULL UNIQUE,
 name_en TEXT NOT NULL,
 name_sq TEXT,
 name_it TEXT,
 description_en TEXT,
 description_sq TEXT,
 description_it TEXT,
 cover_image_key TEXT,
 sort_order INTEGER NOT NULL DEFAULT 0,
 is_visible INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_glam_categories_parent ON categories(parent_id,sort_order);
CREATE TABLE IF NOT EXISTS catalog_products (
 id TEXT PRIMARY KEY,
 slug TEXT NOT NULL UNIQUE,
 category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
 name_en TEXT NOT NULL,
 name_sq TEXT,
 name_it TEXT,
 description_en TEXT,
 description_sq TEXT,
 description_it TEXT,
 price_cents INTEGER NOT NULL DEFAULT 0 CHECK(price_cents>=0),
 currency TEXT NOT NULL DEFAULT 'EUR',
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
 sort_order INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS product_images (
 id TEXT PRIMARY KEY,
 product_id TEXT NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
 image_key TEXT NOT NULL,
 alt_text TEXT,
 sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS product_variants (
 id TEXT PRIMARY KEY,
 product_id TEXT NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
 sku TEXT UNIQUE,
 size TEXT,
 color TEXT,
 stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK(stock_quantity>=0),
 price_override_cents INTEGER CHECK(price_override_cents>=0),
 is_active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS catalog_orders (
 id TEXT PRIMARY KEY,
 order_number TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','awaiting_confirmation','confirmed','cancelled','completed')),
 currency TEXT NOT NULL DEFAULT 'EUR',
 subtotal_cents INTEGER NOT NULL DEFAULT 0,
 customer_name TEXT,
 customer_phone TEXT,
 customer_notes TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS catalog_order_items (
 id TEXT PRIMARY KEY,
 order_id TEXT NOT NULL REFERENCES catalog_orders(id) ON DELETE CASCADE,
 product_id TEXT REFERENCES catalog_products(id) ON DELETE SET NULL,
 variant_id TEXT REFERENCES product_variants(id) ON DELETE SET NULL,
 product_name_snapshot TEXT NOT NULL,
 variant_snapshot TEXT,
 quantity INTEGER NOT NULL CHECK(quantity>0),
 unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents>=0)
);
