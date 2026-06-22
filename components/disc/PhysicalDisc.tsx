"use client";

import { useMemo } from "react";
import {
  BackSide,
  CylinderGeometry,
  FrontSide,
  MeshPhysicalMaterial,
  RingGeometry,
  TorusGeometry
} from "three";
import { DISC_DIMENSIONS, MATERIAL_COLORS } from "./discConstants";

export function PhysicalDisc() {
  const geometry = useMemo(() => {
    const {
      outerRadius,
      innerRadius,
      labelRadius,
      hubRadius,
      thickness,
      segments
    } = DISC_DIMENSIONS;

    const frontFace = new RingGeometry(innerRadius, outerRadius, segments, 1);
    const backFace = new RingGeometry(innerRadius, outerRadius, segments, 1);
    const outerWall = new CylinderGeometry(
      outerRadius,
      outerRadius,
      thickness,
      segments,
      1,
      true
    );
    const innerWall = new CylinderGeometry(
      innerRadius,
      innerRadius,
      thickness,
      segments,
      1,
      true
    );
    const outerRimFront = new TorusGeometry(outerRadius, 0.0038, 8, segments);
    const outerRimBack = new TorusGeometry(outerRadius, 0.003, 8, segments);
    const innerRimFront = new TorusGeometry(innerRadius, 0.0028, 8, segments);
    const innerRimBack = new TorusGeometry(innerRadius, 0.0022, 8, segments);
    const hubInnerBand = new RingGeometry(innerRadius * 1.1, 0.48, segments, 1);
    const hubFront = new RingGeometry(0.48, hubRadius, segments, 1);
    const hubBack = new RingGeometry(innerRadius * 1.12, hubRadius * 0.96, segments, 1);
    const hubOuterBand = new RingGeometry(hubRadius * 0.94, labelRadius, segments, 1);
    const hubInnerLine = new RingGeometry(0.405, 0.425, segments, 1);
    const hubOuterLine = new RingGeometry(0.705, 0.725, segments, 1);

    frontFace.computeVertexNormals();
    backFace.rotateX(Math.PI);
    backFace.computeVertexNormals();
    hubBack.rotateX(Math.PI);
    outerWall.rotateX(Math.PI / 2);
    innerWall.rotateX(Math.PI / 2);

    return {
      frontFace,
      backFace,
      outerWall,
      innerWall,
      outerRimFront,
      outerRimBack,
      innerRimFront,
      innerRimBack,
      hubInnerBand,
      hubFront,
      hubBack,
      hubOuterBand,
      hubInnerLine,
      hubOuterLine
    };
  }, []);

  const materials = useMemo(() => {
    const faceFront = new MeshPhysicalMaterial({
      color: MATERIAL_COLORS.front,
      metalness: 0.42,
      roughness: 0.34,
      clearcoat: 0.62,
      clearcoatRoughness: 0.38,
      reflectivity: 0.42,
      side: FrontSide
    });

    const faceBack = new MeshPhysicalMaterial({
      color: MATERIAL_COLORS.back,
      metalness: 0.38,
      roughness: 0.42,
      clearcoat: 0.42,
      clearcoatRoughness: 0.45,
      reflectivity: 0.34,
      side: FrontSide
    });

    const wall = new MeshPhysicalMaterial({
      color: "#737b7a",
      metalness: 0.36,
      roughness: 0.36,
      clearcoat: 0.5,
      clearcoatRoughness: 0.42
    });

    const innerWall = new MeshPhysicalMaterial({
      color: "#727a79",
      metalness: 0.24,
      roughness: 0.44,
      clearcoat: 0.3,
      clearcoatRoughness: 0.5,
      side: BackSide
    });

    const rim = new MeshPhysicalMaterial({
      color: MATERIAL_COLORS.rim,
      metalness: 0.52,
      roughness: 0.24,
      clearcoat: 0.7,
      clearcoatRoughness: 0.28
    });

    const hub = new MeshPhysicalMaterial({
      color: "#a7adaa",
      metalness: 0.28,
      roughness: 0.36,
      clearcoat: 0.58,
      clearcoatRoughness: 0.34,
      side: FrontSide
    });

    const hubLight = hub.clone();
    hubLight.color.set("#b3b8b5");

    const hubBack = hub.clone();
    hubBack.color.set("#767d7d");
    hubBack.side = FrontSide;

    const hubLine = hub.clone();
    hubLine.color.set("#7f8785");
    hubLine.roughness = 0.46;
    hubLine.clearcoat = 0.32;

    const label = new MeshPhysicalMaterial({
      color: "#89908d",
      metalness: 0.22,
      roughness: 0.5,
      clearcoat: 0.28,
      clearcoatRoughness: 0.54,
      side: FrontSide
    });

    return { faceFront, faceBack, wall, innerWall, rim, hub, hubLight, hubBack, hubLine, label };
  }, []);

  const z = DISC_DIMENSIONS.thickness / 2;
  const hubLift = 0.004;
  const hubDetailLift = 0.006;
  const labelLift = 0.0025;

  return (
    <group>
      <mesh geometry={geometry.frontFace} material={materials.faceFront} position-z={z} />
      <mesh geometry={geometry.backFace} material={materials.faceBack} position-z={-z} />

      <mesh geometry={geometry.outerWall} material={materials.wall} />
      <mesh geometry={geometry.innerWall} material={materials.innerWall} />

      <mesh geometry={geometry.outerRimFront} material={materials.rim} position-z={z} />
      <mesh geometry={geometry.outerRimBack} material={materials.rim} position-z={-z} />
      <mesh geometry={geometry.innerRimFront} material={materials.rim} position-z={z} />
      <mesh geometry={geometry.innerRimBack} material={materials.rim} position-z={-z} />

      <mesh geometry={geometry.hubInnerBand} material={materials.hubLight} position-z={z + hubDetailLift} />
      <mesh geometry={geometry.hubFront} material={materials.hub} position-z={z + hubLift} />
      <mesh geometry={geometry.hubBack} material={materials.hubBack} position-z={-z - 0.0025} />
      <mesh geometry={geometry.hubOuterBand} material={materials.label} position-z={z + labelLift} />
      <mesh geometry={geometry.hubInnerLine} material={materials.hubLine} position-z={z + hubDetailLift + 0.0005} />
      <mesh geometry={geometry.hubOuterLine} material={materials.hubLine} position-z={z + hubDetailLift + 0.0005} />
    </group>
  );
}
