-- ============================================================================
-- Saguaro Materials Catalog — global reference seed
-- ============================================================================
-- Scope    : shared global catalog (tenant_id IS NULL on every row)
-- Tables   : catalog_vendors, catalog_items, catalog_vendor_prices
-- Prices   : Aug 2026 reference prices (source = 'reference', as_of 2026-08-21)
-- Idempotent: safe to run any number of times.
--   * vendors : NOT EXISTS guard + ON CONFLICT (tenant_id, name) DO NOTHING
--   * items   : NOT EXISTS guard on (tenant_id IS NULL, name)
--   * prices  : ON CONFLICT (item_id, vendor_id) DO NOTHING
-- Row conventions (used by verification scripts):
--   vendor rows start with "  (NULL::uuid,"
--   item rows   start with "  ('"
--   price rows  start with "    ('"
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1) VENDORS (16, real national/regional suppliers)
-- ============================================================================

INSERT INTO catalog_vendors (tenant_id, name, kind, verticals, website, is_national)
SELECT v.tenant_id, v.name, v.kind, v.verticals, v.website, v.is_national
FROM (VALUES
  (NULL::uuid, 'The Home Depot', 'big-box', ARRAY['Low Voltage & Networking','Electrical','Plumbing','HVAC','Flooring & Carpet','Drywall','Paint','Framing & Lumber','Concrete','Roofing','Doors & Windows','Insulation']::text[], 'https://www.homedepot.com', true),
  (NULL::uuid, 'Lowe''s', 'big-box', ARRAY['Low Voltage & Networking','Electrical','Plumbing','HVAC','Flooring & Carpet','Drywall','Paint','Framing & Lumber','Concrete','Roofing','Doors & Windows','Insulation']::text[], 'https://www.lowes.com', true),
  (NULL::uuid, 'Ferguson', 'supply-house', ARRAY['Plumbing','HVAC']::text[], 'https://www.ferguson.com', true),
  (NULL::uuid, 'Graybar', 'wholesale', ARRAY['Electrical','Low Voltage & Networking']::text[], 'https://www.graybar.com', true),
  (NULL::uuid, 'Platt Electric', 'supply-house', ARRAY['Electrical','Low Voltage & Networking']::text[], 'https://www.platt.com', false),
  (NULL::uuid, 'CED', 'wholesale', ARRAY['Electrical','Low Voltage & Networking']::text[], 'https://www.ced.com', true),
  (NULL::uuid, 'Wesco/Anixter', 'wholesale', ARRAY['Electrical','Low Voltage & Networking']::text[], 'https://www.wesco.com', true),
  (NULL::uuid, 'ADI Global Distribution', 'wholesale', ARRAY['Low Voltage & Networking']::text[], 'https://www.adiglobaldistribution.us', true),
  (NULL::uuid, 'Ubiquiti Store', 'specialty', ARRAY['Low Voltage & Networking']::text[], 'https://store.ui.com', true),
  (NULL::uuid, 'Floor & Decor', 'specialty', ARRAY['Flooring & Carpet']::text[], 'https://www.flooranddecor.com', true),
  (NULL::uuid, 'Daltile', 'specialty', ARRAY['Flooring & Carpet']::text[], 'https://www.daltile.com', true),
  (NULL::uuid, 'ABC Supply', 'wholesale', ARRAY['Roofing','Doors & Windows']::text[], 'https://www.abcsupply.com', true),
  (NULL::uuid, 'White Cap', 'wholesale', ARRAY['Concrete','Framing & Lumber']::text[], 'https://www.whitecap.com', true),
  (NULL::uuid, 'Fastenal', 'wholesale', ARRAY['Framing & Lumber','Concrete']::text[], 'https://www.fastenal.com', true),
  (NULL::uuid, 'Grainger', 'wholesale', ARRAY['Electrical','Plumbing','HVAC','Paint']::text[], 'https://www.grainger.com', true),
  (NULL::uuid, '84 Lumber', 'supply-house', ARRAY['Framing & Lumber','Doors & Windows','Roofing','Drywall','Insulation']::text[], 'https://www.84lumber.com', true)
) AS v(tenant_id, name, kind, verticals, website, is_national)
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_vendors cv
  WHERE cv.name = v.name
    AND cv.tenant_id IS NOT DISTINCT FROM v.tenant_id
)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- ============================================================================
-- 2) ITEMS — 'Low Voltage & Networking' (61 items)
-- ============================================================================

INSERT INTO catalog_items (tenant_id, vertical, category, name, description, unit, sku_hint)
SELECT NULL::uuid, x.vertical, x.category, x.name, x.description, x.unit, x.sku_hint
FROM (VALUES
  ('Low Voltage & Networking','Copper Cabling','Cat6 UTP Riser (CMR) 1000 ft Box - Blue','23 AWG UTP riser-rated pull box','box','CAT6-CMR-1000-BL'),
  ('Low Voltage & Networking','Copper Cabling','Cat6 UTP Riser (CMR) 1000 ft Box - White','23 AWG UTP riser-rated pull box','box','CAT6-CMR-1000-WH'),
  ('Low Voltage & Networking','Copper Cabling','Cat6 UTP Plenum (CMP) 1000 ft Box - Blue','23 AWG UTP plenum-rated pull box','box','CAT6-CMP-1000-BL'),
  ('Low Voltage & Networking','Copper Cabling','Cat6 UTP Plenum (CMP) 1000 ft Box - White','23 AWG UTP plenum-rated pull box','box','CAT6-CMP-1000-WH'),
  ('Low Voltage & Networking','Copper Cabling','Cat6A UTP Riser 1000 ft Box - Blue','10G-capable Cat6A riser pull box','box','CAT6A-CMR-1000-BL'),
  ('Low Voltage & Networking','Copper Cabling','Cat6A UTP Plenum 1000 ft Box - White','10G-capable Cat6A plenum pull box','box','CAT6A-CMP-1000-WH'),
  ('Low Voltage & Networking','Copper Cabling','Cat6 Outdoor Gel-Filled Direct Burial 1000 ft','UV-rated flooded-core outdoor Cat6','box','CAT6-OSP-1000'),
  ('Low Voltage & Networking','Copper Cabling','Cat6 Snagless Patch Cable 3 ft - 10-Pack','Booted stranded patch cords','pack','CAT6-PC-3FT-10PK'),
  ('Low Voltage & Networking','Copper Cabling','Cat6 Snagless Patch Cable 7 ft - 10-Pack','Booted stranded patch cords','pack','CAT6-PC-7FT-10PK'),
  ('Low Voltage & Networking','Copper Cabling','Cat6 Snagless Patch Cable 25 ft','Booted stranded patch cord','each','CAT6-PC-25FT'),
  ('Low Voltage & Networking','Connectors & Termination','RJ45 Cat6 Modular Plugs - 100-Pack','Solid/stranded 8P8C plugs','pack','RJ45-C6-100'),
  ('Low Voltage & Networking','Connectors & Termination','RJ45 Cat6 Pass-Through Plugs - 100-Pack','EZ-style pass-through plugs','pack','RJ45-C6-PT-100'),
  ('Low Voltage & Networking','Connectors & Termination','RJ45 Cat6A Shielded Plugs - 50-Pack','STP field-terminated plugs','pack','RJ45-C6A-STP-50'),
  ('Low Voltage & Networking','Connectors & Termination','Cat6 Keystone Jack White - 25-Pack','110 punchdown keystone jacks','pack','KJ-C6-WH-25'),
  ('Low Voltage & Networking','Connectors & Termination','Cat6A Keystone Jack White - 10-Pack','10G keystone jacks','pack','KJ-C6A-WH-10'),
  ('Low Voltage & Networking','Connectors & Termination','2-Port Keystone Wall Plate White - 10-Pack','Single-gang decorator plates','pack','WP-2P-WH-10'),
  ('Low Voltage & Networking','Connectors & Termination','Blank Keystone Insert White - 20-Pack','Snap-in blanks','pack','KJ-BLANK-20'),
  ('Low Voltage & Networking','Connectors & Termination','110 Punchdown Tool with Blade','Impact punchdown tool','each','TOOL-110-PD'),
  ('Low Voltage & Networking','Patch Panels & Racks','24-Port Cat6 Loaded Patch Panel 1U','Pre-loaded 110 rear terminations','each','PP-C6-24-1U'),
  ('Low Voltage & Networking','Patch Panels & Racks','48-Port Cat6 Loaded Patch Panel 2U','Pre-loaded 110 rear terminations','each','PP-C6-48-2U'),
  ('Low Voltage & Networking','Patch Panels & Racks','24-Port Blank Keystone Patch Panel 1U','Unloaded keystone panel','each','PP-KS-24-1U'),
  ('Low Voltage & Networking','Patch Panels & Racks','1U Horizontal Cable Manager','Finger-duct manager with cover','each','CM-1U-HORIZ'),
  ('Low Voltage & Networking','Patch Panels & Racks','10 in SOHO Network Rack 4U','Compact 10 in wall rack','each','RACK-10IN-4U'),
  ('Low Voltage & Networking','Patch Panels & Racks','12U Wall-Mount Network Cabinet Glass Door','Lockable wall cabinet 24 in deep','each','CAB-12U-WM'),
  ('Low Voltage & Networking','Patch Panels & Racks','42U 4-Post Open Frame Rack','Adjustable-depth open frame','each','RACK-42U-4P'),
  ('Low Voltage & Networking','Patch Panels & Racks','42U Enclosed Server Cabinet Mesh Doors','Lockable enclosure with fans','each','CAB-42U-MESH'),
  ('Low Voltage & Networking','Patch Panels & Racks','1U Vented Rack Shelf','Cantilever vented shelf','each','SHELF-1U-VENT'),
  ('Low Voltage & Networking','Patch Panels & Racks','M6 Cage Nut and Screw Kit - 50-Pack','Rack hardware kit','pack','HW-M6-50'),
  ('Low Voltage & Networking','Ubiquiti UniFi','Ubiquiti UniFi U7 Pro Access Point','Wi-Fi 7 ceiling AP PoE+','each','U7-Pro'),
  ('Low Voltage & Networking','Ubiquiti UniFi','Ubiquiti UniFi U7 Pro Max Access Point','Wi-Fi 7 high-capacity AP','each','U7-Pro-Max'),
  ('Low Voltage & Networking','Ubiquiti UniFi','Ubiquiti UniFi G5 Bullet Camera','2K outdoor PoE bullet','each','UVC-G5-Bullet'),
  ('Low Voltage & Networking','Ubiquiti UniFi','Ubiquiti UniFi G5 Turret Ultra Camera','2K compact outdoor turret','each','UVC-G5-Turret-Ultra'),
  ('Low Voltage & Networking','Ubiquiti UniFi','Ubiquiti UniFi G5 Pro Camera','4K low-light PoE camera','each','UVC-G5-Pro'),
  ('Low Voltage & Networking','Ubiquiti UniFi','Ubiquiti UniFi G4 Doorbell Pro','PoE video doorbell with package cam','each','UVC-G4-Doorbell-Pro'),
  ('Low Voltage & Networking','Ubiquiti UniFi','Ubiquiti UniFi AI Pro Camera','4K AI detection camera','each','UVC-AI-Pro'),
  ('Low Voltage & Networking','Ubiquiti UniFi','Ubiquiti UniFi NVR Pro','8-bay network video recorder','each','UNVR-Pro'),
  ('Low Voltage & Networking','Ubiquiti UniFi','Ubiquiti Dream Machine Pro Max','Gateway console dual 10G','each','UDM-Pro-Max'),
  ('Low Voltage & Networking','Ubiquiti UniFi','Ubiquiti Pro Max 24 PoE Switch','24-port PoE++ L3 switch','each','USW-Pro-Max-24-PoE'),
  ('Low Voltage & Networking','Ubiquiti UniFi','Ubiquiti Access Hub','Door controller PoE','each','UA-Hub'),
  ('Low Voltage & Networking','Ubiquiti UniFi','Ubiquiti Access Reader Pro','Touchscreen NFC access reader','each','UA-Pro'),
  ('Low Voltage & Networking','Access Control','Magnetic Lock 600 lb Single Door','Surface-mount maglock 12/24V','each','ML-600'),
  ('Low Voltage & Networking','Access Control','Magnetic Lock 1200 lb Single Door','Surface-mount maglock 12/24V','each','ML-1200'),
  ('Low Voltage & Networking','Access Control','Electric Door Strike Fail-Secure 12/24V','ANSI cutout electric strike','each','ES-FS-1224'),
  ('Low Voltage & Networking','Access Control','Request-to-Exit PIR Sensor','REX motion sensor with timer','each','REX-PIR'),
  ('Low Voltage & Networking','Access Control','Push-to-Exit Button Stainless','Illuminated exit button','each','PTE-SS'),
  ('Low Voltage & Networking','Access Control','Standalone Keypad Entry 12V Weatherproof','Push-button code entry keypad','each','KP-12V-WP'),
  ('Low Voltage & Networking','Access Control','Access Control Power Supply 12VDC 5A','Supervised PSU with battery space','each','PSU-12V-5A'),
  ('Low Voltage & Networking','Access Control','Door Position Contact Recessed - 10-Pack','3/4 in recessed contacts','pack','DPS-REC-10'),
  ('Low Voltage & Networking','Fiber Optics','Single-Mode Duplex LC-LC Patch Cable 3 m','OS2 duplex patch cord','each','SM-LCLC-3M'),
  ('Low Voltage & Networking','Fiber Optics','Single-Mode Duplex LC-LC Patch Cable 10 m','OS2 duplex patch cord','each','SM-LCLC-10M'),
  ('Low Voltage & Networking','Fiber Optics','12-Strand Single-Mode Outdoor Armored Fiber','OS2 armored OSP cable per foot','ft','SM-12-OSP-ARM'),
  ('Low Voltage & Networking','Fiber Optics','Gigabit Single-Mode Media Converter LC 20 km','10/100/1000 to SM fiber','each','MC-GE-SM20'),
  ('Low Voltage & Networking','Fiber Optics','10G SFP+ Single-Mode Transceiver LC 10 km','SFP+ LR module','each','SFP-10G-LR'),
  ('Low Voltage & Networking','Fiber Optics','GPON ONT Single Port','Optical network terminal','each','ONT-GPON-1'),
  ('Low Voltage & Networking','Fiber Optics','24-Port LC Fiber Patch Panel Loaded 1U','Loaded LC duplex adapter panel','each','FPP-LC-24-1U'),
  ('Low Voltage & Networking','A/V & Coax','Speaker Wire 16/2 CL3 500 ft','In-wall rated OFC spool','spool','SPK-162-500'),
  ('Low Voltage & Networking','A/V & Coax','Speaker Wire 16/4 CL3 500 ft','In-wall rated OFC spool','spool','SPK-164-500'),
  ('Low Voltage & Networking','A/V & Coax','Security Alarm Wire 18/2 CL3 500 ft','Stranded alarm cable','spool','ALM-182-500'),
  ('Low Voltage & Networking','A/V & Coax','RG6 Quad-Shield Coax 1000 ft','Sweep-tested CATV coax','spool','RG6-QS-1000'),
  ('Low Voltage & Networking','Enclosures','Structured Media Enclosure 14 in','Flush-mount media panel','each','SME-14'),
  ('Low Voltage & Networking','Enclosures','Structured Media Enclosure 28 in','Flush-mount media panel','each','SME-28')
) AS x(vertical, category, name, description, unit, sku_hint)
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_items ci
  WHERE ci.tenant_id IS NULL AND ci.name = x.name
);

-- ============================================================================
-- 3) PRICES — 'Low Voltage & Networking'
--    Wholesale (ADI/Wesco/Graybar/Platt/CED) undercuts big-box on bulk cable;
--    UniFi gear at/near MSRP via Ubiquiti Store, street price via distribution.
-- ============================================================================

INSERT INTO catalog_vendor_prices (item_id, vendor_id, price, unit, qty_in_stock, stock_status, lead_time_days, source, as_of)
SELECT i.id, v.id, p.price, i.unit, p.qty_in_stock, p.stock_status, p.lead_time_days, 'reference', DATE '2026-08-21'
FROM (VALUES
    ('Cat6 UTP Riser (CMR) 1000 ft Box - Blue', 'The Home Depot', 189.00::numeric, 24::int, 'in_stock'::text, 0::int),
    ('Cat6 UTP Riser (CMR) 1000 ft Box - Blue', 'Lowe''s', 185.00, 18, 'in_stock', 0),
    ('Cat6 UTP Riser (CMR) 1000 ft Box - Blue', 'Graybar', 164.50, 120, 'in_stock', 1),
    ('Cat6 UTP Riser (CMR) 1000 ft Box - Blue', 'ADI Global Distribution', 158.90, 200, 'in_stock', 1),
    ('Cat6 UTP Riser (CMR) 1000 ft Box - White', 'The Home Depot', 189.00, 16, 'in_stock', 0),
    ('Cat6 UTP Riser (CMR) 1000 ft Box - White', 'CED', 162.75, 85, 'in_stock', 1),
    ('Cat6 UTP Riser (CMR) 1000 ft Box - White', 'ADI Global Distribution', 158.90, 140, 'in_stock', 1),
    ('Cat6 UTP Plenum (CMP) 1000 ft Box - Blue', 'The Home Depot', 329.00, 8, 'in_stock', 0),
    ('Cat6 UTP Plenum (CMP) 1000 ft Box - Blue', 'Graybar', 289.40, 60, 'in_stock', 1),
    ('Cat6 UTP Plenum (CMP) 1000 ft Box - Blue', 'ADI Global Distribution', 275.50, 90, 'in_stock', 1),
    ('Cat6 UTP Plenum (CMP) 1000 ft Box - Blue', 'Wesco/Anixter', 292.80, NULL, 'unknown', 2),
    ('Cat6 UTP Plenum (CMP) 1000 ft Box - White', 'Lowe''s', 335.00, 6, 'limited', 0),
    ('Cat6 UTP Plenum (CMP) 1000 ft Box - White', 'Platt Electric', 288.60, 40, 'in_stock', 1),
    ('Cat6 UTP Plenum (CMP) 1000 ft Box - White', 'ADI Global Distribution', 275.50, 75, 'in_stock', 1),
    ('Cat6A UTP Riser 1000 ft Box - Blue', 'The Home Depot', 415.00, 5, 'limited', 0),
    ('Cat6A UTP Riser 1000 ft Box - Blue', 'Graybar', 372.90, 35, 'in_stock', 1),
    ('Cat6A UTP Riser 1000 ft Box - Blue', 'ADI Global Distribution', 359.00, 50, 'in_stock', 1),
    ('Cat6A UTP Plenum 1000 ft Box - White', 'Wesco/Anixter', 538.50, NULL, 'order', 5),
    ('Cat6A UTP Plenum 1000 ft Box - White', 'ADI Global Distribution', 515.00, 30, 'in_stock', 1),
    ('Cat6A UTP Plenum 1000 ft Box - White', 'Graybar', 549.90, 22, 'in_stock', 2),
    ('Cat6 Outdoor Gel-Filled Direct Burial 1000 ft', 'ADI Global Distribution', 298.50, 45, 'in_stock', 1),
    ('Cat6 Outdoor Gel-Filled Direct Burial 1000 ft', 'CED', 315.90, 20, 'in_stock', 2),
    ('Cat6 Outdoor Gel-Filled Direct Burial 1000 ft', 'The Home Depot', 345.00, NULL, 'order', 7),
    ('Cat6 Snagless Patch Cable 3 ft - 10-Pack', 'The Home Depot', 24.97, 60, 'in_stock', 0),
    ('Cat6 Snagless Patch Cable 3 ft - 10-Pack', 'Lowe''s', 26.48, 45, 'in_stock', 0),
    ('Cat6 Snagless Patch Cable 3 ft - 10-Pack', 'ADI Global Distribution', 19.50, 300, 'in_stock', 1),
    ('Cat6 Snagless Patch Cable 7 ft - 10-Pack', 'The Home Depot', 32.97, 55, 'in_stock', 0),
    ('Cat6 Snagless Patch Cable 7 ft - 10-Pack', 'ADI Global Distribution', 27.90, 250, 'in_stock', 1),
    ('Cat6 Snagless Patch Cable 7 ft - 10-Pack', 'Graybar', 31.40, 90, 'in_stock', 1),
    ('Cat6 Snagless Patch Cable 25 ft', 'The Home Depot', 12.98, 80, 'in_stock', 0),
    ('Cat6 Snagless Patch Cable 25 ft', 'Lowe''s', 13.48, 65, 'in_stock', 0),
    ('Cat6 Snagless Patch Cable 25 ft', 'ADI Global Distribution', 9.75, 400, 'in_stock', 1),
    ('RJ45 Cat6 Modular Plugs - 100-Pack', 'The Home Depot', 21.97, 40, 'in_stock', 0),
    ('RJ45 Cat6 Modular Plugs - 100-Pack', 'ADI Global Distribution', 16.50, 500, 'in_stock', 1),
    ('RJ45 Cat6 Modular Plugs - 100-Pack', 'Platt Electric', 18.40, 120, 'in_stock', 1),
    ('RJ45 Cat6 Pass-Through Plugs - 100-Pack', 'The Home Depot', 27.98, 35, 'in_stock', 0),
    ('RJ45 Cat6 Pass-Through Plugs - 100-Pack', 'Lowe''s', 28.48, 30, 'in_stock', 0),
    ('RJ45 Cat6 Pass-Through Plugs - 100-Pack', 'ADI Global Distribution', 22.90, 350, 'in_stock', 1),
    ('RJ45 Cat6A Shielded Plugs - 50-Pack', 'ADI Global Distribution', 34.50, 90, 'in_stock', 1),
    ('RJ45 Cat6A Shielded Plugs - 50-Pack', 'Wesco/Anixter', 38.90, NULL, 'unknown', 2),
    ('RJ45 Cat6A Shielded Plugs - 50-Pack', 'Graybar', 37.75, 60, 'in_stock', 1),
    ('Cat6 Keystone Jack White - 25-Pack', 'The Home Depot', 62.25, 25, 'in_stock', 0),
    ('Cat6 Keystone Jack White - 25-Pack', 'ADI Global Distribution', 48.75, 200, 'in_stock', 1),
    ('Cat6 Keystone Jack White - 25-Pack', 'CED', 52.50, 80, 'in_stock', 1),
    ('Cat6A Keystone Jack White - 10-Pack', 'ADI Global Distribution', 42.90, 150, 'in_stock', 1),
    ('Cat6A Keystone Jack White - 10-Pack', 'Graybar', 46.80, 55, 'in_stock', 1),
    ('Cat6A Keystone Jack White - 10-Pack', 'The Home Depot', 54.97, 12, 'in_stock', 0),
    ('2-Port Keystone Wall Plate White - 10-Pack', 'The Home Depot', 11.97, 70, 'in_stock', 0),
    ('2-Port Keystone Wall Plate White - 10-Pack', 'ADI Global Distribution', 8.90, 400, 'in_stock', 1),
    ('2-Port Keystone Wall Plate White - 10-Pack', 'Platt Electric', 9.95, 90, 'in_stock', 1),
    ('Blank Keystone Insert White - 20-Pack', 'ADI Global Distribution', 6.50, 300, 'in_stock', 1),
    ('Blank Keystone Insert White - 20-Pack', 'The Home Depot', 8.97, 45, 'in_stock', 0),
    ('110 Punchdown Tool with Blade', 'The Home Depot', 24.98, 30, 'in_stock', 0),
    ('110 Punchdown Tool with Blade', 'ADI Global Distribution', 19.95, 110, 'in_stock', 1),
    ('110 Punchdown Tool with Blade', 'Graybar', 23.40, 40, 'in_stock', 1),
    ('24-Port Cat6 Loaded Patch Panel 1U', 'The Home Depot', 89.97, 12, 'in_stock', 0),
    ('24-Port Cat6 Loaded Patch Panel 1U', 'ADI Global Distribution', 68.50, 85, 'in_stock', 1),
    ('24-Port Cat6 Loaded Patch Panel 1U', 'Wesco/Anixter', 74.90, 40, 'in_stock', 1),
    ('48-Port Cat6 Loaded Patch Panel 2U', 'ADI Global Distribution', 129.00, 40, 'in_stock', 1),
    ('48-Port Cat6 Loaded Patch Panel 2U', 'Graybar', 142.50, 18, 'in_stock', 1),
    ('48-Port Cat6 Loaded Patch Panel 2U', 'The Home Depot', 159.97, 6, 'limited', 0),
    ('24-Port Blank Keystone Patch Panel 1U', 'ADI Global Distribution', 21.90, 120, 'in_stock', 1),
    ('24-Port Blank Keystone Patch Panel 1U', 'Platt Electric', 24.75, 45, 'in_stock', 1),
    ('24-Port Blank Keystone Patch Panel 1U', 'The Home Depot', 29.98, 20, 'in_stock', 0),
    ('1U Horizontal Cable Manager', 'ADI Global Distribution', 14.50, 200, 'in_stock', 1),
    ('1U Horizontal Cable Manager', 'CED', 16.20, 60, 'in_stock', 1),
    ('1U Horizontal Cable Manager', 'The Home Depot', 19.97, 25, 'in_stock', 0),
    ('10 in SOHO Network Rack 4U', 'ADI Global Distribution', 42.50, 35, 'in_stock', 1),
    ('10 in SOHO Network Rack 4U', 'The Home Depot', 49.98, NULL, 'order', 5),
    ('12U Wall-Mount Network Cabinet Glass Door', 'ADI Global Distribution', 189.00, 20, 'in_stock', 1),
    ('12U Wall-Mount Network Cabinet Glass Door', 'Wesco/Anixter', 205.50, 8, 'in_stock', 2),
    ('12U Wall-Mount Network Cabinet Glass Door', 'The Home Depot', 229.00, NULL, 'order', 7),
    ('42U 4-Post Open Frame Rack', 'ADI Global Distribution', 329.00, 12, 'in_stock', 2),
    ('42U 4-Post Open Frame Rack', 'Graybar', 365.90, 6, 'in_stock', 2),
    ('42U 4-Post Open Frame Rack', 'Wesco/Anixter', 349.50, NULL, 'order', 5),
    ('42U Enclosed Server Cabinet Mesh Doors', 'ADI Global Distribution', 899.00, 4, 'limited', 3),
    ('42U Enclosed Server Cabinet Mesh Doors', 'Graybar', 985.00, NULL, 'order', 7),
    ('42U Enclosed Server Cabinet Mesh Doors', 'Wesco/Anixter', 949.00, 3, 'limited', 3),
    ('1U Vented Rack Shelf', 'ADI Global Distribution', 24.90, 90, 'in_stock', 1),
    ('1U Vented Rack Shelf', 'The Home Depot', 32.98, 15, 'in_stock', 0),
    ('M6 Cage Nut and Screw Kit - 50-Pack', 'ADI Global Distribution', 12.50, 250, 'in_stock', 1),
    ('M6 Cage Nut and Screw Kit - 50-Pack', 'The Home Depot', 16.97, 40, 'in_stock', 0),
    ('M6 Cage Nut and Screw Kit - 50-Pack', 'Platt Electric', 13.80, 75, 'in_stock', 1),
    ('Ubiquiti UniFi U7 Pro Access Point', 'Ubiquiti Store', 189.00, NULL, 'in_stock', 2),
    ('Ubiquiti UniFi U7 Pro Access Point', 'ADI Global Distribution', 189.00, 60, 'in_stock', 1),
    ('Ubiquiti UniFi U7 Pro Access Point', 'Wesco/Anixter', 199.00, 25, 'in_stock', 2),
    ('Ubiquiti UniFi U7 Pro Max Access Point', 'Ubiquiti Store', 279.00, NULL, 'in_stock', 2),
    ('Ubiquiti UniFi U7 Pro Max Access Point', 'ADI Global Distribution', 279.00, 40, 'in_stock', 1),
    ('Ubiquiti UniFi U7 Pro Max Access Point', 'Graybar', 295.00, NULL, 'order', 5),
    ('Ubiquiti UniFi G5 Bullet Camera', 'Ubiquiti Store', 129.00, NULL, 'in_stock', 2),
    ('Ubiquiti UniFi G5 Bullet Camera', 'ADI Global Distribution', 125.50, 120, 'in_stock', 1),
    ('Ubiquiti UniFi G5 Bullet Camera', 'Wesco/Anixter', 135.00, 30, 'in_stock', 2),
    ('Ubiquiti UniFi G5 Turret Ultra Camera', 'Ubiquiti Store', 129.00, NULL, 'limited', 7),
    ('Ubiquiti UniFi G5 Turret Ultra Camera', 'ADI Global Distribution', 126.00, 80, 'in_stock', 1),
    ('Ubiquiti UniFi G5 Turret Ultra Camera', 'Graybar', 138.50, 15, 'in_stock', 2),
    ('Ubiquiti UniFi G5 Pro Camera', 'Ubiquiti Store', 379.00, NULL, 'in_stock', 2),
    ('Ubiquiti UniFi G5 Pro Camera', 'ADI Global Distribution', 372.00, 25, 'in_stock', 1),
    ('Ubiquiti UniFi G5 Pro Camera', 'Wesco/Anixter', 389.00, NULL, 'order', 5),
    ('Ubiquiti UniFi G4 Doorbell Pro', 'Ubiquiti Store', 299.00, NULL, 'in_stock', 2),
    ('Ubiquiti UniFi G4 Doorbell Pro', 'ADI Global Distribution', 295.00, 45, 'in_stock', 1),
    ('Ubiquiti UniFi AI Pro Camera', 'Ubiquiti Store', 399.00, NULL, 'limited', 10),
    ('Ubiquiti UniFi AI Pro Camera', 'ADI Global Distribution', 392.00, 12, 'limited', 2),
    ('Ubiquiti UniFi AI Pro Camera', 'Graybar', 415.00, NULL, 'order', 7),
    ('Ubiquiti UniFi NVR Pro', 'Ubiquiti Store', 849.00, NULL, 'in_stock', 2),
    ('Ubiquiti UniFi NVR Pro', 'ADI Global Distribution', 839.00, 10, 'in_stock', 1),
    ('Ubiquiti UniFi NVR Pro', 'Wesco/Anixter', 869.00, NULL, 'order', 5),
    ('Ubiquiti Dream Machine Pro Max', 'Ubiquiti Store', 599.00, NULL, 'in_stock', 2),
    ('Ubiquiti Dream Machine Pro Max', 'ADI Global Distribution', 589.00, 18, 'in_stock', 1),
    ('Ubiquiti Dream Machine Pro Max', 'Graybar', 615.00, 6, 'in_stock', 2),
    ('Ubiquiti Pro Max 24 PoE Switch', 'Ubiquiti Store', 799.00, NULL, 'in_stock', 2),
    ('Ubiquiti Pro Max 24 PoE Switch', 'ADI Global Distribution', 789.00, 15, 'in_stock', 1),
    ('Ubiquiti Pro Max 24 PoE Switch', 'Wesco/Anixter', 819.00, NULL, 'order', 5),
    ('Ubiquiti Access Hub', 'Ubiquiti Store', 199.00, NULL, 'in_stock', 2),
    ('Ubiquiti Access Hub', 'ADI Global Distribution', 195.00, 35, 'in_stock', 1),
    ('Ubiquiti Access Reader Pro', 'Ubiquiti Store', 299.00, NULL, 'in_stock', 2),
    ('Ubiquiti Access Reader Pro', 'ADI Global Distribution', 292.00, 25, 'in_stock', 1),
    ('Ubiquiti Access Reader Pro', 'Wesco/Anixter', 309.00, NULL, 'order', 5),
    ('Magnetic Lock 600 lb Single Door', 'ADI Global Distribution', 62.50, 60, 'in_stock', 1),
    ('Magnetic Lock 600 lb Single Door', 'Wesco/Anixter', 71.90, 20, 'in_stock', 2),
    ('Magnetic Lock 600 lb Single Door', 'The Home Depot', 89.98, NULL, 'order', 5),
    ('Magnetic Lock 1200 lb Single Door', 'ADI Global Distribution', 118.00, 40, 'in_stock', 1),
    ('Magnetic Lock 1200 lb Single Door', 'Graybar', 132.50, 12, 'in_stock', 2),
    ('Magnetic Lock 1200 lb Single Door', 'The Home Depot', 159.97, NULL, 'order', 5),
    ('Electric Door Strike Fail-Secure 12/24V', 'ADI Global Distribution', 64.50, 75, 'in_stock', 1),
    ('Electric Door Strike Fail-Secure 12/24V', 'Platt Electric', 69.90, 30, 'in_stock', 1),
    ('Electric Door Strike Fail-Secure 12/24V', 'The Home Depot', 84.97, 8, 'in_stock', 0),
    ('Request-to-Exit PIR Sensor', 'ADI Global Distribution', 48.90, 90, 'in_stock', 1),
    ('Request-to-Exit PIR Sensor', 'Wesco/Anixter', 54.50, 25, 'in_stock', 2),
    ('Request-to-Exit PIR Sensor', 'CED', 52.75, 40, 'in_stock', 1),
    ('Push-to-Exit Button Stainless', 'ADI Global Distribution', 27.50, 150, 'in_stock', 1),
    ('Push-to-Exit Button Stainless', 'Platt Electric', 31.40, 45, 'in_stock', 1),
    ('Push-to-Exit Button Stainless', 'The Home Depot', 39.98, 12, 'in_stock', 0),
    ('Standalone Keypad Entry 12V Weatherproof', 'ADI Global Distribution', 68.50, 55, 'in_stock', 1),
    ('Standalone Keypad Entry 12V Weatherproof', 'CED', 74.90, 20, 'in_stock', 2),
    ('Standalone Keypad Entry 12V Weatherproof', 'The Home Depot', 92.97, 6, 'limited', 0),
    ('Access Control Power Supply 12VDC 5A', 'ADI Global Distribution', 72.90, 45, 'in_stock', 1),
    ('Access Control Power Supply 12VDC 5A', 'Wesco/Anixter', 79.50, 18, 'in_stock', 2),
    ('Access Control Power Supply 12VDC 5A', 'Graybar', 82.40, 22, 'in_stock', 1),
    ('Door Position Contact Recessed - 10-Pack', 'ADI Global Distribution', 32.50, 120, 'in_stock', 1),
    ('Door Position Contact Recessed - 10-Pack', 'Wesco/Anixter', 36.90, NULL, 'unknown', 2),
    ('Single-Mode Duplex LC-LC Patch Cable 3 m', 'ADI Global Distribution', 9.75, 300, 'in_stock', 1),
    ('Single-Mode Duplex LC-LC Patch Cable 3 m', 'Graybar', 11.40, 90, 'in_stock', 1),
    ('Single-Mode Duplex LC-LC Patch Cable 3 m', 'The Home Depot', 14.98, 20, 'in_stock', 0),
    ('Single-Mode Duplex LC-LC Patch Cable 10 m', 'ADI Global Distribution', 14.50, 200, 'in_stock', 1),
    ('Single-Mode Duplex LC-LC Patch Cable 10 m', 'Wesco/Anixter', 16.80, 60, 'in_stock', 2),
    ('Single-Mode Duplex LC-LC Patch Cable 10 m', 'The Home Depot', 19.97, 12, 'in_stock', 0),
    ('12-Strand Single-Mode Outdoor Armored Fiber', 'Graybar', 1.42, 25000, 'in_stock', 2),
    ('12-Strand Single-Mode Outdoor Armored Fiber', 'Wesco/Anixter', 1.38, 18000, 'in_stock', 2),
    ('12-Strand Single-Mode Outdoor Armored Fiber', 'ADI Global Distribution', 1.29, 30000, 'in_stock', 1),
    ('Gigabit Single-Mode Media Converter LC 20 km', 'ADI Global Distribution', 42.50, 80, 'in_stock', 1),
    ('Gigabit Single-Mode Media Converter LC 20 km', 'CED', 46.90, 25, 'in_stock', 1),
    ('Gigabit Single-Mode Media Converter LC 20 km', 'The Home Depot', 54.98, NULL, 'order', 5),
    ('10G SFP+ Single-Mode Transceiver LC 10 km', 'ADI Global Distribution', 34.90, 150, 'in_stock', 1),
    ('10G SFP+ Single-Mode Transceiver LC 10 km', 'Graybar', 39.50, 60, 'in_stock', 1),
    ('10G SFP+ Single-Mode Transceiver LC 10 km', 'Ubiquiti Store', 49.00, NULL, 'in_stock', 2),
    ('GPON ONT Single Port', 'ADI Global Distribution', 82.50, 40, 'in_stock', 1),
    ('GPON ONT Single Port', 'Wesco/Anixter', 89.90, NULL, 'unknown', 3),
    ('24-Port LC Fiber Patch Panel Loaded 1U', 'ADI Global Distribution', 98.50, 30, 'in_stock', 1),
    ('24-Port LC Fiber Patch Panel Loaded 1U', 'Graybar', 112.00, 12, 'in_stock', 2),
    ('24-Port LC Fiber Patch Panel Loaded 1U', 'Wesco/Anixter', 108.40, 15, 'in_stock', 2),
    ('Speaker Wire 16/2 CL3 500 ft', 'The Home Depot', 89.98, 25, 'in_stock', 0),
    ('Speaker Wire 16/2 CL3 500 ft', 'Lowe''s', 92.48, 20, 'in_stock', 0),
    ('Speaker Wire 16/2 CL3 500 ft', 'ADI Global Distribution', 74.50, 90, 'in_stock', 1),
    ('Speaker Wire 16/4 CL3 500 ft', 'ADI Global Distribution', 118.50, 60, 'in_stock', 1),
    ('Speaker Wire 16/4 CL3 500 ft', 'The Home Depot', 139.97, 10, 'in_stock', 0),
    ('Security Alarm Wire 18/2 CL3 500 ft', 'ADI Global Distribution', 38.90, 150, 'in_stock', 1),
    ('Security Alarm Wire 18/2 CL3 500 ft', 'CED', 42.50, 45, 'in_stock', 1),
    ('Security Alarm Wire 18/2 CL3 500 ft', 'The Home Depot', 49.98, 15, 'in_stock', 0),
    ('RG6 Quad-Shield Coax 1000 ft', 'The Home Depot', 139.97, 18, 'in_stock', 0),
    ('RG6 Quad-Shield Coax 1000 ft', 'ADI Global Distribution', 112.50, 80, 'in_stock', 1),
    ('RG6 Quad-Shield Coax 1000 ft', 'Graybar', 124.00, 35, 'in_stock', 1),
    ('Structured Media Enclosure 14 in', 'The Home Depot', 42.98, 30, 'in_stock', 0),
    ('Structured Media Enclosure 14 in', 'Lowe''s', 44.25, 22, 'in_stock', 0),
    ('Structured Media Enclosure 14 in', 'ADI Global Distribution', 36.50, 70, 'in_stock', 1),
    ('Structured Media Enclosure 28 in', 'The Home Depot', 84.97, 20, 'in_stock', 0),
    ('Structured Media Enclosure 28 in', 'Lowe''s', 86.98, 15, 'in_stock', 0),
    ('Structured Media Enclosure 28 in', 'ADI Global Distribution', 72.90, 45, 'in_stock', 1)
) AS p(item_name, vendor_name, price, qty_in_stock, stock_status, lead_time_days)
JOIN catalog_items i ON i.tenant_id IS NULL AND i.name = p.item_name
JOIN catalog_vendors v ON v.tenant_id IS NULL AND v.name = p.vendor_name
ON CONFLICT (item_id, vendor_id) DO NOTHING;

-- ============================================================================
-- 4) ITEMS + PRICES — 'Electrical' (24 items)
-- ============================================================================

INSERT INTO catalog_items (tenant_id, vertical, category, name, description, unit, sku_hint)
SELECT NULL::uuid, x.vertical, x.category, x.name, x.description, x.unit, x.sku_hint
FROM (VALUES
  ('Electrical','Wire & Cable','Romex NM-B 14-2 W/G 250 ft','Copper nonmetallic sheathed cable','roll','NMB-142-250'),
  ('Electrical','Wire & Cable','Romex NM-B 12-2 W/G 250 ft','Copper nonmetallic sheathed cable','roll','NMB-122-250'),
  ('Electrical','Wire & Cable','Romex NM-B 12-3 W/G 250 ft','Copper nonmetallic sheathed cable','roll','NMB-123-250'),
  ('Electrical','Wire & Cable','THHN 12 AWG Stranded Black 500 ft','Building wire spool','spool','THHN-12-BLK-500'),
  ('Electrical','Wire & Cable','THHN 10 AWG Stranded Black 500 ft','Building wire spool','spool','THHN-10-BLK-500'),
  ('Electrical','Conduit & Boxes','EMT Conduit 1/2 in x 10 ft','Galvanized thin-wall conduit','each','EMT-050-10'),
  ('Electrical','Conduit & Boxes','EMT Conduit 3/4 in x 10 ft','Galvanized thin-wall conduit','each','EMT-075-10'),
  ('Electrical','Conduit & Boxes','EMT Set-Screw Connector 1/2 in - 25-Pack','Steel set-screw connectors','pack','EMT-CONN-050-25'),
  ('Electrical','Conduit & Boxes','EMT Set-Screw Coupling 3/4 in - 20-Pack','Steel set-screw couplings','pack','EMT-COUP-075-20'),
  ('Electrical','Conduit & Boxes','4 in Square Box 1-1/2 in Deep','Welded steel box with KOs','each','BOX-4SQ-15'),
  ('Electrical','Conduit & Boxes','1-Gang New Work Nail-On Box','PVC 18 cu in nail-on','each','BOX-1G-NW'),
  ('Electrical','Conduit & Boxes','1-Gang Old Work Box','PVC swing-clamp remodel box','each','BOX-1G-OW'),
  ('Electrical','Panels & Breakers','Square D QO 15A 1-Pole Breaker','Plug-on QO series breaker','each','QO115'),
  ('Electrical','Panels & Breakers','Square D QO 20A 1-Pole Breaker','Plug-on QO series breaker','each','QO120'),
  ('Electrical','Panels & Breakers','Square D QO 50A 2-Pole Breaker','Plug-on QO series breaker','each','QO250'),
  ('Electrical','Panels & Breakers','Square D QO 100A 20-Space Main Breaker Load Center','Indoor convertible panel','each','QO120M100PC'),
  ('Electrical','Panels & Breakers','Square D QO 200A 40-Space Main Breaker Load Center','Indoor convertible panel','each','QO140M200PC'),
  ('Electrical','Devices & Lighting','Leviton Decora 15A Rocker Switch White - 10-Pack','Quiet rocker switches','pack','DEC-SW15-10'),
  ('Electrical','Devices & Lighting','Leviton Decora 15A TR Duplex Receptacle White - 10-Pack','Tamper-resistant receptacles','pack','DEC-REC15-10'),
  ('Electrical','Devices & Lighting','Leviton Decora 20A GFCI TR Receptacle White','Self-test GFCI','each','DEC-GFCI20'),
  ('Electrical','Devices & Lighting','6 in LED Wafer Downlight Selectable CCT - 6-Pack','Canless recessed wafers','pack','WAFER-6-6PK'),
  ('Electrical','Devices & Lighting','4 in LED Wafer Downlight Selectable CCT - 6-Pack','Canless recessed wafers','pack','WAFER-4-6PK'),
  ('Electrical','Rough-In Hardware','NM Cable Staples 1/2 in - 200-Pack','Insulated cable staples','pack','STAPLE-NM-200'),
  ('Electrical','Rough-In Hardware','Ground Rod 5/8 in x 8 ft Copper-Bonded','UL-listed grounding electrode','each','GRD-58-8')
) AS x(vertical, category, name, description, unit, sku_hint)
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_items ci
  WHERE ci.tenant_id IS NULL AND ci.name = x.name
);

INSERT INTO catalog_vendor_prices (item_id, vendor_id, price, unit, qty_in_stock, stock_status, lead_time_days, source, as_of)
SELECT i.id, v.id, p.price, i.unit, p.qty_in_stock, p.stock_status, p.lead_time_days, 'reference', DATE '2026-08-21'
FROM (VALUES
    ('Romex NM-B 14-2 W/G 250 ft', 'The Home Depot', 67.98::numeric, 45::int, 'in_stock'::text, 0::int),
    ('Romex NM-B 14-2 W/G 250 ft', 'Lowe''s', 66.48, 38, 'in_stock', 0),
    ('Romex NM-B 14-2 W/G 250 ft', 'Platt Electric', 61.20, 120, 'in_stock', 1),
    ('Romex NM-B 14-2 W/G 250 ft', 'CED', 59.80, 200, 'in_stock', 1),
    ('Romex NM-B 12-2 W/G 250 ft', 'The Home Depot', 102.98, 40, 'in_stock', 0),
    ('Romex NM-B 12-2 W/G 250 ft', 'Lowe''s', 101.50, 32, 'in_stock', 0),
    ('Romex NM-B 12-2 W/G 250 ft', 'Graybar', 94.60, 150, 'in_stock', 1),
    ('Romex NM-B 12-2 W/G 250 ft', 'Platt Electric', 92.80, 90, 'in_stock', 1),
    ('Romex NM-B 12-3 W/G 250 ft', 'The Home Depot', 178.97, 15, 'in_stock', 0),
    ('Romex NM-B 12-3 W/G 250 ft', 'CED', 164.50, 60, 'in_stock', 1),
    ('Romex NM-B 12-3 W/G 250 ft', 'Graybar', 168.90, 45, 'in_stock', 1),
    ('THHN 12 AWG Stranded Black 500 ft', 'The Home Depot', 62.98, 25, 'in_stock', 0),
    ('THHN 12 AWG Stranded Black 500 ft', 'Platt Electric', 54.90, 200, 'in_stock', 1),
    ('THHN 12 AWG Stranded Black 500 ft', 'Graybar', 56.40, 160, 'in_stock', 1),
    ('THHN 10 AWG Stranded Black 500 ft', 'The Home Depot', 96.97, 18, 'in_stock', 0),
    ('THHN 10 AWG Stranded Black 500 ft', 'CED', 86.50, 90, 'in_stock', 1),
    ('THHN 10 AWG Stranded Black 500 ft', 'Wesco/Anixter', 88.90, 75, 'in_stock', 1),
    ('EMT Conduit 1/2 in x 10 ft', 'The Home Depot', 9.28, 350, 'in_stock', 0),
    ('EMT Conduit 1/2 in x 10 ft', 'Lowe''s', 9.15, 280, 'in_stock', 0),
    ('EMT Conduit 1/2 in x 10 ft', 'Platt Electric', 7.85, 1200, 'in_stock', 1),
    ('EMT Conduit 1/2 in x 10 ft', 'CED', 7.60, 1500, 'in_stock', 1),
    ('EMT Conduit 3/4 in x 10 ft', 'The Home Depot', 15.45, 220, 'in_stock', 0),
    ('EMT Conduit 3/4 in x 10 ft', 'Graybar', 13.20, 800, 'in_stock', 1),
    ('EMT Conduit 3/4 in x 10 ft', 'Platt Electric', 12.90, 650, 'in_stock', 1),
    ('EMT Set-Screw Connector 1/2 in - 25-Pack', 'The Home Depot', 18.97, 40, 'in_stock', 0),
    ('EMT Set-Screw Connector 1/2 in - 25-Pack', 'Platt Electric', 15.40, 150, 'in_stock', 1),
    ('EMT Set-Screw Connector 1/2 in - 25-Pack', 'CED', 14.80, 180, 'in_stock', 1),
    ('EMT Set-Screw Coupling 3/4 in - 20-Pack', 'The Home Depot', 21.48, 30, 'in_stock', 0),
    ('EMT Set-Screw Coupling 3/4 in - 20-Pack', 'Graybar', 17.90, 120, 'in_stock', 1),
    ('4 in Square Box 1-1/2 in Deep', 'The Home Depot', 2.98, 400, 'in_stock', 0),
    ('4 in Square Box 1-1/2 in Deep', 'Platt Electric', 2.35, 2000, 'in_stock', 1),
    ('4 in Square Box 1-1/2 in Deep', 'Wesco/Anixter', 2.28, 1600, 'in_stock', 1),
    ('1-Gang New Work Nail-On Box', 'The Home Depot', 0.86, 1200, 'in_stock', 0),
    ('1-Gang New Work Nail-On Box', 'Lowe''s', 0.84, 950, 'in_stock', 0),
    ('1-Gang New Work Nail-On Box', 'CED', 0.68, 5000, 'in_stock', 1),
    ('1-Gang Old Work Box', 'The Home Depot', 2.38, 600, 'in_stock', 0),
    ('1-Gang Old Work Box', 'Lowe''s', 2.32, 520, 'in_stock', 0),
    ('1-Gang Old Work Box', 'Platt Electric', 1.95, 1400, 'in_stock', 1),
    ('Square D QO 15A 1-Pole Breaker', 'The Home Depot', 13.97, 150, 'in_stock', 0),
    ('Square D QO 15A 1-Pole Breaker', 'Lowe''s', 13.48, 120, 'in_stock', 0),
    ('Square D QO 15A 1-Pole Breaker', 'Platt Electric', 11.90, 400, 'in_stock', 1),
    ('Square D QO 15A 1-Pole Breaker', 'Graybar', 12.40, 350, 'in_stock', 1),
    ('Square D QO 20A 1-Pole Breaker', 'The Home Depot', 13.97, 180, 'in_stock', 0),
    ('Square D QO 20A 1-Pole Breaker', 'Lowe''s', 13.48, 140, 'in_stock', 0),
    ('Square D QO 20A 1-Pole Breaker', 'CED', 11.75, 500, 'in_stock', 1),
    ('Square D QO 20A 1-Pole Breaker', 'Wesco/Anixter', 12.10, 420, 'in_stock', 1),
    ('Square D QO 50A 2-Pole Breaker', 'The Home Depot', 36.97, 45, 'in_stock', 0),
    ('Square D QO 50A 2-Pole Breaker', 'Platt Electric', 32.40, 110, 'in_stock', 1),
    ('Square D QO 50A 2-Pole Breaker', 'Graybar', 33.80, 90, 'in_stock', 1),
    ('Square D QO 100A 20-Space Main Breaker Load Center', 'The Home Depot', 164.97, 12, 'in_stock', 0),
    ('Square D QO 100A 20-Space Main Breaker Load Center', 'Platt Electric', 152.00, 30, 'in_stock', 1),
    ('Square D QO 100A 20-Space Main Breaker Load Center', 'CED', 148.50, 40, 'in_stock', 1),
    ('Square D QO 200A 40-Space Main Breaker Load Center', 'The Home Depot', 298.00, 8, 'in_stock', 0),
    ('Square D QO 200A 40-Space Main Breaker Load Center', 'Lowe''s', 305.00, 6, 'in_stock', 0),
    ('Square D QO 200A 40-Space Main Breaker Load Center', 'Graybar', 276.50, 25, 'in_stock', 1),
    ('Square D QO 200A 40-Space Main Breaker Load Center', 'Platt Electric', 269.00, 18, 'in_stock', 1),
    ('Leviton Decora 15A Rocker Switch White - 10-Pack', 'The Home Depot', 38.97, 55, 'in_stock', 0),
    ('Leviton Decora 15A Rocker Switch White - 10-Pack', 'Lowe''s', 37.98, 48, 'in_stock', 0),
    ('Leviton Decora 15A Rocker Switch White - 10-Pack', 'CED', 33.50, 160, 'in_stock', 1),
    ('Leviton Decora 15A TR Duplex Receptacle White - 10-Pack', 'The Home Depot', 35.97, 60, 'in_stock', 0),
    ('Leviton Decora 15A TR Duplex Receptacle White - 10-Pack', 'Lowe''s', 34.98, 52, 'in_stock', 0),
    ('Leviton Decora 15A TR Duplex Receptacle White - 10-Pack', 'Platt Electric', 30.40, 200, 'in_stock', 1),
    ('Leviton Decora 20A GFCI TR Receptacle White', 'The Home Depot', 24.97, 90, 'in_stock', 0),
    ('Leviton Decora 20A GFCI TR Receptacle White', 'Lowe''s', 23.98, 75, 'in_stock', 0),
    ('Leviton Decora 20A GFCI TR Receptacle White', 'Graybar', 21.50, 240, 'in_stock', 1),
    ('6 in LED Wafer Downlight Selectable CCT - 6-Pack', 'The Home Depot', 109.97, 25, 'in_stock', 0),
    ('6 in LED Wafer Downlight Selectable CCT - 6-Pack', 'Lowe''s', 104.98, 20, 'in_stock', 0),
    ('6 in LED Wafer Downlight Selectable CCT - 6-Pack', 'Platt Electric', 94.50, 80, 'in_stock', 1),
    ('4 in LED Wafer Downlight Selectable CCT - 6-Pack', 'The Home Depot', 89.97, 30, 'in_stock', 0),
    ('4 in LED Wafer Downlight Selectable CCT - 6-Pack', 'Lowe''s', 87.48, 26, 'in_stock', 0),
    ('4 in LED Wafer Downlight Selectable CCT - 6-Pack', 'CED', 79.90, 95, 'in_stock', 1),
    ('NM Cable Staples 1/2 in - 200-Pack', 'The Home Depot', 12.97, 85, 'in_stock', 0),
    ('NM Cable Staples 1/2 in - 200-Pack', 'Lowe''s', 12.48, 70, 'in_stock', 0),
    ('NM Cable Staples 1/2 in - 200-Pack', 'Platt Electric', 10.90, 300, 'in_stock', 1),
    ('Ground Rod 5/8 in x 8 ft Copper-Bonded', 'The Home Depot', 21.98, 40, 'in_stock', 0),
    ('Ground Rod 5/8 in x 8 ft Copper-Bonded', 'Graybar', 18.40, 150, 'in_stock', 1),
    ('Ground Rod 5/8 in x 8 ft Copper-Bonded', 'Wesco/Anixter', 17.90, 120, 'in_stock', 1)
) AS p(item_name, vendor_name, price, qty_in_stock, stock_status, lead_time_days)
JOIN catalog_items i ON i.tenant_id IS NULL AND i.name = p.item_name
JOIN catalog_vendors v ON v.tenant_id IS NULL AND v.name = p.vendor_name
ON CONFLICT (item_id, vendor_id) DO NOTHING;

-- ============================================================================
-- 5) ITEMS + PRICES — 'Plumbing' (18 items)
-- ============================================================================

INSERT INTO catalog_items (tenant_id, vertical, category, name, description, unit, sku_hint)
SELECT NULL::uuid, x.vertical, x.category, x.name, x.description, x.unit, x.sku_hint
FROM (VALUES
  ('Plumbing','PEX & Copper','PEX-A Tubing 1/2 in x 100 ft Red','Expansion-style flexible tubing','roll','PEXA-050-100-R'),
  ('Plumbing','PEX & Copper','PEX-A Tubing 1/2 in x 100 ft Blue','Expansion-style flexible tubing','roll','PEXA-050-100-B'),
  ('Plumbing','PEX & Copper','PEX-A Tubing 1/2 in x 300 ft Blue','Expansion-style flexible tubing coil','roll','PEXA-050-300-B'),
  ('Plumbing','PEX & Copper','PEX-A Tubing 3/4 in x 100 ft Red','Expansion-style flexible tubing','roll','PEXA-075-100-R'),
  ('Plumbing','PEX & Copper','PEX-A Tubing 3/4 in x 100 ft Blue','Expansion-style flexible tubing','roll','PEXA-075-100-B'),
  ('Plumbing','PEX & Copper','Copper Pipe Type M 1/2 in x 10 ft','Hard copper water tube','each','CU-M-050-10'),
  ('Plumbing','PEX & Copper','Copper Pipe Type M 3/4 in x 10 ft','Hard copper water tube','each','CU-M-075-10'),
  ('Plumbing','Valves & Fittings','Full-Port Brass Ball Valve 1/2 in Threaded','Lead-free NPT ball valve','each','BV-050-FP'),
  ('Plumbing','Valves & Fittings','Full-Port Brass Ball Valve 3/4 in Threaded','Lead-free NPT ball valve','each','BV-075-FP'),
  ('Plumbing','Valves & Fittings','PEX-A Expansion Coupling 3/4 in - 10-Pack','Cold-expansion fittings','pack','PEXA-COUP-075-10'),
  ('Plumbing','Valves & Fittings','Push-to-Connect Coupling 3/4 in','Tool-free repair coupling','each','PTC-COUP-075'),
  ('Plumbing','Valves & Fittings','P-Trap 1-1/2 in PVC with Union','Slip-joint tubular trap','each','PT-112-PVC'),
  ('Plumbing','Fixtures & Water Heaters','Reinforced Wax Ring with Horn','Toilet bowl seal','each','WAX-HORN'),
  ('Plumbing','Fixtures & Water Heaters','Toilet Supply Line 3/8 in x 12 in Braided','Stainless braided riser','each','SUP-TOILET-12'),
  ('Plumbing','Fixtures & Water Heaters','50-Gal Electric Water Heater 4500W','Dual-element tall tank','each','WH-50E'),
  ('Plumbing','Fixtures & Water Heaters','50-Gal Gas Water Heater 40k BTU','Atmospheric vent tall tank','each','WH-50G'),
  ('Plumbing','Fixtures & Water Heaters','Water Heater Drain Pan 24 in Aluminum','Pan with PVC adapter','each','WH-PAN-24'),
  ('Plumbing','Fixtures & Water Heaters','T&P Relief Valve 3/4 in','Temperature-pressure relief','each','TP-VALVE-075')
) AS x(vertical, category, name, description, unit, sku_hint)
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_items ci
  WHERE ci.tenant_id IS NULL AND ci.name = x.name
);

INSERT INTO catalog_vendor_prices (item_id, vendor_id, price, unit, qty_in_stock, stock_status, lead_time_days, source, as_of)
SELECT i.id, v.id, p.price, i.unit, p.qty_in_stock, p.stock_status, p.lead_time_days, 'reference', DATE '2026-08-21'
FROM (VALUES
    ('PEX-A Tubing 1/2 in x 100 ft Red', 'The Home Depot', 42.98::numeric, 35::int, 'in_stock'::text, 0::int),
    ('PEX-A Tubing 1/2 in x 100 ft Red', 'Lowe''s', 41.50, 28, 'in_stock', 0),
    ('PEX-A Tubing 1/2 in x 100 ft Red', 'Ferguson', 36.90, 150, 'in_stock', 1),
    ('PEX-A Tubing 1/2 in x 100 ft Blue', 'The Home Depot', 42.98, 32, 'in_stock', 0),
    ('PEX-A Tubing 1/2 in x 100 ft Blue', 'Lowe''s', 41.50, 30, 'in_stock', 0),
    ('PEX-A Tubing 1/2 in x 100 ft Blue', 'Ferguson', 36.90, 140, 'in_stock', 1),
    ('PEX-A Tubing 1/2 in x 300 ft Blue', 'The Home Depot', 118.97, 12, 'in_stock', 0),
    ('PEX-A Tubing 1/2 in x 300 ft Blue', 'Ferguson', 104.50, 60, 'in_stock', 1),
    ('PEX-A Tubing 1/2 in x 300 ft Blue', 'Grainger', 112.80, 25, 'in_stock', 2),
    ('PEX-A Tubing 3/4 in x 100 ft Red', 'The Home Depot', 89.97, 18, 'in_stock', 0),
    ('PEX-A Tubing 3/4 in x 100 ft Red', 'Ferguson', 79.50, 80, 'in_stock', 1),
    ('PEX-A Tubing 3/4 in x 100 ft Red', 'Lowe''s', 88.48, 15, 'in_stock', 0),
    ('PEX-A Tubing 3/4 in x 100 ft Blue', 'The Home Depot', 89.97, 20, 'in_stock', 0),
    ('PEX-A Tubing 3/4 in x 100 ft Blue', 'Ferguson', 79.50, 75, 'in_stock', 1),
    ('PEX-A Tubing 3/4 in x 100 ft Blue', 'Lowe''s', 88.48, 16, 'in_stock', 0),
    ('Copper Pipe Type M 1/2 in x 10 ft', 'The Home Depot', 19.98, 120, 'in_stock', 0),
    ('Copper Pipe Type M 1/2 in x 10 ft', 'Ferguson', 17.20, 400, 'in_stock', 1),
    ('Copper Pipe Type M 1/2 in x 10 ft', 'Grainger', 18.50, 90, 'in_stock', 2),
    ('Copper Pipe Type M 3/4 in x 10 ft', 'The Home Depot', 31.98, 95, 'in_stock', 0),
    ('Copper Pipe Type M 3/4 in x 10 ft', 'Ferguson', 27.80, 320, 'in_stock', 1),
    ('Copper Pipe Type M 3/4 in x 10 ft', 'Lowe''s', 30.98, 70, 'in_stock', 0),
    ('Full-Port Brass Ball Valve 1/2 in Threaded', 'The Home Depot', 11.98, 140, 'in_stock', 0),
    ('Full-Port Brass Ball Valve 1/2 in Threaded', 'Ferguson', 9.40, 500, 'in_stock', 1),
    ('Full-Port Brass Ball Valve 1/2 in Threaded', 'Grainger', 10.20, 200, 'in_stock', 2),
    ('Full-Port Brass Ball Valve 3/4 in Threaded', 'The Home Depot', 16.98, 110, 'in_stock', 0),
    ('Full-Port Brass Ball Valve 3/4 in Threaded', 'Ferguson', 13.20, 420, 'in_stock', 1),
    ('Full-Port Brass Ball Valve 3/4 in Threaded', 'Lowe''s', 15.98, 85, 'in_stock', 0),
    ('PEX-A Expansion Coupling 3/4 in - 10-Pack', 'Ferguson', 21.50, 180, 'in_stock', 1),
    ('PEX-A Expansion Coupling 3/4 in - 10-Pack', 'The Home Depot', 27.98, 25, 'in_stock', 0),
    ('Push-to-Connect Coupling 3/4 in', 'The Home Depot', 9.98, 160, 'in_stock', 0),
    ('Push-to-Connect Coupling 3/4 in', 'Lowe''s', 9.48, 130, 'in_stock', 0),
    ('Push-to-Connect Coupling 3/4 in', 'Ferguson', 8.20, 350, 'in_stock', 1),
    ('P-Trap 1-1/2 in PVC with Union', 'The Home Depot', 6.48, 200, 'in_stock', 0),
    ('P-Trap 1-1/2 in PVC with Union', 'Lowe''s', 6.28, 170, 'in_stock', 0),
    ('P-Trap 1-1/2 in PVC with Union', 'Ferguson', 4.90, 600, 'in_stock', 1),
    ('Reinforced Wax Ring with Horn', 'The Home Depot', 4.98, 250, 'in_stock', 0),
    ('Reinforced Wax Ring with Horn', 'Lowe''s', 4.68, 210, 'in_stock', 0),
    ('Reinforced Wax Ring with Horn', 'Ferguson', 3.40, 800, 'in_stock', 1),
    ('Toilet Supply Line 3/8 in x 12 in Braided', 'The Home Depot', 6.98, 300, 'in_stock', 0),
    ('Toilet Supply Line 3/8 in x 12 in Braided', 'Ferguson', 4.80, 900, 'in_stock', 1),
    ('50-Gal Electric Water Heater 4500W', 'The Home Depot', 589.00, 10, 'in_stock', 0),
    ('50-Gal Electric Water Heater 4500W', 'Lowe''s', 579.00, 8, 'in_stock', 0),
    ('50-Gal Electric Water Heater 4500W', 'Ferguson', 645.00, 25, 'in_stock', 1),
    ('50-Gal Gas Water Heater 40k BTU', 'The Home Depot', 749.00, 8, 'in_stock', 0),
    ('50-Gal Gas Water Heater 40k BTU', 'Lowe''s', 739.00, 6, 'in_stock', 0),
    ('50-Gal Gas Water Heater 40k BTU', 'Ferguson', 812.00, 20, 'in_stock', 1),
    ('Water Heater Drain Pan 24 in Aluminum', 'The Home Depot', 27.98, 45, 'in_stock', 0),
    ('Water Heater Drain Pan 24 in Aluminum', 'Lowe''s', 26.48, 38, 'in_stock', 0),
    ('Water Heater Drain Pan 24 in Aluminum', 'Ferguson', 22.90, 120, 'in_stock', 1),
    ('T&P Relief Valve 3/4 in', 'The Home Depot', 18.98, 60, 'in_stock', 0),
    ('T&P Relief Valve 3/4 in', 'Ferguson', 14.50, 200, 'in_stock', 1),
    ('T&P Relief Valve 3/4 in', 'Grainger', 16.20, 85, 'in_stock', 2)
) AS p(item_name, vendor_name, price, qty_in_stock, stock_status, lead_time_days)
JOIN catalog_items i ON i.tenant_id IS NULL AND i.name = p.item_name
JOIN catalog_vendors v ON v.tenant_id IS NULL AND v.name = p.vendor_name
ON CONFLICT (item_id, vendor_id) DO NOTHING;

-- ============================================================================
-- 6) ITEMS + PRICES — 'HVAC' (14 items)
-- ============================================================================

INSERT INTO catalog_items (tenant_id, vertical, category, name, description, unit, sku_hint)
SELECT NULL::uuid, x.vertical, x.category, x.name, x.description, x.unit, x.sku_hint
FROM (VALUES
  ('HVAC','Ductwork','Insulated Flex Duct R8 8 in x 25 ft','Foil-jacket insulated flex','each','FLEX-R8-08-25'),
  ('HVAC','Ductwork','Insulated Flex Duct R8 10 in x 25 ft','Foil-jacket insulated flex','each','FLEX-R8-10-25'),
  ('HVAC','Ductwork','Insulated Flex Duct R8 12 in x 25 ft','Foil-jacket insulated flex','each','FLEX-R8-12-25'),
  ('HVAC','Grilles & Registers','Steel Supply Register 4 in x 10 in White','Adjustable 2-way register','each','REG-410-WH'),
  ('HVAC','Grilles & Registers','Return Air Grille 20 in x 20 in White','Stamped-face return grille','each','GRL-2020-WH'),
  ('HVAC','Equipment & Accessories','Condensate Pump 1/50 HP 120V','Automatic condensate removal','each','CP-150-120'),
  ('HVAC','Filters','MERV 13 Filter 16x25x1 - 2-Pack','Pleated media filters','pack','M13-16251-2PK'),
  ('HVAC','Filters','MERV 13 Filter 20x20x1 - 2-Pack','Pleated media filters','pack','M13-20201-2PK'),
  ('HVAC','Equipment & Accessories','12000 BTU 115V Mini-Split Heat Pump System','21.5 SEER2 single-zone kit','each','MS-12K-115'),
  ('HVAC','Equipment & Accessories','Mini-Split Line Set 1/4 in x 1/2 in x 25 ft','Insulated copper line set','each','LS-1412-25'),
  ('HVAC','Equipment & Accessories','UL 181 Foil Duct Tape 2.5 in x 60 yd','Code-approved foil tape','each','TAPE-UL181'),
  ('HVAC','Equipment & Accessories','Water-Based Duct Mastic 1 Gal','Duct sealant tub','each','MASTIC-1G'),
  ('HVAC','Controls','Programmable Thermostat 7-Day','Universal staged thermostat','each','TSTAT-7D'),
  ('HVAC','Equipment & Accessories','Equipment Pad 36 in x 36 in x 3 in','Plastic condenser pad','each','PAD-3636')
) AS x(vertical, category, name, description, unit, sku_hint)
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_items ci
  WHERE ci.tenant_id IS NULL AND ci.name = x.name
);

INSERT INTO catalog_vendor_prices (item_id, vendor_id, price, unit, qty_in_stock, stock_status, lead_time_days, source, as_of)
SELECT i.id, v.id, p.price, i.unit, p.qty_in_stock, p.stock_status, p.lead_time_days, 'reference', DATE '2026-08-21'
FROM (VALUES
    ('Insulated Flex Duct R8 8 in x 25 ft', 'The Home Depot', 98.97::numeric, 22::int, 'in_stock'::text, 0::int),
    ('Insulated Flex Duct R8 8 in x 25 ft', 'Ferguson', 84.50, 90, 'in_stock', 1),
    ('Insulated Flex Duct R8 8 in x 25 ft', 'Grainger', 96.80, 35, 'in_stock', 2),
    ('Insulated Flex Duct R8 10 in x 25 ft', 'The Home Depot', 124.97, 18, 'in_stock', 0),
    ('Insulated Flex Duct R8 10 in x 25 ft', 'Ferguson', 108.90, 70, 'in_stock', 1),
    ('Insulated Flex Duct R8 10 in x 25 ft', 'Lowe''s', 122.48, 14, 'in_stock', 0),
    ('Insulated Flex Duct R8 12 in x 25 ft', 'The Home Depot', 152.97, 12, 'in_stock', 0),
    ('Insulated Flex Duct R8 12 in x 25 ft', 'Ferguson', 132.50, 55, 'in_stock', 1),
    ('Insulated Flex Duct R8 12 in x 25 ft', 'Grainger', 148.90, 20, 'in_stock', 2),
    ('Steel Supply Register 4 in x 10 in White', 'The Home Depot', 8.98, 180, 'in_stock', 0),
    ('Steel Supply Register 4 in x 10 in White', 'Lowe''s', 8.78, 150, 'in_stock', 0),
    ('Steel Supply Register 4 in x 10 in White', 'Ferguson', 6.90, 500, 'in_stock', 1),
    ('Return Air Grille 20 in x 20 in White', 'The Home Depot', 19.98, 60, 'in_stock', 0),
    ('Return Air Grille 20 in x 20 in White', 'Lowe''s', 19.48, 50, 'in_stock', 0),
    ('Return Air Grille 20 in x 20 in White', 'Ferguson', 15.80, 200, 'in_stock', 1),
    ('Condensate Pump 1/50 HP 120V', 'The Home Depot', 62.97, 35, 'in_stock', 0),
    ('Condensate Pump 1/50 HP 120V', 'Ferguson', 52.40, 110, 'in_stock', 1),
    ('Condensate Pump 1/50 HP 120V', 'Grainger', 58.90, 60, 'in_stock', 2),
    ('MERV 13 Filter 16x25x1 - 2-Pack', 'The Home Depot', 34.97, 80, 'in_stock', 0),
    ('MERV 13 Filter 16x25x1 - 2-Pack', 'Lowe''s', 33.98, 65, 'in_stock', 0),
    ('MERV 13 Filter 16x25x1 - 2-Pack', 'Grainger', 29.50, 300, 'in_stock', 1),
    ('MERV 13 Filter 20x20x1 - 2-Pack', 'The Home Depot', 32.97, 75, 'in_stock', 0),
    ('MERV 13 Filter 20x20x1 - 2-Pack', 'Lowe''s', 31.98, 60, 'in_stock', 0),
    ('MERV 13 Filter 20x20x1 - 2-Pack', 'Grainger', 27.90, 280, 'in_stock', 1),
    ('12000 BTU 115V Mini-Split Heat Pump System', 'The Home Depot', 949.00, 6, 'in_stock', 0),
    ('12000 BTU 115V Mini-Split Heat Pump System', 'Lowe''s', 928.00, 5, 'in_stock', 0),
    ('12000 BTU 115V Mini-Split Heat Pump System', 'Ferguson', 1065.00, NULL, 'order', 5),
    ('Mini-Split Line Set 1/4 in x 1/2 in x 25 ft', 'The Home Depot', 102.97, 15, 'in_stock', 0),
    ('Mini-Split Line Set 1/4 in x 1/2 in x 25 ft', 'Ferguson', 88.50, 60, 'in_stock', 1),
    ('Mini-Split Line Set 1/4 in x 1/2 in x 25 ft', 'Grainger', 96.40, 25, 'in_stock', 2),
    ('UL 181 Foil Duct Tape 2.5 in x 60 yd', 'The Home Depot', 13.48, 120, 'in_stock', 0),
    ('UL 181 Foil Duct Tape 2.5 in x 60 yd', 'Lowe''s', 12.98, 100, 'in_stock', 0),
    ('UL 181 Foil Duct Tape 2.5 in x 60 yd', 'Grainger', 11.20, 400, 'in_stock', 1),
    ('Water-Based Duct Mastic 1 Gal', 'The Home Depot', 18.97, 45, 'in_stock', 0),
    ('Water-Based Duct Mastic 1 Gal', 'Ferguson', 15.40, 130, 'in_stock', 1),
    ('Programmable Thermostat 7-Day', 'The Home Depot', 42.97, 55, 'in_stock', 0),
    ('Programmable Thermostat 7-Day', 'Lowe''s', 41.48, 45, 'in_stock', 0),
    ('Programmable Thermostat 7-Day', 'Grainger', 38.50, 150, 'in_stock', 1),
    ('Equipment Pad 36 in x 36 in x 3 in', 'The Home Depot', 46.98, 30, 'in_stock', 0),
    ('Equipment Pad 36 in x 36 in x 3 in', 'Ferguson', 39.90, 85, 'in_stock', 1),
    ('Equipment Pad 36 in x 36 in x 3 in', 'Lowe''s', 45.48, 25, 'in_stock', 0)
) AS p(item_name, vendor_name, price, qty_in_stock, stock_status, lead_time_days)
JOIN catalog_items i ON i.tenant_id IS NULL AND i.name = p.item_name
JOIN catalog_vendors v ON v.tenant_id IS NULL AND v.name = p.vendor_name
ON CONFLICT (item_id, vendor_id) DO NOTHING;

-- ============================================================================
-- 7) ITEMS + PRICES — 'Flooring & Carpet' (16 items)
-- ============================================================================

INSERT INTO catalog_items (tenant_id, vertical, category, name, description, unit, sku_hint)
SELECT NULL::uuid, x.vertical, x.category, x.name, x.description, x.unit, x.sku_hint
FROM (VALUES
  ('Flooring & Carpet','Carpet','Commercial Carpet Tile 24x24 Level Loop','Glue-down modular tile','sq ft','CT-2424-LL'),
  ('Flooring & Carpet','Carpet','Carpet Tile Plank 9x36 Patterned Loop','Modular plank tile','sq ft','CT-936-PL'),
  ('Flooring & Carpet','Carpet','Plush Carpet Nylon','Residential cut-pile broadloom','sq yd','CPT-PLUSH-NYL'),
  ('Flooring & Carpet','Carpet','Berber Loop Carpet','Olefin loop broadloom','sq yd','CPT-BERBER'),
  ('Flooring & Carpet','Carpet','Carpet Pad 8 lb Rebond','7/16 in rebond cushion','sq yd','PAD-8LB'),
  ('Flooring & Carpet','Carpet','Carpet Tack Strip 4 ft','Wood strip with pins','each','TACK-4FT'),
  ('Flooring & Carpet','Resilient & Wood','Rigid Core LVP 20 mil 7 in Plank','SPC click-lock plank','sq ft','LVP-20-7'),
  ('Flooring & Carpet','Resilient & Wood','LVP 12 mil Click-Lock','Entry-level SPC plank','sq ft','LVP-12'),
  ('Flooring & Carpet','Resilient & Wood','Engineered Hardwood White Oak 5 in','UV-cured wear layer plank','sq ft','EHW-WO-5'),
  ('Flooring & Carpet','Resilient & Wood','Foam Underlayment 3 mm 100 sq ft Roll','Moisture-barrier underlayment','roll','UL-3MM-100'),
  ('Flooring & Carpet','Tile & Setting','Porcelain Tile 12x24 Matte Gray','Rectified floor tile','sq ft','PT-1224-GRY'),
  ('Flooring & Carpet','Tile & Setting','Porcelain Tile 24x48 Large Format','Rectified large-format tile','sq ft','PT-2448-LF'),
  ('Flooring & Carpet','Tile & Setting','Modified Thinset Mortar White 50 lb','Polymer-modified mortar','bag','THIN-MOD-50W'),
  ('Flooring & Carpet','Tile & Setting','Sanded Grout 25 lb Gray','Cement grout for joints over 1/8 in','bag','GROUT-S-25G'),
  ('Flooring & Carpet','Tile & Setting','Tile Leveling Clips 1/16 in - 300-Pack','Lippage control clips','pack','TLC-116-300'),
  ('Flooring & Carpet','Tile & Setting','Self-Leveling Underlayment 50 lb','Pourable floor leveler','bag','SLU-50')
) AS x(vertical, category, name, description, unit, sku_hint)
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_items ci
  WHERE ci.tenant_id IS NULL AND ci.name = x.name
);

INSERT INTO catalog_vendor_prices (item_id, vendor_id, price, unit, qty_in_stock, stock_status, lead_time_days, source, as_of)
SELECT i.id, v.id, p.price, i.unit, p.qty_in_stock, p.stock_status, p.lead_time_days, 'reference', DATE '2026-08-21'
FROM (VALUES
    ('Commercial Carpet Tile 24x24 Level Loop', 'Floor & Decor', 1.79::numeric, 12000::int, 'in_stock'::text, 0::int),
    ('Commercial Carpet Tile 24x24 Level Loop', 'The Home Depot', 2.19, 4500, 'in_stock', 0),
    ('Commercial Carpet Tile 24x24 Level Loop', 'Lowe''s', 2.29, 3800, 'in_stock', 0),
    ('Carpet Tile Plank 9x36 Patterned Loop', 'Floor & Decor', 2.49, 8000, 'in_stock', 0),
    ('Carpet Tile Plank 9x36 Patterned Loop', 'The Home Depot', 2.89, 2600, 'in_stock', 0),
    ('Plush Carpet Nylon', 'The Home Depot', 21.97, 900, 'in_stock', 3),
    ('Plush Carpet Nylon', 'Lowe''s', 20.98, 850, 'in_stock', 3),
    ('Plush Carpet Nylon', 'Floor & Decor', 18.99, 1200, 'in_stock', 2),
    ('Berber Loop Carpet', 'The Home Depot', 17.97, 750, 'in_stock', 3),
    ('Berber Loop Carpet', 'Lowe''s', 17.48, 680, 'in_stock', 3),
    ('Berber Loop Carpet', 'Floor & Decor', 15.99, 950, 'in_stock', 2),
    ('Carpet Pad 8 lb Rebond', 'The Home Depot', 5.49, 2200, 'in_stock', 0),
    ('Carpet Pad 8 lb Rebond', 'Lowe''s', 5.29, 1900, 'in_stock', 0),
    ('Carpet Pad 8 lb Rebond', 'Floor & Decor', 4.75, 3000, 'in_stock', 0),
    ('Carpet Tack Strip 4 ft', 'The Home Depot', 1.68, 800, 'in_stock', 0),
    ('Carpet Tack Strip 4 ft', 'Lowe''s', 1.62, 700, 'in_stock', 0),
    ('Carpet Tack Strip 4 ft', 'Floor & Decor', 1.45, 1500, 'in_stock', 0),
    ('Rigid Core LVP 20 mil 7 in Plank', 'Floor & Decor', 2.69, 18000, 'in_stock', 0),
    ('Rigid Core LVP 20 mil 7 in Plank', 'The Home Depot', 3.19, 7500, 'in_stock', 0),
    ('Rigid Core LVP 20 mil 7 in Plank', 'Lowe''s', 3.09, 6800, 'in_stock', 0),
    ('LVP 12 mil Click-Lock', 'Floor & Decor', 1.79, 22000, 'in_stock', 0),
    ('LVP 12 mil Click-Lock', 'The Home Depot', 2.09, 9500, 'in_stock', 0),
    ('LVP 12 mil Click-Lock', 'Lowe''s', 1.99, 8200, 'in_stock', 0),
    ('Engineered Hardwood White Oak 5 in', 'Floor & Decor', 4.49, 6500, 'in_stock', 0),
    ('Engineered Hardwood White Oak 5 in', 'The Home Depot', 5.49, 2400, 'in_stock', 0),
    ('Engineered Hardwood White Oak 5 in', 'Lowe''s', 5.29, 2100, 'in_stock', 0),
    ('Foam Underlayment 3 mm 100 sq ft Roll', 'The Home Depot', 26.98, 60, 'in_stock', 0),
    ('Foam Underlayment 3 mm 100 sq ft Roll', 'Lowe''s', 25.48, 52, 'in_stock', 0),
    ('Foam Underlayment 3 mm 100 sq ft Roll', 'Floor & Decor', 22.99, 110, 'in_stock', 0),
    ('Porcelain Tile 12x24 Matte Gray', 'Floor & Decor', 1.69, 15000, 'in_stock', 0),
    ('Porcelain Tile 12x24 Matte Gray', 'Daltile', 2.15, 9000, 'in_stock', 2),
    ('Porcelain Tile 12x24 Matte Gray', 'The Home Depot', 2.29, 5200, 'in_stock', 0),
    ('Porcelain Tile 24x48 Large Format', 'Floor & Decor', 3.49, 6000, 'in_stock', 0),
    ('Porcelain Tile 24x48 Large Format', 'Daltile', 4.25, 3500, 'in_stock', 3),
    ('Modified Thinset Mortar White 50 lb', 'The Home Depot', 23.98, 140, 'in_stock', 0),
    ('Modified Thinset Mortar White 50 lb', 'Floor & Decor', 19.99, 260, 'in_stock', 0),
    ('Modified Thinset Mortar White 50 lb', 'Daltile', 26.50, 90, 'in_stock', 2),
    ('Modified Thinset Mortar White 50 lb', 'Lowe''s', 22.48, 120, 'in_stock', 0),
    ('Sanded Grout 25 lb Gray', 'The Home Depot', 19.97, 110, 'in_stock', 0),
    ('Sanded Grout 25 lb Gray', 'Floor & Decor', 16.99, 200, 'in_stock', 0),
    ('Sanded Grout 25 lb Gray', 'Daltile', 21.40, 75, 'in_stock', 2),
    ('Tile Leveling Clips 1/16 in - 300-Pack', 'Floor & Decor', 24.99, 90, 'in_stock', 0),
    ('Tile Leveling Clips 1/16 in - 300-Pack', 'The Home Depot', 29.98, 40, 'in_stock', 0),
    ('Tile Leveling Clips 1/16 in - 300-Pack', 'Daltile', 32.50, NULL, 'order', 3),
    ('Self-Leveling Underlayment 50 lb', 'The Home Depot', 41.98, 65, 'in_stock', 0),
    ('Self-Leveling Underlayment 50 lb', 'Lowe''s', 40.48, 55, 'in_stock', 0),
    ('Self-Leveling Underlayment 50 lb', 'Floor & Decor', 37.99, 100, 'in_stock', 0)
) AS p(item_name, vendor_name, price, qty_in_stock, stock_status, lead_time_days)
JOIN catalog_items i ON i.tenant_id IS NULL AND i.name = p.item_name
JOIN catalog_vendors v ON v.tenant_id IS NULL AND v.name = p.vendor_name
ON CONFLICT (item_id, vendor_id) DO NOTHING;

-- ============================================================================
-- 8) ITEMS + PRICES — 'Drywall' (12 items)
-- ============================================================================

INSERT INTO catalog_items (tenant_id, vertical, category, name, description, unit, sku_hint)
SELECT NULL::uuid, x.vertical, x.category, x.name, x.description, x.unit, x.sku_hint
FROM (VALUES
  ('Drywall','Board','5/8 in Type X Drywall 4x12','Fire-rated gypsum panel','sheet','DW-58X-412'),
  ('Drywall','Board','5/8 in Type X Drywall 4x8','Fire-rated gypsum panel','sheet','DW-58X-48'),
  ('Drywall','Board','1/2 in Lightweight Drywall 4x8','Ultralight gypsum panel','sheet','DW-12L-48'),
  ('Drywall','Board','1/2 in Lightweight Drywall 4x12','Ultralight gypsum panel','sheet','DW-12L-412'),
  ('Drywall','Finishing','All-Purpose Joint Compound 4.5 Gal','Ready-mix pail','pail','JC-AP-45'),
  ('Drywall','Finishing','Lightweight Joint Compound 4.5 Gal','Ready-mix low-shrink pail','pail','JC-LW-45'),
  ('Drywall','Finishing','20-Minute Setting Compound 18 lb','Setting-type powder','bag','SC-20-18'),
  ('Drywall','Finishing','Fiberglass Mesh Tape 300 ft','Self-adhesive joint tape','roll','MT-300'),
  ('Drywall','Finishing','Paper Joint Tape 500 ft','Creased paper tape','roll','PT-500'),
  ('Drywall','Trim & Fasteners','Metal Corner Bead 1-1/4 in x 8 ft','Galvanized outside corner','each','CB-M-8'),
  ('Drywall','Trim & Fasteners','Vinyl Corner Bead 10 ft','Rigid vinyl outside corner','each','CB-V-10'),
  ('Drywall','Trim & Fasteners','Coarse Drywall Screws 1-5/8 in 5 lb','Bugle-head screws','box','DS-158-5LB')
) AS x(vertical, category, name, description, unit, sku_hint)
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_items ci
  WHERE ci.tenant_id IS NULL AND ci.name = x.name
);

INSERT INTO catalog_vendor_prices (item_id, vendor_id, price, unit, qty_in_stock, stock_status, lead_time_days, source, as_of)
SELECT i.id, v.id, p.price, i.unit, p.qty_in_stock, p.stock_status, p.lead_time_days, 'reference', DATE '2026-08-21'
FROM (VALUES
    ('5/8 in Type X Drywall 4x12', 'The Home Depot', 21.48::numeric, 320::int, 'in_stock'::text, 0::int),
    ('5/8 in Type X Drywall 4x12', 'Lowe''s', 20.98, 280, 'in_stock', 0),
    ('5/8 in Type X Drywall 4x12', '84 Lumber', 19.25, 600, 'in_stock', 1),
    ('5/8 in Type X Drywall 4x8', 'The Home Depot', 15.98, 450, 'in_stock', 0),
    ('5/8 in Type X Drywall 4x8', 'Lowe''s', 15.48, 380, 'in_stock', 0),
    ('5/8 in Type X Drywall 4x8', '84 Lumber', 14.40, 750, 'in_stock', 1),
    ('1/2 in Lightweight Drywall 4x8', 'The Home Depot', 12.98, 600, 'in_stock', 0),
    ('1/2 in Lightweight Drywall 4x8', 'Lowe''s', 12.48, 520, 'in_stock', 0),
    ('1/2 in Lightweight Drywall 4x8', '84 Lumber', 11.90, 900, 'in_stock', 1),
    ('1/2 in Lightweight Drywall 4x12', 'The Home Depot', 18.97, 280, 'in_stock', 0),
    ('1/2 in Lightweight Drywall 4x12', 'Lowe''s', 18.48, 240, 'in_stock', 0),
    ('1/2 in Lightweight Drywall 4x12', '84 Lumber', 17.60, 500, 'in_stock', 1),
    ('All-Purpose Joint Compound 4.5 Gal', 'The Home Depot', 19.98, 160, 'in_stock', 0),
    ('All-Purpose Joint Compound 4.5 Gal', 'Lowe''s', 19.48, 140, 'in_stock', 0),
    ('All-Purpose Joint Compound 4.5 Gal', '84 Lumber', 18.25, 220, 'in_stock', 1),
    ('Lightweight Joint Compound 4.5 Gal', 'The Home Depot', 21.98, 130, 'in_stock', 0),
    ('Lightweight Joint Compound 4.5 Gal', 'Lowe''s', 21.48, 115, 'in_stock', 0),
    ('Lightweight Joint Compound 4.5 Gal', '84 Lumber', 20.10, 180, 'in_stock', 1),
    ('20-Minute Setting Compound 18 lb', 'The Home Depot', 15.97, 90, 'in_stock', 0),
    ('20-Minute Setting Compound 18 lb', 'Lowe''s', 15.48, 75, 'in_stock', 0),
    ('Fiberglass Mesh Tape 300 ft', 'The Home Depot', 6.98, 200, 'in_stock', 0),
    ('Fiberglass Mesh Tape 300 ft', 'Lowe''s', 6.78, 170, 'in_stock', 0),
    ('Fiberglass Mesh Tape 300 ft', '84 Lumber', 6.20, 300, 'in_stock', 1),
    ('Paper Joint Tape 500 ft', 'The Home Depot', 5.98, 220, 'in_stock', 0),
    ('Paper Joint Tape 500 ft', 'Lowe''s', 5.78, 190, 'in_stock', 0),
    ('Paper Joint Tape 500 ft', '84 Lumber', 5.30, 320, 'in_stock', 1),
    ('Metal Corner Bead 1-1/4 in x 8 ft', 'The Home Depot', 3.68, 350, 'in_stock', 0),
    ('Metal Corner Bead 1-1/4 in x 8 ft', 'Lowe''s', 3.58, 300, 'in_stock', 0),
    ('Metal Corner Bead 1-1/4 in x 8 ft', '84 Lumber', 3.15, 500, 'in_stock', 1),
    ('Vinyl Corner Bead 10 ft', 'The Home Depot', 4.28, 280, 'in_stock', 0),
    ('Vinyl Corner Bead 10 ft', 'Lowe''s', 4.18, 240, 'in_stock', 0),
    ('Vinyl Corner Bead 10 ft', '84 Lumber', 3.80, 420, 'in_stock', 1),
    ('Coarse Drywall Screws 1-5/8 in 5 lb', 'The Home Depot', 29.97, 85, 'in_stock', 0),
    ('Coarse Drywall Screws 1-5/8 in 5 lb', 'Lowe''s', 28.98, 70, 'in_stock', 0),
    ('Coarse Drywall Screws 1-5/8 in 5 lb', '84 Lumber', 26.50, 130, 'in_stock', 1)
) AS p(item_name, vendor_name, price, qty_in_stock, stock_status, lead_time_days)
JOIN catalog_items i ON i.tenant_id IS NULL AND i.name = p.item_name
JOIN catalog_vendors v ON v.tenant_id IS NULL AND v.name = p.vendor_name
ON CONFLICT (item_id, vendor_id) DO NOTHING;

-- ============================================================================
-- 9) ITEMS + PRICES — 'Paint' (12 items)
-- ============================================================================

INSERT INTO catalog_items (tenant_id, vertical, category, name, description, unit, sku_hint)
SELECT NULL::uuid, x.vertical, x.category, x.name, x.description, x.unit, x.sku_hint
FROM (VALUES
  ('Paint','Interior','Premium Interior Eggshell White Base 5 Gal','Scrubbable acrylic wall paint','pail','INT-EGG-5G'),
  ('Paint','Interior','Contractor Interior Flat White 5 Gal','Production-grade wall paint','pail','INT-FLAT-5G'),
  ('Paint','Interior','Ceiling Paint Flat White 5 Gal','Spatter-resistant ceiling paint','pail','CLG-FLAT-5G'),
  ('Paint','Interior','Interior Semi-Gloss White Base 1 Gal','Trim and door enamel','can','INT-SG-1G'),
  ('Paint','Primer','PVA Drywall Primer 5 Gal','New drywall sealer','pail','PRM-PVA-5G'),
  ('Paint','Primer','Multi-Surface Primer-Sealer 5 Gal','Stain-blocking bonding primer','pail','PRM-MS-5G'),
  ('Paint','Primer','Stain-Blocking Shellac Primer 1 Gal','Interior shellac-base primer','can','PRM-SHL-1G'),
  ('Paint','Exterior','Exterior Satin Acrylic White Base 5 Gal','All-climate exterior paint','pail','EXT-SAT-5G'),
  ('Paint','Exterior','Exterior Flat Acrylic 1 Gal','Exterior masonry and siding','can','EXT-FLAT-1G'),
  ('Paint','Sundries','Painters Tape 1.88 in - 6-Pack','Medium-adhesion masking tape','pack','TAPE-188-6PK'),
  ('Paint','Sundries','9 in Roller Covers 3/8 in Nap - 6-Pack','Woven roller covers','pack','RC-9-38-6PK'),
  ('Paint','Sundries','Painters Acrylic Caulk 10 oz - 12-Pack','Paintable latex caulk','pack','CAULK-PA-12PK')
) AS x(vertical, category, name, description, unit, sku_hint)
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_items ci
  WHERE ci.tenant_id IS NULL AND ci.name = x.name
);

INSERT INTO catalog_vendor_prices (item_id, vendor_id, price, unit, qty_in_stock, stock_status, lead_time_days, source, as_of)
SELECT i.id, v.id, p.price, i.unit, p.qty_in_stock, p.stock_status, p.lead_time_days, 'reference', DATE '2026-08-21'
FROM (VALUES
    ('Premium Interior Eggshell White Base 5 Gal', 'The Home Depot', 168.00::numeric, 40::int, 'in_stock'::text, 0::int),
    ('Premium Interior Eggshell White Base 5 Gal', 'Lowe''s', 172.00, 35, 'in_stock', 0),
    ('Premium Interior Eggshell White Base 5 Gal', 'Grainger', 189.00, 20, 'in_stock', 2),
    ('Contractor Interior Flat White 5 Gal', 'The Home Depot', 98.97, 60, 'in_stock', 0),
    ('Contractor Interior Flat White 5 Gal', 'Lowe''s', 96.48, 52, 'in_stock', 0),
    ('Ceiling Paint Flat White 5 Gal', 'The Home Depot', 108.97, 35, 'in_stock', 0),
    ('Ceiling Paint Flat White 5 Gal', 'Lowe''s', 105.98, 30, 'in_stock', 0),
    ('Ceiling Paint Flat White 5 Gal', 'Grainger', 122.00, 15, 'in_stock', 2),
    ('Interior Semi-Gloss White Base 1 Gal', 'The Home Depot', 43.98, 90, 'in_stock', 0),
    ('Interior Semi-Gloss White Base 1 Gal', 'Lowe''s', 44.48, 80, 'in_stock', 0),
    ('Interior Semi-Gloss White Base 1 Gal', 'Grainger', 49.50, 40, 'in_stock', 2),
    ('PVA Drywall Primer 5 Gal', 'The Home Depot', 72.98, 45, 'in_stock', 0),
    ('PVA Drywall Primer 5 Gal', 'Lowe''s', 71.48, 40, 'in_stock', 0),
    ('PVA Drywall Primer 5 Gal', 'Grainger', 84.90, 18, 'in_stock', 2),
    ('Multi-Surface Primer-Sealer 5 Gal', 'The Home Depot', 118.97, 30, 'in_stock', 0),
    ('Multi-Surface Primer-Sealer 5 Gal', 'Lowe''s', 116.98, 26, 'in_stock', 0),
    ('Multi-Surface Primer-Sealer 5 Gal', 'Grainger', 129.50, 12, 'in_stock', 2),
    ('Stain-Blocking Shellac Primer 1 Gal', 'The Home Depot', 62.98, 50, 'in_stock', 0),
    ('Stain-Blocking Shellac Primer 1 Gal', 'Lowe''s', 61.48, 42, 'in_stock', 0),
    ('Exterior Satin Acrylic White Base 5 Gal', 'The Home Depot', 198.00, 25, 'in_stock', 0),
    ('Exterior Satin Acrylic White Base 5 Gal', 'Lowe''s', 205.00, 22, 'in_stock', 0),
    ('Exterior Satin Acrylic White Base 5 Gal', 'Grainger', 224.00, 10, 'in_stock', 2),
    ('Exterior Flat Acrylic 1 Gal', 'The Home Depot', 42.98, 70, 'in_stock', 0),
    ('Exterior Flat Acrylic 1 Gal', 'Lowe''s', 41.98, 60, 'in_stock', 0),
    ('Painters Tape 1.88 in - 6-Pack', 'The Home Depot', 34.97, 110, 'in_stock', 0),
    ('Painters Tape 1.88 in - 6-Pack', 'Lowe''s', 33.98, 95, 'in_stock', 0),
    ('Painters Tape 1.88 in - 6-Pack', 'Grainger', 31.20, 200, 'in_stock', 1),
    ('9 in Roller Covers 3/8 in Nap - 6-Pack', 'The Home Depot', 18.97, 130, 'in_stock', 0),
    ('9 in Roller Covers 3/8 in Nap - 6-Pack', 'Lowe''s', 18.48, 115, 'in_stock', 0),
    ('9 in Roller Covers 3/8 in Nap - 6-Pack', 'Grainger', 16.90, 250, 'in_stock', 1),
    ('Painters Acrylic Caulk 10 oz - 12-Pack', 'The Home Depot', 32.97, 75, 'in_stock', 0),
    ('Painters Acrylic Caulk 10 oz - 12-Pack', 'Lowe''s', 31.98, 65, 'in_stock', 0),
    ('Painters Acrylic Caulk 10 oz - 12-Pack', 'Grainger', 29.40, 140, 'in_stock', 1)
) AS p(item_name, vendor_name, price, qty_in_stock, stock_status, lead_time_days)
JOIN catalog_items i ON i.tenant_id IS NULL AND i.name = p.item_name
JOIN catalog_vendors v ON v.tenant_id IS NULL AND v.name = p.vendor_name
ON CONFLICT (item_id, vendor_id) DO NOTHING;

-- ============================================================================
-- 10) ITEMS + PRICES — 'Framing & Lumber' (18 items)
-- ============================================================================

INSERT INTO catalog_items (tenant_id, vertical, category, name, description, unit, sku_hint)
SELECT NULL::uuid, x.vertical, x.category, x.name, x.description, x.unit, x.sku_hint
FROM (VALUES
  ('Framing & Lumber','Dimensional Lumber','2x4x8 KD SPF Stud','Kiln-dried stud grade','each','244-8-KD'),
  ('Framing & Lumber','Dimensional Lumber','2x4x92-5/8 Precut Stud','Kiln-dried precut stud','each','244-925-KD'),
  ('Framing & Lumber','Dimensional Lumber','2x6x8 KD SPF','Kiln-dried number 2 grade','each','266-8-KD'),
  ('Framing & Lumber','Dimensional Lumber','2x6x10 KD SPF','Kiln-dried number 2 grade','each','266-10-KD'),
  ('Framing & Lumber','Dimensional Lumber','2x8x12 KD SPF Number 2','Kiln-dried number 2 grade','each','288-12-KD'),
  ('Framing & Lumber','Dimensional Lumber','2x10x12 KD SPF Number 2','Kiln-dried number 2 grade','each','2100-12-KD'),
  ('Framing & Lumber','Sheathing','7/16 in OSB Sheathing 4x8','APA-rated wall and roof panel','sheet','OSB-716-48'),
  ('Framing & Lumber','Sheathing','15/32 in CDX Plywood 4x8','Exterior-glue sheathing','sheet','CDX-1532-48'),
  ('Framing & Lumber','Sheathing','3/4 in CDX Plywood 4x8','Exterior-glue subfloor panel','sheet','CDX-34-48'),
  ('Framing & Lumber','Engineered Lumber','1-3/4 in x 11-7/8 in LVL Beam','Laminated veneer lumber per foot','lf','LVL-134-1178'),
  ('Framing & Lumber','Connectors & Fasteners','Simpson LUS26 Joist Hanger 2x6','Face-mount joist hanger','each','LUS26'),
  ('Framing & Lumber','Connectors & Fasteners','Simpson LUS210 Joist Hanger 2x10','Face-mount joist hanger','each','LUS210'),
  ('Framing & Lumber','Connectors & Fasteners','Simpson H2.5A Hurricane Tie','Truss and rafter tie','each','H2.5A'),
  ('Framing & Lumber','Connectors & Fasteners','Simpson DTT2Z Deck Tension Tie','ZMAX lateral-load connector','each','DTT2Z'),
  ('Framing & Lumber','Connectors & Fasteners','SDS 1/4 in x 3 in Structural Screws - 100-Count','Heavy-duty connector screws','box','SDS25300-R100'),
  ('Framing & Lumber','Connectors & Fasteners','21 Degree Framing Nails 3 in x .131 - 4000-Count','Plastic-collated full round head','box','FN-21-3-4000'),
  ('Framing & Lumber','Adhesives & Accessories','Construction Adhesive 28 oz','Heavy-duty subfloor adhesive','each','CA-28OZ'),
  ('Framing & Lumber','Adhesives & Accessories','Sill Seal Foam 5-1/2 in x 50 ft','Foam sill gasket roll','roll','SS-55-50')
) AS x(vertical, category, name, description, unit, sku_hint)
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_items ci
  WHERE ci.tenant_id IS NULL AND ci.name = x.name
);

INSERT INTO catalog_vendor_prices (item_id, vendor_id, price, unit, qty_in_stock, stock_status, lead_time_days, source, as_of)
SELECT i.id, v.id, p.price, i.unit, p.qty_in_stock, p.stock_status, p.lead_time_days, 'reference', DATE '2026-08-21'
FROM (VALUES
    ('2x4x8 KD SPF Stud', 'The Home Depot', 3.98::numeric, 2200::int, 'in_stock'::text, 0::int),
    ('2x4x8 KD SPF Stud', 'Lowe''s', 3.92, 1900, 'in_stock', 0),
    ('2x4x8 KD SPF Stud', '84 Lumber', 3.65, 5000, 'in_stock', 1),
    ('2x4x92-5/8 Precut Stud', 'The Home Depot', 3.78, 2600, 'in_stock', 0),
    ('2x4x92-5/8 Precut Stud', 'Lowe''s', 3.72, 2200, 'in_stock', 0),
    ('2x4x92-5/8 Precut Stud', '84 Lumber', 3.45, 6000, 'in_stock', 1),
    ('2x6x8 KD SPF', 'The Home Depot', 6.55, 1400, 'in_stock', 0),
    ('2x6x8 KD SPF', 'Lowe''s', 6.48, 1200, 'in_stock', 0),
    ('2x6x8 KD SPF', '84 Lumber', 6.05, 3200, 'in_stock', 1),
    ('2x6x10 KD SPF', 'The Home Depot', 8.92, 1100, 'in_stock', 0),
    ('2x6x10 KD SPF', 'Lowe''s', 8.85, 950, 'in_stock', 0),
    ('2x6x10 KD SPF', '84 Lumber', 8.25, 2600, 'in_stock', 1),
    ('2x8x12 KD SPF Number 2', 'The Home Depot', 14.85, 600, 'in_stock', 0),
    ('2x8x12 KD SPF Number 2', 'Lowe''s', 14.65, 520, 'in_stock', 0),
    ('2x8x12 KD SPF Number 2', '84 Lumber', 13.70, 1500, 'in_stock', 1),
    ('2x10x12 KD SPF Number 2', 'The Home Depot', 21.45, 420, 'in_stock', 0),
    ('2x10x12 KD SPF Number 2', 'Lowe''s', 21.25, 380, 'in_stock', 0),
    ('2x10x12 KD SPF Number 2', '84 Lumber', 19.80, 1100, 'in_stock', 1),
    ('7/16 in OSB Sheathing 4x8', 'The Home Depot', 14.97, 1800, 'in_stock', 0),
    ('7/16 in OSB Sheathing 4x8', 'Lowe''s', 14.65, 1500, 'in_stock', 0),
    ('7/16 in OSB Sheathing 4x8', '84 Lumber', 13.85, 4000, 'in_stock', 1),
    ('15/32 in CDX Plywood 4x8', 'The Home Depot', 36.98, 700, 'in_stock', 0),
    ('15/32 in CDX Plywood 4x8', 'Lowe''s', 36.45, 620, 'in_stock', 0),
    ('15/32 in CDX Plywood 4x8', '84 Lumber', 34.20, 1600, 'in_stock', 1),
    ('3/4 in CDX Plywood 4x8', 'The Home Depot', 52.98, 500, 'in_stock', 0),
    ('3/4 in CDX Plywood 4x8', 'Lowe''s', 52.25, 440, 'in_stock', 0),
    ('3/4 in CDX Plywood 4x8', '84 Lumber', 49.40, 1200, 'in_stock', 1),
    ('1-3/4 in x 11-7/8 in LVL Beam', '84 Lumber', 9.25, 2400, 'in_stock', 2),
    ('1-3/4 in x 11-7/8 in LVL Beam', 'White Cap', 8.85, 3000, 'in_stock', 2),
    ('1-3/4 in x 11-7/8 in LVL Beam', 'The Home Depot', 10.45, NULL, 'order', 7),
    ('Simpson LUS26 Joist Hanger 2x6', 'The Home Depot', 1.18, 900, 'in_stock', 0),
    ('Simpson LUS26 Joist Hanger 2x6', 'Fastenal', 1.05, 2500, 'in_stock', 1),
    ('Simpson LUS26 Joist Hanger 2x6', 'White Cap', 0.92, 4000, 'in_stock', 1),
    ('Simpson LUS26 Joist Hanger 2x6', '84 Lumber', 1.08, 1800, 'in_stock', 1),
    ('Simpson LUS210 Joist Hanger 2x10', 'The Home Depot', 2.28, 650, 'in_stock', 0),
    ('Simpson LUS210 Joist Hanger 2x10', 'White Cap', 1.85, 2800, 'in_stock', 1),
    ('Simpson LUS210 Joist Hanger 2x10', 'Fastenal', 2.05, 1600, 'in_stock', 1),
    ('Simpson H2.5A Hurricane Tie', 'The Home Depot', 0.88, 2400, 'in_stock', 0),
    ('Simpson H2.5A Hurricane Tie', 'Lowe''s', 0.86, 2000, 'in_stock', 0),
    ('Simpson H2.5A Hurricane Tie', 'White Cap', 0.62, 8000, 'in_stock', 1),
    ('Simpson H2.5A Hurricane Tie', 'Fastenal', 0.78, 5000, 'in_stock', 1),
    ('Simpson DTT2Z Deck Tension Tie', 'The Home Depot', 19.97, 120, 'in_stock', 0),
    ('Simpson DTT2Z Deck Tension Tie', 'Fastenal', 17.80, 400, 'in_stock', 1),
    ('Simpson DTT2Z Deck Tension Tie', 'White Cap', 16.40, 550, 'in_stock', 1),
    ('SDS 1/4 in x 3 in Structural Screws - 100-Count', 'Fastenal', 82.50, 90, 'in_stock', 1),
    ('SDS 1/4 in x 3 in Structural Screws - 100-Count', 'White Cap', 78.90, 120, 'in_stock', 1),
    ('SDS 1/4 in x 3 in Structural Screws - 100-Count', 'The Home Depot', 94.97, 30, 'in_stock', 0),
    ('21 Degree Framing Nails 3 in x .131 - 4000-Count', 'The Home Depot', 84.97, 60, 'in_stock', 0),
    ('21 Degree Framing Nails 3 in x .131 - 4000-Count', 'Lowe''s', 82.98, 50, 'in_stock', 0),
    ('21 Degree Framing Nails 3 in x .131 - 4000-Count', 'Fastenal', 76.50, 200, 'in_stock', 1),
    ('21 Degree Framing Nails 3 in x .131 - 4000-Count', 'White Cap', 74.20, 260, 'in_stock', 1),
    ('Construction Adhesive 28 oz', 'The Home Depot', 8.48, 300, 'in_stock', 0),
    ('Construction Adhesive 28 oz', 'Lowe''s', 8.28, 260, 'in_stock', 0),
    ('Construction Adhesive 28 oz', '84 Lumber', 7.60, 500, 'in_stock', 1),
    ('Construction Adhesive 28 oz', 'Fastenal', 7.90, 400, 'in_stock', 1),
    ('Sill Seal Foam 5-1/2 in x 50 ft', 'The Home Depot', 11.98, 140, 'in_stock', 0),
    ('Sill Seal Foam 5-1/2 in x 50 ft', 'Lowe''s', 11.48, 120, 'in_stock', 0),
    ('Sill Seal Foam 5-1/2 in x 50 ft', '84 Lumber', 10.40, 260, 'in_stock', 1)
) AS p(item_name, vendor_name, price, qty_in_stock, stock_status, lead_time_days)
JOIN catalog_items i ON i.tenant_id IS NULL AND i.name = p.item_name
JOIN catalog_vendors v ON v.tenant_id IS NULL AND v.name = p.vendor_name
ON CONFLICT (item_id, vendor_id) DO NOTHING;

-- ============================================================================
-- 11) ITEMS + PRICES — 'Concrete' (12 items)
-- ============================================================================

INSERT INTO catalog_items (tenant_id, vertical, category, name, description, unit, sku_hint)
SELECT NULL::uuid, x.vertical, x.category, x.name, x.description, x.unit, x.sku_hint
FROM (VALUES
  ('Concrete','Mixes','Quikrete Concrete Mix 80 lb','4000 PSI general-purpose mix','bag','QK-1101-80'),
  ('Concrete','Mixes','Quikrete 5000 High Early Strength 80 lb','5000 PSI commercial mix','bag','QK-1007-80'),
  ('Concrete','Mixes','Quikrete Fast-Setting Mix 50 lb','Sets in 20-40 minutes','bag','QK-1004-50'),
  ('Concrete','Reinforcement','Rebar Number 3 x 10 ft Grade 40','3/8 in deformed bar','each','RB-3-10'),
  ('Concrete','Reinforcement','Rebar Number 4 x 20 ft Grade 60','1/2 in deformed bar','each','RB-4-20'),
  ('Concrete','Reinforcement','Remesh Sheet 42 in x 84 in','Welded wire reinforcement sheet','sheet','WWR-4284'),
  ('Concrete','Reinforcement','Welded Wire Mesh Roll 5 ft x 150 ft','6x6 W1.4 reinforcement roll','roll','WWM-5150'),
  ('Concrete','Reinforcement','Rebar Tie Wire 16 Ga 3.5 lb','Annealed tie wire roll','roll','TW-16-35'),
  ('Concrete','Curing & Sealing','Acrylic Cure and Seal 1 Gal','Membrane-forming cure and seal','each','CS-ACR-1G'),
  ('Concrete','Curing & Sealing','Acrylic Cure and Seal 5 Gal','Membrane-forming cure and seal','pail','CS-ACR-5G'),
  ('Concrete','Forming & Anchors','Anchor J-Bolt 1/2 in x 8 in - 50-Pack','Cast-in-place anchor bolts','pack','JB-1258-50'),
  ('Concrete','Forming & Anchors','Concrete Form Tube 12 in x 4 ft','Fiber footing form tube','each','FT-12-48')
) AS x(vertical, category, name, description, unit, sku_hint)
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_items ci
  WHERE ci.tenant_id IS NULL AND ci.name = x.name
);

INSERT INTO catalog_vendor_prices (item_id, vendor_id, price, unit, qty_in_stock, stock_status, lead_time_days, source, as_of)
SELECT i.id, v.id, p.price, i.unit, p.qty_in_stock, p.stock_status, p.lead_time_days, 'reference', DATE '2026-08-21'
FROM (VALUES
    ('Quikrete Concrete Mix 80 lb', 'The Home Depot', 6.98::numeric, 1200::int, 'in_stock'::text, 0::int),
    ('Quikrete Concrete Mix 80 lb', 'Lowe''s', 6.85, 1000, 'in_stock', 0),
    ('Quikrete Concrete Mix 80 lb', 'White Cap', 6.25, 3000, 'in_stock', 1),
    ('Quikrete 5000 High Early Strength 80 lb', 'The Home Depot', 8.98, 800, 'in_stock', 0),
    ('Quikrete 5000 High Early Strength 80 lb', 'Lowe''s', 8.85, 700, 'in_stock', 0),
    ('Quikrete 5000 High Early Strength 80 lb', 'White Cap', 8.10, 2200, 'in_stock', 1),
    ('Quikrete Fast-Setting Mix 50 lb', 'The Home Depot', 7.98, 900, 'in_stock', 0),
    ('Quikrete Fast-Setting Mix 50 lb', 'Lowe''s', 7.85, 780, 'in_stock', 0),
    ('Quikrete Fast-Setting Mix 50 lb', 'White Cap', 7.20, 1800, 'in_stock', 1),
    ('Rebar Number 3 x 10 ft Grade 40', 'The Home Depot', 6.48, 600, 'in_stock', 0),
    ('Rebar Number 3 x 10 ft Grade 40', 'Lowe''s', 6.38, 520, 'in_stock', 0),
    ('Rebar Number 3 x 10 ft Grade 40', 'White Cap', 5.40, 5000, 'in_stock', 1),
    ('Rebar Number 4 x 20 ft Grade 60', 'The Home Depot', 15.97, 350, 'in_stock', 0),
    ('Rebar Number 4 x 20 ft Grade 60', 'White Cap', 12.80, 4000, 'in_stock', 1),
    ('Rebar Number 4 x 20 ft Grade 60', 'Fastenal', 14.50, 900, 'in_stock', 1),
    ('Remesh Sheet 42 in x 84 in', 'The Home Depot', 10.98, 400, 'in_stock', 0),
    ('Remesh Sheet 42 in x 84 in', 'Lowe''s', 10.78, 350, 'in_stock', 0),
    ('Remesh Sheet 42 in x 84 in', 'White Cap', 9.20, 1500, 'in_stock', 1),
    ('Welded Wire Mesh Roll 5 ft x 150 ft', 'White Cap', 128.50, 90, 'in_stock', 1),
    ('Welded Wire Mesh Roll 5 ft x 150 ft', 'The Home Depot', 154.97, 20, 'in_stock', 0),
    ('Welded Wire Mesh Roll 5 ft x 150 ft', 'Fastenal', 142.90, 45, 'in_stock', 2),
    ('Rebar Tie Wire 16 Ga 3.5 lb', 'The Home Depot', 9.48, 250, 'in_stock', 0),
    ('Rebar Tie Wire 16 Ga 3.5 lb', 'White Cap', 7.90, 1200, 'in_stock', 1),
    ('Rebar Tie Wire 16 Ga 3.5 lb', 'Fastenal', 8.60, 600, 'in_stock', 1),
    ('Acrylic Cure and Seal 1 Gal', 'The Home Depot', 32.98, 60, 'in_stock', 0),
    ('Acrylic Cure and Seal 1 Gal', 'White Cap', 27.50, 200, 'in_stock', 1),
    ('Acrylic Cure and Seal 1 Gal', 'Lowe''s', 31.98, 50, 'in_stock', 0),
    ('Acrylic Cure and Seal 5 Gal', 'White Cap', 118.90, 80, 'in_stock', 1),
    ('Acrylic Cure and Seal 5 Gal', 'The Home Depot', 142.97, 15, 'in_stock', 0),
    ('Acrylic Cure and Seal 5 Gal', 'Fastenal', 132.50, 30, 'in_stock', 2),
    ('Anchor J-Bolt 1/2 in x 8 in - 50-Pack', 'White Cap', 62.50, 150, 'in_stock', 1),
    ('Anchor J-Bolt 1/2 in x 8 in - 50-Pack', 'Fastenal', 68.90, 90, 'in_stock', 1),
    ('Anchor J-Bolt 1/2 in x 8 in - 50-Pack', 'The Home Depot', 84.97, 25, 'in_stock', 0),
    ('Concrete Form Tube 12 in x 4 ft', 'The Home Depot', 16.98, 120, 'in_stock', 0),
    ('Concrete Form Tube 12 in x 4 ft', 'Lowe''s', 16.48, 100, 'in_stock', 0),
    ('Concrete Form Tube 12 in x 4 ft', 'White Cap', 14.20, 400, 'in_stock', 1)
) AS p(item_name, vendor_name, price, qty_in_stock, stock_status, lead_time_days)
JOIN catalog_items i ON i.tenant_id IS NULL AND i.name = p.item_name
JOIN catalog_vendors v ON v.tenant_id IS NULL AND v.name = p.vendor_name
ON CONFLICT (item_id, vendor_id) DO NOTHING;

-- ============================================================================
-- 12) ITEMS + PRICES — 'Roofing' (12 items)
-- ============================================================================

INSERT INTO catalog_items (tenant_id, vertical, category, name, description, unit, sku_hint)
SELECT NULL::uuid, x.vertical, x.category, x.name, x.description, x.unit, x.sku_hint
FROM (VALUES
  ('Roofing','Shingles','Architectural Shingles Charcoal','Laminated shingles 33.3 sq ft per bundle','bundle','ARCH-CHAR-BDL'),
  ('Roofing','Shingles','3-Tab Shingles Weathered Gray','Strip shingles 33.3 sq ft per bundle','bundle','3TAB-WG-BDL'),
  ('Roofing','Shingles','Hip and Ridge Cap Shingles','33 lf per bundle','bundle','RIDGE-BDL'),
  ('Roofing','Shingles','Starter Strip Shingles','105 lf per bundle','bundle','STARTER-BDL'),
  ('Roofing','Underlayment','Synthetic Roof Underlayment 10 Sq Roll','Slip-resistant synthetic felt','roll','SYN-UL-10SQ'),
  ('Roofing','Underlayment','Ice and Water Shield 2 Sq Roll','Self-adhering membrane','roll','IWS-2SQ'),
  ('Roofing','Flashing & Edge','Aluminum Drip Edge 2 in x 10 ft White','Style D eave edge','each','DE-2-10-WH'),
  ('Roofing','Flashing & Edge','Pipe Boot Flashing 1-1/2 to 3 in','Adjustable neoprene boot','each','PB-153'),
  ('Roofing','Flashing & Edge','Step Flashing 4x4x8 in - 100-Pack','Aluminum step shingle flashing','box','SF-448-100'),
  ('Roofing','Accessories','Coil Roofing Nails 1-1/4 in - 7200-Count','Electro-galvanized coil nails','box','CRN-114-7200'),
  ('Roofing','Accessories','Plastic Cement Flashing Sealant 1 Gal','Asphalt roof cement','each','PC-1G'),
  ('Roofing','Accessories','Ridge Vent 4 ft Shingle-Over','Baffled ridge ventilation','each','RV-4FT')
) AS x(vertical, category, name, description, unit, sku_hint)
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_items ci
  WHERE ci.tenant_id IS NULL AND ci.name = x.name
);

INSERT INTO catalog_vendor_prices (item_id, vendor_id, price, unit, qty_in_stock, stock_status, lead_time_days, source, as_of)
SELECT i.id, v.id, p.price, i.unit, p.qty_in_stock, p.stock_status, p.lead_time_days, 'reference', DATE '2026-08-21'
FROM (VALUES
    ('Architectural Shingles Charcoal', 'The Home Depot', 42.97::numeric, 600::int, 'in_stock'::text, 0::int),
    ('Architectural Shingles Charcoal', 'Lowe''s', 41.98, 520, 'in_stock', 0),
    ('Architectural Shingles Charcoal', 'ABC Supply', 38.50, 2400, 'in_stock', 1),
    ('Architectural Shingles Charcoal', '84 Lumber', 39.90, 900, 'in_stock', 1),
    ('3-Tab Shingles Weathered Gray', 'The Home Depot', 36.97, 400, 'in_stock', 0),
    ('3-Tab Shingles Weathered Gray', 'Lowe''s', 35.98, 350, 'in_stock', 0),
    ('3-Tab Shingles Weathered Gray', 'ABC Supply', 32.40, 1800, 'in_stock', 1),
    ('Hip and Ridge Cap Shingles', 'The Home Depot', 58.97, 150, 'in_stock', 0),
    ('Hip and Ridge Cap Shingles', 'ABC Supply', 51.20, 700, 'in_stock', 1),
    ('Hip and Ridge Cap Shingles', 'Lowe''s', 57.48, 130, 'in_stock', 0),
    ('Starter Strip Shingles', 'The Home Depot', 47.98, 180, 'in_stock', 0),
    ('Starter Strip Shingles', 'ABC Supply', 42.50, 800, 'in_stock', 1),
    ('Starter Strip Shingles', '84 Lumber', 44.90, 300, 'in_stock', 1),
    ('Synthetic Roof Underlayment 10 Sq Roll', 'The Home Depot', 94.98, 80, 'in_stock', 0),
    ('Synthetic Roof Underlayment 10 Sq Roll', 'ABC Supply', 82.50, 400, 'in_stock', 1),
    ('Synthetic Roof Underlayment 10 Sq Roll', '84 Lumber', 88.90, 150, 'in_stock', 1),
    ('Ice and Water Shield 2 Sq Roll', 'The Home Depot', 108.97, 60, 'in_stock', 0),
    ('Ice and Water Shield 2 Sq Roll', 'Lowe''s', 106.48, 50, 'in_stock', 0),
    ('Ice and Water Shield 2 Sq Roll', 'ABC Supply', 94.50, 320, 'in_stock', 1),
    ('Aluminum Drip Edge 2 in x 10 ft White', 'The Home Depot', 10.48, 500, 'in_stock', 0),
    ('Aluminum Drip Edge 2 in x 10 ft White', 'Lowe''s', 10.28, 420, 'in_stock', 0),
    ('Aluminum Drip Edge 2 in x 10 ft White', 'ABC Supply', 8.40, 2000, 'in_stock', 1),
    ('Aluminum Drip Edge 2 in x 10 ft White', '84 Lumber', 9.20, 800, 'in_stock', 1),
    ('Pipe Boot Flashing 1-1/2 to 3 in', 'The Home Depot', 13.48, 200, 'in_stock', 0),
    ('Pipe Boot Flashing 1-1/2 to 3 in', 'Lowe''s', 13.18, 170, 'in_stock', 0),
    ('Pipe Boot Flashing 1-1/2 to 3 in', 'ABC Supply', 10.90, 900, 'in_stock', 1),
    ('Step Flashing 4x4x8 in - 100-Pack', 'ABC Supply', 58.90, 250, 'in_stock', 1),
    ('Step Flashing 4x4x8 in - 100-Pack', 'The Home Depot', 72.97, 40, 'in_stock', 0),
    ('Step Flashing 4x4x8 in - 100-Pack', '84 Lumber', 64.50, 90, 'in_stock', 1),
    ('Coil Roofing Nails 1-1/4 in - 7200-Count', 'The Home Depot', 68.97, 90, 'in_stock', 0),
    ('Coil Roofing Nails 1-1/4 in - 7200-Count', 'ABC Supply', 61.50, 400, 'in_stock', 1),
    ('Coil Roofing Nails 1-1/4 in - 7200-Count', '84 Lumber', 64.20, 160, 'in_stock', 1),
    ('Plastic Cement Flashing Sealant 1 Gal', 'The Home Depot', 15.98, 130, 'in_stock', 0),
    ('Plastic Cement Flashing Sealant 1 Gal', 'Lowe''s', 15.48, 110, 'in_stock', 0),
    ('Plastic Cement Flashing Sealant 1 Gal', 'ABC Supply', 13.20, 500, 'in_stock', 1),
    ('Ridge Vent 4 ft Shingle-Over', 'The Home Depot', 13.97, 220, 'in_stock', 0),
    ('Ridge Vent 4 ft Shingle-Over', 'ABC Supply', 11.80, 800, 'in_stock', 1),
    ('Ridge Vent 4 ft Shingle-Over', '84 Lumber', 12.60, 300, 'in_stock', 1)
) AS p(item_name, vendor_name, price, qty_in_stock, stock_status, lead_time_days)
JOIN catalog_items i ON i.tenant_id IS NULL AND i.name = p.item_name
JOIN catalog_vendors v ON v.tenant_id IS NULL AND v.name = p.vendor_name
ON CONFLICT (item_id, vendor_id) DO NOTHING;

-- ============================================================================
-- 13) ITEMS + PRICES — 'Doors & Windows' (12 items)
-- ============================================================================

INSERT INTO catalog_items (tenant_id, vertical, category, name, description, unit, sku_hint)
SELECT NULL::uuid, x.vertical, x.category, x.name, x.description, x.unit, x.sku_hint
FROM (VALUES
  ('Doors & Windows','Interior Doors','Prehung Interior Door 30x80 6-Panel Hollow Core','Primed jamb and door unit','each','PID-3080-6P'),
  ('Doors & Windows','Interior Doors','Prehung Interior Door 32x80 2-Panel Shaker Solid Core','Primed jamb and door unit','each','PID-3280-SHK'),
  ('Doors & Windows','Exterior Doors','Prehung Steel Entry Door 36x80 6-Panel','Insulated steel unit with brickmold','each','PED-3680-STL'),
  ('Doors & Windows','Exterior Doors','Prehung Fiberglass Entry Door 36x80 Craftsman','Insulated fiberglass with lite','each','PED-3680-FG'),
  ('Doors & Windows','Windows','Vinyl Single-Hung Window 24x36 Low-E','Insulated dual-pane new construction','each','VSH-2436'),
  ('Doors & Windows','Windows','Vinyl Single-Hung Window 36x48 Low-E','Insulated dual-pane new construction','each','VSH-3648'),
  ('Doors & Windows','Windows','Vinyl Single-Hung Window 36x60 Low-E','Insulated dual-pane new construction','each','VSH-3660'),
  ('Doors & Windows','Exterior Doors','Vinyl Sliding Patio Door 72x80','Dual-pane slider with screen','each','VSPD-7280'),
  ('Doors & Windows','Hardware & Accessories','Entry Knob and Single-Cylinder Deadbolt Combo','Keyed-alike satin nickel set','each','KNB-DB-SN'),
  ('Doors & Windows','Hardware & Accessories','Door Shims - 12-Pack','Tapered wood shims','pack','SHIM-12PK'),
  ('Doors & Windows','Hardware & Accessories','Window Flashing Tape 4 in x 75 ft','Self-adhering butyl flashing','roll','WFT-4-75'),
  ('Doors & Windows','Hardware & Accessories','Exterior Door Threshold 36 in Adjustable','Aluminum sill with oak cap','each','THR-36-ADJ')
) AS x(vertical, category, name, description, unit, sku_hint)
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_items ci
  WHERE ci.tenant_id IS NULL AND ci.name = x.name
);

INSERT INTO catalog_vendor_prices (item_id, vendor_id, price, unit, qty_in_stock, stock_status, lead_time_days, source, as_of)
SELECT i.id, v.id, p.price, i.unit, p.qty_in_stock, p.stock_status, p.lead_time_days, 'reference', DATE '2026-08-21'
FROM (VALUES
    ('Prehung Interior Door 30x80 6-Panel Hollow Core', 'The Home Depot', 148.97::numeric, 25::int, 'in_stock'::text, 0::int),
    ('Prehung Interior Door 30x80 6-Panel Hollow Core', 'Lowe''s', 145.98, 22, 'in_stock', 0),
    ('Prehung Interior Door 30x80 6-Panel Hollow Core', '84 Lumber', 138.50, 60, 'in_stock', 2),
    ('Prehung Interior Door 32x80 2-Panel Shaker Solid Core', 'The Home Depot', 238.97, 12, 'in_stock', 0),
    ('Prehung Interior Door 32x80 2-Panel Shaker Solid Core', 'Lowe''s', 235.48, 10, 'in_stock', 0),
    ('Prehung Interior Door 32x80 2-Panel Shaker Solid Core', '84 Lumber', 222.90, 35, 'in_stock', 2),
    ('Prehung Steel Entry Door 36x80 6-Panel', 'The Home Depot', 328.00, 8, 'in_stock', 0),
    ('Prehung Steel Entry Door 36x80 6-Panel', 'Lowe''s', 322.00, 7, 'in_stock', 0),
    ('Prehung Steel Entry Door 36x80 6-Panel', '84 Lumber', 305.00, 20, 'in_stock', 2),
    ('Prehung Steel Entry Door 36x80 6-Panel', 'ABC Supply', 298.50, 30, 'in_stock', 2),
    ('Prehung Fiberglass Entry Door 36x80 Craftsman', 'The Home Depot', 478.00, 5, 'in_stock', 0),
    ('Prehung Fiberglass Entry Door 36x80 Craftsman', 'Lowe''s', 469.00, 4, 'limited', 0),
    ('Prehung Fiberglass Entry Door 36x80 Craftsman', '84 Lumber', 445.00, NULL, 'order', 7),
    ('Vinyl Single-Hung Window 24x36 Low-E', 'The Home Depot', 152.97, 18, 'in_stock', 0),
    ('Vinyl Single-Hung Window 24x36 Low-E', 'Lowe''s', 149.98, 15, 'in_stock', 0),
    ('Vinyl Single-Hung Window 24x36 Low-E', 'ABC Supply', 138.40, 60, 'in_stock', 2),
    ('Vinyl Single-Hung Window 36x48 Low-E', 'The Home Depot', 198.97, 14, 'in_stock', 0),
    ('Vinyl Single-Hung Window 36x48 Low-E', 'Lowe''s', 195.48, 12, 'in_stock', 0),
    ('Vinyl Single-Hung Window 36x48 Low-E', 'ABC Supply', 178.90, 45, 'in_stock', 2),
    ('Vinyl Single-Hung Window 36x48 Low-E', '84 Lumber', 188.50, 25, 'in_stock', 2),
    ('Vinyl Single-Hung Window 36x60 Low-E', 'The Home Depot', 238.97, 10, 'in_stock', 0),
    ('Vinyl Single-Hung Window 36x60 Low-E', 'Lowe''s', 234.98, 9, 'in_stock', 0),
    ('Vinyl Single-Hung Window 36x60 Low-E', 'ABC Supply', 215.40, 35, 'in_stock', 2),
    ('Vinyl Sliding Patio Door 72x80', 'The Home Depot', 698.00, 4, 'in_stock', 0),
    ('Vinyl Sliding Patio Door 72x80', 'Lowe''s', 685.00, 3, 'limited', 0),
    ('Vinyl Sliding Patio Door 72x80', '84 Lumber', 652.00, NULL, 'order', 7),
    ('Entry Knob and Single-Cylinder Deadbolt Combo', 'The Home Depot', 49.98, 60, 'in_stock', 0),
    ('Entry Knob and Single-Cylinder Deadbolt Combo', 'Lowe''s', 48.48, 52, 'in_stock', 0),
    ('Door Shims - 12-Pack', 'The Home Depot', 4.48, 300, 'in_stock', 0),
    ('Door Shims - 12-Pack', 'Lowe''s', 4.38, 260, 'in_stock', 0),
    ('Door Shims - 12-Pack', '84 Lumber', 3.90, 500, 'in_stock', 1),
    ('Window Flashing Tape 4 in x 75 ft', 'The Home Depot', 24.97, 90, 'in_stock', 0),
    ('Window Flashing Tape 4 in x 75 ft', 'Lowe''s', 24.48, 80, 'in_stock', 0),
    ('Window Flashing Tape 4 in x 75 ft', 'ABC Supply', 21.50, 300, 'in_stock', 1),
    ('Window Flashing Tape 4 in x 75 ft', '84 Lumber', 22.80, 150, 'in_stock', 1),
    ('Exterior Door Threshold 36 in Adjustable', 'The Home Depot', 32.98, 45, 'in_stock', 0),
    ('Exterior Door Threshold 36 in Adjustable', 'Lowe''s', 32.48, 38, 'in_stock', 0),
    ('Exterior Door Threshold 36 in Adjustable', '84 Lumber', 29.90, 80, 'in_stock', 1)
) AS p(item_name, vendor_name, price, qty_in_stock, stock_status, lead_time_days)
JOIN catalog_items i ON i.tenant_id IS NULL AND i.name = p.item_name
JOIN catalog_vendors v ON v.tenant_id IS NULL AND v.name = p.vendor_name
ON CONFLICT (item_id, vendor_id) DO NOTHING;

-- ============================================================================
-- 14) ITEMS + PRICES — 'Insulation' (12 items)
-- ============================================================================

INSERT INTO catalog_items (tenant_id, vertical, category, name, description, unit, sku_hint)
SELECT NULL::uuid, x.vertical, x.category, x.name, x.description, x.unit, x.sku_hint
FROM (VALUES
  ('Insulation','Batts','R-13 Kraft-Faced Batts 15 in Bag','Covers about 106 sq ft','bag','R13-KF-15'),
  ('Insulation','Batts','R-13 Unfaced Batts 15 in Bag','Covers about 106 sq ft','bag','R13-UF-15'),
  ('Insulation','Batts','R-19 Kraft-Faced Batts 15 in Bag','Covers about 87 sq ft','bag','R19-KF-15'),
  ('Insulation','Batts','R-19 Unfaced Batts 23 in Bag','Covers about 133 sq ft','bag','R19-UF-23'),
  ('Insulation','Batts','R-30 Kraft-Faced Batts 23 in Bag','Covers about 58 sq ft','bag','R30-KF-23'),
  ('Insulation','Batts','Mineral Wool R-15 Batts 15.25 in Bag','Covers about 59.7 sq ft','bag','MW-R15-1525'),
  ('Insulation','Blown-In','Blown-In Fiberglass R-38 27.5 lb Bag','Loose-fill attic insulation','bag','BIF-R38-275'),
  ('Insulation','Foam Board','XPS Foam Board 2 in 4x8 R-10','Extruded polystyrene panel','sheet','XPS-2-48'),
  ('Insulation','Foam Board','XPS Foam Board 1 in 4x8 R-5','Extruded polystyrene panel','sheet','XPS-1-48'),
  ('Insulation','Foam Board','Polyiso Foam Board 2 in 4x8 R-13','Foil-faced polyiso panel','sheet','ISO-2-48'),
  ('Insulation','Sealants & Barriers','Gap-Filling Spray Foam 12 oz','Expanding polyurethane foam','each','SF-GAP-12'),
  ('Insulation','Sealants & Barriers','6-Mil Poly Vapor Barrier 10x100 ft','Clear polyethylene sheeting','roll','VB-6-10100')
) AS x(vertical, category, name, description, unit, sku_hint)
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_items ci
  WHERE ci.tenant_id IS NULL AND ci.name = x.name
);

INSERT INTO catalog_vendor_prices (item_id, vendor_id, price, unit, qty_in_stock, stock_status, lead_time_days, source, as_of)
SELECT i.id, v.id, p.price, i.unit, p.qty_in_stock, p.stock_status, p.lead_time_days, 'reference', DATE '2026-08-21'
FROM (VALUES
    ('R-13 Kraft-Faced Batts 15 in Bag', 'The Home Depot', 62.98::numeric, 90::int, 'in_stock'::text, 0::int),
    ('R-13 Kraft-Faced Batts 15 in Bag', 'Lowe''s', 61.48, 80, 'in_stock', 0),
    ('R-13 Kraft-Faced Batts 15 in Bag', '84 Lumber', 57.90, 150, 'in_stock', 1),
    ('R-13 Unfaced Batts 15 in Bag', 'The Home Depot', 59.98, 75, 'in_stock', 0),
    ('R-13 Unfaced Batts 15 in Bag', 'Lowe''s', 58.48, 65, 'in_stock', 0),
    ('R-13 Unfaced Batts 15 in Bag', '84 Lumber', 55.20, 130, 'in_stock', 1),
    ('R-19 Kraft-Faced Batts 15 in Bag', 'The Home Depot', 66.98, 70, 'in_stock', 0),
    ('R-19 Kraft-Faced Batts 15 in Bag', 'Lowe''s', 65.48, 60, 'in_stock', 0),
    ('R-19 Kraft-Faced Batts 15 in Bag', '84 Lumber', 61.40, 120, 'in_stock', 1),
    ('R-19 Unfaced Batts 23 in Bag', 'The Home Depot', 63.98, 65, 'in_stock', 0),
    ('R-19 Unfaced Batts 23 in Bag', 'Lowe''s', 62.48, 55, 'in_stock', 0),
    ('R-19 Unfaced Batts 23 in Bag', '84 Lumber', 58.90, 110, 'in_stock', 1),
    ('R-30 Kraft-Faced Batts 23 in Bag', 'The Home Depot', 74.97, 55, 'in_stock', 0),
    ('R-30 Kraft-Faced Batts 23 in Bag', 'Lowe''s', 73.48, 48, 'in_stock', 0),
    ('R-30 Kraft-Faced Batts 23 in Bag', '84 Lumber', 69.50, 95, 'in_stock', 1),
    ('Mineral Wool R-15 Batts 15.25 in Bag', 'The Home Depot', 79.98, 40, 'in_stock', 0),
    ('Mineral Wool R-15 Batts 15.25 in Bag', 'Lowe''s', 78.48, 35, 'in_stock', 0),
    ('Blown-In Fiberglass R-38 27.5 lb Bag', 'The Home Depot', 44.98, 200, 'in_stock', 0),
    ('Blown-In Fiberglass R-38 27.5 lb Bag', 'Lowe''s', 43.98, 170, 'in_stock', 0),
    ('Blown-In Fiberglass R-38 27.5 lb Bag', '84 Lumber', 41.20, 320, 'in_stock', 1),
    ('XPS Foam Board 2 in 4x8 R-10', 'The Home Depot', 46.98, 120, 'in_stock', 0),
    ('XPS Foam Board 2 in 4x8 R-10', 'Lowe''s', 45.98, 105, 'in_stock', 0),
    ('XPS Foam Board 2 in 4x8 R-10', '84 Lumber', 43.50, 200, 'in_stock', 1),
    ('XPS Foam Board 1 in 4x8 R-5', 'The Home Depot', 27.98, 150, 'in_stock', 0),
    ('XPS Foam Board 1 in 4x8 R-5', 'Lowe''s', 27.48, 130, 'in_stock', 0),
    ('XPS Foam Board 1 in 4x8 R-5', '84 Lumber', 25.90, 250, 'in_stock', 1),
    ('Polyiso Foam Board 2 in 4x8 R-13', 'The Home Depot', 44.97, 100, 'in_stock', 0),
    ('Polyiso Foam Board 2 in 4x8 R-13', 'Lowe''s', 43.98, 90, 'in_stock', 0),
    ('Polyiso Foam Board 2 in 4x8 R-13', '84 Lumber', 41.80, 180, 'in_stock', 1),
    ('Gap-Filling Spray Foam 12 oz', 'The Home Depot', 6.98, 400, 'in_stock', 0),
    ('Gap-Filling Spray Foam 12 oz', 'Lowe''s', 6.78, 350, 'in_stock', 0),
    ('Gap-Filling Spray Foam 12 oz', '84 Lumber', 6.20, 600, 'in_stock', 1),
    ('6-Mil Poly Vapor Barrier 10x100 ft', 'The Home Depot', 78.97, 50, 'in_stock', 0),
    ('6-Mil Poly Vapor Barrier 10x100 ft', 'Lowe''s', 77.48, 42, 'in_stock', 0),
    ('6-Mil Poly Vapor Barrier 10x100 ft', '84 Lumber', 72.50, 90, 'in_stock', 1)
) AS p(item_name, vendor_name, price, qty_in_stock, stock_status, lead_time_days)
JOIN catalog_items i ON i.tenant_id IS NULL AND i.name = p.item_name
JOIN catalog_vendors v ON v.tenant_id IS NULL AND v.name = p.vendor_name
ON CONFLICT (item_id, vendor_id) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-run sanity checks (read-only; uncomment to inspect)
-- ============================================================================
-- SELECT count(*) AS vendors FROM catalog_vendors WHERE tenant_id IS NULL;
-- SELECT vertical, count(*) AS items FROM catalog_items WHERE tenant_id IS NULL GROUP BY vertical ORDER BY vertical;
-- SELECT count(*) AS prices FROM catalog_vendor_prices p JOIN catalog_items i ON i.id = p.item_id WHERE i.tenant_id IS NULL;
-- Expected: 16 vendors, 223 items, 667 price rows (2-4 vendors per item).
