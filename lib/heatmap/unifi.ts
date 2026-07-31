/** Real Ubiquiti/UniFi device catalog — auto-compiled specs (editable per placement).
 *  Drives model-accurate coverage math + cabling/PoE budgets. Source: UniFi lineup research 2026-07. */

export interface UnifiAP { model: string; gen: string; bands: string[]; txDbm: Record<string, number>; gainDbi: number; poe: string; form: string; outdoor: boolean; note: string }
export interface UnifiCamera { model: string; mp: number; hpx: number; hfov: number; hfovRange: [number, number] | null; irFt: number; ptz: boolean; outdoor: boolean; ik?: string; priceUsd?: number; poe?: string; note: string }
export interface UnifiGateway { model: string; role: string; builtInAp: boolean; apTxDbm: number; poePorts: number; poeBudgetW: number; sfpPlus: number; lanPorts: number; runsProtect: boolean; note: string }
export interface UnifiSwitch { model: string; ports: number; poePorts: number; poeBudgetW: number; sfpPlus: number; priceUsd?: number; note: string }

export const UNIFI_APS: UnifiAP[] = [
  {
    "model": "UniFi U6 Lite",
    "gen": "6",
    "bands": [
      "2.4",
      "5"
    ],
    "txDbm": {
      "5": 23,
      "2.4": 23
    },
    "gainDbi": 3,
    "poe": "802.3af",
    "form": "ceiling",
    "outdoor": false,
    "note": "Per-band gain 2.4GHz 2.8 dBi / 5GHz 3 dBi. 2x2 MIMO both bands. Indoor ceiling/wall. PoE (44-57V, 802.3af class)."
  },
  {
    "model": "UniFi U6 LR (Long-Range)",
    "gen": "6",
    "bands": [
      "2.4",
      "5"
    ],
    "txDbm": {
      "5": 26,
      "2.4": 26
    },
    "gainDbi": 5.5,
    "poe": "802.3at",
    "form": "ceiling",
    "outdoor": true,
    "note": "Per-band gain 2.4GHz 4 dBi / 5GHz 5.5 dBi. High-power long-range 4x4(2.4)/4x4(5). IP54, ceiling/wall. PoE+."
  },
  {
    "model": "UniFi U6 Pro",
    "gen": "6",
    "bands": [
      "2.4",
      "5"
    ],
    "txDbm": {
      "5": 26,
      "2.4": 22
    },
    "gainDbi": 6,
    "poe": "802.3at",
    "form": "ceiling",
    "outdoor": false,
    "note": "Per-band gain 2.4GHz 4 dBi / 5GHz 6 dBi. 2x2(2.4)/4x4(5). Indoor ceiling/wall. PoE+."
  },
  {
    "model": "UniFi U6 Mesh",
    "gen": "6",
    "bands": [
      "2.4",
      "5"
    ],
    "txDbm": {
      "5": 26,
      "2.4": 22
    },
    "gainDbi": 5,
    "poe": "802.3af",
    "form": "mesh",
    "outdoor": true,
    "note": "Per-band gain 2.4GHz 3 dBi / 5GHz 5 dBi. IPX5 weatherproof, wall/pole/table mounts. Wireless mesh capable. PoE (802.3af)."
  },
  {
    "model": "UniFi U6 In-Wall (U6-IW)",
    "gen": "6",
    "bands": [
      "2.4",
      "5"
    ],
    "txDbm": {
      "5": 26,
      "2.4": 22
    },
    "gainDbi": 5.9,
    "poe": "802.3at",
    "form": "in-wall",
    "outdoor": false,
    "note": "Per-band gain 2.4GHz 5 dBi / 5GHz 5.9 dBi. Wall-plate form; 4x GbE downlinks with PoE passthrough (PoE+ input required for output). Indoor."
  },
  {
    "model": "UniFi U6 Enterprise",
    "gen": "6E",
    "bands": [
      "2.4",
      "5",
      "6"
    ],
    "txDbm": {
      "5": 26,
      "6": 26,
      "2.4": 22
    },
    "gainDbi": 6,
    "poe": "802.3at",
    "form": "ceiling",
    "outdoor": false,
    "note": "Tri-band WiFi 6E. Per-band gain 2.4GHz 3.2 / 5GHz 5.3 / 6GHz 6 dBi. 4x4 all bands. Indoor ceiling/wall. PoE+."
  },
  {
    "model": "UniFi U6+ (U6 Plus)",
    "gen": "6",
    "bands": [
      "2.4",
      "5"
    ],
    "txDbm": {
      "5": 23,
      "2.4": 23
    },
    "gainDbi": 5.4,
    "poe": "802.3af",
    "form": "ceiling",
    "outdoor": false,
    "note": "Per-band gain 2.4GHz 3 dBi / 5GHz 5.4 dBi. 2x2 both bands. Budget replacement for U6 Lite tier. Indoor. PoE (802.3af)."
  },
  {
    "model": "UniFi U7 Pro",
    "gen": "7",
    "bands": [
      "2.4",
      "5",
      "6"
    ],
    "txDbm": {
      "5": 26,
      "6": 23,
      "2.4": 23
    },
    "gainDbi": 6,
    "poe": "802.3at",
    "form": "ceiling",
    "outdoor": false,
    "note": "Tri-band WiFi 7 (320MHz on 6GHz). Per-band gain 2.4GHz 4 / 5GHz 6 / 6GHz 5.8 dBi. 2x2 all bands. Indoor ceiling/wall. PoE+ (~13W)."
  },
  {
    "model": "UniFi U7 Pro Max",
    "gen": "7",
    "bands": [
      "2.4",
      "5",
      "6"
    ],
    "txDbm": {
      "5": 29,
      "6": 23,
      "2.4": 23
    },
    "gainDbi": 6,
    "poe": "802.3at",
    "form": "ceiling",
    "outdoor": false,
    "note": "Tri-band WiFi 7, 4x4 on 5GHz (higher 29 dBm 5GHz TX). Per-band gain 2.4GHz 4 / 5GHz 6 / 6GHz 5.9 dBi. Indoor ceiling/wall. PoE+."
  },
  {
    "model": "UniFi U7 Pro Wall",
    "gen": "7",
    "bands": [
      "2.4",
      "5",
      "6"
    ],
    "txDbm": {
      "5": 26,
      "6": 23,
      "2.4": 22
    },
    "gainDbi": 6,
    "poe": "802.3at",
    "form": "wall",
    "outdoor": false,
    "note": "Tri-band WiFi 7 wall-mount. Per-band gain 2.4GHz 4 / 5GHz 5 / 6GHz 6 dBi. Directional wall coverage. Indoor. PoE+."
  },
  {
    "model": "UniFi UAP-AC-Pro",
    "gen": "5",
    "bands": [
      "2.4",
      "5"
    ],
    "txDbm": {
      "5": 22,
      "2.4": 22
    },
    "gainDbi": 3,
    "poe": "802.3af/at",
    "form": "ceiling",
    "outdoor": true,
    "note": "WiFi 5 (802.11ac Wave1), 3x3 MIMO. Gain 3 dBi both bands. Weather-resistant, ceiling/wall. PoE 802.3af/at (48V adapter incl.)."
  },
  {
    "model": "UniFi UAP-AC-Lite",
    "gen": "5",
    "bands": [
      "2.4",
      "5"
    ],
    "txDbm": {
      "5": 20,
      "2.4": 20
    },
    "gainDbi": 3,
    "poe": "passive",
    "form": "ceiling",
    "outdoor": false,
    "note": "WiFi 5 (802.11ac), 2x2 MIMO. Gain 3 dBi both bands. Indoor ceiling/wall. Powered by 24V passive PoE (adapter incl.); also accepts 802.3af."
  },
  {
    "model": "UniFi FlexHD (UAP-FlexHD)",
    "gen": "5",
    "bands": [
      "2.4",
      "5"
    ],
    "txDbm": {
      "5": 26,
      "2.4": 23
    },
    "gainDbi": 4,
    "poe": "802.3af/at",
    "form": "ceiling",
    "outdoor": true,
    "note": "WiFi 5 (802.11ac Wave2), 4x4 on 5GHz. Per-band gain 2.4GHz 1.6 / 5GHz 4 dBi. Cylindrical; wall/pole/table/ceiling mounts. Indoor/outdoor. PoE 802.3af/at."
  },
  {
    "model": "UniFi BeaconHD (UAP-BeaconHD, aka 'Swiss')",
    "gen": "5",
    "bands": [
      "2.4",
      "5"
    ],
    "txDbm": {
      "5": 23,
      "2.4": 22
    },
    "gainDbi": 3,
    "poe": "none",
    "form": "mesh",
    "outdoor": false,
    "note": "WiFi 5 (802.11ac Wave2) plug-in mesh extender (AC wall outlet, no PoE, no wired uplink). 2x2 both bands, gain ~3 dBi. TX values approximate (not on current techspecs). Indoor mesh only."
  }
];

export const UNIFI_CAMERAS: UnifiCamera[] = [
  {"model":"UniFi G6 Dome","mp":8,"hpx":3840,"hfov":109.9,"hfovRange":null,"irFt":98,"ptz":false,"outdoor":true,"ik":"IK10","priceUsd":279,"poe":"PoE","note":"1/1.8\" 8MP 4K, H109.9/V56.7/D134.1, IK10 impact, IP66. In-bay STANDARD (golf). Mount rear-corner, high, angled in."},
  {"model":"UniFi G6 Pro Dome","mp":8,"hpx":3840,"hfov":113.8,"hfovRange":[45.5,113.8],"irFt":131,"ptz":false,"outdoor":true,"ik":"IK10","priceUsd":499,"poe":"PoE+","note":"1/1.2\" 8MP 4K, wide H113.8/V61.9, 2.36x zoom, IK10, IP66. PREMIUM in-bay — best in dim/backlit golf bays (larger sensor)."},
  {"model":"UniFi G6 Pro Turret","mp":8,"hpx":3840,"hfov":113.8,"hfovRange":[45.5,113.8],"irFt":131,"ptz":false,"outdoor":true,"ik":"IK04","priceUsd":479,"poe":"PoE+","note":"Same 1/1.2\" sensor/optics as G6 Pro Dome but IK04 — NOT for in-bay impact zones."},
  {"model":"UniFi G6 Turret","mp":8,"hpx":3840,"hfov":109.9,"hfovRange":null,"irFt":98,"ptz":false,"outdoor":true,"ik":"IK04","priceUsd":199,"poe":"PoE","note":"1/1.8\" 8MP 4K, 3-axis. Common-area / entry / back-of-house. IK04 (keep out of ball path)."},
  {"model":"UniFi G6 Bullet","mp":8,"hpx":3840,"hfov":108,"hfovRange":null,"irFt":98,"ptz":false,"outdoor":true,"ik":"IK04","priceUsd":199,"poe":"PoE","note":"1/1.8\" 8MP 4K bullet. Common-area. IK04."},
  {"model":"UniFi G6 180","mp":16,"hpx":7680,"hfov":180,"hfovRange":null,"irFt":0,"ptz":false,"outdoor":false,"ik":"IK04","priceUsd":299,"poe":"PoE","note":"Dual 1/1.8\" 8MP stitched 16MP (7680x2160), H180/V56.7, two-way audio, 15-20fps. Concourse/wide-shallow. IK04 (out of ball path)."},
  {"model":"UniFi G6 PTZ","mp":8,"hpx":3840,"hfov":64,"hfovRange":[2,64],"irFt":0,"ptz":true,"outdoor":true,"priceUsd":399,"poe":"PoE+","note":"Motorized PTZ — large open areas only, not fixed bays."},
  {
    "model": "G4 Bullet",
    "mp": 4,
    "hpx": 2688,
    "hfov": 86,
    "hfovRange": null,
    "irFt": 30,
    "ptz": false,
    "outdoor": true,
    "note": "2K fixed-lens outdoor bullet. Sensor 5MP, output 2688x1512 (4MP). IR ~9m. Verified techspecs.ui.com."
  },
  {
    "model": "G5 Bullet",
    "mp": 4,
    "hpx": 2688,
    "hfov": 84.4,
    "hfovRange": null,
    "irFt": 30,
    "ptz": false,
    "outdoor": true,
    "note": "2K fixed. 5MP sensor, 2688x1512 output. HFOV 84.4. IR 9m. Verified techspecs."
  },
  {
    "model": "G4 Pro",
    "mp": 8,
    "hpx": 3840,
    "hfov": 109.9,
    "hfovRange": [
      35,
      109.9
    ],
    "irFt": 50,
    "ptz": false,
    "outdoor": true,
    "note": "4K motorized 3x zoom (zoom, not pan/tilt). HFOV 109.9 wide to 35 tele. IR 15m. Verified techspecs."
  },
  {
    "model": "G5 Pro",
    "mp": 8,
    "hpx": 3840,
    "hfov": 109.9,
    "hfovRange": [
      35,
      109.9
    ],
    "irFt": 82,
    "ptz": false,
    "outdoor": true,
    "note": "4K motorized 3x zoom. HFOV 109.9 wide to 35 tele. IR 25m base, up to 40m (131ft) with Vision Enhancer. Verified techspecs."
  },
  {
    "model": "G4 Dome",
    "mp": 4,
    "hpx": 2688,
    "hfov": 102.4,
    "hfovRange": null,
    "irFt": 30,
    "ptz": false,
    "outdoor": false,
    "note": "Indoor 2K ceiling dome. HFOV 102.4. IR 9m. Verified techspecs."
  },
  {
    "model": "G5 Dome",
    "mp": 4,
    "hpx": 2688,
    "hfov": 102.4,
    "hfovRange": null,
    "irFt": 30,
    "ptz": false,
    "outdoor": false,
    "note": "Indoor 2K dome, enhanced DR/low-light. HFOV 102.4. IR 9m. Verified techspecs."
  },
  {
    "model": "G5 Turret Ultra",
    "mp": 4,
    "hpx": 2688,
    "hfov": 102.4,
    "hfovRange": null,
    "irFt": 98,
    "ptz": false,
    "outdoor": true,
    "note": "Ultra-compact weatherproof turret. HFOV 102.4. Long-range IR 30m (98ft). Verified techspecs."
  },
  {
    "model": "G5 Flex",
    "mp": 4,
    "hpx": 2688,
    "hfov": 102.4,
    "hfovRange": null,
    "irFt": 20,
    "ptz": false,
    "outdoor": true,
    "note": "Compact indoor/outdoor (IPX4 while covered). HFOV 102.4. IR 6m. Verified techspecs."
  },
  {
    "model": "G4 Instant",
    "mp": 2,
    "hpx": 1920,
    "hfov": 102.4,
    "hfovRange": null,
    "irFt": 13,
    "ptz": false,
    "outdoor": false,
    "note": "Tiny indoor 1080p plug-in cam. HFOV ~102 (wide). IR ~4m. No 'G5 Instant' exists in the lineup as of 2026-07; G4 Instant is the only Instant model."
  },
  {
    "model": "AI Bullet",
    "mp": 4,
    "hpx": 2688,
    "hfov": 84.7,
    "hfovRange": null,
    "irFt": 82,
    "ptz": false,
    "outdoor": true,
    "note": "2K fixed AI bullet (on-cam face/LPR/smart detect). HFOV 84.7. IR 25m. IP65. Note: this is a 2K/4MP camera, NOT 8MP (AI Pro is the 8MP bullet)."
  },
  {
    "model": "AI Turret",
    "mp": 8,
    "hpx": 3840,
    "hfov": 109.9,
    "hfovRange": null,
    "irFt": 131,
    "ptz": false,
    "outdoor": true,
    "note": "4K fixed AI turret. HFOV 109.9. Long-range IR 40m (131ft). PoE+. Verified techspecs."
  },
  {
    "model": "AI 360",
    "mp": 4,
    "hpx": 1920,
    "hfov": 360,
    "hfovRange": null,
    "irFt": 30,
    "ptz": false,
    "outdoor": true,
    "note": "360-deg fisheye, 1920x1920 (1:1) 4MP output. HFOV=360 (full panoramic) — DORI math must use fisheye dewarp, not linear HFOV. IR 9m. Digital PTZ only (no mechanical). Verified techspecs."
  },
  {
    "model": "AI Pro",
    "mp": 8,
    "hpx": 3840,
    "hfov": 109.9,
    "hfovRange": [
      34.9,
      109.9
    ],
    "irFt": 82,
    "ptz": false,
    "outdoor": true,
    "note": "Flagship 4K AI bullet, motorized 3x zoom. HFOV 109.9 wide to 34.9 tele. IR 25m base, 40m (131ft) with Vision Enhancer. Verified techspecs."
  },
  {
    "model": "AI DSLR (AI Enhanced)",
    "mp": 10,
    "hpx": 3840,
    "hfov": 52,
    "hfovRange": [
      21.6,
      52
    ],
    "irFt": 0,
    "ptz": false,
    "outdoor": true,
    "note": "4K interchangeable-lens AI camera (M.Zuiko M4/3 mount). 17mm=52 HFOV, 45mm=21.6 HFOV — HFOV depends on installed lens. No built-in IR (pairs with external illuminator). PoE+ 17.77W. Verified techspecs."
  },
  {
    "model": "G4 PTZ",
    "mp": 8,
    "hpx": 3840,
    "hfov": 64,
    "hfovRange": [
      2,
      64
    ],
    "irFt": 300,
    "ptz": true,
    "outdoor": true,
    "note": "4K high-performance PTZ, 22x optical. HFOV 64 wide to 2 tele. Continuous 360 pan. Very long IR 100m (300ft+). PoE++ 42.9W. Verified techspecs/datasheet."
  },
  {
    "model": "G5 PTZ",
    "mp": 4,
    "hpx": 2688,
    "hfov": 99.7,
    "hfovRange": [
      45.5,
      99.7
    ],
    "irFt": 65,
    "ptz": true,
    "outdoor": true,
    "note": "Compact 2K PTZ (distinct from big G4 PTZ). 2x optical, HFOV 99.7 wide to 45.5 tele. Pan 350 / tilt 100. IR 20m. Verified techspecs. NOT a 4K/22x unit — that is the G4 PTZ."
  }
];

export const UNIFI_GATEWAYS: UnifiGateway[] = [
  {
    "model": "UniFi Dream Machine (UDM)",
    "role": "all-in-one",
    "builtInAp": true,
    "apTxDbm": 26,
    "poePorts": 0,
    "poeBudgetW": 0,
    "sfpPlus": 0,
    "lanPorts": 4,
    "runsProtect": false,
    "note": "Original consumer all-in-one: gateway + controller + 4-port GbE switch + WiFi 5 AP. 1 GbE WAN, 4 GbE LAN, NO PoE, NO SFP. Does NOT run UniFi Protect (no NVR storage). Legacy/entry model. tx power country-limited."
  },
  {
    "model": "UniFi Dream Machine Pro (UDM-Pro)",
    "role": "gateway",
    "builtInAp": false,
    "apTxDbm": 0,
    "poePorts": 0,
    "poeBudgetW": 0,
    "sfpPlus": 2,
    "lanPorts": 8,
    "runsProtect": true,
    "note": "1U rack gateway/controller. Default WAN = 1x 10G SFP+ + 1x GbE RJ45. 8x GbE LAN + 1x 10G SFP+ LAN (2 SFP+ total). NO built-in PoE and NO WiFi — pair with a PoE switch to power APs/cameras. 1x 3.5in HDD bay for Protect NVR."
  },
  {
    "model": "UniFi Dream Machine Special Edition (UDM-SE)",
    "role": "gateway",
    "builtInAp": false,
    "apTxDbm": 0,
    "poePorts": 8,
    "poeBudgetW": 180,
    "sfpPlus": 2,
    "lanPorts": 9,
    "runsProtect": true,
    "note": "UDM-Pro + built-in PoE. 8x GbE PoE/PoE+ ports (30W max/port, 180W total budget) + 1x 2.5 GbE RJ45 + 2x 10G SFP+. NO built-in WiFi. 1x 3.5in HDD bay + 128GB SSD. This is the go-to when you want the gateway itself to power a handful of APs/cameras without a separate switch."
  },
  {
    "model": "UniFi Dream Machine Pro Max (UDM-Pro-Max)",
    "role": "gateway",
    "builtInAp": false,
    "apTxDbm": 0,
    "poePorts": 0,
    "poeBudgetW": 0,
    "sfpPlus": 2,
    "lanPorts": 9,
    "runsProtect": true,
    "note": "Top-tier 1U gateway. 8x GbE LAN + 1x 2.5 GbE RJ45 + 2x 10G SFP+. 5 Gbps IDS/IPS, 200+ devices / 2000+ clients. NO PoE and NO WiFi (needs PoE switch). 2x 3.5in HDD bays for REDUNDANT NVR storage + 128GB SSD. Best for large Protect deployments."
  },
  {
    "model": "UniFi Dream Router (UDR)",
    "role": "all-in-one",
    "builtInAp": true,
    "apTxDbm": 26,
    "poePorts": 2,
    "poeBudgetW": 40,
    "sfpPlus": 0,
    "lanPorts": 4,
    "runsProtect": true,
    "note": "Compact desktop all-in-one: gateway + controller + WiFi 6 AP + small PoE switch. 1 GbE WAN, 4 GbE LAN of which 2 are PoE (15.4W/port, 40W total). NO SFP. 128GB SSD for Protect (up to 5 HD / 1 4K cams). All GbE — no multi-gig."
  },
  {
    "model": "UniFi Dream Router 7 (UDR7)",
    "role": "all-in-one",
    "builtInAp": true,
    "apTxDbm": 26,
    "poePorts": 1,
    "poeBudgetW": 15.4,
    "sfpPlus": 1,
    "lanPorts": 4,
    "runsProtect": true,
    "note": "10G desktop all-in-one with WiFi 7. 4x 2.5 GbE RJ45 (1 is PoE, 15.4W budget) + 1x 10G SFP+ (default WAN can be SFP+ or 2.5GbE). Multi-gig throughout. Pre-installed 64GB microSD for NVR (up to 5 HD / 1 4K). ~1750 sq ft WiFi coverage. Only ONE PoE port — plan a PoE switch for more than one downstream device."
  },
  {
    "model": "UniFi Dream Wall (UDW)",
    "role": "all-in-one",
    "builtInAp": true,
    "apTxDbm": 26,
    "poePorts": 17,
    "poeBudgetW": 420,
    "sfpPlus": 2,
    "lanPorts": 17,
    "runsProtect": true,
    "note": "Wall-mounted all-in-one flagship: gateway + controller + WiFi 6 AP + 17-port GbE PoE switch + 4.7in touchscreen. PoE is tiered: 4x PoE++ (60W) + 4x PoE+ (30W) + 9x PoE (15.4W), ~420W total budget. 2x 10G SFP+ + 1x 2.5 GbE RJ45 WAN. 512GB microSD + 128GB SSD for Protect. Highest built-in PoE budget of any Dream device."
  },
  {
    "model": "UniFi Cloud Gateway Ultra (UCG-Ultra)",
    "role": "gateway",
    "builtInAp": false,
    "apTxDbm": 0,
    "poePorts": 0,
    "poeBudgetW": 0,
    "sfpPlus": 0,
    "lanPorts": 4,
    "runsProtect": false,
    "note": "Compact desktop gateway/controller. 1x 2.5 GbE RJ45 WAN + 4x GbE LAN. NO WiFi, NO PoE, NO SFP. 16GB onboard storage only — runs UniFi Network (and can launch Protect/other apps) but has NO usable NVR storage, so NOT a practical Protect NVR. Budget replacement for the old USG. Requires a PoE switch for any APs/cameras."
  },
  {
    "model": "UniFi Cloud Gateway Max (UCG-Max)",
    "role": "gateway",
    "builtInAp": false,
    "apTxDbm": 0,
    "poePorts": 0,
    "poeBudgetW": 0,
    "sfpPlus": 0,
    "lanPorts": 4,
    "runsProtect": true,
    "note": "Compact desktop multi-gig gateway/controller. 5x 2.5 GbE RJ45 total (1 WAN + 4 LAN). NO WiFi, NO PoE, NO SFP. 2.3 Gbps IDS/IPS. Selectable NVMe SSD up to 2TB for Protect NVR (up to ~15 HD / 5 4K cams). Full multi-gig LAN. Needs a PoE switch to power APs/cameras."
  },
  {
    "model": "UniFi Next-Gen Gateway Pro (UXG-Pro)",
    "role": "gateway",
    "builtInAp": false,
    "apTxDbm": 0,
    "poePorts": 0,
    "poeBudgetW": 0,
    "sfpPlus": 2,
    "lanPorts": 1,
    "runsProtect": false,
    "note": "1U pure routing/security gateway (no NVR). Default WAN = 1x 10G SFP+ + 1x GbE RJ45; 2x 10G SFP+ + 2x GbE RJ45 total. NO WiFi, NO PoE. Historically an offload gateway managed by a separate console; runs UniFi Network self-hosted. Use when a dedicated router is wanted alongside existing switching. Largely superseded by the UCG line."
  },
  {
    "model": "UniFi Next-Gen Gateway Lite (UXG-Lite)",
    "role": "gateway",
    "builtInAp": false,
    "apTxDbm": 0,
    "poePorts": 0,
    "poeBudgetW": 0,
    "sfpPlus": 0,
    "lanPorts": 1,
    "runsProtect": false,
    "note": "Tiny desktop gateway. 1x GbE RJ45 WAN + 1x GbE RJ45 LAN (2 ports total, gigabit — not multi-gig). NO WiFi, NO PoE, NO SFP, NO NVR. USG replacement / smallest managed gateway; needs a controller or self-hosted Network + a PoE switch for everything downstream. Largely superseded by UCG-Ultra."
  }
];

export const UNIFI_SWITCHES: UnifiSwitch[] = [
  {"model":"UniFi Pro Max 16 PoE","ports":16,"poePorts":16,"poeBudgetW":180,"sfpPlus":2,"priceUsd":399,"note":"16-port PoE/PoE+ (180W). Size camera loads ≤70% of budget. Two of these (360W) recommended for an 8-bay golf install."},
  {
    "model": "USW-Lite-8-PoE",
    "ports": 8,
    "poePorts": 4,
    "poeBudgetW": 52,
    "sfpPlus": 0,
    "note": "8x GbE RJ45, ports 1-4 are PoE (802.3af/at PoE+). No SFP. Fanless desktop. 52W total PoE budget - good for a few cameras/APs at edge. Powered by external adapter."
  },
  {
    "model": "USW-Lite-16-PoE",
    "ports": 16,
    "poePorts": 8,
    "poeBudgetW": 45,
    "sfpPlus": 0,
    "note": "16x GbE RJ45, 8 PoE (802.3af/at PoE+). No SFP uplink - copper only. Fanless. Low 45W budget: sized for 8 light PoE loads (APs / indoor cams), NOT PTZ or PoE++ devices."
  },
  {
    "model": "USW-Pro-24-PoE",
    "ports": 26,
    "poePorts": 24,
    "poeBudgetW": 400,
    "sfpPlus": 2,
    "note": "24x GbE RJ45 (16 PoE+ 32W + 8 PoE++ 60W) + 2x 10G SFP+ uplink. Layer 3, 400W budget. 1U rack, touchscreen. Note: Gen2 exists with same port map."
  },
  {
    "model": "USW-Pro-48-PoE",
    "ports": 52,
    "poePorts": 48,
    "poeBudgetW": 600,
    "sfpPlus": 4,
    "note": "48x GbE RJ45 (40 PoE+ 32W + 8 PoE++ 60W) + 4x 10G SFP+ uplink. Layer 3, 600W budget (660W internal PSU). 1U, touchscreen. Workhorse for camera/AP-dense floors."
  },
  {
    "model": "USW-Enterprise-24-PoE",
    "ports": 26,
    "poePorts": 24,
    "poeBudgetW": 400,
    "sfpPlus": 2,
    "note": "12x 2.5GbE PoE+ + 12x GbE PoE+ + 2x 10G SFP+. Layer 3, 400W budget. 2.5G ports feed WiFi 6E/7 APs (U6-Enterprise/U7). Half the ports are multi-gig."
  },
  {
    "model": "USW-Enterprise-48-PoE",
    "ports": 52,
    "poePorts": 48,
    "poeBudgetW": 720,
    "sfpPlus": 4,
    "note": "48x 2.5GbE PoE+ (all multi-gig) + 4x 10G SFP+. Layer 3, 720W budget. Premium multi-gig access layer for high-density WiFi 6E/7 deployments."
  },
  {
    "model": "USW-Flex",
    "ports": 5,
    "poePorts": 4,
    "poeBudgetW": 46,
    "sfpPlus": 0,
    "note": "5x GbE; port 1 = PoE INPUT (powers the switch), ports 2-5 = PoE OUTPUT. Outdoor-rated (IP55). When fed by PoE++ (60W) delivers up to ~46W downstream. No power brick needed - remote PoE extender for cameras."
  },
  {
    "model": "USW-Flex-Mini",
    "ports": 5,
    "poePorts": 0,
    "poeBudgetW": 0,
    "sfpPlus": 0,
    "note": "5x GbE, NO PoE output. Powered by PoE-in (passthrough powers switch only) or USB-C. Tiny desk switch - port expansion, not device power."
  },
  {
    "model": "USW-Aggregation",
    "ports": 8,
    "poePorts": 0,
    "poeBudgetW": 0,
    "sfpPlus": 8,
    "note": "8x 10G SFP+ (fiber/DAC). No RJ45, no PoE. Fiber aggregation/distribution core - ties multiple PoE access switches together over 10G. Fanless, 1U."
  },
  {
    "model": "USW-Pro-Aggregation",
    "ports": 32,
    "poePorts": 0,
    "poeBudgetW": 0,
    "sfpPlus": 28,
    "note": "28x 10G SFP+ + 4x 25G SFP28 uplinks. No PoE. Layer 3, 760 Gbps capacity. Large-campus fiber core. sfpPlusPorts counts the 28x 10G; the 4x SFP28 are separate 25G uplinks."
  },
  {
    "model": "USW-Industrial",
    "ports": 10,
    "poePorts": 8,
    "poeBudgetW": 450,
    "sfpPlus": 2,
    "note": "8x GbE PoE++ (60W/port) + 2x 1G SFP. Hardened -40C to 75C, IP autonomous, surge-protected, wide 48-56V DC input. 450W budget when fed 54V DC. SFP are 1G only (not 10G). Outdoor/industrial camera runs."
  }
];

export const UNIFI_SMART: { model: string; type: string; note: string }[] = [
  {
    "model": "",
    "type": "smart-plug",
    "note": "Single 120V outlet, remotely switchable + energy monitoring, managed in UniFi Network/Protect. Used to remote-cycle a device (camera, AP, sign) on loss of connectivity. Mark on plan as a switched-outlet load."
  },
  {
    "model": "",
    "type": "smart-pdu",
    "note": "1U rack PDU, per-outlet switching + metering, some outlets provide DC to power UniFi gear. Rack-power management item - mark in rack elevation, not floor plan."
  },
  {
    "model": "",
    "type": "ev-charger",
    "note": "Networked Level-2 EV charger (up to ~9.6kW / 48A on Pro, integrated touchscreen on Pro). Requires 240V circuit + network drop. Mark as EV charger with dedicated 240V home-run + Cat6 data drop."
  },
  {
    "model": "",
    "type": "touch-display",
    "note": "21.5in and 27in PoE-or-DC touch displays for building/room signage, scheduling, dashboards. Powered/data over single Cat6 (PoE++ on the larger unit). Mark as a wall-mounted display drop."
  },
  {
    "model": "",
    "type": "in-wall-ap",
    "note": "UniFi does NOT make an in-wall LIGHT switch. The in-wall units are access points with a downlink PoE passthrough port - not lighting control. Do not confuse with a smart light switch."
  },
  {
    "model": "",
    "type": "controlled-load-3rd-party",
    "note": "UniFi has no native lighting/projector control. Standard practice: control via 3rd-party (Lutron RA3/QSX for lights+shades, DMX for architectural, relay or IR/RS-232 gateway for projectors). In a low-voltage design, mark projectors/lights on a separate CONTROL layer with a symbol + note (e.g. 'Ctrl: Lutron' or 'Relay via USP-Plug'). Simple on/off loads can be cycled through a UniFi smart plug/PDU; dimming/scene control always needs the 3rd-party system. Each controlled device still needs its own low-voltage control run (Cat6/keypad wire) back to the control processor."
  }
];

export const CABLING_MEDIA: { media: string; maxRunFt: number; note: string }[] = [
  {
    "media": "Cat6 (U/UTP)",
    "maxRunFt": 328,
    "note": "~100m max total channel for 1GbE incl. PoE (up to PoE++ 60W/90W). Standard copper drop for cameras, APs, displays, and any powered device. PoE power and data on the same run. Derate length for very high-wattage PoE++ (voltage drop)."
  },
  {
    "media": "Cat6A",
    "maxRunFt": 328,
    "note": "~100m for 10GBASE-T copper. Use for 2.5G/5G/10G access ports (multi-gig APs, uplinks to Enterprise switches) and PoE++ device runs where headroom matters. Preferred new-build horizontal cable."
  },
  {
    "media": "Fiber SFP+ multimode (OM3/OM4)",
    "maxRunFt": 1312,
    "note": "10G over multimode: ~300m (OM3) to ~400m (OM4). Building-internal riser/backbone uplinks between access switches and aggregation. No PoE over fiber - powered gear still needs local power. 1312ft = OM4 400m."
  },
  {
    "media": "Fiber SFP+ single-mode (OS2)",
    "maxRunFt": 32808,
    "note": "10G over single-mode: up to ~10km+ with appropriate transceiver. Campus/inter-building backbone and long fiber runs. 32808ft = 10km. Choose transceiver (LR/ER) to match distance; no PoE."
  },
  {
    "media": "DAC (Direct Attach Copper, SFP+/SFP28)",
    "maxRunFt": 10,
    "note": "Passive copper 10G/25G, ~1-3m. In-rack switch-to-switch stacking/aggregation only (e.g. access switch to USW-Aggregation). Cheapest 10G option for short adjacent runs; no PoE."
  }
];

export interface UnifiNVR { model: string; maxCameras: number; bays: number; priceUsd: number; note: string }
export const UNIFI_NVR: UnifiNVR[] = [
  { model: 'UniFi NVR Pro', maxCameras: 32, bays: 4, priceUsd: 580, note: 'Up to 32 cameras across 4 drive bays. Continuous 4K. Recommended recorder for multi-bay golf installs.' },
  { model: 'UniFi NVR', maxCameras: 18, bays: 1, priceUsd: 299, note: 'Standard NVR, single drive bay.' },
  { model: 'UniFi NVR Mini', maxCameras: 4, bays: 1, priceUsd: 199, note: '1080p-focused, single bay — NOT for continuous 4K bay counts.' },
];
