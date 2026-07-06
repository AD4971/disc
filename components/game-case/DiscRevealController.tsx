"use client";

import { OrbitControls, useCursor } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import gsap from "gsap";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Group } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { CaseBase } from "./CaseBase";
import { CaseLid } from "./CaseLid";
import {
  CASE_CAMERA_VIEWS,
  CLICK_DRAG_THRESHOLD_PX,
  HINGE_X,
  LID_CLOSED_Z,
  LID_OPEN_ANGLE
} from "./constants";
import { DiscTray } from "./DiscTray";
import { Hinge } from "./Hinge";
import { LockingHub } from "./LockingHub";
import type { CaseMaterials } from "./materials";
import { PlaceholderDisc } from "./PlaceholderDisc";
import type { CaseState } from "./types";

type DiscRevealControllerProps = {
  caseState: CaseState;
  materials: CaseMaterials;
  onStateChange: (state: CaseState) => void;
};

// The single imperative component: owns the lid pivot, the open/close
// gsap timelines, the inspection OrbitControls, and the busy-lock that
// ignores pointer input and disables the controls while a transition
// is running.
export function DiscRevealController({
  caseState,
  materials,
  onStateChange
}: DiscRevealControllerProps) {
  const tiltGroupRef = useRef<Group>(null);
  const lidPivotRef = useRef<Group>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const isBusyRef = useRef(false);
  const stateRef = useRef(caseState);
  const onStateChangeRef = useRef(onStateChange);
  const [hovered, setHovered] = useState(false);
  const { camera } = useThree();

  useCursor(hovered);

  useEffect(() => {
    stateRef.current = caseState;
    onStateChangeRef.current = onStateChange;
  }, [caseState, onStateChange]);

  useEffect(() => {
    camera.position.set(...CASE_CAMERA_VIEWS.closed.position);
    controlsRef.current?.target.set(...CASE_CAMERA_VIEWS.closed.target);
    controlsRef.current?.update();
  }, [camera]);

  // Dev helper for screenshots/review: /game-case?debugView=open jumps
  // straight to the open pose; debugCam/debugTarget=x,y,z override the
  // camera. No effect without the params.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const parseVec = (value: string | null): [number, number, number] | null => {
      const parts = value?.split(",").map(Number) ?? [];
      return parts.length === 3 && parts.every(Number.isFinite)
        ? (parts as [number, number, number])
        : null;
    };

    if (params.get("debugView") === "open" && lidPivotRef.current) {
      lidPivotRef.current.rotation.y = LID_OPEN_ANGLE;
      onStateChangeRef.current("open");
      camera.position.set(...CASE_CAMERA_VIEWS.open.position);
      controlsRef.current?.target.set(...CASE_CAMERA_VIEWS.open.target);
    }

    const debugCam = parseVec(params.get("debugCam"));
    if (debugCam) {
      camera.position.set(...debugCam);
    }

    const debugTarget = parseVec(params.get("debugTarget"));
    if (debugTarget) {
      controlsRef.current?.target.set(...debugTarget);
    }

    controlsRef.current?.update();
  }, [camera]);

  useEffect(() => {
    return () => {
      timelineRef.current?.kill();
    };
  }, []);

  // Builds every transition fresh from the current pose (instead of
  // reversing a stored timeline) so camera moves made with the orbit
  // controls between clicks never cause jumps.
  const playTransition = useCallback(
    (to: "open" | "closed") => {
      const lidPivot = lidPivotRef.current;
      const tiltGroup = tiltGroupRef.current;
      const controls = controlsRef.current;

      if (!lidPivot || !tiltGroup || !controls) {
        return;
      }

      timelineRef.current?.kill();
      gsap.killTweensOf([
        lidPivot.rotation,
        tiltGroup.rotation,
        camera.position,
        controls.target
      ]);

      isBusyRef.current = true;
      controls.enabled = false;
      onStateChangeRef.current("opening");

      const view = CASE_CAMERA_VIEWS[to];
      const timeline = gsap.timeline({
        onComplete: () => {
          isBusyRef.current = false;
          controls.enabled = true;
          onStateChangeRef.current(to);
        }
      });
      timeline.eventCallback("onUpdate", () => controls.update());

      timeline.to(
        tiltGroup.rotation,
        { x: 0, y: 0, duration: 0.3, ease: "power2.out" },
        0
      );
      timeline.to(
        lidPivot.rotation,
        {
          y: to === "open" ? LID_OPEN_ANGLE : 0,
          duration: 1.15,
          ease: "power3.inOut"
        },
        0.05
      );
      timeline.to(
        camera.position,
        {
          x: view.position[0],
          y: view.position[1],
          z: view.position[2],
          duration: 1.15,
          ease: "power3.inOut"
        },
        0.15
      );
      timeline.to(
        controls.target,
        {
          x: view.target[0],
          y: view.target[1],
          z: view.target[2],
          duration: 1.15,
          ease: "power3.inOut"
        },
        0.15
      );

      timelineRef.current = timeline;
    },
    [camera]
  );

  const handleCaseClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();

      // Orbit drags that end on the case must not toggle it.
      if (isBusyRef.current || event.delta > CLICK_DRAG_THRESHOLD_PX) {
        return;
      }

      if (stateRef.current === "closed") {
        playTransition("open");
      } else if (stateRef.current === "open") {
        playTransition("closed");
      }
    },
    [playTransition]
  );

  const handlePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    const tiltGroup = tiltGroupRef.current;

    // Pure hover only — never while orbit-dragging (buttons pressed).
    if (
      isBusyRef.current ||
      stateRef.current !== "closed" ||
      event.buttons !== 0 ||
      !tiltGroup
    ) {
      return;
    }

    gsap.to(tiltGroup.rotation, {
      x: -event.pointer.y * 0.06,
      y: event.pointer.x * 0.1,
      duration: 0.5,
      ease: "power2.out",
      overwrite: "auto"
    });
  }, []);

  const handlePointerOver = useCallback(() => setHovered(true), []);

  const handlePointerOut = useCallback(() => {
    setHovered(false);
    const tiltGroup = tiltGroupRef.current;

    if (isBusyRef.current || stateRef.current !== "closed" || !tiltGroup) {
      return;
    }

    gsap.to(tiltGroup.rotation, {
      x: 0,
      y: 0,
      duration: 0.6,
      ease: "power2.out",
      overwrite: "auto"
    });
  }, []);

  return (
    <>
      <group
        ref={tiltGroupRef}
        onClick={handleCaseClick}
        onPointerMove={handlePointerMove}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <CaseBase materials={materials} />
        <Hinge materials={materials} />
        <DiscTray materials={materials} />
        <LockingHub materials={materials} />
        <PlaceholderDisc materials={materials} />
        <group ref={lidPivotRef} position={[HINGE_X, 0, LID_CLOSED_Z]}>
          <CaseLid materials={materials} />
        </group>
      </group>

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        rotateSpeed={0.85}
        zoomSpeed={0.8}
        minDistance={5}
        maxDistance={17}
        target={CASE_CAMERA_VIEWS.closed.target}
      />
    </>
  );
}
