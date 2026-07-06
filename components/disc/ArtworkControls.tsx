"use client";

import {
  ChevronDown,
  ImagePlus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload
} from "lucide-react";
import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent
} from "react";
import {
  DEFAULT_ARTWORK_TRANSFORM,
  type DiscArtworkMode,
  type DiscArtworkSlot,
  type DiscArtworkTransform
} from "./discArtwork";
import styles from "./ArtworkControls.module.css";

type ArtworkControlsProps = {
  busy: boolean;
  error: string;
  slot: DiscArtworkSlot | null;
  onFileSelect: (file: File) => void;
  onModeChange: (mode: DiscArtworkMode) => void;
  onRemove: () => void;
  onResetTransform: () => void;
  onTransformChange: (transform: DiscArtworkTransform) => void;
};

export function ArtworkControls({
  busy,
  error,
  slot,
  onFileSelect,
  onModeChange,
  onRemove,
  onResetTransform,
  onTransformChange
}: ArtworkControlsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const artworkMode = slot?.mode ?? "color";

  const chooseFile = () => {
    if (!busy) {
      inputRef.current?.click();
    }
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      onFileSelect(file);
    }

    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    const file = event.dataTransfer.files[0];
    if (file && !busy) {
      onFileSelect(file);
    }
  };

  const handleDrag = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.type === "dragenter" || event.type === "dragover") {
      setDragActive(true);
    } else if (
      !event.relatedTarget ||
      !event.currentTarget.contains(event.relatedTarget as Node)
    ) {
      setDragActive(false);
    }
  };

  const updateTransform = <Key extends keyof DiscArtworkTransform>(
    key: Key,
    value: DiscArtworkTransform[Key]
  ) => {
    if (!slot) {
      return;
    }

    onTransformChange({
      ...slot.transform,
      [key]: value
    });
  };

  return (
    <section
      className={styles.panel}
      data-drag-active={dragActive}
      aria-label="Front artwork"
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        className={styles.hiddenInput}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
        onChange={handleFileInput}
      />

      <header className={styles.header}>
        <ImagePlus aria-hidden="true" size={16} strokeWidth={1.8} />
        <span>Artwork</span>
        {slot ? (
          <button
            className={styles.panelToggle}
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse artwork controls" : "Expand artwork controls"}
            title={expanded ? "Collapse artwork controls" : "Expand artwork controls"}
            onClick={() => setExpanded((value) => !value)}
          >
            <ChevronDown
              aria-hidden="true"
              size={15}
              data-expanded={expanded}
            />
          </button>
        ) : null}
      </header>

      {slot ? (
        <div className={styles.loaded}>
          <div className={styles.fileRow}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slot.previewUrl}
              alt=""
              className={styles.preview}
              data-inverted={
                artworkMode === "mask" && slot.transform.inverted
              }
              data-mode={artworkMode}
            />
            <div className={styles.fileMeta}>
              <strong title={slot.fileName}>{slot.fileName}</strong>
              <span>
                {slot.width} × {slot.height} ·{" "}
                {artworkMode === "color" ? "color print" : "luminance mask"}
              </span>
            </div>
            <button
              className={styles.iconButton}
              type="button"
              title="Remove artwork"
              aria-label="Remove artwork"
              onClick={onRemove}
            >
              <Trash2 size={15} />
            </button>
          </div>

          {expanded ? (
            <>
              <div className={styles.actions}>
                <button type="button" disabled={busy} onClick={chooseFile}>
                  <RefreshCw size={14} />
                  <span>{busy ? "Loading" : "Replace"}</span>
                </button>
                <button type="button" onClick={onResetTransform}>
                  <RotateCcw size={14} />
                  <span>Reset</span>
                </button>
              </div>

              <div className={styles.modeControl} aria-label="Artwork mode">
                <button
                  type="button"
                  aria-pressed={artworkMode === "color"}
                  onClick={() => onModeChange("color")}
                >
                  Color print
                </button>
                <button
                  type="button"
                  aria-pressed={artworkMode === "mask"}
                  onClick={() => onModeChange("mask")}
                >
                  B/W mask
                </button>
              </div>

              {artworkMode === "mask" ? (
                <label className={styles.toggleRow}>
                  <span>Invert mask</span>
                  <input
                    type="checkbox"
                    checked={slot.transform.inverted}
                    onChange={(event) =>
                      updateTransform("inverted", event.target.checked)
                    }
                  />
                </label>
              ) : null}

              <ArtworkSlider
                label="Scale"
                min={0.5}
                max={1.5}
                step={0.01}
                value={slot.transform.scale}
                displayValue={slot.transform.scale.toFixed(2)}
                onChange={(value) => updateTransform("scale", value)}
              />
              <ArtworkSlider
                label="Rotation"
                min={-180}
                max={180}
                step={1}
                value={slot.transform.rotation}
                displayValue={`${Math.round(slot.transform.rotation)}°`}
                onChange={(value) => updateTransform("rotation", value)}
              />
            </>
          ) : null}
        </div>
      ) : (
        <button
          className={styles.dropZone}
          data-drag-active={dragActive}
          type="button"
          disabled={busy}
          onClick={chooseFile}
        >
          <Upload aria-hidden="true" size={18} />
          <span>{busy ? "Preparing artwork" : "Choose or drop artwork"}</span>
          <small>PNG, JPEG, or WebP · 20 MB max</small>
        </button>
      )}

      {error ? <p className={styles.error}>{error}</p> : null}

      {expanded &&
      slot &&
      (slot.transform.scale !== DEFAULT_ARTWORK_TRANSFORM.scale ||
        slot.transform.rotation !== DEFAULT_ARTWORK_TRANSFORM.rotation) ? (
        <span className={styles.modified}>Placement adjusted</span>
      ) : null}
    </section>
  );
}

type ArtworkSliderProps = {
  displayValue: string;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  value: number;
};

function ArtworkSlider({
  displayValue,
  label,
  max,
  min,
  onChange,
  step,
  value
}: ArtworkSliderProps) {
  return (
    <label className={styles.sliderRow}>
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output>{displayValue}</output>
    </label>
  );
}
