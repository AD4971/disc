"use client";

import { DISC_CENTER_Z, PLACEHOLDER_DISC } from "./constants";
import type { CaseMaterials } from "./materials";

type PlaceholderDiscProps = {
  materials: CaseMaterials;
};

// Milestone 1 stand-in: a plain cylinder with a hub-band detail.
// Swapped for a thin wrapper around components/disc PhysicalDisc in
// Milestone 3 once the case prototype is stable.
export function PlaceholderDisc({ materials }: PlaceholderDiscProps) {
  const { radius, thickness, hubRadius } = PLACEHOLDER_DISC;

  return (
    <group position={[0, 0, DISC_CENTER_Z]}>
      <mesh material={materials.discBody} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius, radius, thickness, 96]} />
      </mesh>
      <mesh
        material={materials.discCenter}
        position={[0, 0, thickness / 2 + 0.001]}
      >
        <ringGeometry args={[0.21, hubRadius, 64]} />
      </mesh>
    </group>
  );
}
