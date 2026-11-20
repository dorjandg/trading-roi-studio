-- GLAM Catalog Manager — Cloudflare D1 (GLAM_DB)
-- Run after creating a dedicated GLAM database and binding it to Pages.
CREATE TABLE IF NOT EXISTS glam_categories (
 id TEXT PRIMARY KEY, parent_id TEXT REFERENCES glam_categories(id),
 name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 cover_key TEXT, visible INTEGER NOT NULL DEFAULT 0,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS glam_brands (
 id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE,
 description TEXT NOT NULL DEFAULT '', product_types TEXT NOT NULL DEFAULT '',
 website TEXT NOT NULL DEFAULT '', image_key TEXT,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS glam_products (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, brand_id TEXT REFERENCES glam_brands(id),
 category_id TEXT REFERENCES glam_categories(id),
 sku TEXT, price_eur REAL NOT NULL DEFAULT 0,
 compare_price_eur REAL, description TEXT NOT NULL DEFAULT '',
 sizes_json TEXT NOT NULL DEFAULT '[]', colors_json TEXT NOT NULL DEFAULT '[]',
 materials TEXT NOT NULL DEFAULT '', care TEXT NOT NULL DEFAULT '',
 availability TEXT NOT NULL DEFAULT 'unconfirmed',
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','published')),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS glam_product_images (
 id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES glam_products(id) ON DELETE CASCADE,
 object_key TEXT NOT NULL, alt_text TEXT NOT NULL DEFAULT '',
 sort_order INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS glam_products_category ON glam_products(category_id,status);
CREATE INDEX IF NOT EXISTS glam_products_brand ON glam_products(brand_id,status);
CREATE INDEX IF NOT EXISTS glam_images_product ON glam_product_images(product_id,sort_order);
-- Public AI catalog snapshot used by /api/glam-catalog after authenticated publication.
CREATE TABLE IF NOT EXISTS glam_catalog (
 id TEXT PRIMARY KEY, payload TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
