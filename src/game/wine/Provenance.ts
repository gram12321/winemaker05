import type { RawMaterialAnchors, WineOrigin } from './types';

/** Stable identity keys use fields explicitly, independent of JSON object key order. */
export function originKey(origin: WineOrigin): string {
  return JSON.stringify([
    origin.vineyardId, origin.vineyardName, origin.region, origin.siteId, origin.grapeId,
    origin.vintage, origin.terroirPotential, origin.originPrestige,
  ]);
}

export function anchorsKey(anchors: RawMaterialAnchors): string {
  return JSON.stringify([
    anchors.sugarGPerL, anchors.acidity, anchors.phenolics, anchors.aromatics, anchors.body, anchors.agingPotential,
  ]);
}

/** Identifies a source by origin and its inherited baseline. */
export function sourceKey(origin: WineOrigin, anchors: RawMaterialAnchors): string {
  return JSON.stringify([
    origin.vineyardId, origin.vineyardName, origin.region, origin.siteId, origin.grapeId,
    origin.vintage, origin.terroirPotential, origin.originPrestige,
    anchors.sugarGPerL, anchors.acidity, anchors.phenolics, anchors.aromatics, anchors.body, anchors.agingPotential,
  ]);
}
