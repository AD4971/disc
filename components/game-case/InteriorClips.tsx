"use client";

import { CASE_DIMENSIONS } from "./constants";
import type { CaseMaterials } from "./materials";

type InteriorClipsProps = {
  materials: CaseMaterials;
  // Which face of the lid slab the clips sit on (-1 = inner face).
  side: 1 | -1;
};

// Two rectangular manual/cover clips on the lid's inner face, top and
// bottom, matching ref/disc case real/IMG_0409: a flat plate with a
// raised retaining bar floating above it.
export function InteriorClips({ materials, side }: InteriorClipsProps) {
  const { panelHeight: h, shellThickness: t } = CASE_DIMENSIONS;
  const material = materials.shellEdge;
  const lift = (height: number) => side * (t / 2 + height / 2);

  return (
    <group>
      {[1, -1].map((sy) => (
        <group key={sy} position={[0, sy * (h / 2 - 1.15), 0]}>
          <mesh material={material} position={[0, 0, lift(0.028)]}>
            <boxGeometry args={[1.15, 0.42, 0.028]} />
          </mesh>
          <mesh material={material} position={[0, 0, lift(0.028) + side * 0.05]}>
            <boxGeometry args={[0.9, 0.16, 0.03]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
