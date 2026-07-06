"use client";

import { useMemo } from "react";
import { ExtrudeGeometry, Shape } from "three";
import { CASE_DIMENSIONS } from "./constants";
import type { CaseMaterials } from "./materials";

// Rounded-rect panel extruded along Z with a small edge bevel, centered
// on the origin. Corner radius lives in the panel plane, which drei's
// RoundedBox cannot do for slabs thinner than 2x the corner radius.
export function createRoundedPanelGeometry(
  width: number,
  height: number,
  depth: number,
  cornerRadius: number,
  bevel: number
) {
  const hw = width / 2;
  const hh = height / 2;
  const r = cornerRadius;

  const shape = new Shape();
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.absarc(hw - r, -hh + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(hw, hh - r);
  shape.absarc(hw - r, hh - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-hw + r, hh);
  shape.absarc(-hw + r, hh - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-hw, -hh + r);
  shape.absarc(-hw + r, -hh + r, r, Math.PI, Math.PI * 1.5, false);

  const coreDepth = Math.max(depth - bevel * 2, 0.001);
  const geometry = new ExtrudeGeometry(shape, {
    depth: coreDepth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 12
  });
  geometry.translate(0, 0, -coreDepth / 2);

  return geometry;
}

type PanelMoldingsProps = {
  materials: CaseMaterials;
  // Which face of the slab the moldings sit on: +1 = +Z side, -1 = -Z.
  side: 1 | -1;
  // "face" adds the continuous rails + subtle inset; "border" is just
  // the raised outer frame.
  variant?: "face" | "border";
};

// Molded plastic details shared by both panels, in slab-centered local
// coordinates. All simple boxes per the v1 mandate. The free (latch)
// edge is +X in local space for both panels since the spine sits at -X.
export function PanelMoldings({
  materials,
  side,
  variant = "face"
}: PanelMoldingsProps) {
  const { panelWidth: w, panelHeight: h, shellThickness: t } = CASE_DIMENSIONS;
  const material = materials.shellEdge;
  const lift = (height: number) => side * (t / 2 + height / 2);

  const border = (
    <>
      {[1, -1].map((sy) => (
        <mesh
          key={`border-h-${sy}`}
          material={material}
          position={[0, sy * (h / 2 - 0.1), lift(0.04)]}
        >
          <boxGeometry args={[w - 0.16, 0.1, 0.04]} />
        </mesh>
      ))}
      {[1, -1].map((sx) => (
        <mesh
          key={`border-v-${sx}`}
          material={material}
          position={[sx * (w / 2 - 0.1), 0, lift(0.04)]}
        >
          <boxGeometry args={[0.1, h - 0.16, 0.04]} />
        </mesh>
      ))}
    </>
  );

  if (variant === "border") {
    return <group>{border}</group>;
  }

  return (
    <group>
      {border}

      {/* continuous molded rails running across the face, top and
          bottom — single long bars, interrupted only at the frame */}
      {[1, -1].map((sy) => (
        <mesh
          key={`rail-${sy}`}
          material={material}
          position={[0, sy * (h / 2 - 0.3), lift(0.03)]}
        >
          <boxGeometry args={[w - 0.55, 0.055, 0.03]} />
        </mesh>
      ))}

      {/* subtle inset relief frame in the face plastic itself — same
          tone as the panel so it reads molded, not graphic */}
      {[1, -1].map((sy) => (
        <mesh
          key={`inset-h-${sy}`}
          material={materials.shellFace}
          position={[0, sy * (h / 2 - 0.52), lift(0.022)]}
        >
          <boxGeometry args={[w - 1.0, 0.05, 0.022]} />
        </mesh>
      ))}
      {[1, -1].map((sx) => (
        <mesh
          key={`inset-v-${sx}`}
          material={materials.shellFace}
          position={[sx * (w / 2 - 0.5), 0, lift(0.022)]}
        >
          <boxGeometry args={[0.05, h - 1.0, 0.022]} />
        </mesh>
      ))}
    </group>
  );
}

type PerimeterWallsProps = {
  materials: CaseMaterials;
  // Wall height along Z and the Z of the wall's base (inner panel face).
  height: number;
  baseZ: number;
  // Walls rise toward +Z (1) or -Z (-1) from baseZ.
  direction: 1 | -1;
  // How far the walls are pulled in from the panel outline, so the
  // lid's shallow lip can nest inside the base's tall walls.
  inset?: number;
  // Base half: free-edge wall in the denser edge plastic, plus rounded
  // corner posts so the silhouette corners read chunky, not notched.
  denseFreeEdge?: boolean;
};

// Molded side walls on the three non-spine edges (top, bottom, free
// edge). These are what make the closed case read as one solid slim
// box instead of two floating panels with an exposed cavity.
export function PerimeterWalls({
  materials,
  height,
  baseZ,
  direction,
  inset = 0,
  denseFreeEdge = false
}: PerimeterWallsProps) {
  const { panelWidth: w, panelHeight: h, shellThickness: t, cornerRadius } =
    CASE_DIMENSIONS;
  const zCenter = baseZ + (direction * height) / 2;

  return (
    <group>
      {[1, -1].map((sy) => (
        <mesh
          key={`wall-h-${sy}`}
          material={materials.shellFace}
          position={[0, sy * (h / 2 - t / 2 - inset), zCenter]}
        >
          <boxGeometry args={[w - 0.24 - inset * 2, t, height]} />
        </mesh>
      ))}
      <mesh
        material={denseFreeEdge ? materials.shellEdge : materials.shellFace}
        position={[w / 2 - t / 2 - inset, 0, zCenter]}
      >
        <boxGeometry args={[t, h - 0.24 - inset * 2, height]} />
      </mesh>

      {denseFreeEdge &&
        /* corner posts filling the gap between wall ends and the
           panels' rounded corners — chunky rounded silhouette */
        [1, -1].flatMap((sx) =>
          [1, -1].map((sy) => (
            <mesh
              key={`corner-${sx}-${sy}`}
              material={materials.shellFace}
              position={[
                sx * (w / 2 - cornerRadius),
                sy * (h / 2 - cornerRadius),
                zCenter
              ]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[cornerRadius, cornerRadius, height, 24]} />
            </mesh>
          ))
        )}
    </group>
  );
}

type FreeEdgeDetailsProps = {
  materials: CaseMaterials;
};

// Molded detail on the closed case's right/free-edge wall, modeled on
// ref/disc case real/disc side ref.jpeg: a long vertical capsule
// grip/latch panel with a raised lip and recessed channel, two latch
// blocks bridging the seam near top and bottom, and tight seam lines
// where the lid meets the base walls.
export function FreeEdgeDetails({ materials }: FreeEdgeDetailsProps) {
  const { panelWidth: w, panelHeight: h } = CASE_DIMENSIONS;
  // Where the lid's inner face lands on the base walls when closed.
  const seamZ = 0.104;

  const gripLip = useMemo(() => {
    const geometry = createRoundedPanelGeometry(0.2, 2.1, 0.05, 0.095, 0.01);
    geometry.rotateY(Math.PI / 2);
    return geometry;
  }, []);

  const gripChannel = useMemo(() => {
    const geometry = createRoundedPanelGeometry(0.11, 1.98, 0.024, 0.05, 0.006);
    geometry.rotateY(Math.PI / 2);
    return geometry;
  }, []);

  const latchBlock = useMemo(() => {
    const geometry = createRoundedPanelGeometry(0.2, 0.4, 0.045, 0.07, 0.008);
    geometry.rotateY(Math.PI / 2);
    return geometry;
  }, []);

  return (
    <group>
      {/* raised capsule lip, centered on the wall */}
      <mesh
        geometry={gripLip}
        material={materials.shellEdge}
        position={[w / 2 + 0.002, 0, -0.01]}
      />
      {/* recessed channel inside the lip — face plastic, sunk lower */}
      <mesh
        geometry={gripChannel}
        material={materials.shellFace}
        position={[w / 2 + 0.018, 0, -0.01]}
      />

      {/* latch blocks bridging the seam near top and bottom */}
      {[1, -1].map((sy) => (
        <mesh
          key={`latch-${sy}`}
          geometry={latchBlock}
          material={materials.shellEdge}
          position={[w / 2 + 0.004, sy * (h / 2 - 0.5), 0.03]}
        />
      ))}

      {/* tight seam hairlines where the lid lands on the walls */}
      <mesh
        material={materials.shellEdge}
        position={[w / 2 + 0.003, 0, seamZ]}
      >
        <boxGeometry args={[0.006, h - 0.3, 0.02]} />
      </mesh>
      {[1, -1].map((sy) => (
        <mesh
          key={`seam-${sy}`}
          material={materials.shellEdge}
          position={[0, sy * (h / 2 + 0.003), seamZ]}
        >
          <boxGeometry args={[w - 0.3, 0.006, 0.02]} />
        </mesh>
      ))}
    </group>
  );
}

type CaseBaseProps = {
  materials: CaseMaterials;
};

// Fixed half of the shell: back panel plus the thick spine on -X. The
// tray, hub and disc are parented next to this by the controller.
export function CaseBase({ materials }: CaseBaseProps) {
  const { panelWidth, panelHeight, spineDepth, shellThickness, cornerRadius, bevel } =
    CASE_DIMENSIONS;
  const backZ = -spineDepth / 2 + shellThickness / 2;

  const backPanel = useMemo(
    () =>
      createRoundedPanelGeometry(
        panelWidth,
        panelHeight,
        shellThickness,
        cornerRadius,
        bevel
      ),
    [panelWidth, panelHeight, shellThickness, cornerRadius, bevel]
  );

  const spine = useMemo(() => {
    const geometry = createRoundedPanelGeometry(
      spineDepth,
      panelHeight,
      shellThickness,
      cornerRadius,
      bevel
    );
    // Built flat like a panel, then stood up so its depth axis runs
    // along X, forming the left wall of the case.
    geometry.rotateY(Math.PI / 2);
    return geometry;
  }, [spineDepth, panelHeight, shellThickness, cornerRadius, bevel]);

  // Base walls fill nearly the whole cavity depth so the closed case
  // reads as one solid box; a small clearance stays below the lid.
  const wallHeight = spineDepth - shellThickness * 2 - 0.02;
  const innerZ = -spineDepth / 2 + shellThickness;

  return (
    <group>
      <mesh geometry={backPanel} material={materials.shellFace} position={[0, 0, backZ]} />
      <group position={[0, 0, backZ]}>
        <PanelMoldings materials={materials} side={1} variant="border" />
      </group>

      <PerimeterWalls
        materials={materials}
        height={wallHeight}
        baseZ={innerZ}
        direction={1}
        denseFreeEdge
      />
      <FreeEdgeDetails materials={materials} />

      <mesh
        geometry={spine}
        material={materials.shellFace}
        position={[-(panelWidth / 2 - shellThickness / 2), 0, 0]}
      />
      {/* living-hinge crease ridges, flush against the spine surface */}
      {[0.15, -0.15].map((z) => (
        <mesh
          key={`crease-${z}`}
          material={materials.shellEdge}
          position={[-(panelWidth / 2 + 0.003), 0, z]}
        >
          <boxGeometry args={[0.014, panelHeight * 0.97, 0.08]} />
        </mesh>
      ))}
    </group>
  );
}
