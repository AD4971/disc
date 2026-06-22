import type { Vector3Tuple } from "three";

export const DISC_DIMENSIONS = {
  outerRadius: 2,
  innerRadius: 0.33,
  labelRadius: 0.92,
  hubRadius: 0.68,
  thickness: 0.035,
  segments: 224
} as const;

export const CAMERA_VIEWS = {
  default: {
    position: [1.18, 0.94, 7.1] as Vector3Tuple,
    rotation: [0.18, -0.24, -0.05] as Vector3Tuple
  },
  front: {
    position: [0, 0, 7.35] as Vector3Tuple,
    rotation: [0, 0, 0] as Vector3Tuple
  },
  back: {
    position: [0, 0, -7.35] as Vector3Tuple,
    rotation: [0, Math.PI, 0] as Vector3Tuple
  }
} as const;

export const CAMERA_TARGET = [0, 0, 0] as Vector3Tuple;

export const MATERIAL_COLORS = {
  front: "#aeb4af",
  back: "#858d8d",
  wall: "#565d5e",
  rim: "#c6ccc8",
  hub: "#a0a5a2",
  innerWall: "#3e4445"
} as const;
