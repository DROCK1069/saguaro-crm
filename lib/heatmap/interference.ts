/**
 * Heatmap engine — Wi-Fi CHANNEL / AIRTIME INTERFERENCE analysis.
 *
 * This is our HONEST answer to "spectrum analysis": it works from an 802.11
 * neighbor-AP SCAN (the same BSSID/SSID/channel/RSSI list any phone or AP can
 * produce) — NOT a fabricated SDR sweep. Because a scan already gives a MEASURED
 * RSSI per neighbor, there is no path loss to model here (unlike the placement
 * engine's rfRssi/apRssiAt, which predict RSSI from tx power + distance). So we
 * deliberately do NOT re-run path-loss math; we reuse the shared Band type and
 * the canonical 5 GHz channel plan (CHANNELS_5) from ./models and compute the
 * physical-layer parts a scan can't hand us: channel-overlap geometry, co- vs
 * adjacent-channel interferer counts, a weighted congestion score, an airtime
 * contention estimate, and a cleanest-non-overlapping-channel recommendation.
 *
 * Pure TypeScript, DOM-free, deterministic (no Date.now / Math.random).
 */
import type { Band } from './types';
import { CHANNELS_5 } from './models';

/* ── Inputs ──────────────────────────────────────────────────────────────── */

/** One scanned neighbor AP (from an 802.11 scan / site survey). */
export interface ScannedNeighbor {
  bssid: string;
  ssid?: string;
  channel: number;
  band: Band;
  rssiDbm: number;
  /** occupied channel width; defaults to 20 MHz if the scan didn't report it. */
  widthMhz?: number;
}

/** One of OUR planned APs whose channel we've already committed. */
export interface PlannedAp {
  band: Band;
  channel: number;
  widthMhz?: number;
}

export interface InterferenceOpts {
  /** our own planned APs — folded in so we don't stack two of our radios co-channel. */
  ownAps?: PlannedAp[];
  /** assumed on-site RSSI of our own APs (they're in-building → strong). */
  ownApRssiDbm?: number;
  /** planned channel width (MHz) per band for the channels WE would deploy. */
  ourWidthMhz?: Partial<Record<Band, number>>;
}

/* ── Outputs ─────────────────────────────────────────────────────────────── */

export interface ChannelReport {
  band: Band;
  channel: number;
  /** 0-100 saturating congestion score (overlap-weighted, RSSI-weighted). */
  congestion: number;
  /** interferers (neighbors + our other APs) on EXACTLY this channel. */
  coChannel: number;
  /** interferers that OVERLAP this channel but sit on a different channel. */
  adjChannel: number;
  /** 0-100 estimated share of airtime stolen by audible overlapping BSSes. */
  airtimePct: number;
}

export interface InterferenceResult {
  perChannel: ChannelReport[];
  recommend: Record<Band, number[]>;
  /** most-congested channels first (congestion > 0), for a "spectrum" callout. */
  worstChannels: ChannelReport[];
}

/* ── Physical anchors (documented, defensible) ───────────────────────────── */

/** 802.11 OFDM carrier-sense / energy-detect threshold (dBm): a neighbor at or
 *  above this makes our radio DEFER — i.e. it costs us real airtime. */
const CCA_DBM = -82;
/** noise floor and a "blasting-in-your-face" ceiling for the RSSI weight ramp. */
const NOISE_FLOOR_DBM = -92;
const STRONG_DBM = -40;
/** nominal airtime a single audible BSS holds (beacons + light traffic) when a
 *  scan gives us no traffic counters. Scaled by overlap + strength per neighbor. */
const AIRTIME_PER_BSS = 0.08;
/** congestion saturation constant: one strong co-channel neighbor ≈ 40. */
const CONGESTION_K = 0.6;
/** default assumed strength of our own in-building APs. */
const OWN_AP_RSSI_DBM = -58;

/** Canonical non-overlapping channel plans (cleanest deploy grid) per band. */
const NON_OVERLAPPING: Record<Band, number[]> = {
  '2.4': [1, 6, 11],
  '5': CHANNELS_5, // [36,40,44,48,149,153,157,161]
  // 6 GHz Preferred Scanning Channels (PSC), 20 MHz.
  '6': [5, 21, 37, 53, 69, 85, 101, 117, 133, 149, 165, 181, 197, 213, 229],
};

/** default channel width (MHz) we'd plan per band. */
const DEFAULT_OUR_WIDTH: Record<Band, number> = { '2.4': 20, '5': 20, '6': 20 };

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/* ── Channel geometry ────────────────────────────────────────────────────── */

/** Center frequency (MHz) of a channel number in a band. */
export function channelCenterMhz(band: Band, channel: number): number {
  if (band === '2.4') return 2407 + 5 * channel; // ch1=2412 … ch11=2462
  if (band === '5') return 5000 + 5 * channel; // ch36=5180
  return 5950 + 5 * channel; // 6 GHz: ch1=5955
}

interface Interval { lo: number; hi: number; w: number }
function interval(band: Band, channel: number, widthMhz: number): Interval {
  const c = channelCenterMhz(band, channel);
  const w = widthMhz > 0 ? widthMhz : 20;
  return { lo: c - w / 2, hi: c + w / 2, w };
}

/**
 * Fraction of channel A's bandwidth that channel B overlaps (0..1).
 * Co-channel same-width → 1.0. For 2.4 GHz 20 MHz channels this reproduces the
 * classic overlap: diff1=0.75, diff2=0.5, diff3=0.25, diff≥4=0 (so ch1 hits
 * ch2/3/4 but NOT ch6+). Widths from the scan bond correctly on 5/6 GHz.
 */
export function channelOverlap(
  band: Band,
  chA: number,
  chB: number,
  widthA = 20,
  widthB = 20,
): number {
  const a = interval(band, chA, widthA);
  const b = interval(band, chB, widthB);
  const ov = Math.max(0, Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo));
  return a.w > 0 ? ov / a.w : 0;
}

/** RSSI → 0..1 interference weight (linear in dB across the usable range). */
function rssiWeight(rssiDbm: number): number {
  return clamp01((rssiDbm - NOISE_FLOOR_DBM) / (STRONG_DBM - NOISE_FLOOR_DBM));
}

/* ── Core scoring ────────────────────────────────────────────────────────── */

interface Interferer { channel: number; band: Band; rssiDbm: number; widthMhz?: number }

function interferersForBand(
  band: Band,
  neighbors: ScannedNeighbor[],
  opts: InterferenceOpts,
): Interferer[] {
  const ownRssi = opts.ownApRssiDbm ?? OWN_AP_RSSI_DBM;
  const scanned: Interferer[] = neighbors
    .filter((n) => n.band === band && Number.isFinite(n.channel))
    .map((n) => ({ channel: n.channel, band, rssiDbm: n.rssiDbm, widthMhz: n.widthMhz }));
  const own: Interferer[] = (opts.ownAps ?? [])
    .filter((a) => a.band === band && Number.isFinite(a.channel))
    .map((a) => ({ channel: a.channel, band, rssiDbm: ownRssi, widthMhz: a.widthMhz }));
  return [...scanned, ...own];
}

/** Score one candidate channel against a pre-filtered interferer list. */
function scoreChannel(
  band: Band,
  channel: number,
  ourWidth: number,
  interferers: Interferer[],
): ChannelReport {
  let coChannel = 0;
  let adjChannel = 0;
  let weighted = 0; // Σ overlap·rssiWeight  → congestion
  let airtime = 0; // Σ overlap·busy·strength → airtimePct

  for (const it of interferers) {
    const of = channelOverlap(band, channel, it.channel, ourWidth, it.widthMhz ?? 20);
    if (of <= 0) continue;
    if (it.channel === channel) coChannel++;
    else adjChannel++;

    const w = rssiWeight(it.rssiDbm);
    weighted += of * w;

    // Only neighbors we can actually hear (≥ CCA) steal airtime from us.
    if (it.rssiDbm >= CCA_DBM) airtime += of * AIRTIME_PER_BSS * (0.4 + 0.6 * w);
  }

  const congestion = Math.round(100 * (1 - Math.exp(-CONGESTION_K * weighted)));
  const airtimePct = Math.round(Math.min(1, airtime) * 100);
  return { band, channel, congestion, coChannel, adjChannel, airtimePct };
}

/** Union of channels worth reporting for a band (plan grid ∪ occupied ∪ ours). */
function channelsForBand(band: Band, interferers: Interferer[]): number[] {
  const base =
    band === '2.4' ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] : NON_OVERLAPPING[band];
  const seen = new Set<number>(base);
  for (const it of interferers) if (Number.isFinite(it.channel)) seen.add(it.channel);
  return [...seen].sort((a, b) => a - b);
}

/**
 * Cleanest non-overlapping channels for a band, cleanest first.
 * Sorts the band's canonical non-overlapping grid by congestion, breaking ties
 * on fewer co-channel interferers, then lowest channel number.
 */
export function recommendedChannels(
  neighbors: ScannedNeighbor[],
  band: Band,
  count: number,
  opts: InterferenceOpts = {},
): number[] {
  const ourWidth = opts.ourWidthMhz?.[band] ?? DEFAULT_OUR_WIDTH[band];
  const interferers = interferersForBand(band, neighbors, opts);
  const scored = NON_OVERLAPPING[band].map((ch) =>
    scoreChannel(band, ch, ourWidth, interferers),
  );
  scored.sort(
    (a, b) =>
      a.congestion - b.congestion ||
      a.coChannel - b.coChannel ||
      a.airtimePct - b.airtimePct ||
      a.channel - b.channel,
  );
  return scored.slice(0, Math.max(0, count)).map((s) => s.channel);
}

/**
 * Full interference analysis from a neighbor-AP scan.
 * @param neighbors scanned neighbor APs
 * @param opts our planned AP channels + planning widths
 */
export function analyzeInterference(
  neighbors: ScannedNeighbor[],
  opts: InterferenceOpts = {},
): InterferenceResult {
  const bands: Band[] = ['2.4', '5', '6'];
  const perChannel: ChannelReport[] = [];

  for (const band of bands) {
    const ourWidth = opts.ourWidthMhz?.[band] ?? DEFAULT_OUR_WIDTH[band];
    const interferers = interferersForBand(band, neighbors, opts);
    for (const ch of channelsForBand(band, interferers)) {
      perChannel.push(scoreChannel(band, ch, ourWidth, interferers));
    }
  }

  const recommend: Record<Band, number[]> = {
    '2.4': recommendedChannels(neighbors, '2.4', NON_OVERLAPPING['2.4'].length, opts),
    '5': recommendedChannels(neighbors, '5', NON_OVERLAPPING['5'].length, opts),
    '6': recommendedChannels(neighbors, '6', NON_OVERLAPPING['6'].length, opts),
  };

  const worstChannels = perChannel
    .filter((c) => c.congestion > 0)
    .sort((a, b) => b.congestion - a.congestion || b.airtimePct - a.airtimePct)
    .slice(0, 8);

  return { perChannel, recommend, worstChannels };
}
