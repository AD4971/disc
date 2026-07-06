"use client";

import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import gsap from "gsap";
import { SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, RefObject } from "react";
import type {
  Group,
  PerspectiveCamera,
  RectAreaLight,
  Texture,
  Vector3Tuple
} from "three";
import {
  ACESFilmicToneMapping,
  EquirectangularReflectionMapping,
  Euler,
  LinearSRGBColorSpace,
  MathUtils,
  Quaternion,
  Vector2,
  Vector3
} from "three";
import {
  EXRLoader,
  RGBELoader,
  type OrbitControls as OrbitControlsImpl
} from "three-stdlib";
import { ArtworkControls } from "./ArtworkControls";
import { DiscControls } from "./DiscControls";
import {
  createArtworkSlot,
  DEFAULT_ARTWORK_TRANSFORM,
  disposeArtworkSlot,
  type DiscArtworkMode,
  type DiscArtworkState,
  type DiscArtworkTransform,
  validateArtworkFile
} from "./discArtwork";
import { CAMERA_TARGET, CAMERA_VIEWS } from "./discConstants";
import {
  DEFAULT_MATERIAL_SETTINGS,
  OPTICAL_STUDIO_LIGHTS,
  type DiscEnvironmentSettings,
  type DiscMaterialSettings
} from "./discMaterials";
import { PhysicalDisc } from "./PhysicalDisc";
import styles from "./DiscViewer.module.css";

type ViewName = keyof typeof CAMERA_VIEWS;

export type DiscViewerProps = {
  /** Local-axis angular speed in radians per second. */
  spinSpeed?: number;
};

type DiscSceneProps = {
  artworkState: DiscArtworkState;
  autoRotate: boolean;
  cameraZoom: number;
  command: ViewCommand | null;
  environmentSettings: DiscEnvironmentSettings;
  environmentTexture: Texture | null;
  materialSettings: DiscMaterialSettings;
  onCommandHandled: () => void;
  onRecordingLightRotationChange: (rotation: number | null) => void;
  onRecordingLoopComplete: () => void;
  isRecordingLoop: boolean;
  spinSpeed: number;
};

type ViewCommand =
  | { id: number; type: "reset" | "front" | "back" }
  | { id: number; type: "flip" };

type HdriFormat = "hdr" | "exr";

type HdriSource = {
  format: HdriFormat;
  name: string;
  url: string;
};

type HdriStatus = "loading" | "ready" | "error";

const DEFAULT_HDRI_SOURCE: HdriSource = {
  format: "exr",
  name: "Studio Silver",
  url: "/environments/studio-silver.exr"
};

const DEFAULT_ENVIRONMENT_SETTINGS: DiscEnvironmentSettings = {
  intensity: 0.23,
  rotation: 3.75
};

const DEFAULT_SPIN_SPEED = (Math.PI * 2) / 30;
const LOOP_DURATION = 6.5;
const TAU = Math.PI * 2;
const FLIP_ANGLE = Math.PI;
const ANTICIPATION_ANGLE = MathUtils.degToRad(2);
const OVERSHOOT_ANGLE = MathUtils.degToRad(1);
const WOBBLE_ANGLE = MathUtils.degToRad(0.8);
const WOBBLE_DAMPING = 7;
const ANTICIPATION_START = 0.15;
const HERO_FLIP_START = 0.22;
const HERO_FLIP_END = 0.45;
const SETTLE_END = 0.51;
const BACK_HOLD_END = 0.58;
const FRONT_HERO_HOLD_START = 0.88;
const LIGHT_SWEEP_START = 0.2;
const LIGHT_SWEEP_END = 0.56;
const LIGHT_ROTATION_AMOUNT = 1;
const LIGHT_SWEEP_RADIUS = 3.4;
const LIGHT_SWEEP_HEIGHT = 4.2;
const LIGHT_SWEEP_INTENSITY = 0.9;
const MIN_CAMERA_ZOOM = 0.82;
const MAX_CAMERA_ZOOM = 1.18;
const DEFAULT_ZOOM_SLIDER_VALUE = 0.5;
const DRAG_VELOCITY_WINDOW_MS = 110;
const MAX_INERTIA_RADIANS_PER_SECOND = 4.5;
const INERTIA_DECAY_PER_SECOND = 5.5;
const INERTIA_STOP_THRESHOLD = 0.015;

type DragVelocitySample = {
  duration: number;
  pitch: number;
  time: number;
  yaw: number;
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function easeInOutCubic(value: number) {
  const t = clamp01(value);
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeInOutQuart(value: number) {
  const t = clamp01(value);
  return t < 0.5
    ? 8 * t * t * t * t
    : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

function getCinematicLightSweep(progress: number) {
  if (progress <= LIGHT_SWEEP_START) {
    return 0;
  }

  if (progress >= LIGHT_SWEEP_END) {
    return 1;
  }

  return easeInOutCubic(
    (progress - LIGHT_SWEEP_START) /
      (LIGHT_SWEEP_END - LIGHT_SWEEP_START)
  );
}

function getCinematicFlipAngle(progress: number) {
  if (progress < ANTICIPATION_START) {
    return 0;
  }

  if (progress < HERO_FLIP_START) {
    return (
      -ANTICIPATION_ANGLE *
      easeInOutCubic(
        (progress - ANTICIPATION_START) /
          (HERO_FLIP_START - ANTICIPATION_START)
      )
    );
  }

  if (progress < HERO_FLIP_END) {
    return MathUtils.lerp(
      -ANTICIPATION_ANGLE,
      FLIP_ANGLE + OVERSHOOT_ANGLE,
      easeInOutQuart(
        (progress - HERO_FLIP_START) /
          (HERO_FLIP_END - HERO_FLIP_START)
      )
    );
  }

  if (progress < SETTLE_END) {
    const settleProgress =
      (progress - HERO_FLIP_END) / (SETTLE_END - HERO_FLIP_END);
    const settleEnvelope = 1 - settleProgress;
    const settle =
      OVERSHOOT_ANGLE *
        settleEnvelope *
        settleEnvelope *
        Math.cos(settleProgress * TAU) +
      WOBBLE_ANGLE *
        Math.exp(-WOBBLE_DAMPING * settleProgress) *
        Math.sin(settleProgress * Math.PI * 3) *
        settleEnvelope;

    return FLIP_ANGLE + settle;
  }

  if (progress < BACK_HOLD_END) {
    return FLIP_ANGLE;
  }

  if (progress >= FRONT_HERO_HOLD_START) {
    return 0;
  }

  return (
    FLIP_ANGLE *
    (1 -
      easeInOutCubic(
        (progress - BACK_HOLD_END) /
          (FRONT_HERO_HOLD_START - BACK_HOLD_END)
      ))
  );
}

export function DiscViewer({
  spinSpeed = DEFAULT_SPIN_SPEED
}: DiscViewerProps = {}) {
  const [artworkState, setArtworkState] = useState<DiscArtworkState>({
    back: null,
    front: null
  });
  const [artworkBusy, setArtworkBusy] = useState(false);
  const [artworkError, setArtworkError] = useState("");
  const [autoRotate, setAutoRotate] = useState(false);
  const [recordingLightRotation, setRecordingLightRotation] = useState<
    number | null
  >(null);
  const [zoomSliderValue, setZoomSliderValue] = useState(
    DEFAULT_ZOOM_SLIDER_VALUE
  );
  const [isRecordingLoop, setIsRecordingLoop] = useState(false);
  const [command, setCommand] = useState<ViewCommand | null>(null);
  const [environmentSettings, setEnvironmentSettings] =
    useState<DiscEnvironmentSettings>({ ...DEFAULT_ENVIRONMENT_SETTINGS });
  const [hdriSource, setHdriSource] = useState<HdriSource>(DEFAULT_HDRI_SOURCE);
  const [hdriStatus, setHdriStatus] = useState<HdriStatus>("loading");
  const [hdriError, setHdriError] = useState("");
  const [materialSettings, setMaterialSettings] = useState<DiscMaterialSettings>({
    ...DEFAULT_MATERIAL_SETTINGS
  });
  const customObjectUrlRef = useRef<string | null>(null);
  const artworkStateRef = useRef(artworkState);
  const artworkRequestRef = useRef(0);
  const artworkAnisotropyRef = useRef(1);
  const environmentTexture = useHdriTexture(
    hdriSource,
    setHdriStatus,
    setHdriError
  );
  const cameraZoom = MathUtils.lerp(
    MIN_CAMERA_ZOOM,
    MAX_CAMERA_ZOOM,
    zoomSliderValue
  );

  useEffect(() => {
    return () => {
      artworkRequestRef.current += 1;
      disposeArtworkSlot(artworkStateRef.current.front);
      disposeArtworkSlot(artworkStateRef.current.back);

      if (customObjectUrlRef.current) {
        URL.revokeObjectURL(customObjectUrlRef.current);
      }
    };
  }, []);

  const selectArtwork = useCallback(async (file: File) => {
    const requestId = artworkRequestRef.current + 1;
    artworkRequestRef.current = requestId;
    const validationError = validateArtworkFile(file);

    if (validationError) {
      setArtworkBusy(false);
      setArtworkError(validationError);
      return;
    }

    setArtworkBusy(true);
    setArtworkError("");

    try {
      const slot = await createArtworkSlot(
        file,
        artworkAnisotropyRef.current
      );

      if (artworkRequestRef.current !== requestId) {
        disposeArtworkSlot(slot);
        return;
      }

      disposeArtworkSlot(artworkStateRef.current.front);
      const nextState = {
        ...artworkStateRef.current,
        front: slot
      };
      artworkStateRef.current = nextState;
      setArtworkState(nextState);
    } catch {
      if (artworkRequestRef.current === requestId) {
        setArtworkError("This image could not be decoded.");
      }
    } finally {
      if (artworkRequestRef.current === requestId) {
        setArtworkBusy(false);
      }
    }
  }, []);

  const removeArtwork = useCallback(() => {
    artworkRequestRef.current += 1;
    setArtworkBusy(false);
    setArtworkError("");
    disposeArtworkSlot(artworkStateRef.current.front);

    const nextState = {
      ...artworkStateRef.current,
      front: null
    };
    artworkStateRef.current = nextState;
    setArtworkState(nextState);
  }, []);

  const updateArtworkTransform = useCallback(
    (transform: DiscArtworkTransform) => {
      const front = artworkStateRef.current.front;

      if (!front) {
        return;
      }

      const nextState = {
        ...artworkStateRef.current,
        front: {
          ...front,
          transform
        }
      };
      artworkStateRef.current = nextState;
      setArtworkState(nextState);
    },
    []
  );

  const resetArtworkTransform = useCallback(() => {
    const front = artworkStateRef.current.front;

    if (!front) {
      return;
    }

    updateArtworkTransform({
      ...DEFAULT_ARTWORK_TRANSFORM,
      inverted: front.transform.inverted
    });
  }, [updateArtworkTransform]);

  const updateArtworkMode = useCallback((mode: DiscArtworkMode) => {
    const front = artworkStateRef.current.front;

    if (!front) {
      return;
    }

    const nextState = {
      ...artworkStateRef.current,
      front: {
        ...front,
        mode
      }
    };
    artworkStateRef.current = nextState;
    setArtworkState(nextState);
  }, []);

  const issueCommand = useCallback((type: ViewCommand["type"]) => {
    setIsRecordingLoop(false);
    setCommand({ id: Date.now(), type });
  }, []);

  const updateAutoRotate = useCallback((enabled: boolean) => {
    if (enabled) {
      setIsRecordingLoop(false);
    }

    setAutoRotate(enabled);
  }, []);

  const startRecordingLoop = useCallback(() => {
    setAutoRotate(false);
    setIsRecordingLoop(true);
  }, []);

  const completeRecordingLoop = useCallback(() => {
    setRecordingLightRotation(null);
    setIsRecordingLoop(false);
  }, []);

  const updateMaterialSetting = useCallback(
    <Key extends keyof DiscMaterialSettings>(
      key: Key,
      value: DiscMaterialSettings[Key]
    ) => {
      setMaterialSettings((settings) => ({
        ...settings,
        [key]: value
      }));
    },
    []
  );

  const updateEnvironmentSetting = useCallback(
    <Key extends keyof DiscEnvironmentSettings>(
      key: Key,
      value: DiscEnvironmentSettings[Key]
    ) => {
      setEnvironmentSettings((settings) => ({
        ...settings,
        [key]: value
      }));
    },
    []
  );

  const selectHdri = useCallback((file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();

    if (extension !== "hdr" && extension !== "exr") {
      setHdriError("Choose a .hdr or .exr environment.");
      setHdriStatus("error");
      return;
    }

    if (customObjectUrlRef.current) {
      URL.revokeObjectURL(customObjectUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    customObjectUrlRef.current = objectUrl;
    setHdriSource({
      format: extension,
      name: file.name,
      url: objectUrl
    });
  }, []);

  const restoreDefaultHdri = useCallback(() => {
    if (customObjectUrlRef.current) {
      URL.revokeObjectURL(customObjectUrlRef.current);
      customObjectUrlRef.current = null;
    }

    setHdriSource(DEFAULT_HDRI_SOURCE);
  }, []);

  const resetTuning = useCallback(() => {
    setMaterialSettings({ ...DEFAULT_MATERIAL_SETTINGS });
    setEnvironmentSettings({ ...DEFAULT_ENVIRONMENT_SETTINGS });
    setZoomSliderValue(DEFAULT_ZOOM_SLIDER_VALUE);
    restoreDefaultHdri();
  }, [restoreDefaultHdri]);

  return (
    <main className={styles.viewer}>
      <Canvas
        shadows
        dpr={[1, 2.5]}
        camera={{
          fov: 38,
          near: 0.1,
          far: 100,
          position: CAMERA_VIEWS.default.position
        }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.76;
          artworkAnisotropyRef.current = gl.capabilities.getMaxAnisotropy();
        }}
      >
        <DiscScene
          artworkState={artworkState}
          autoRotate={autoRotate}
          cameraZoom={cameraZoom}
          command={command}
          environmentSettings={environmentSettings}
          environmentTexture={environmentTexture}
          materialSettings={materialSettings}
          onCommandHandled={() => setCommand(null)}
          onRecordingLightRotationChange={setRecordingLightRotation}
          onRecordingLoopComplete={completeRecordingLoop}
          isRecordingLoop={isRecordingLoop}
          spinSpeed={spinSpeed}
        />
      </Canvas>

      <ArtworkControls
        busy={artworkBusy}
        error={artworkError}
        slot={artworkState.front}
        onFileSelect={selectArtwork}
        onModeChange={updateArtworkMode}
        onRemove={removeArtwork}
        onResetTransform={resetArtworkTransform}
        onTransformChange={updateArtworkTransform}
      />

      <MaterialColorControls
        cameraZoom={cameraZoom}
        displayedEnvironmentRotation={
          recordingLightRotation ?? environmentSettings.rotation
        }
        environmentSettings={environmentSettings}
        hdriError={hdriError}
        hdriName={hdriSource.name}
        hdriStatus={hdriStatus}
        isCustomHdri={hdriSource !== DEFAULT_HDRI_SOURCE}
        settings={materialSettings}
        onEnvironmentSettingChange={updateEnvironmentSetting}
        onHdriClear={restoreDefaultHdri}
        onHdriSelect={selectHdri}
        onSettingChange={updateMaterialSetting}
        onZoomChange={setZoomSliderValue}
        onReset={resetTuning}
        zoomSliderValue={zoomSliderValue}
      />

      <DiscControls
        autoRotate={autoRotate}
        isRecordingLoop={isRecordingLoop}
        onAutoRotateChange={updateAutoRotate}
        onRecordLoop={startRecordingLoop}
        onReset={() => issueCommand("reset")}
        onFront={() => issueCommand("front")}
        onBack={() => issueCommand("back")}
        onFlip={() => issueCommand("flip")}
      />
    </main>
  );
}

function DiscScene({
  artworkState,
  autoRotate,
  cameraZoom,
  command,
  environmentSettings,
  environmentTexture,
  materialSettings,
  onCommandHandled,
  onRecordingLightRotationChange,
  onRecordingLoopComplete,
  isRecordingLoop,
  spinSpeed
}: DiscSceneProps) {
  const orientationRef = useRef<Group>(null);
  const spinRef = useRef<Group>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const orientationTweenRef = useRef<gsap.core.Tween | null>(null);
  const isAnimatingRef = useRef(false);
  const loopActiveRef = useRef(false);
  const loopStartTimeRef = useRef<number | null>(null);
  const lastLightRotationReportTimeRef = useRef(-Infinity);
  const loopBaseOrientationRef = useRef(new Quaternion());
  const loopMotionEulerRef = useRef(new Euler());
  const loopMotionQuaternionRef = useRef(new Quaternion());
  const loopBaseCameraPositionRef = useRef(new Vector3());
  const loopBaseCameraQuaternionRef = useRef(new Quaternion());
  const loopTargetRef = useRef(new Vector3());
  const loopBaseSpinRef = useRef(0);
  const loopBaseEnvironmentRotationRef = useRef(environmentSettings.rotation);
  const cinematicEnvironmentRotationRef = useRef(environmentSettings.rotation);
  const cinematicLightSweepRef = useRef(0);
  const angularVelocityRef = useRef(new Vector2());
  const frameCameraUpRef = useRef(new Vector3());
  const frameCameraRightRef = useRef(new Vector3());
  const frameYawQuaternionRef = useRef(new Quaternion());
  const framePitchQuaternionRef = useRef(new Quaternion());
  const frameDragQuaternionRef = useRef(new Quaternion());
  const dragRef = useRef({
    active: false,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    samples: [] as DragVelocitySample[],
    pointerId: -1
  });
  const { camera, size } = useThree();
  const sceneCameraRef = useRef(camera as PerspectiveCamera);
  const aspect = size.width / Math.max(size.height, 1);
  const discScale = aspect < 0.75 ? Math.max(0.58, aspect / 0.9) : 1;

  const getResponsivePosition = useCallback(
    (position: Vector3Tuple) => {
      const scale = aspect < 0.75 ? Math.min(1.22, 0.78 / aspect) : 1;

      return position.map((value) => value * scale) as Vector3Tuple;
    },
    [aspect]
  );

  const animateOrientationTo = useCallback(
    (targetQuaternion: Quaternion, duration = 0.85) => {
      const orientation = orientationRef.current;

      if (!orientation) {
        return;
      }

      orientationTweenRef.current?.kill();
      angularVelocityRef.current.set(0, 0);
      isAnimatingRef.current = true;

      const startQuaternion = orientation.quaternion.clone();
      const progress = { value: 0 };

      orientationTweenRef.current = gsap.to(progress, {
        value: 1,
        duration,
        ease: "power3.inOut",
        onUpdate: () => {
          orientation.quaternion
            .slerpQuaternions(startQuaternion, targetQuaternion, progress.value)
            .normalize();
        },
        onComplete: () => {
          orientation.quaternion.copy(targetQuaternion).normalize();
          isAnimatingRef.current = false;
          orientationTweenRef.current = null;
        }
      });
    },
    []
  );

  const animateCameraTo = useCallback(
    (view: ViewName) => {
      const activeCamera = camera as PerspectiveCamera;
      const controls = controlsRef.current;
      const cameraView = view === "back" ? CAMERA_VIEWS.front : CAMERA_VIEWS[view];
      const nextPosition = getResponsivePosition(cameraView.position);
      const nextRotation = CAMERA_VIEWS[view].rotation;
      const targetQuaternion = new Quaternion().setFromEuler(
        new Euler(nextRotation[0], nextRotation[1], nextRotation[2], "XYZ")
      );

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

      animateOrientationTo(targetQuaternion);
    },
    [animateOrientationTo, camera, getResponsivePosition]
  );

  const flipDisc = useCallback(() => {
    const orientation = orientationRef.current;

    if (!orientation) {
      return;
    }

    orientationTweenRef.current?.kill();
    angularVelocityRef.current.set(0, 0);
    isAnimatingRef.current = true;

    const startQuaternion = orientation.quaternion.clone();
    const localFlipAxis = new Vector3(0, 1, 0);
    const localFlipQuaternion = new Quaternion();
    const progress = { value: 0 };

    orientationTweenRef.current = gsap.to(progress, {
      value: 1,
      duration: 1.5,
      ease: "power2.inOut",
      onUpdate: () => {
        localFlipQuaternion.setFromAxisAngle(
          localFlipAxis,
          progress.value * Math.PI * 2
        );
        orientation.quaternion
          .copy(startQuaternion)
          .multiply(localFlipQuaternion)
          .normalize();
      },
      onComplete: () => {
        orientation.quaternion.copy(startQuaternion).normalize();
        isAnimatingRef.current = false;
        orientationTweenRef.current = null;
      }
    });
  }, []);

  useEffect(() => {
    sceneCameraRef.current = camera as PerspectiveCamera;
  }, [camera]);

  useEffect(() => {
    const activeCamera = camera as PerspectiveCamera;
    activeCamera.position.set(...getResponsivePosition(CAMERA_VIEWS.default.position));
    activeCamera.lookAt(new Vector3(...CAMERA_TARGET));
    controlsRef.current?.target.set(...CAMERA_TARGET);
    controlsRef.current?.update();
  }, [camera, getResponsivePosition]);

  useEffect(() => {
    const activeCamera = camera as PerspectiveCamera;

    gsap.killTweensOf(activeCamera, "zoom");
    gsap.to(activeCamera, {
      zoom: cameraZoom,
      duration: 0.28,
      ease: "power2.out",
      onUpdate: () => activeCamera.updateProjectionMatrix()
    });

    return () => {
      gsap.killTweensOf(activeCamera, "zoom");
    };
  }, [camera, cameraZoom]);

  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (
        isRecordingLoop ||
        event.button !== 0 ||
        !orientationRef.current
      ) {
        return;
      }

      orientationTweenRef.current?.kill();
      orientationTweenRef.current = null;
      isAnimatingRef.current = false;
      angularVelocityRef.current.set(0, 0);
      dragRef.current.active = true;
      dragRef.current.lastX = event.nativeEvent.clientX;
      dragRef.current.lastY = event.nativeEvent.clientY;
      dragRef.current.lastTime = event.nativeEvent.timeStamp;
      dragRef.current.samples = [];
      dragRef.current.pointerId = event.pointerId;
      (event.nativeEvent.target as HTMLElement | null)?.setPointerCapture(
        event.pointerId
      );
      event.stopPropagation();
    },
    [isRecordingLoop]
  );

  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const orientation = orientationRef.current;
      const drag = dragRef.current;

      if (!drag.active || drag.pointerId !== event.pointerId || !orientation) {
        return;
      }

      const deltaX = event.nativeEvent.clientX - drag.lastX;
      const deltaY = event.nativeEvent.clientY - drag.lastY;
      const rotationScale =
        3.2 / Math.max(Math.min(size.width, size.height), 320);
      const eventTime = event.nativeEvent.timeStamp;
      const sampleDuration = Math.min(
        Math.max((eventTime - drag.lastTime) / 1000, 1 / 240),
        0.05
      );
      drag.lastX = event.nativeEvent.clientX;
      drag.lastY = event.nativeEvent.clientY;
      drag.lastTime = eventTime;

      frameCameraUpRef.current
        .set(0, 1, 0)
        .applyQuaternion(camera.quaternion)
        .normalize();
      frameCameraRightRef.current
        .set(1, 0, 0)
        .applyQuaternion(camera.quaternion)
        .normalize();

      const yaw = deltaX * rotationScale;
      const pitch = deltaY * rotationScale;
      frameYawQuaternionRef.current.setFromAxisAngle(
        frameCameraUpRef.current,
        yaw
      );
      framePitchQuaternionRef.current.setFromAxisAngle(
        frameCameraRightRef.current,
        pitch
      );
      frameDragQuaternionRef.current
        .copy(frameYawQuaternionRef.current)
        .multiply(framePitchQuaternionRef.current);

      orientation.quaternion
        .premultiply(frameDragQuaternionRef.current)
        .normalize();

      drag.samples.push({
        duration: sampleDuration,
        pitch: pitch / sampleDuration,
        time: eventTime,
        yaw: yaw / sampleDuration
      });
      const sampleCutoff = eventTime - DRAG_VELOCITY_WINDOW_MS;
      while (
        drag.samples.length > 1 &&
        drag.samples[0].time < sampleCutoff
      ) {
        drag.samples.shift();
      }
      event.stopPropagation();
    },
    [camera, size.height, size.width]
  );

  const stopDragging = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const drag = dragRef.current;

      if (!drag.active || event.pointerId !== drag.pointerId) {
        return;
      }

      drag.active = false;
      drag.pointerId = -1;

      const latestSample = drag.samples.at(-1);
      const isFreshRelease =
        event.type === "pointerup" &&
        latestSample &&
        event.nativeEvent.timeStamp - latestSample.time <=
          DRAG_VELOCITY_WINDOW_MS;

      if (!autoRotate && isFreshRelease) {
        let totalDuration = 0;
        let weightedPitch = 0;
        let weightedYaw = 0;

        for (const sample of drag.samples) {
          totalDuration += sample.duration;
          weightedPitch += sample.pitch * sample.duration;
          weightedYaw += sample.yaw * sample.duration;
        }

        if (totalDuration > 0) {
          angularVelocityRef.current
            .set(
              weightedPitch / totalDuration,
              weightedYaw / totalDuration
            )
            .clampLength(0, MAX_INERTIA_RADIANS_PER_SECOND);
        }
      } else {
        angularVelocityRef.current.set(0, 0);
      }

      drag.samples = [];
      const target = event.nativeEvent.target as HTMLElement | null;
      if (target?.hasPointerCapture(event.pointerId)) {
        target.releasePointerCapture(event.pointerId);
      }

      if (angularVelocityRef.current.length() <= INERTIA_STOP_THRESHOLD) {
        angularVelocityRef.current.set(0, 0);
      }

      event.stopPropagation();
    },
    [autoRotate]
  );

  useEffect(() => {
    return () => {
      orientationTweenRef.current?.kill();
    };
  }, []);

  useEffect(() => {
    if (autoRotate) {
      angularVelocityRef.current.set(0, 0);
    }
  }, [autoRotate]);

  const restoreCapturedLoopPose = useCallback(() => {
    const orientation = orientationRef.current;
    const spin = spinRef.current;
    const activeCamera = sceneCameraRef.current;
    const controls = controlsRef.current;

    orientation?.quaternion
      .copy(loopBaseOrientationRef.current)
      .normalize();

    if (spin) {
      spin.rotation.z = loopBaseSpinRef.current;
    }

    activeCamera.position.copy(loopBaseCameraPositionRef.current);
    activeCamera.quaternion
      .copy(loopBaseCameraQuaternionRef.current)
      .normalize();
    controls?.target.copy(loopTargetRef.current);
    cinematicEnvironmentRotationRef.current =
      loopBaseEnvironmentRotationRef.current;
    cinematicLightSweepRef.current = 0;
    onRecordingLightRotationChange(null);
    loopStartTimeRef.current = null;
    loopActiveRef.current = false;
  }, [onRecordingLightRotationChange]);

  useEffect(() => {
    const activeCamera = camera as PerspectiveCamera;
    const controls = controlsRef.current;
    const orientation = orientationRef.current;
    const spin = spinRef.current;

    if (isRecordingLoop) {
      if (loopActiveRef.current || !orientation || !spin) {
        return;
      }

      orientationTweenRef.current?.kill();
      orientationTweenRef.current = null;
      isAnimatingRef.current = false;
      angularVelocityRef.current.set(0, 0);
      gsap.killTweensOf(activeCamera.position);
      gsap.killTweensOf(activeCamera);

      if (controls) {
        gsap.killTweensOf(controls.target);
        loopTargetRef.current.copy(controls.target);
      } else {
        loopTargetRef.current.set(...CAMERA_TARGET);
      }

      loopBaseOrientationRef.current
        .copy(orientation.quaternion)
        .normalize();
      loopBaseCameraPositionRef.current.copy(activeCamera.position);
      loopBaseCameraQuaternionRef.current
        .copy(activeCamera.quaternion)
        .normalize();
      loopBaseSpinRef.current = spin.rotation.z;
      loopBaseEnvironmentRotationRef.current =
        environmentSettings.rotation;
      cinematicEnvironmentRotationRef.current =
        environmentSettings.rotation;
      cinematicLightSweepRef.current = 0;
      lastLightRotationReportTimeRef.current = -Infinity;
      onRecordingLightRotationChange(environmentSettings.rotation);
      loopStartTimeRef.current = null;
      loopActiveRef.current = true;
      return;
    }

    if (!loopActiveRef.current) {
      return;
    }

    restoreCapturedLoopPose();
  }, [
    camera,
    environmentSettings.rotation,
    isRecordingLoop,
    onRecordingLightRotationChange,
    restoreCapturedLoopPose
  ]);

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

  useFrame(({ clock }, delta) => {
    const orientation = orientationRef.current;
    const isDragging = dragRef.current.active;

    if (
      isRecordingLoop &&
      loopActiveRef.current &&
      orientation &&
      spinRef.current
    ) {
      if (loopStartTimeRef.current === null) {
        loopStartTimeRef.current = clock.elapsedTime;
      }

      const elapsed = clock.elapsedTime - loopStartTimeRef.current;
      const rawProgress = elapsed / LOOP_DURATION;
      const progress = clamp01(rawProgress);
      const flipAngle = getCinematicFlipAngle(progress);
      const settleProgress = clamp01(
        (progress - HERO_FLIP_END) / (SETTLE_END - HERO_FLIP_END)
      );
      const settleEnvelope =
        progress >= HERO_FLIP_END && progress < SETTLE_END
          ? Math.exp(-WOBBLE_DAMPING * settleProgress) *
            (1 - settleProgress)
          : 0;
      const settleDrift =
        Math.sin(settleProgress * Math.PI * 3) *
        WOBBLE_ANGLE *
        settleEnvelope;
      const lightSweepProgress = getCinematicLightSweep(progress);
      const lightSweepEnvelope =
        Math.sin(lightSweepProgress * Math.PI) ** 2;
      const activeCamera = sceneCameraRef.current;

      loopMotionEulerRef.current.set(
        flipAngle,
        settleDrift * 0.32,
        settleDrift * 0.18,
        "XYZ"
      );
      loopMotionQuaternionRef.current.setFromEuler(
        loopMotionEulerRef.current
      );
      orientation.quaternion
        .copy(loopBaseOrientationRef.current)
        .multiply(loopMotionQuaternionRef.current)
        .normalize();
      spinRef.current.rotation.z = loopBaseSpinRef.current;
      activeCamera.position.copy(loopBaseCameraPositionRef.current);
      activeCamera.quaternion
        .copy(loopBaseCameraQuaternionRef.current)
        .normalize();
      controlsRef.current?.target.copy(loopTargetRef.current);
      const cinematicEnvironmentRotation =
        loopBaseEnvironmentRotationRef.current +
        lightSweepEnvelope * LIGHT_ROTATION_AMOUNT;
      cinematicEnvironmentRotationRef.current =
        cinematicEnvironmentRotation;
      cinematicLightSweepRef.current = lightSweepProgress;

      if (
        elapsed - lastLightRotationReportTimeRef.current >= 1 / 30 ||
        rawProgress >= 1
      ) {
        lastLightRotationReportTimeRef.current = elapsed;
        onRecordingLightRotationChange(
          MathUtils.euclideanModulo(cinematicEnvironmentRotation, TAU)
        );
      }

      if (rawProgress >= 1) {
        restoreCapturedLoopPose();
        // TODO: Start/stop MediaRecorder here when video export is added.
        onRecordingLoopComplete();
      }

      return;
    }

    if (
      orientation &&
      !autoRotate &&
      !isDragging &&
      !isAnimatingRef.current &&
      angularVelocityRef.current.length() > INERTIA_STOP_THRESHOLD
    ) {
      const frameDelta = Math.min(delta, 0.05);
      const pitch = angularVelocityRef.current.x * frameDelta;
      const yaw = angularVelocityRef.current.y * frameDelta;

      frameCameraUpRef.current
        .set(0, 1, 0)
        .applyQuaternion(camera.quaternion)
        .normalize();
      frameCameraRightRef.current
        .set(1, 0, 0)
        .applyQuaternion(camera.quaternion)
        .normalize();
      frameYawQuaternionRef.current.setFromAxisAngle(
        frameCameraUpRef.current,
        yaw
      );
      framePitchQuaternionRef.current.setFromAxisAngle(
        frameCameraRightRef.current,
        pitch
      );
      frameDragQuaternionRef.current
        .copy(frameYawQuaternionRef.current)
        .multiply(framePitchQuaternionRef.current);
      orientation.quaternion
        .premultiply(frameDragQuaternionRef.current)
        .normalize();
      angularVelocityRef.current.multiplyScalar(
        Math.exp(-frameDelta * INERTIA_DECAY_PER_SECOND)
      );

      if (
        angularVelocityRef.current.length() <= INERTIA_STOP_THRESHOLD
      ) {
        angularVelocityRef.current.set(0, 0);
      }
    }

    if (
      spinRef.current &&
      autoRotate &&
      !isDragging &&
      !isAnimatingRef.current
    ) {
      spinRef.current.rotation.z = MathUtils.euclideanModulo(
        spinRef.current.rotation.z + spinSpeed * delta,
        Math.PI * 2
      );
    }
  });

  return (
    <>
      <color attach="background" args={["#030303"]} />

      <WorldLighting
        cinematicEnvironmentRotationRef={cinematicEnvironmentRotationRef}
        cinematicLightSweepRef={cinematicLightSweepRef}
        environmentSettings={environmentSettings}
        environmentTexture={environmentTexture}
        isRecordingLoop={isRecordingLoop}
      />

      <group scale={discScale}>
        <group
          ref={orientationRef}
          rotation={CAMERA_VIEWS.default.rotation as Vector3Tuple}
        >
          <group ref={spinRef}>
            <PhysicalDisc
              artworkState={artworkState}
              cinematicEnvironmentRotationRef={
                cinematicEnvironmentRotationRef
              }
              environmentSettings={environmentSettings}
              environmentTexture={environmentTexture}
              isRecordingLoop={isRecordingLoop}
              materialSettings={materialSettings}
            />
          </group>
        </group>
      </group>

      <mesh
        position={[0, 0, -0.75]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onLostPointerCapture={stopDragging}
      >
        <planeGeometry args={[18, 18]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          colorWrite={false}
        />
      </mesh>

      <OrbitControls
        ref={controlsRef}
        enabled={!isRecordingLoop}
        enableRotate={false}
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

type MaterialColorControlsProps = {
  cameraZoom: number;
  displayedEnvironmentRotation: number;
  environmentSettings: DiscEnvironmentSettings;
  hdriError: string;
  hdriName: string;
  hdriStatus: HdriStatus;
  isCustomHdri: boolean;
  settings: DiscMaterialSettings;
  onEnvironmentSettingChange: <Key extends keyof DiscEnvironmentSettings>(
    key: Key,
    value: DiscEnvironmentSettings[Key]
  ) => void;
  onHdriClear: () => void;
  onHdriSelect: (file: File) => void;
  onSettingChange: <Key extends keyof DiscMaterialSettings>(
    key: Key,
    value: DiscMaterialSettings[Key]
  ) => void;
  onZoomChange: (value: number) => void;
  onReset: () => void;
  zoomSliderValue: number;
};

function MaterialColorControls({
  cameraZoom,
  displayedEnvironmentRotation,
  environmentSettings,
  hdriError,
  hdriName,
  hdriStatus,
  isCustomHdri,
  settings,
  onEnvironmentSettingChange,
  onHdriClear,
  onHdriSelect,
  onSettingChange,
  onZoomChange,
  onReset,
  zoomSliderValue
}: MaterialColorControlsProps) {
  const setNumber = (key: keyof DiscMaterialSettings) => (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    onSettingChange(key, Number(event.target.value));
  };

  const setEnvironmentNumber = (key: keyof DiscEnvironmentSettings) => (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    onEnvironmentSettingChange(key, Number(event.target.value));
  };

  const handleHdriSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      onHdriSelect(file);
    }

    event.target.value = "";
  };

  return (
    <details className={styles.materialPanel}>
      <summary className={styles.panelSummary}>
        <SlidersHorizontal aria-hidden="true" size={16} strokeWidth={1.8} />
        <span>Disc studio</span>
      </summary>

      <div className={styles.panelBody}>
        <div className={styles.panelHeader}>
          <span>Studio tuning</span>
          <button type="button" onClick={onReset}>
            Reset
          </button>
        </div>

        <div className={styles.sectionLabel}>World lighting</div>
        <MaterialSlider
          label="Intensity"
          min={0.2}
          max={2}
          step={0.01}
          value={environmentSettings.intensity}
          onChange={setEnvironmentNumber("intensity")}
        />
        <MaterialSlider
          label="Rotation"
          min={0}
          max={Math.PI * 2}
          step={0.01}
          value={displayedEnvironmentRotation}
          onChange={setEnvironmentNumber("rotation")}
        />
        <MaterialSlider
          label="Camera Zoom"
          min={0}
          max={1}
          step={0.01}
          value={zoomSliderValue}
          outputValue={cameraZoom}
          onChange={(event) => onZoomChange(Number(event.target.value))}
        />

        <details className={styles.environmentDetails}>
        <summary>Custom environment</summary>
        <div className={styles.environmentBody}>
          <div className={styles.environmentFile}>
            <span>{hdriName}</span>
            <span
              className={styles.environmentStatus}
              data-status={hdriStatus}
            >
              {hdriStatus === "loading"
                ? "Loading"
                : hdriStatus === "error"
                  ? "Error"
                  : "Ready"}
            </span>
          </div>
          {hdriError ? (
            <p className={styles.environmentError}>{hdriError}</p>
          ) : null}
          <div className={styles.environmentActions}>
            <label className={styles.fileButton}>
              Choose HDRI
              <input
                type="file"
                accept=".hdr,.exr,application/octet-stream"
                onChange={handleHdriSelection}
              />
            </label>
            <button
              type="button"
              disabled={!isCustomHdri}
              onClick={onHdriClear}
            >
              Use default
            </button>
          </div>
        </div>
        </details>

        <details className={styles.environmentDetails}>
        <summary>Material color</summary>
        <div className={styles.environmentBody}>
      <label className={styles.colorRow}>
        <span>Base</span>
        <input
          type="color"
          value={settings.baseColor}
          onChange={(event) => onSettingChange("baseColor", event.target.value)}
        />
      </label>

      <MaterialSlider
        label="Diffraction"
        min={0}
        max={1.4}
        step={0.01}
        value={settings.diffractionIntensity}
        onChange={setNumber("diffractionIntensity")}
      />
      <MaterialSlider
        label="Iridescence"
        min={0}
        max={1.4}
        step={0.01}
        value={settings.spectralIntensity}
        onChange={setNumber("spectralIntensity")}
      />
      <MaterialSlider
        label="Visibility"
        min={0}
        max={0.55}
        step={0.01}
        value={settings.frontVisibility}
        onChange={setNumber("frontVisibility")}
      />
      <MaterialSlider
        label="Saturation"
        min={0}
        max={1.2}
        step={0.01}
        value={settings.spectralSaturation}
        onChange={setNumber("spectralSaturation")}
      />
      <MaterialSlider
        label="Brightness"
        min={0.4}
        max={1.8}
        step={0.01}
        value={settings.spectralBrightness}
        onChange={setNumber("spectralBrightness")}
      />
      <MaterialSlider
        label="Cyan"
        min={0}
        max={1.5}
        step={0.01}
        value={settings.cyanStrength}
        onChange={setNumber("cyanStrength")}
      />
      <MaterialSlider
        label="Magenta"
        min={0}
        max={1.5}
        step={0.01}
        value={settings.magentaStrength}
        onChange={setNumber("magentaStrength")}
      />
      <MaterialSlider
        label="Yellow"
        min={0}
        max={1.5}
        step={0.01}
        value={settings.yellowStrength}
        onChange={setNumber("yellowStrength")}
      />
      <MaterialSlider
        label="Violet"
        min={0}
        max={1.5}
        step={0.01}
        value={settings.violetStrength}
        onChange={setNumber("violetStrength")}
      />
        </div>
        </details>
      </div>
    </details>
  );
}

type MaterialSliderProps = {
  label: string;
  min: number;
  max: number;
  outputValue?: number;
  step: number;
  value: number;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

function MaterialSlider({
  label,
  min,
  max,
  outputValue,
  step,
  value,
  onChange
}: MaterialSliderProps) {
  return (
    <label className={styles.sliderRow}>
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
      />
      <output>{(outputValue ?? value).toFixed(2)}</output>
    </label>
  );
}

function useHdriTexture(
  source: HdriSource,
  setStatus: (status: HdriStatus) => void,
  setError: (message: string) => void
) {
  const [texture, setTexture] = useState<Texture | null>(null);
  const textureRef = useRef<Texture | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    let cancelled = false;
    const loader = source.format === "exr" ? new EXRLoader() : new RGBELoader();

    setStatus("loading");
    setError("");

    loader.load(
      source.url,
      (loadedTexture) => {
        if (cancelled || requestRef.current !== requestId) {
          loadedTexture.dispose();
          return;
        }

        loadedTexture.mapping = EquirectangularReflectionMapping;
        loadedTexture.colorSpace = LinearSRGBColorSpace;
        const previousTexture = textureRef.current;
        textureRef.current = loadedTexture;
        setTexture(loadedTexture);
        setStatus("ready");
        previousTexture?.dispose();
      },
      undefined,
      () => {
        if (cancelled || requestRef.current !== requestId) {
          return;
        }

        setError(`Could not load ${source.name}. The previous environment is still active.`);
        setStatus("error");
      }
    );

    return () => {
      cancelled = true;
    };
  }, [setError, setStatus, source]);

  useEffect(() => {
    return () => {
      textureRef.current?.dispose();
    };
  }, []);

  return texture;
}

type WorldLightingProps = {
  cinematicEnvironmentRotationRef: RefObject<number>;
  cinematicLightSweepRef: RefObject<number>;
  environmentSettings: DiscEnvironmentSettings;
  environmentTexture: Texture | null;
  isRecordingLoop: boolean;
};

function WorldLighting({
  cinematicEnvironmentRotationRef,
  cinematicLightSweepRef,
  environmentSettings,
  environmentTexture,
  isRecordingLoop
}: WorldLightingProps) {
  const lightsGroupRef = useRef<Group>(null);
  const fillKickerRef = useRef<RectAreaLight>(null);
  const fillARef = useRef<RectAreaLight>(null);
  const fillBRef = useRef<RectAreaLight>(null);
  const sweepKeyRef = useRef<RectAreaLight>(null);
  const sweepRightRef = useRef(new Vector3());
  const sweepUpRef = useRef(new Vector3());
  const sweepDiagonalRef = useRef(new Vector3());
  const sweepTowardCameraRef = useRef(new Vector3());
  const { camera, scene } = useThree();
  const lightingSceneRef = useRef(scene);

  useEffect(() => {
    lightingSceneRef.current = scene;
  }, [scene]);

  useEffect(() => {
    fillKickerRef.current?.lookAt(0, 0, 0);
    fillARef.current?.lookAt(0, 0, 0);
    fillBRef.current?.lookAt(0, 0, 0);
    sweepKeyRef.current?.lookAt(0, 0, 0);
  }, []);

  useEffect(() => {
    if (isRecordingLoop) {
      return;
    }

    if (lightsGroupRef.current) {
      lightsGroupRef.current.rotation.y = 0;
    }
    if (sweepKeyRef.current) {
      sweepKeyRef.current.intensity = 0;
    }

    lightingSceneRef.current.environmentRotation.set(
      0,
      environmentSettings.rotation,
      0
    );
  }, [environmentSettings.rotation, isRecordingLoop]);

  useFrame(() => {
    if (!isRecordingLoop) {
      return;
    }

    lightingSceneRef.current.environmentRotation.set(
      0,
      cinematicEnvironmentRotationRef.current,
      0
    );

    const sweepKey = sweepKeyRef.current;
    if (sweepKey) {
      const sweepProgress = cinematicLightSweepRef.current;
      const sweepEnvelope = Math.sin(sweepProgress * Math.PI) ** 2;
      const sweepOffset = MathUtils.lerp(
        -LIGHT_SWEEP_RADIUS,
        LIGHT_SWEEP_RADIUS,
        sweepProgress
      );

      sweepRightRef.current
        .set(1, 0, 0)
        .applyQuaternion(camera.quaternion)
        .normalize();
      sweepUpRef.current
        .set(0, 1, 0)
        .applyQuaternion(camera.quaternion)
        .normalize();
      sweepDiagonalRef.current
        .copy(sweepRightRef.current)
        .add(sweepUpRef.current)
        .normalize();
      sweepTowardCameraRef.current
        .copy(camera.position)
        .normalize()
        .multiplyScalar(LIGHT_SWEEP_HEIGHT);

      sweepKey.position
        .copy(sweepTowardCameraRef.current)
        .addScaledVector(sweepDiagonalRef.current, sweepOffset);
      sweepKey.intensity = LIGHT_SWEEP_INTENSITY * sweepEnvelope;
      sweepKey.lookAt(0, 0, 0);
    }
  });

  return (
    <>
      <ambientLight intensity={0.004} />
      <rectAreaLight
        ref={sweepKeyRef}
        width={0.45}
        height={2}
        intensity={0}
        color="#f4f8ff"
      />
      <group ref={lightsGroupRef}>
        <rectAreaLight
          ref={fillKickerRef}
          width={OPTICAL_STUDIO_LIGHTS.kicker.width}
          height={OPTICAL_STUDIO_LIGHTS.kicker.height}
          intensity={OPTICAL_STUDIO_LIGHTS.kicker.intensity}
          color={OPTICAL_STUDIO_LIGHTS.kicker.color}
          position={OPTICAL_STUDIO_LIGHTS.kicker.position}
        />
        <rectAreaLight
          ref={fillARef}
          width={OPTICAL_STUDIO_LIGHTS.fillA.width}
          height={OPTICAL_STUDIO_LIGHTS.fillA.height}
          intensity={OPTICAL_STUDIO_LIGHTS.fillA.intensity}
          color={OPTICAL_STUDIO_LIGHTS.fillA.color}
          position={OPTICAL_STUDIO_LIGHTS.fillA.position}
        />
        <rectAreaLight
          ref={fillBRef}
          width={OPTICAL_STUDIO_LIGHTS.fillB.width}
          height={OPTICAL_STUDIO_LIGHTS.fillB.height}
          intensity={OPTICAL_STUDIO_LIGHTS.fillB.intensity}
          color={OPTICAL_STUDIO_LIGHTS.fillB.color}
          position={OPTICAL_STUDIO_LIGHTS.fillB.position}
        />
      </group>

      {environmentTexture ? (
        <Environment
          map={environmentTexture}
          background={false}
          environmentIntensity={environmentSettings.intensity}
          environmentRotation={[0, environmentSettings.rotation, 0]}
        />
      ) : (
        <ProceduralEnvironmentFallback />
      )}
    </>
  );
}

function ProceduralEnvironmentFallback() {
  return (
    <Environment resolution={256} environmentIntensity={0.72}>
      <Lightformer
        form="rect"
        intensity={1}
        color={OPTICAL_STUDIO_LIGHTS.key.color}
        scale={[7, 2.6, 1]}
        position={OPTICAL_STUDIO_LIGHTS.key.position}
        rotation={[-0.55, -0.7, -0.35]}
      />
      <Lightformer
        form="rect"
        intensity={0.52}
        color={OPTICAL_STUDIO_LIGHTS.kicker.color}
        scale={[1.3, 5.5, 1]}
        position={OPTICAL_STUDIO_LIGHTS.kicker.position}
        rotation={[-0.42, 0.86, 0.24]}
      />
    </Environment>
  );
}
