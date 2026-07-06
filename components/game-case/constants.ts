import type { Vector3Tuple } from "three";

// Proportions derived from ref/disc case real/* photos: slim portrait
// PS4-style shell wrapping a disc of radius 2 (mirrors DISC_DIMENSIONS
// in components/disc — kept decoupled in v1).
export const CASE_DIMENSIONS = {
  // ~1.15x the disc diameter, matching the 135mm/120mm real-case ratio.
  panelWidth: 4.6,
  panelHeight: 6.05,
  spineDepth: 0.44,
  shellThickness: 0.07,
  cornerRadius: 0.14,
  bevel: 0.015
} as const;

export const PLACEHOLDER_DISC = {
  radius: 2,
  thickness: 0.035,
  hubRadius: 0.34
} as const;

// Spine/hinge on the -X side: opening swings the lid to the LEFT, so
// the clips lid sits on the LEFT and the tray half on the RIGHT when
// open — standard Blu-ray/PS4 case orientation.
export const HINGE_X = -CASE_DIMENSIONS.panelWidth / 2;
export const LID_CLOSED_Z =
  CASE_DIMENSIONS.spineDepth / 2 - CASE_DIMENSIONS.shellThickness / 2;
export const LID_OPEN_ANGLE = -Math.PI * 0.92;

// Inner face of the back panel — tray, hub and disc stack up from here.
export const BACK_INNER_Z =
  -CASE_DIMENSIONS.spineDepth / 2 + CASE_DIMENSIONS.shellThickness;
export const TRAY_FLOOR_HEIGHT = 0.014;
export const TRAY_SEAT_HEIGHT = 0.045;
export const TRAY_SEAT_Z = BACK_INNER_Z + TRAY_SEAT_HEIGHT;
export const DISC_CENTER_Z =
  TRAY_SEAT_Z + 0.004 + PLACEHOLDER_DISC.thickness / 2;

// Slight 3/4 closed framing so the spine thickness on the left reads.
export const CASE_CAMERA_VIEWS = {
  closed: {
    position: [-2.7, 0.9, 9.2] as Vector3Tuple,
    target: [0, 0, 0] as Vector3Tuple
  },
  open: {
    position: [-2.1, 1.9, 12.2] as Vector3Tuple,
    target: [-2.0, 0, 0] as Vector3Tuple
  }
} as const;

// Pointer movement (px) above which a click is treated as a drag.
export const CLICK_DRAG_THRESHOLD_PX = 5;
