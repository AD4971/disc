"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import {
  CylinderGeometry,
  RingGeometry,
  type Texture,
  TorusGeometry
} from "three";
import { DISC_DIMENSIONS } from "./discConstants";
import {
  applyDiscArtworkState,
  applyDiscEnvironmentSettings,
  applyDiscMaterialSettings,
  type DiscEnvironmentSettings,
  type DiscMaterialSettings,
  createPhysicalDiscMaterials
} from "./discMaterials";
import type { DiscArtworkState } from "./discArtwork";

type PhysicalDiscProps = {
  artworkState: DiscArtworkState;
  cinematicEnvironmentRotationRef: RefObject<number>;
  environmentSettings: DiscEnvironmentSettings;
  environmentTexture: Texture | null;
  isRecordingLoop: boolean;
  materialSettings: DiscMaterialSettings;
};

export function PhysicalDisc({
  artworkState,
  cinematicEnvironmentRotationRef,
  environmentSettings,
  environmentTexture,
  isRecordingLoop,
  materialSettings
}: PhysicalDiscProps) {
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
    const frontOverlay = new RingGeometry(innerRadius, outerRadius, segments, 1);
    const backOverlay = new RingGeometry(innerRadius, outerRadius, segments, 1);
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
    const hubInnerBandRadius = innerRadius + 0.05;
    const hubInnerBand = new RingGeometry(
      innerRadius + 0.025,
      hubInnerBandRadius,
      segments,
      1
    );
    const hubFront = new RingGeometry(
      hubInnerBandRadius,
      hubRadius,
      segments,
      1
    );
    const hubBack = new RingGeometry(
      innerRadius + 0.025,
      hubRadius,
      segments,
      1
    );
    const hubOuterBand = new RingGeometry(
      hubRadius,
      labelRadius,
      segments,
      1
    );
    const hubInnerLine = new RingGeometry(
      innerRadius + 0.041,
      innerRadius + 0.047,
      segments,
      1
    );

    frontFace.computeVertexNormals();
    backFace.rotateX(Math.PI);
    backFace.computeVertexNormals();
    frontOverlay.computeVertexNormals();
    backOverlay.rotateX(Math.PI);
    backOverlay.computeVertexNormals();
    hubBack.rotateX(Math.PI);
    outerWall.rotateX(Math.PI / 2);
    innerWall.rotateX(Math.PI / 2);

    return {
      frontFace,
      backFace,
      frontOverlay,
      backOverlay,
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
      hubInnerLine
    };
  }, []);

  const materials = useMemo(() => createPhysicalDiscMaterials("silver"), []);
  const lastCinematicRotationRef = useRef(Number.NaN);

  useEffect(() => {
    applyDiscMaterialSettings(materials, materialSettings);
    applyDiscArtworkState(materials, artworkState);
  }, [artworkState, materialSettings, materials]);

  useEffect(() => {
    applyDiscEnvironmentSettings(
      materials,
      environmentSettings,
      environmentTexture
    );
    lastCinematicRotationRef.current = Number.NaN;
  }, [
    environmentSettings,
    environmentTexture,
    isRecordingLoop,
    materials
  ]);

  useFrame(() => {
    if (!isRecordingLoop) {
      return;
    }

    const rotation = cinematicEnvironmentRotationRef.current;

    if (Math.abs(rotation - lastCinematicRotationRef.current) < 0.000001) {
      return;
    }

    applyDiscEnvironmentSettings(
      materials,
      {
        intensity: environmentSettings.intensity,
        rotation
      },
      environmentTexture
    );
    lastCinematicRotationRef.current = rotation;
  });

  const z = DISC_DIMENSIONS.thickness / 2;
  const overlayOffset = 0.002;
  const hubLift = 0.004;
  const hubDetailLift = 0.006;
  const labelLift = 0.0025;

  return (
    <group>
      <mesh geometry={geometry.frontFace} material={materials.faceFront} position-z={z} />
      <mesh geometry={geometry.backFace} material={materials.faceBack} position-z={-z} />
      <mesh
        geometry={geometry.frontOverlay}
        material={materials.overlayFront}
        position-z={z + overlayOffset}
        renderOrder={2}
      />
      <mesh
        geometry={geometry.backOverlay}
        material={materials.overlayBack}
        position-z={-z - overlayOffset}
        renderOrder={2}
      />

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
    </group>
  );
}
