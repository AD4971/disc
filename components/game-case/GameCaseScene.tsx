"use client";

import { Environment, Lightformer } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Texture } from "three";
import {
  ACESFilmicToneMapping,
  EquirectangularReflectionMapping,
  LinearSRGBColorSpace
} from "three";
import { EXRLoader } from "three-stdlib";
import { CASE_CAMERA_VIEWS } from "./constants";
import { DiscRevealController } from "./DiscRevealController";
import {
  applyCaseEnvironmentSettings,
  createCaseMaterials,
  disposeCaseMaterials
} from "./materials";
import type { CaseEnvironmentSettings, CaseState } from "./types";
import styles from "./GameCaseScene.module.css";

const ENVIRONMENT_URL = "/environments/studio-silver.exr";

const ENVIRONMENT_SETTINGS: CaseEnvironmentSettings = {
  intensity: 0.85,
  rotation: 3.75
};

export function GameCaseScene() {
  const [caseState, setCaseState] = useState<CaseState>("closed");
  const environmentTexture = useEnvironmentTexture(ENVIRONMENT_URL);
  const materials = useMemo(() => createCaseMaterials(), []);

  useEffect(() => {
    applyCaseEnvironmentSettings(materials, ENVIRONMENT_SETTINGS);
  }, [materials]);

  useEffect(() => {
    return () => {
      disposeCaseMaterials(materials);
    };
  }, [materials]);

  return (
    <main className={styles.scene}>
      <Canvas
        dpr={[1, 2]}
        camera={{
          fov: 38,
          near: 0.1,
          far: 100,
          position: CASE_CAMERA_VIEWS.closed.position
        }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <color attach="background" args={["#050506"]} />
        <ambientLight intensity={0.015} />

        {environmentTexture ? (
          <Environment
            map={environmentTexture}
            background={false}
            environmentIntensity={ENVIRONMENT_SETTINGS.intensity}
            environmentRotation={[0, ENVIRONMENT_SETTINGS.rotation, 0]}
          />
        ) : (
          <Environment resolution={256} environmentIntensity={0.7}>
            <Lightformer
              form="rect"
              intensity={1}
              color="#eaf4ff"
              scale={[7, 2.6, 1]}
              position={[-4.8, 3.5, 3.2]}
              rotation={[-0.55, -0.7, -0.35]}
            />
            <Lightformer
              form="rect"
              intensity={0.5}
              color="#fff2df"
              scale={[1.3, 5.5, 1]}
              position={[4.5, -2.5, 1.2]}
              rotation={[-0.42, 0.86, 0.24]}
            />
          </Environment>
        )}

        <DiscRevealController
          caseState={caseState}
          materials={materials}
          onStateChange={setCaseState}
        />
      </Canvas>

      <p className={styles.hint} data-state={caseState}>
        {caseState === "closed"
          ? "Drag to inspect · Click case to open"
          : caseState === "open"
            ? "Drag to inspect"
            : ""}
      </p>
    </main>
  );
}

function useEnvironmentTexture(url: string) {
  const [texture, setTexture] = useState<Texture | null>(null);
  const textureRef = useRef<Texture | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loader = new EXRLoader();

    loader.load(url, (loadedTexture) => {
      if (cancelled) {
        loadedTexture.dispose();
        return;
      }

      loadedTexture.mapping = EquirectangularReflectionMapping;
      loadedTexture.colorSpace = LinearSRGBColorSpace;
      textureRef.current?.dispose();
      textureRef.current = loadedTexture;
      setTexture(loadedTexture);
    });

    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    return () => {
      textureRef.current?.dispose();
      textureRef.current = null;
    };
  }, []);

  return texture;
}
