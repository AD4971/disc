"use client";

import {
  BACK_INNER_Z,
  DISC_CENTER_Z,
  PLACEHOLDER_DISC,
  TRAY_FLOOR_HEIGHT,
  TRAY_SEAT_HEIGHT
} from "./constants";
import type { CaseMaterials } from "./materials";

type DiscTrayProps = {
  materials: CaseMaterials;
};

// Molded tray on the back panel's inner face: shallow recess floor,
// raised outer ring, partial curved ramps top/bottom, small retaining
// tabs overhanging the disc edge, and an inner ring around the hub.
// Layered meshes, no CSG, per the v1 mandate.
export function DiscTray({ materials }: DiscTrayProps) {
  const material = materials.shellEdge;
  const discTopZ = DISC_CENTER_Z + PLACEHOLDER_DISC.thickness / 2;
  const rampArc = Math.PI * 0.55;
  const tabAngles = [30, 150, 210, 330].map((deg) => (deg * Math.PI) / 180);

  return (
    <group>
      {/* shallow recess floor */}
      <mesh
        material={material}
        position={[0, 0, BACK_INNER_Z + TRAY_FLOOR_HEIGHT / 2]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[2.2, 2.2, TRAY_FLOOR_HEIGHT, 96]} />
      </mesh>

      {/* raised outer tray ring */}
      <mesh material={material} position={[0, 0, BACK_INNER_Z + 0.05]}>
        <torusGeometry args={[2.18, 0.04, 12, 96]} />
      </mesh>

      {/* partial curved ramps hugging the disc, top and bottom */}
      {[Math.PI / 2, (3 * Math.PI) / 2].map((center) => (
        <mesh
          key={center}
          material={material}
          position={[0, 0, BACK_INNER_Z + 0.07]}
          rotation={[0, 0, center - rampArc / 2]}
        >
          <torusGeometry args={[2.14, 0.055, 10, 48, rampArc]} />
        </mesh>
      ))}

      {/* small retaining tabs overhanging the disc edge */}
      {tabAngles.map((angle) => (
        <mesh
          key={angle}
          material={material}
          position={[
            Math.cos(angle) * 2.05,
            Math.sin(angle) * 2.05,
            discTopZ + 0.012
          ]}
          rotation={[0, 0, angle]}
        >
          <boxGeometry args={[0.12, 0.07, 0.05]} />
        </mesh>
      ))}

      {/* inner ring around the hub area */}
      <mesh
        material={material}
        position={[0, 0, BACK_INNER_Z + TRAY_FLOOR_HEIGHT + 0.02]}
      >
        <torusGeometry args={[0.55, 0.028, 10, 64]} />
      </mesh>

      {/* raised seat platform the disc center rests on */}
      <mesh
        material={material}
        position={[0, 0, BACK_INNER_Z + TRAY_SEAT_HEIGHT / 2]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.95, 0.95, TRAY_SEAT_HEIGHT, 64]} />
      </mesh>
    </group>
  );
}
