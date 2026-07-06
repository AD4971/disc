"use client";

import { CASE_DIMENSIONS, HINGE_X, LID_CLOSED_Z } from "./constants";
import type { CaseMaterials } from "./materials";

type HingeProps = {
  materials: CaseMaterials;
};

// Thin "living hinge" web at the spine crease — the reference case
// folds on a molded flex strip, not a cylindrical knuckle. Decorative;
// the actual rotation happens on the lid pivot group.
export function Hinge({ materials }: HingeProps) {
  const { panelHeight } = CASE_DIMENSIONS;

  return (
    <mesh material={materials.shellEdge} position={[HINGE_X, 0, LID_CLOSED_Z]}>
      <boxGeometry args={[0.05, panelHeight * 0.97, 0.05]} />
    </mesh>
  );
}
