-- Insert initial categories
INSERT INTO public.categories (category_id, name, description, sort_order) VALUES 
('cat_clothes', 'Arjen Vaatteet', 'Päivittäiset vaatteet pesulaan', 1),
('cat_special', 'Erikoispesu', 'Kengät, lakanat ja matot', 2);

-- Insert initial products
INSERT INTO public.products (product_id, category_id, name, description, base_price, pricing_model) VALUES
('prod_normal_wash', 'cat_clothes', '👕 Peruspyykki', 'Arjen vaatteet puhtaaksi ja raikkaaksi. T-paidat, housut, sukat ja muut. Pesemme hellävaraisesti 40 °C asteessa, aina hajusteettomilla pesuaineilla. (5 kg)', 25.90, 'FIXED'),
('prod_shoes', 'cat_special', '👟 Kenkäpesu', 'Lenkkarit tai tennarit puhdistetaan hellästi ja huolellisesti. Pesu tehdään käsin tai koneessa pesupussissa, 30 °C asteessa ja hajusteettomasti. (per pari)', 20.00, 'FIXED'),
('prod_sheets', 'cat_special', '🛏️ Lakanapesu', 'Pehmeät lakanat ja pussilakanat puhtaiksi. Paremmat unet odottavat. Käytämme 60 °C pesua ja hajusteettomia aineita hygienian takaamiseksi. (per setti)', 25.90, 'FIXED'),
('prod_carpet', 'cat_special', '🧼 Mattopesu', 'Pienet matot saavat uuden elämän. Värit kirkastuvat ja pöly katoaa. Matot pestään yksittäin, 30 °C lämpötilassa, ilman hajusteita. Hinta lasketaan neliömetrien mukaan.', 19.90, 'PER_M2');