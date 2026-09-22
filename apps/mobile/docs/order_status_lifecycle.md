# 🔄 Pesuni: Tilausten Elinkaari & Tilasiirtymät (Order Status Lifecycle)

Tämä dokumentti kuvaa Pesuni-järjestelmän täydellisen tilaputken ja logiikan pseudokoodina asiakkaan, kuljettajan, pesulan ja tietokannan näkökulmasta.

---

## 1. 📋 Tilasiirtymäkaavio (Visual Pipeline)

```
[1. Tilaus vastaanotettu]
        │  (Kuljettaja ottaa menokeikan Etsi-sivulta)
        ▼
[2. Kuljettaja löytynyt]
        │  (Kuljettaja painaa: "Aloita nouto")
        ▼
[3. Noutamassa]
        │  (Kuljettaja painaa: "Olen saapunut")
        ▼
[4. Saapunut noutokohteeseen]
        │  (Kuljettaja painaa: "Punnitse & Kuljeta pesulaan")
        ▼
[5. Kuljetetaan pesulaan]
        │  (Kuljettaja luovuttaa pyykit pesulaan: "Luovutettu pesulalle")
        ▼
[6. Pesussa]
        │  (Pesula merkitsee pesun valmistuneeksi)
        ▼
[7. Pesu valmis] (Taustasignaali paluukeikan vapautukselle)
        │  (Kuljettaja ottaa paluukeikan ja painaa: "Aloita palautus")
        ▼
[8. Palautetaan (Kuljetuksessa kotiin)]
        │  (Kuljettaja painaa: "Olen saapunut")
        ▼
[9. Saapunut toimituskohteeseen]
        │  (Kuljettaja luovuttaa puhtaat pyykit: "Kuittaa luovutetuksi")
        ▼
[10. Toimitettu / Valmis]
```

---

## 2. 💻 Pseudokoodi (Tilat ja Siirtymät)

```python
# ==========================================
# 1. ASIAKAS LUO TILAUKSEN (CHECKOUT)
# ==========================================
def on_customer_checkout_completed(order_payload):
    order = create_order(
        status = 'pending',
        tracking_status = 'PENDING',       # Näkyy asiakkaalle: "Tilaus vastaanotettu"
        address = order_payload.address,
        pickup_time = order_payload.pickup_time,
        return_time = order_payload.return_time
    )
    
    # Trigger luo automaattisesti kaksi toimitustehtävää:
    # A) Menotilaus (Noutokeikka)
    pickup_task = create_delivery_task(
        order_id = order.id,
        task_type = 'pickup',
        status = 'unassigned',
        pickup_address = order.address,
        delivery_address = laundry.address
    )
    
    # B) Paluutilaus (Palautuskeikka)
    return_task = create_delivery_task(
        order_id = order.id,
        task_type = 'delivery',
        status = 'unassigned',
        pickup_address = laundry.address,
        delivery_address = order.address
    )
    return order


# ==========================================
# 2. KULJETTAJA OTTAA MENOTILAUKSEN (ETSI-SIVU)
# ==========================================
def on_driver_claim_pickup_gig(driver_id, pickup_task_id):
    update_delivery_task(pickup_task_id, driver_id=driver_id, status='assigned')
    
    # Vain menotilauksen kuljettaja aktivoi tilan:
    update_order(pickup_task.order_id, 
        driver_id = driver_id,
        tracking_status = 'DRIVER_ASSIGNED'  # Näkyy asiakkaalle: "Kuljettaja löytynyt"
    )


# ==========================================
# 3. KULJETTAJA ALOITTAA NOUTOAJON (OMAT AJOT)
# ==========================================
def on_driver_start_pickup(pickup_task_id):
    update_delivery_task(pickup_task_id, status='picking_up', started_at=now())
    update_order(pickup_task.order_id, 
        tracking_status = 'PICKING_UP'       # Näkyy asiakkaalle: "Noutamassa"
    )


# ==========================================
# 4. KULJETTAJA SAAPUU NOUTOKOHTEESEEN
# ==========================================
def on_driver_arrived_at_pickup(pickup_task_id):
    update_delivery_task(pickup_task_id, status='arrived_pickup')
    update_order(pickup_task.order_id, 
        tracking_status = 'ARRIVED_PICKUP'   # Näkyy asiakkaalle: "Kuljettaja saapunut"
    )


# ==========================================
# 5. KULJETTAJA PUNNITSEE & VIE PESULAAN
# ==========================================
def on_driver_complete_pickup_weight(pickup_task_id, weight_kg):
    update_delivery_task(pickup_task_id, 
        status = 'in_transit_to_laundry',
        pickup_weight_kg = weight_kg
    )
    update_order(pickup_task.order_id, 
        pickup_weight_kg = weight_kg,
        tracking_status = 'IN_TRANSIT_TO_LAUNDRY'  # Näkyy asiakkaalle: "Kuljetetaan pesulaan"
    )


# ==========================================
# 6. KULJETTAJA LUOVUTTAA PYYKIT PESULAAN
# ==========================================
def on_driver_delivered_to_laundry(pickup_task_id):
    update_delivery_task(pickup_task_id, status='completed', completed_at=now())
    update_order(pickup_task.order_id, 
        status = 'washing',
        laundry_status = 'washing',
        tracking_status = 'WASHING'          # Näkyy asiakkaalle: "Pyykit pesussa"
    )


# ==========================================
# 7. PESULA MERKITSEE PESUN VALMIIKSI
# ==========================================
def on_laundry_finish_wash(order_id):
    update_order(order_id, 
        laundry_status = 'ready',
        tracking_status = 'WASH_COMPLETED'   # Taustasignaali kuljettajille
    )
    # Vapauttaa palautuskeikan kuljettajien haettavaksi Etsi-sivulle


# ==========================================
# 8. KULJETTAJA ALOITTAA PALAUTUSAJON
# ==========================================
def on_driver_start_delivery(return_task_id):
    update_delivery_task(return_task_id, status='in_progress', started_at=now())
    update_order(return_task.order_id, 
        status = 'returning',
        tracking_status = 'RETURNING'        # Näkyy asiakkaalle: "Pyykit palautuksessa"
    )


# ==========================================
# 9. KULJETTAJA SAAPUU TOIMITUSKOHTEESEEN
# ==========================================
def on_driver_arrived_at_delivery(return_task_id):
    update_delivery_task(return_task_id, status='arrived_delivery')
    update_order(return_task.order_id, 
        tracking_status = 'ARRIVED_DELIVERY' # Näkyy asiakkaalle: "Kuljettaja saapunut"
    )


# ==========================================
# 10. KULJETTAJA LUOVUTTAA PYYKIT ASIAKKAALLE
# ==========================================
def on_driver_complete_delivery(return_task_id):
    update_delivery_task(return_task_id, status='completed', completed_at=now())
    update_order(return_task.order_id, 
        status = 'delivered',
        tracking_status = 'COMPLETED',       # Näkyy asiakkaalle: "Pyykit toimitettu"
        delivered_at = now()
    )
```

---

## 3. 🎯 Asiakasnäkymän Tilatekstien Mäppäys (`OrderStatusCard.tsx`)

| Tila / Vaihe | Otsikko Asiakkaalle | Alateksti Asiakkaalle | Badge / Väri |
| :--- | :--- | :--- | :--- |
| **1. Tilaus luotu** | `Tilaus vastaanotettu` | *Etsitään lähintä vapaata kuljettajaa* | `VASTAANOTETTU` (Sininen `#00C2FF`) |
| **2. Menokeikka otettu** | `Kuljettaja löytynyt` | *Noutoaika sovittu klo 08:00 - 10:00* | `KULJETTAJA VAHVISTETTU` (Vihreä `#10B981`) |
| **3. Ajo noutoon aloitettu** | `Noutamassa` | *Kuljettaja on matkalla noutamaan pyykkejä* | `NOUTAMASSA` (Sininen `#0284C7`) |
| **4. Kuljettaja ovella** | `Kuljettaja saapunut` | *Kuljettaja on nouto-osoitteessa* | `NOUTOPAIKALLA` (Sininen `#0284C7`) |
| **5. Pyykit kyydissä** | `Kuljetetaan pesulaan` | *Pyykit on noudettu ja matkalla pesulaan* | `MATKALLA PESULAAN` (Keltainen `#F59E0B`) |
| **6. Pesulassa** | `Pyykit pesussa` | *Pyykkejänne pestään huolellisesti pesulassa* | `PESULASSA` (Indigo `#6366F1`) |
| **7. Pesu valmis** | *(Pyykit pesussa / Valmistellaan)* | *Pyykit valmistellaan palautuskuljetukseen* | `PESULASSA` (Indigo `#6366F1`) |
| **8. Palautus aloitettu** | `Pyykit palautuksessa` | *Arvioitu toimitus klo 16:00 - 18:00* | `KULJETUKSESSA KOTIIN` (Sininen `#0284C7`) |
| **9. Kuljettaja ovella** | `Kuljettaja saapunut` | *Kuljettaja on saapunut toimitusosoitteeseen* | `SAAPUNUT PERILLE` (Sininen `#0284C7`) |
| **10. Luovutettu perille**| `Pyykit toimitettu` | *Toimitettu onnistuneesti perille* | `VALMIS & TOIMITETTU` (Vihreä `#10B981`) |
