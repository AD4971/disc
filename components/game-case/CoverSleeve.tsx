"use client";

import { useMemo } from "react";
import { MeshStandardMaterial } from "three";
import { CASE_DIMENSIONS } from "./constants";

// One continuous printed insert spanning back + spine + front — the
// full unfolded shell width, per the reference case. Not mounted in
// Milestone 1; the slide-out interaction arrives in Milestone 2.
export function CoverSleeve() {
  const { panelWidth, panelHeight, spineDepth } = CASE_DIMENSIONS;
  const fullWidth = panelWidth * 2 + spineDepth;

  const materials = useMemo(() => {
    // Placeholder front/spine/back print tints until real artwork lands.
    return {
      front: new MeshStandardMaterial({ color: "#d8d2c4", roughness: 0.85 }),
      spine: new MeshStandardMaterial({ color: "#b7ad98", roughness: 0.85 }),
      back: new MeshStandardMaterial({ color: "#cfc8b8", roughness: 0.85 })
    };
  }, []);

  const sectionHeight = panelHeight * 0.985;

  return (
    <group>
      <mesh material={materials.back} position={[-fullWidth / 2 + panelWidth / 2, 0, 0]}>
        <planeGeometry args={[panelWidth, sectionHeight]} />
      </mesh>
      <mesh
        material={materials.spine}
        position={[-fullWidth / 2 + panelWidth + spineDepth / 2, 0, 0]}
      >
        <planeGeometry args={[spineDepth, sectionHeight]} />
      </mesh>
      <mesh
        material={materials.front}
        position={[fullWidth / 2 - panelWidth / 2, 0, 0]}
      >
        <planeGeometry args={[panelWidth, sectionHeight]} />
      </mesh>
    </group>
  );
}
