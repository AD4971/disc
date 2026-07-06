"use client";

import { useMemo } from "react";
import {
  createRoundedPanelGeometry,
  PanelMoldings,
  PerimeterWalls
} from "./CaseBase";
import { CASE_DIMENSIONS } from "./constants";
import type { CaseMaterials } from "./materials";

type CaseLidProps = {
  materials: CaseMaterials;
};

// Front panel slab, positioned relative to the hinge pivot group that
// the controller owns. The spine sits at -X, so the slab extends to +X
// from the pivot and swings open to the left. Inner face (-Z when
// closed) carries the molded frame.
export function CaseLid({ materials }: CaseLidProps) {
  const { panelWidth, panelHeight, shellThickness, cornerRadius, bevel } =
    CASE_DIMENSIONS;

  const panel = useMemo(
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

  return (
    <group position={[panelWidth / 2, 0, 0]}>
      <mesh geometry={panel} material={materials.shellFace} />
      {/* front face of the case: continuous rails + border */}
      <PanelMoldings materials={materials} side={1} variant="face" />
      {/* inner face: raised frame */}
      <PanelMoldings materials={materials} side={-1} variant="border" />
      {/* shallow lip that nests just inside the base walls when closed */}
      <PerimeterWalls
        materials={materials}
        height={0.06}
        baseZ={-shellThickness / 2}
        direction={-1}
        inset={0.1}
      />
    </group>
  );
}
