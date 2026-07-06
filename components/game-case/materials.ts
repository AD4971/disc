import { DoubleSide, MeshPhysicalMaterial, MeshStandardMaterial } from "three";
import type { CaseEnvironmentSettings } from "./types";

export type CaseMaterials = {
  shellFace: MeshPhysicalMaterial;
  shellEdge: MeshPhysicalMaterial;
  hub: MeshStandardMaterial;
  discBody: MeshStandardMaterial;
  discCenter: MeshStandardMaterial;
};

// Saturated translucent plastic via plain alpha blending, not
// transmission: depthWrite is off and both faces render, so flat faces
// stay lightly transparent while edge-on views and stacked moldings
// naturally read darker and more saturated — stable, no refraction
// sorting artifacts. Low roughness keeps it glossy plastic, not frost.
export function createCaseMaterials(): CaseMaterials {
  const shellFace = new MeshPhysicalMaterial({
    color: "#3d78f2",
    transparent: true,
    opacity: 0.46,
    depthWrite: false,
    side: DoubleSide,
    roughness: 0.24,
    metalness: 0,
    clearcoat: 0.22,
    clearcoatRoughness: 0.45,
    specularIntensity: 0.3,
    envMapIntensity: 0.7
  });

  // Moldings, tray, spine details: same plastic, thicker read — deeper
  // electric blue, noticeably more opaque.
  const shellEdge = new MeshPhysicalMaterial({
    color: "#1b3fd8",
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
    side: DoubleSide,
    roughness: 0.32,
    metalness: 0,
    clearcoat: 0.3,
    clearcoatRoughness: 0.4,
    specularIntensity: 0.25,
    envMapIntensity: 0.45
  });

  // Push-hub teeth/cap read as near-white translucent plastic.
  const hub = new MeshStandardMaterial({
    color: "#dbe6f8",
    transparent: true,
    opacity: 0.9,
    roughness: 0.42,
    metalness: 0.05,
    envMapIntensity: 0.7
  });

  const discBody = new MeshStandardMaterial({
    color: "#a2aab2",
    roughness: 0.3,
    metalness: 0.7,
    envMapIntensity: 0.9
  });

  const discCenter = new MeshStandardMaterial({
    color: "#9aa19d",
    roughness: 0.4,
    metalness: 0.35,
    envMapIntensity: 0.7
  });

  return { shellFace, shellEdge, hub, discBody, discCenter };
}

const ENV_INTENSITY_SCALE: Record<keyof CaseMaterials, number> = {
  shellFace: 0.7,
  shellEdge: 0.5,
  hub: 0.8,
  discBody: 0.95,
  discCenter: 0.85
};

export function applyCaseEnvironmentSettings(
  materials: CaseMaterials,
  settings: CaseEnvironmentSettings
) {
  for (const key of Object.keys(materials) as (keyof CaseMaterials)[]) {
    materials[key].envMapIntensity =
      settings.intensity * ENV_INTENSITY_SCALE[key];
  }
}

export function disposeCaseMaterials(materials: CaseMaterials) {
  for (const material of Object.values(materials)) {
    material.dispose();
  }
}
