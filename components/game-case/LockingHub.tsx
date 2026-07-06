"use client";

import { DISC_CENTER_Z, PLACEHOLDER_DISC, TRAY_SEAT_Z } from "./constants";
import type { CaseMaterials } from "./materials";

type LockingHubProps = {
  materials: CaseMaterials;
};

// Simple version of the real push hub: translucent circular base,
// eight radial teeth over the disc hole rim, a raised central
// button/cap, and a small triangular press detail. Static in v1 —
// the release/retract animation arrives with the disc-focus milestone.
export function LockingHub({ materials }: LockingHubProps) {
  const discTopZ = DISC_CENTER_Z + PLACEHOLDER_DISC.thickness / 2;
  const teeth = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);

  return (
    <group>
      {/* circular transparent hub base under the disc center */}
      <mesh
        material={materials.shellFace}
        position={[0, 0, TRAY_SEAT_Z + 0.015]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.46, 0.46, 0.03, 48]} />
      </mesh>

      {/* radial teeth/spokes */}
      {teeth.map((angle) => (
        <mesh
          key={angle}
          material={materials.hub}
          position={[
            Math.cos(angle) * 0.27,
            Math.sin(angle) * 0.27,
            discTopZ + 0.016
          ]}
          rotation={[0, 0, angle]}
        >
          <boxGeometry args={[0.2, 0.032, 0.032]} />
        </mesh>
      ))}

      {/* central raised button/cap */}
      <mesh
        material={materials.hub}
        position={[0, 0, discTopZ + 0.032]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.115, 0.16, 0.05, 32]} />
      </mesh>

      {/* small triangular push detail */}
      <mesh
        material={materials.shellEdge}
        position={[0, 0, discTopZ + 0.062]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.085, 0.085, 0.024, 3]} />
      </mesh>
    </group>
  );
}
