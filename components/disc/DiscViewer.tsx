"use client";

import { Environment, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Group, PerspectiveCamera, Vector3Tuple } from "three";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { DiscControls } from "./DiscControls";
import { CAMERA_TARGET, CAMERA_VIEWS } from "./discConstants";
import { PhysicalDisc } from "./PhysicalDisc";
import styles from "./DiscViewer.module.css";

type ViewName = keyof typeof CAMERA_VIEWS;

type DiscSceneProps = {
  autoRotate: boolean;
  command: ViewCommand | null;
  onCommandHandled: () => void;
};

type ViewCommand =
  | { id: number; type: "reset" | "front" | "back" }
  | { id: number; type: "flip" };

export function DiscViewer() {
  const [autoRotate, setAutoRotate] = useState(false);
  const [command, setCommand] = useState<ViewCommand | null>(null);

  const issueCommand = useCallback((type: ViewCommand["type"]) => {
    setCommand({ id: Date.now(), type });
  }, []);

  return (
    <main className={styles.viewer}>
      <Canvas
        shadows
        camera={{
          fov: 38,
          near: 0.1,
          far: 100,
          position: CAMERA_VIEWS.default.position
        }}
        gl={{ antialias: true, alpha: false }}
      >
        <DiscScene
          autoRotate={autoRotate}
          command={command}
          onCommandHandled={() => setCommand(null)}
        />
      </Canvas>

      <DiscControls
        autoRotate={autoRotate}
        onAutoRotateChange={setAutoRotate}
        onReset={() => issueCommand("reset")}
        onFront={() => issueCommand("front")}
        onBack={() => issueCommand("back")}
        onFlip={() => issueCommand("flip")}
      />
    </main>
  );
}

function DiscScene({ autoRotate, command, onCommandHandled }: DiscSceneProps) {
  const discRef = useRef<Group>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  const aspect = size.width / Math.max(size.height, 1);
  const discScale = aspect < 0.75 ? Math.max(0.46, aspect / 1.05) : 1;

  const getResponsivePosition = useCallback(
    (position: Vector3Tuple) => {
      const scale = aspect < 0.75 ? 0.95 / aspect : 1;

      return position.map((value) => value * scale) as Vector3Tuple;
    },
    [aspect]
  );

  const animateCameraTo = useCallback(
    (view: ViewName) => {
      const activeCamera = camera as PerspectiveCamera;
      const controls = controlsRef.current;
      const nextPosition = getResponsivePosition(CAMERA_VIEWS[view].position);
      const nextRotation = CAMERA_VIEWS[view].rotation;

      gsap.killTweensOf(activeCamera.position);
      gsap.killTweensOf(activeCamera);
      if (controls) {
        gsap.killTweensOf(controls.target);
      }

      gsap.to(activeCamera.position, {
        x: nextPosition[0],
        y: nextPosition[1],
        z: nextPosition[2],
        duration: 0.85,
        ease: "power3.inOut",
        onUpdate: () => {
          controls?.update();
        }
      });

      if (controls) {
        gsap.to(controls.target, {
          x: CAMERA_TARGET[0],
          y: CAMERA_TARGET[1],
          z: CAMERA_TARGET[2],
          duration: 0.85,
          ease: "power3.inOut",
          onUpdate: () => controls.update()
        });
      }

      if (discRef.current) {
        gsap.killTweensOf(discRef.current.rotation);
        gsap.to(discRef.current.rotation, {
          x: nextRotation[0],
          y: nextRotation[1],
          z: nextRotation[2],
          duration: 0.85,
          ease: "power3.inOut"
        });
      }
    },
    [camera, getResponsivePosition]
  );

  const flipDisc = useCallback(() => {
    if (!discRef.current) {
      return;
    }

    gsap.killTweensOf(discRef.current.rotation);
    gsap.to(discRef.current.rotation, {
      y: discRef.current.rotation.y + Math.PI,
      duration: 0.92,
      ease: "power3.inOut"
    });
  }, []);

  useEffect(() => {
    const activeCamera = camera as PerspectiveCamera;
    activeCamera.position.set(...getResponsivePosition(CAMERA_VIEWS.default.position));
    activeCamera.lookAt(new Vector3(...CAMERA_TARGET));
    controlsRef.current?.target.set(...CAMERA_TARGET);
    controlsRef.current?.update();
  }, [camera, getResponsivePosition]);

  useEffect(() => {
    if (!command) {
      return;
    }

    if (command.type === "flip") {
      flipDisc();
    } else if (command.type === "reset") {
      animateCameraTo("default");
    } else {
      animateCameraTo(command.type);
    }

    onCommandHandled();
  }, [animateCameraTo, command, flipDisc, onCommandHandled]);

  useFrame((_, delta) => {
    if (autoRotate && discRef.current) {
      discRef.current.rotation.z += delta * 0.22;
    }
  });

  return (
    <>
      <color attach="background" args={["#030303"]} />
      <fog attach="fog" args={["#030303", 7, 11]} />

      <ambientLight intensity={0.34} />
      <directionalLight position={[3, 3.3, 4.6]} intensity={2.3} />
      <directionalLight position={[-2.8, -1.6, -2.2]} intensity={0.66} />
      <pointLight position={[-3.2, 2.2, 2.4]} intensity={9} distance={7.5} />
      <pointLight position={[2.8, -2.5, -2.2]} intensity={3.6} distance={6} />

      <group
        ref={discRef}
        rotation={CAMERA_VIEWS.default.rotation as Vector3Tuple}
        scale={discScale}
      >
        <PhysicalDisc />
      </group>

      <Environment preset="city" environmentIntensity={0.45} />
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableDamping
        dampingFactor={0.075}
        rotateSpeed={0.82}
        zoomSpeed={0.72}
        minDistance={2.25}
        maxDistance={7}
        target={CAMERA_TARGET}
      />
    </>
  );
}
