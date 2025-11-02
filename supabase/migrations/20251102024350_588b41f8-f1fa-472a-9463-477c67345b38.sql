-- Poistetaan vanhat tuotteet
DELETE FROM products WHERE product_id IN ('prod_normal_wash', 'prod_shoes', 'prod_carpet', 'prod_sheets');

-- Poistetaan vanhat kategoriat
DELETE FROM categories WHERE category_id IN ('cat_clothes', 'cat_special');

-- Lisätään uudet kategoriat
INSERT INTO categories (category_id, name, description, sort_order) VALUES
('cat_arjen_pyykit', 'Arjen pyykit', 'Tavalliset käyttövaatteet ja päivittäinen pesu', 1),
('cat_kodintekstiilit', 'Kodintekstiilit', 'Lakanat, peitot ja muut kodintekstiilit', 2),
('cat_mattopesu', 'Mattopesu', 'Mattojen pesu ja huolto', 3),
('cat_erikoispesut', 'Kengät & Erikoispesut', 'Erikoishuomiota vaativat tuotteet', 4);

-- Lisätään tuotteet: 1. Arjen pyykit
INSERT INTO products (product_id, category_id, name, description, base_price, pricing_model, is_active) VALUES
('prod_pesuni_kassi_9kg', 'cat_arjen_pyykit', 'Pesuni-Kassi (9 kg)', 'Arjen pyykit pesulaan - 9 kg vaatteita pestyinä ja taitettuna', 35.90, 'FIXED', true),
('prod_pesuni_kassi_14kg', 'cat_arjen_pyykit', 'Pesuni-Kassi ISO (14 kg)', 'Arjen pyykit pesulaan - 14 kg vaatteita pestyinä ja taitettuna', 49.90, 'FIXED', true),
('prod_paitapalvelu', 'cat_arjen_pyykit', 'Paitapalvelu (5 kpl)', '5 paitaa pestynä ja viikattuna', 29.90, 'FIXED', true),
('prod_untuvatakki', 'cat_arjen_pyykit', 'Untuvatakki', 'Untuvatakki erikoispestynä', 24.90, 'FIXED', true),

-- Lisätään tuotteet: 2. Kodintekstiilit
('prod_petauspatjan_paallinen', 'cat_kodintekstiilit', 'Petauspatjan päällinen (1 kpl)', 'Petauspatjan päällinen pestynä', 19.90, 'FIXED', true),
('prod_takki', 'cat_kodintekstiilit', 'Täkki (1 kpl)', 'Täkki pestynä ja tuuletettu', 24.90, 'FIXED', true),
('prod_tyyny', 'cat_kodintekstiilit', 'Tyyny (1 kpl)', 'Tyyny pestynä', 9.90, 'FIXED', true),
('prod_lakanasetti_1h', 'cat_kodintekstiilit', 'Lakanasetti (1 hengen)', 'Yhden hengen lakanasetti pestynä', 19.90, 'FIXED', true),
('prod_lakanasetti_2h', 'cat_kodintekstiilit', 'Lakanasetti (2 hengen)', 'Kahden hengen lakanasetti pestynä', 24.90, 'FIXED', true),
('prod_sohvanpaalliset', 'cat_kodintekstiilit', 'Sohvanpäälliset', 'Sohvanpäälliset pestynä (hinta koon mukaan)', 39.90, 'FIXED', true),

-- Lisätään tuotteet: 3. Mattopesu
('prod_mattopesu_m2', 'cat_mattopesu', 'Mattopesu (per m²)', 'Maton pesu - hinta lasketaan neliömetrien mukaan', 19.90, 'PER_M2', true),
('prod_kaytavamatto', 'cat_mattopesu', 'Käytävämatto', 'Käytävämaton pesu (kiinteä hinta)', 24.90, 'FIXED', true),

-- Lisätään tuotteet: 4. Kengät & Erikoispesut
('prod_kenkapesu_tennarit', 'cat_erikoispesut', 'Kenkäpesu - Tennarit (1 pari)', 'Tennarit pestynä ja puhdistettuna', 19.90, 'FIXED', true),
('prod_kenkapesu_saappaat', 'cat_erikoispesut', 'Kenkäpesu - Saappaat (1 pari)', 'Saappaat pestynä ja puhdistettuna', 24.90, 'FIXED', true),
('prod_lastenvaunut', 'cat_erikoispesut', 'Lastenvaunut (tekstiiliosat)', 'Lastenvaunujen tekstiiliosat pestynä', 34.90, 'FIXED', true),
('prod_laukku_reppu', 'cat_erikoispesut', 'Laukku / Reppu (1 kpl)', 'Laukku tai reppu pestynä ja puhdistettuna', 19.90, 'FIXED', true);