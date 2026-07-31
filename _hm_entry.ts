// Browser entry for the visual heatmap proof — exposes the REAL engine to window.
import { computeCoverage, apUsableRadiusFt, apRssiAt } from './lib/heatmap/engine';
import { recompute, autoPlaceAPs, planChannels } from './lib/heatmap/smart';
import { isoLines } from './lib/heatmap/overlays';
import { computeBom } from './lib/heatmap/bom';
import { UNIFI_APS, UNIFI_CAMERAS } from './lib/heatmap/unifi';
import { planSchedule } from './lib/heatmap/network';
import { doriDistanceFt } from './lib/heatmap/models';
import { recommendCabling, summarizeCables, runLengthFt, CABLE_CATALOG, DEVICE_CABLING, SELECTION_RULES } from './lib/heatmap/cabling-spec';
// @ts-expect-error attach to window
window.HM = { computeCoverage, apUsableRadiusFt, apRssiAt, recompute, autoPlaceAPs, planChannels, isoLines, computeBom, UNIFI_APS, UNIFI_CAMERAS, planSchedule, doriDistanceFt, recommendCabling, summarizeCables, runLengthFt, CABLE_CATALOG, DEVICE_CABLING, SELECTION_RULES };
