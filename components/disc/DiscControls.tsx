"use client";

import {
  CircleOff,
  Film,
  FlipVertical2,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward
} from "lucide-react";
import styles from "./DiscControls.module.css";

type DiscControlsProps = {
  autoRotate: boolean;
  isRecordingLoop: boolean;
  onAutoRotateChange: (enabled: boolean) => void;
  onRecordLoop: () => void;
  onReset: () => void;
  onFront: () => void;
  onBack: () => void;
  onFlip: () => void;
};

export function DiscControls({
  autoRotate,
  isRecordingLoop,
  onAutoRotateChange,
  onRecordLoop,
  onReset,
  onFront,
  onBack,
  onFlip
}: DiscControlsProps) {
  return (
    <div className={styles.panel} aria-label="Disc viewer controls">
      <button
        className={`${styles.control} ${autoRotate ? styles.active : ""}`}
        type="button"
        aria-pressed={autoRotate}
        title={autoRotate ? "Turn auto rotate off" : "Turn auto rotate on"}
        onClick={() => onAutoRotateChange(!autoRotate)}
      >
        {autoRotate ? <CircleOff size={17} /> : <Play size={17} />}
        <span>Auto rotate</span>
      </button>

      <button
        className={`${styles.control} ${isRecordingLoop ? styles.active : ""}`}
        type="button"
        aria-pressed={isRecordingLoop}
        disabled={isRecordingLoop}
        title={isRecordingLoop ? "Recording loop in progress" : "Record Loop"}
        onClick={onRecordLoop}
      >
        <Film size={17} />
        <span>{isRecordingLoop ? "Recording…" : "Record Loop"}</span>
      </button>

      <button
        className={styles.iconControl}
        type="button"
        title="Reset view"
        aria-label="Reset view"
        onClick={onReset}
      >
        <RotateCcw size={18} />
      </button>

      <button
        className={styles.iconControl}
        type="button"
        title="Front view"
        aria-label="Front view"
        onClick={onFront}
      >
        <SkipBack size={18} />
      </button>

      <button
        className={styles.iconControl}
        type="button"
        title="Back view"
        aria-label="Back view"
        onClick={onBack}
      >
        <SkipForward size={18} />
      </button>

      <button
        className={styles.control}
        type="button"
        title="Flip disc"
        onClick={onFlip}
      >
        <FlipVertical2 size={17} />
        <span>Flip disc</span>
      </button>
    </div>
  );
}
