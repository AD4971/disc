import {
  BackSide,
  Color,
  DataUtils,
  FrontSide,
  HalfFloatType,
  MeshPhysicalMaterial,
  NormalBlending,
  ShaderMaterial,
  Texture,
  Vector3
} from "three";
import type { DiscArtworkSlot, DiscArtworkState } from "./discArtwork";
import { DISC_DIMENSIONS } from "./discConstants";

export type DiscMaterialMode = "silver" | "hotPink";

export type DiscEnvironmentSettings = {
  intensity: number;
  rotation: number;
};

export type DiscMaterialSettings = {
  baseColor: string;
  metalness: number;
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  diffractionIntensity: number;
  spectralIntensity: number;
  frontVisibility: number;
  fresnelBoost: number;
  fresnelPower: number;
  grooveDensity: number;
  grooveStrength: number;
  grooveVisibility: number;
  grooveSharpness: number;
  grooveInnerFalloff: number;
  grooveOuterFalloff: number;
  spectralSaturation: number;
  spectralBrightness: number;
  cyanStrength: number;
  magentaStrength: number;
  yellowStrength: number;
  violetStrength: number;
  redCenter: number;
  greenCenter: number;
  blueCenter: number;
  violetCenter: number;
  bandWidth: number;
  pearlWash: number;
  lightX: number;
  lightY: number;
  lightZ: number;
  hueShift: number;
  hubBrightness: number;
  hubGloss: number;
  rimBrightness: number;
  rimReflectivity: number;
};

export const DEFAULT_MATERIAL_SETTINGS: DiscMaterialSettings = {
  baseColor: "#d9ddda",
  metalness: 0.72,
  roughness: 0.29,
  clearcoat: 1,
  clearcoatRoughness: 0.17,
  diffractionIntensity: 0.86,
  spectralIntensity: 0.78,
  frontVisibility: 0.18,
  fresnelBoost: 0.8,
  fresnelPower: 2.4,
  grooveDensity: 850,
  grooveStrength: 0.16,
  grooveVisibility: 0.12,
  grooveSharpness: 0.86,
  grooveInnerFalloff: 0.08,
  grooveOuterFalloff: 0.96,
  spectralSaturation: 0.68,
  spectralBrightness: 1.02,
  cyanStrength: 1,
  magentaStrength: 0.86,
  yellowStrength: 0.92,
  violetStrength: 0.72,
  redCenter: 0.34,
  greenCenter: 0.18,
  blueCenter: -0.02,
  violetCenter: -0.18,
  bandWidth: 0.14,
  pearlWash: 0.42,
  lightX: -4.8,
  lightY: -3.5,
  lightZ: 3.2,
  hueShift: 0,
  hubBrightness: 1.06,
  hubGloss: 0.9,
  rimBrightness: 1.08,
  rimReflectivity: 0.94
};

export const OPTICAL_STUDIO_LIGHTS = {
  key: {
    position: [-4.8, -3.5, 3.2] as const,
    color: "#eaf4ff",
    diffractionWeight: 0.7
  },
  kicker: {
    position: [4.5, -2.5, 1.2] as const,
    color: "#fff2df",
    intensity: 0.035,
    width: 0.35,
    height: 3.6
  },
  fillA: {
    position: [-2.6, 2.8, 4.8] as const,
    color: "#dfeaff",
    intensity: 0.02,
    diffractionWeight: 0.18,
    width: 6.2,
    height: 2.8
  },
  fillB: {
    position: [3.2, -1.8, -4.2] as const,
    color: "#fff8ea",
    intensity: 0.016,
    diffractionWeight: 0.12,
    width: 5.4,
    height: 2.4
  }
} as const;

const MATERIAL_MODES: Record<DiscMaterialMode, { tint: string }> = {
  silver: {
    tint: "#d5d9d4"
  },
  hotPink: {
    tint: "#ff4db8"
  }
};

type EnvironmentLight = {
  angularRadius: number;
  direction: Vector3;
  weight: number;
};

const DEFAULT_ENVIRONMENT_LIGHTS: readonly EnvironmentLight[] = [
  {
    angularRadius: 0.24,
    direction: new Vector3(...OPTICAL_STUDIO_LIGHTS.key.position).normalize(),
    weight: 0.56
  },
  {
    angularRadius: 0.28,
    direction: new Vector3(-0.55, 0.72, 0.42).normalize(),
    weight: 0.27
  },
  {
    angularRadius: 0.2,
    direction: new Vector3(0.62, -0.2, 0.76).normalize(),
    weight: 0.17
  }
];

const environmentLightCache = new WeakMap<Texture, EnvironmentLight[]>();

const ARTWORK_PRINT_INNER_RADIUS =
  DISC_DIMENSIONS.artworkInnerRadius / (DISC_DIMENSIONS.outerRadius * 2);
const ARTWORK_PRINT_OUTER_RADIUS =
  1.945 / (DISC_DIMENSIONS.outerRadius * 2);

const overlayVertexShader = `
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vWorldCenter;
  varying vec3 vWorldNormal;

  void main() {
    vUv = uv;

    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vec4 worldCenter = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);

    vWorldPosition = worldPosition.xyz;
    vWorldCenter = worldCenter.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const overlayFragmentShader = `
  uniform vec3 uBaseTint;
  uniform sampler2D uEnvironmentMap;
  uniform float uHasEnvironment;
  uniform float uEnvironmentIntensity;
  uniform float uEnvironmentRotation;
  uniform vec3 uEnvironmentLightA;
  uniform vec3 uEnvironmentLightB;
  uniform vec3 uEnvironmentLightC;
  uniform float uEnvironmentLightWeightA;
  uniform float uEnvironmentLightWeightB;
  uniform float uEnvironmentLightWeightC;
  uniform float uEnvironmentLightSpreadA;
  uniform float uEnvironmentLightSpreadB;
  uniform float uEnvironmentLightSpreadC;
  uniform vec3 uFillALightPosition;
  uniform vec3 uFillBLightPosition;
  uniform float uFillALightWeight;
  uniform float uFillBLightWeight;
  uniform float uDiffractionIntensity;
  uniform float uSpectralIntensity;
  uniform float uFrontVisibility;
  uniform float uFresnelBoost;
  uniform float uFresnelPower;
  uniform float uGrooveDensity;
  uniform float uGrooveStrength;
  uniform float uGrooveVisibility;
  uniform float uGrooveSharpness;
  uniform float uGrooveInnerFalloff;
  uniform float uGrooveOuterFalloff;
  uniform float uSpectralSaturation;
  uniform float uSpectralBrightness;
  uniform float uCyanStrength;
  uniform float uMagentaStrength;
  uniform float uYellowStrength;
  uniform float uVioletStrength;
  uniform float uBandWidth;
  uniform float uPearlWash;
  uniform float uHueShift;
  uniform float uOpacity;
  uniform sampler2D uArtworkMap;
  uniform float uHasArtwork;
  uniform float uArtworkInvert;
  uniform float uArtworkMode;
  uniform float uArtworkPrintInnerRadius;
  uniform float uArtworkPrintOuterRadius;
  uniform float uArtworkScale;
  uniform float uArtworkRotation;

  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vWorldCenter;
  varying vec3 vWorldNormal;

  const float PI = 3.141592653589793;

  vec3 safeNormalize(vec3 value, vec3 fallback) {
    float len = length(value);
    return len > 0.0001 ? value / len : fallback;
  }

  vec4 artworkSampleAt(vec2 sourceUv) {
    float angle = -uArtworkRotation;
    float sine = sin(angle);
    float cosine = cos(angle);
    vec2 centered = sourceUv - 0.5;
    vec2 rotated = vec2(
      cosine * centered.x - sine * centered.y,
      sine * centered.x + cosine * centered.y
    );
    vec2 sampleUv = rotated / max(uArtworkScale, 0.001) + 0.5;
    float inside =
      step(0.0, sampleUv.x) *
      step(sampleUv.x, 1.0) *
      step(0.0, sampleUv.y) *
      step(sampleUv.y, 1.0);
    vec4 artworkSample = texture2D(
      uArtworkMap,
      clamp(sampleUv, vec2(0.0), vec2(1.0))
    );
    float discRadius = length(sourceUv - 0.5);
    float printFeather = max(fwidth(discRadius) * 1.5, 0.00075);
    float printArea =
      smoothstep(
        uArtworkPrintInnerRadius - printFeather,
        uArtworkPrintInnerRadius + printFeather,
        discRadius
      ) *
      (
        1.0 -
        smoothstep(
          uArtworkPrintOuterRadius - printFeather,
          uArtworkPrintOuterRadius + printFeather,
          discRadius
        )
      );

    artworkSample.a *= inside * printArea;
    return artworkSample;
  }

  float artworkMaskCoverage(vec4 artworkSample) {
    float luminance = dot(
      artworkSample.rgb,
      vec3(0.2126, 0.7152, 0.0722)
    );
    float defaultCoverage = (1.0 - luminance) * artworkSample.a;
    float invertedCoverage = luminance * artworkSample.a;

    return mix(
      defaultCoverage,
      invertedCoverage,
      step(0.5, uArtworkInvert)
    );
  }

  float wavelengthBand(float coordinate, float center, float width) {
    float distanceFromBand = abs(coordinate - center) / max(width, 0.001);
    return exp(-0.5 * distanceFromBand * distanceFromBand);
  }

  vec4 wavelengthResponse(float orderCoordinate, float width) {
    float violetBand = wavelengthBand(orderCoordinate, 0.235, width * 0.82);
    float cyanBand = wavelengthBand(orderCoordinate, 0.278, width);
    float greenBand = wavelengthBand(orderCoordinate, 0.318, width * 1.04);
    float yellowBand = wavelengthBand(orderCoordinate, 0.36, width);
    float magentaBand = wavelengthBand(orderCoordinate, 0.407, width * 0.9);

    vec3 violet = vec3(0.45, 0.2, 1.0) * uVioletStrength;
    vec3 cyan = vec3(0.02, 0.82, 1.0) * uCyanStrength;
    vec3 green = vec3(0.2, 1.0, 0.56) * mix(uCyanStrength, uYellowStrength, 0.5);
    vec3 yellow = vec3(1.0, 0.82, 0.12) * uYellowStrength;
    vec3 magenta = vec3(1.0, 0.1, 0.62) * uMagentaStrength;

    vec3 color =
      violet * violetBand +
      cyan * cyanBand +
      green * greenBand +
      yellow * yellowBand +
      magenta * magentaBand;
    float combinedEnergy =
      violetBand +
      cyanBand +
      greenBand +
      yellowBand +
      magentaBand;
    float coverage = 1.0 - exp(-combinedEnergy * 0.5);

    return vec4(color, coverage);
  }

  vec4 diffractionForLight(
    vec3 lightDirection,
    float lightWeight,
    vec3 normal,
    vec3 viewDirection,
    vec3 radialDirection,
    vec3 tangentDirection,
    float width,
    float sourceSpread
  ) {
    float hemisphere = smoothstep(0.015, 0.2, dot(normal, lightDirection));
    vec3 surfaceMomentum =
      viewDirection +
      lightDirection -
      normal * dot(viewDirection + lightDirection, normal);
    float signedTangentMismatch = dot(surfaceMomentum, tangentDirection);
    float tangentMismatch = abs(signedTangentMismatch);
    float alignmentWidth =
      mix(0.1, 0.18, clamp(width * 5.0, 0.0, 1.0)) +
      sourceSpread * 1.05;
    float normalizedMismatch = tangentMismatch / max(alignmentWidth, 0.001);
    float alignmentCore = exp(-0.5 * normalizedMismatch * normalizedMismatch);
    float tailMismatch = normalizedMismatch / 2.35;
    float alignmentTail = exp(-0.5 * tailMismatch * tailMismatch);
    float grooveAlignment = min(1.0, alignmentCore * 0.82 + alignmentTail * 0.18);

    float signedOrder = dot(surfaceMomentum, radialDirection) * 0.36;
    float angularDispersion = signedTangentMismatch * 0.7;
    float bandWidth =
      mix(0.022, 0.046, clamp((width - 0.08) / 0.12, 0.0, 1.0)) +
      sourceSpread * 0.055;
    vec4 primary = wavelengthResponse(
      signedOrder + angularDispersion,
      bandWidth
    );
    vec4 reverse = wavelengthResponse(
      -signedOrder - angularDispersion,
      bandWidth * 1.06
    ) * 0.22;
    float incidence = mix(0.72, 1.0, sqrt(max(dot(normal, lightDirection), 0.0)));
    float energy = hemisphere * grooveAlignment * incidence * lightWeight;

    return vec4(
      (primary.rgb + reverse.rgb) * energy,
      (primary.a + reverse.a) * energy
    );
  }

  vec4 diffractionForAreaLight(
    vec3 lightDirection,
    float lightWeight,
    float sourceSpread,
    vec3 normal,
    vec3 viewDirection,
    vec3 radialDirection,
    vec3 tangentDirection,
    float width
  ) {
    vec3 helperAxis =
      abs(lightDirection.y) < 0.92
        ? vec3(0.0, 1.0, 0.0)
        : vec3(1.0, 0.0, 0.0);
    vec3 sourceAxis = normalize(cross(helperAxis, lightDirection));
    float sampleAngle = sourceSpread * 0.72;
    vec3 sourceA = normalize(
      lightDirection * cos(sampleAngle) + sourceAxis * sin(sampleAngle)
    );
    vec3 sourceB = normalize(
      lightDirection * cos(sampleAngle) - sourceAxis * sin(sampleAngle)
    );
    vec4 centerResponse = diffractionForLight(
      lightDirection,
      lightWeight * 0.5,
      normal,
      viewDirection,
      radialDirection,
      tangentDirection,
      width,
      sourceSpread * 0.72
    );
    vec4 responseA = diffractionForLight(
      sourceA,
      lightWeight * 0.25,
      normal,
      viewDirection,
      radialDirection,
      tangentDirection,
      width * 1.04,
      sourceSpread * 0.82
    );
    vec4 responseB = diffractionForLight(
      sourceB,
      lightWeight * 0.25,
      normal,
      viewDirection,
      radialDirection,
      tangentDirection,
      width * 1.04,
      sourceSpread * 0.82
    );

    return centerResponse + responseA + responseB;
  }

  vec3 rotateAroundY(vec3 direction, float angle) {
    float sine = sin(angle);
    float cosine = cos(angle);
    return vec3(
      cosine * direction.x + sine * direction.z,
      direction.y,
      -sine * direction.x + cosine * direction.z
    );
  }

  vec2 equirectangularUv(vec3 direction) {
    vec3 rotatedDirection = rotateAroundY(normalize(direction), -uEnvironmentRotation);
    return vec2(
      atan(rotatedDirection.z, rotatedDirection.x) / (2.0 * PI) + 0.5,
      asin(clamp(rotatedDirection.y, -1.0, 1.0)) / PI + 0.5
    );
  }

  float environmentLuminance(vec3 direction) {
    vec3 sampleDirection = normalize(direction);
    vec3 helperAxis =
      abs(sampleDirection.y) < 0.94
        ? vec3(0.0, 1.0, 0.0)
        : vec3(1.0, 0.0, 0.0);
    vec3 tangentA = normalize(cross(helperAxis, sampleDirection));
    vec3 tangentB = normalize(cross(sampleDirection, tangentA));
    float sampleOffset = 0.055;
    vec3 radiance =
      texture2D(uEnvironmentMap, equirectangularUv(sampleDirection)).rgb * 0.4;
    radiance += texture2D(
      uEnvironmentMap,
      equirectangularUv(normalize(sampleDirection + tangentA * sampleOffset))
    ).rgb * 0.15;
    radiance += texture2D(
      uEnvironmentMap,
      equirectangularUv(normalize(sampleDirection - tangentA * sampleOffset))
    ).rgb * 0.15;
    radiance += texture2D(
      uEnvironmentMap,
      equirectangularUv(normalize(sampleDirection + tangentB * sampleOffset))
    ).rgb * 0.15;
    radiance += texture2D(
      uEnvironmentMap,
      equirectangularUv(normalize(sampleDirection - tangentB * sampleOffset))
    ).rgb * 0.15;
    float luminance = dot(radiance, vec3(0.2126, 0.7152, 0.0722));
    return 1.0 - exp(-luminance * uEnvironmentIntensity * 0.7);
  }

  float specularAlignment(vec3 lightDirection, vec3 normal, vec3 viewDirection) {
    vec3 reflectedLight = reflect(-lightDirection, normal);
    return pow(max(dot(reflectedLight, viewDirection), 0.0), 10.0);
  }

  void main() {
    vec2 centeredUv = vUv - 0.5;
    float r = length(centeredUv);
    float printCoverage = 0.0;
    if (uHasArtwork > 0.5) {
      vec4 artworkSample = artworkSampleAt(vUv);
      float maskCoverage = artworkMaskCoverage(artworkSample);
      printCoverage = mix(
        artworkSample.a,
        maskCoverage,
        step(0.5, uArtworkMode)
      );
    }
    float usableDisc =
      smoothstep(
        uArtworkPrintInnerRadius - 0.006,
        uArtworkPrintInnerRadius + 0.014,
        r
      ) *
      (
        1.0 -
        smoothstep(
          uArtworkPrintOuterRadius - 0.018,
          uArtworkPrintOuterRadius + 0.006,
          r
        )
      );
    vec3 N = normalize(vWorldNormal);
    vec3 radialVector = vWorldPosition - vWorldCenter;
    radialVector -= N * dot(radialVector, N);
    vec3 fallbackAxis = abs(N.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
    vec3 fallbackRadial = normalize(cross(fallbackAxis, N));
    vec3 radialDir = safeNormalize(radialVector, fallbackRadial);
    vec3 tangentDir = safeNormalize(cross(N, radialDir), fallbackAxis);
    vec3 V = normalize(cameraPosition - vWorldPosition);
    vec3 environmentLightA = normalize(uEnvironmentLightA);
    vec3 environmentLightB = normalize(uEnvironmentLightB);
    vec3 environmentLightC = normalize(uEnvironmentLightC);
    vec3 fillALight = normalize(uFillALightPosition - vWorldPosition);
    vec3 fillBLight = normalize(uFillBLightPosition - vWorldPosition);

    vec3 reflectionDirection = normalize(reflect(-V, N));
    float environmentEnergy = environmentLuminance(reflectionDirection);
    float width = clamp(uBandWidth, 0.08, 0.2);
    vec4 environmentDiffractionA = diffractionForAreaLight(
      environmentLightA,
      uEnvironmentLightWeightA,
      uEnvironmentLightSpreadA,
      N,
      V,
      radialDir,
      tangentDir,
      width
    );
    vec4 environmentDiffractionB = diffractionForAreaLight(
      environmentLightB,
      uEnvironmentLightWeightB,
      uEnvironmentLightSpreadB,
      N,
      V,
      radialDir,
      tangentDir,
      width * 0.96
    );
    vec4 environmentDiffractionC = diffractionForAreaLight(
      environmentLightC,
      uEnvironmentLightWeightC,
      uEnvironmentLightSpreadC,
      N,
      V,
      radialDir,
      tangentDir,
      width * 0.92
    );
    vec4 fillADiffraction = diffractionForAreaLight(
      fillALight,
      uFillALightWeight * 0.5,
      0.22,
      N,
      V,
      radialDir,
      tangentDir,
      width * 0.94
    );
    vec4 fillBDiffraction = diffractionForAreaLight(
      fillBLight,
      uFillBLightWeight * 0.5,
      0.2,
      N,
      V,
      radialDir,
      tangentDir,
      width * 0.9
    );
    vec3 spectral =
      environmentDiffractionA.rgb * 0.9 +
      environmentDiffractionB.rgb * 1.08 +
      environmentDiffractionC.rgb * 1.12 +
      fillADiffraction.rgb * 1.12 +
      fillBDiffraction.rgb * 1.12;
    float fanEnergy = clamp(
      environmentDiffractionA.a * 0.9 +
      environmentDiffractionB.a * 1.08 +
      environmentDiffractionC.a * 1.12 +
      fillADiffraction.a * 1.12 +
      fillBDiffraction.a * 1.12,
      0.0,
      1.0
    );
    spectral *= mix(0.82, 1.0, environmentEnergy);
    spectral = mix(spectral, spectral.zxy, clamp(uHueShift, 0.0, 1.0));
    float spectralPeak = max(spectral.r, max(spectral.g, spectral.b));
    vec3 spectralColor = spectral / max(spectralPeak, 0.001);
    vec3 spectralGrey = vec3(dot(spectralColor, vec3(0.299, 0.587, 0.114)));
    spectralColor = mix(
      spectralGrey,
      spectralColor,
      clamp(uSpectralSaturation, 0.0, 1.0)
    );
    spectralColor = clamp(spectralColor * uSpectralBrightness, 0.0, 1.0);
    vec3 pearlColor = mix(
      uBaseTint,
      mix(vec3(0.82, 0.94, 1.0), vec3(1.0, 0.9, 0.96), environmentEnergy),
      0.18
    );

    float fresnel = pow(1.0 - abs(dot(N, V)), max(uFresnelPower, 1.0));
    float frontOpacity = 0.045 + clamp(uFrontVisibility, 0.0, 0.55) * 0.12;
    float grazingOpacity = fresnel * (0.055 + uFresnelBoost * 0.045);
    float visibility = clamp(frontOpacity + grazingOpacity, 0.0, 0.16);
    float radialCoverage =
      smoothstep(
        uArtworkPrintInnerRadius - 0.004,
        uArtworkPrintInnerRadius + 0.018,
        r
      ) *
      (
        1.0 -
        smoothstep(
          uArtworkPrintOuterRadius - 0.02,
          uArtworkPrintOuterRadius + 0.006,
          r
        )
      );

    float groovePhase = r * uGrooveDensity;
    float grooveFootprint = max(fwidth(groovePhase), 0.0001);
    float grooveHalfFootprint = grooveFootprint * 0.5;
    float grooveSinc = abs(sin(grooveHalfFootprint) / grooveHalfFootprint);
    float grooveFilter =
      grooveSinc * exp(-0.085 * grooveFootprint * grooveFootprint);
    float grooveAa = max(grooveFootprint * 0.58, 0.035);
    float grooveMicro = 0.5 + 0.5 * cos(groovePhase) * grooveFilter;
    float grooveCrest = smoothstep(
      uGrooveSharpness - grooveAa,
      uGrooveSharpness + grooveAa,
      grooveMicro
    );
    float grooveSheen = mix(grooveMicro, grooveCrest, 0.72) * grooveFilter;
    grooveSheen *= smoothstep(uGrooveInnerFalloff, uGrooveInnerFalloff + 0.14, r);
    grooveSheen *= 1.0 - smoothstep(uGrooveOuterFalloff * 0.5, 0.5, r);

    float highlightResponse =
      specularAlignment(environmentLightA, N, V) * uEnvironmentLightWeightA +
      specularAlignment(environmentLightB, N, V) * uEnvironmentLightWeightB +
      specularAlignment(environmentLightC, N, V) * uEnvironmentLightWeightC +
      specularAlignment(fillALight, N, V) * uFillALightWeight +
      specularAlignment(fillBLight, N, V) * uFillBLightWeight;
    highlightResponse = mix(
      highlightResponse,
      max(highlightResponse, environmentEnergy),
      uHasEnvironment * 0.7
    );
    float grooveLighting = clamp(
      0.06 + highlightResponse * 0.74 + fresnel * 0.2,
      0.0,
      1.0
    );
    float grooveAlpha = grooveSheen * grooveFilter * grooveLighting;
    grooveAlpha *= uGrooveVisibility * uGrooveStrength * 0.55;
    grooveAlpha = min(grooveAlpha, 0.007);

    float controlGain = sqrt(max(uDiffractionIntensity * uSpectralIntensity, 0.0));
    float diffractionAlpha = fanEnergy * visibility * controlGain * 28.0;
    float reflectionGate = mix(
      0.55,
      1.0,
      smoothstep(0.08, 0.58, environmentEnergy)
    );
    diffractionAlpha *= reflectionGate;
    float pearlAlpha = mix(0.008, 0.016, fresnel) * uPearlWash;
    pearlAlpha *= uSpectralIntensity * mix(0.55, 1.0, environmentEnergy);
    float fresnelAlpha = fresnel * uFresnelBoost * 0.018;

    diffractionAlpha *= radialCoverage;
    pearlAlpha *= radialCoverage;
    grooveAlpha *= usableDisc;
    fresnelAlpha *= usableDisc;

    if (uHasArtwork > 0.5) {
      float maskMode = step(0.5, uArtworkMode);
      float diffractionRetention = mix(0.35, 0.74, maskMode);
      float pearlRetention = mix(0.42, 0.76, maskMode);
      float grooveRetention = mix(0.7, 0.9, maskMode);
      float fresnelRetention = mix(0.88, 0.92, maskMode);

      diffractionAlpha *= mix(1.0, diffractionRetention, printCoverage);
      pearlAlpha *= mix(1.0, pearlRetention, printCoverage);
      grooveAlpha *= mix(1.0, grooveRetention, printCoverage);
      fresnelAlpha *= mix(1.0, fresnelRetention, printCoverage);
    }

    vec3 grooveColor = mix(vec3(0.94, 0.98, 1.0), spectralColor, 0.02);
    vec3 fresnelColor = mix(vec3(0.94, 0.98, 1.0), pearlColor, 0.18);
    float totalAlpha = diffractionAlpha + pearlAlpha + grooveAlpha + fresnelAlpha;
    vec3 finalColor =
      spectralColor * diffractionAlpha +
      pearlColor * pearlAlpha +
      grooveColor * grooveAlpha +
      fresnelColor * fresnelAlpha;
    finalColor /= max(totalAlpha, 0.001);

    totalAlpha = clamp(totalAlpha * uOpacity, 0.0, 0.15);
    finalColor = clamp(finalColor, 0.0, 1.0);
    gl_FragColor = vec4(finalColor, totalAlpha);
  }
`;

type DiscMaterialBundle = {
  faceFront: MeshPhysicalMaterial;
  faceBack: MeshPhysicalMaterial;
  wall: MeshPhysicalMaterial;
  innerWall: MeshPhysicalMaterial;
  rim: MeshPhysicalMaterial;
  hub: MeshPhysicalMaterial;
  hubLight: MeshPhysicalMaterial;
  hubBack: MeshPhysicalMaterial;
  hubLine: MeshPhysicalMaterial;
  label: MeshPhysicalMaterial;
  overlayFront: ShaderMaterial;
  overlayBack: ShaderMaterial;
};

type PhysicalGrooveUniforms = {
  uArtworkInvert: { value: number };
  uArtworkMap: { value: Texture | null };
  uArtworkMode: { value: number };
  uArtworkPrintInnerRadius: { value: number };
  uArtworkPrintOuterRadius: { value: number };
  uArtworkRotation: { value: number };
  uArtworkScale: { value: number };
  uDiscGrooveDensity: { value: number };
  uDiscGrooveNormalAmplitude: { value: number };
  uDiscGrooveRoughnessAmplitude: { value: number };
  uHasArtwork: { value: number };
};

function configurePhysicalGrooves(
  material: MeshPhysicalMaterial,
  anisotropyStrength: number
) {
  const uniforms: PhysicalGrooveUniforms = {
    uArtworkInvert: { value: 0 },
    uArtworkMap: { value: null },
    uArtworkMode: { value: 0 },
    uArtworkPrintInnerRadius: { value: ARTWORK_PRINT_INNER_RADIUS },
    uArtworkPrintOuterRadius: { value: ARTWORK_PRINT_OUTER_RADIUS },
    uArtworkRotation: { value: 0 },
    uArtworkScale: { value: 1 },
    uDiscGrooveDensity: { value: 900 },
    uDiscGrooveNormalAmplitude: { value: 0.003 },
    uDiscGrooveRoughnessAmplitude: { value: 0.012 },
    uHasArtwork: { value: 0 }
  };

  material.userData.discGrooveUniforms = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec2 vDiscPosition;
        varying vec3 vDiscRadialView;
        varying vec2 vDiscArtworkUv;`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vDiscPosition = position.xy;
        vDiscArtworkUv = uv;
        vec2 discRadialObject = normalize(position.xy);
        vDiscRadialView = normalize(normalMatrix * vec3(discRadialObject, 0.0));`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform sampler2D uArtworkMap;
        uniform float uHasArtwork;
        uniform float uArtworkInvert;
        uniform float uArtworkMode;
        uniform float uArtworkPrintInnerRadius;
        uniform float uArtworkPrintOuterRadius;
        uniform float uArtworkScale;
        uniform float uArtworkRotation;
        uniform float uDiscGrooveDensity;
        uniform float uDiscGrooveNormalAmplitude;
        uniform float uDiscGrooveRoughnessAmplitude;
        varying vec2 vDiscPosition;
        varying vec3 vDiscRadialView;
        varying vec2 vDiscArtworkUv;

        vec4 discArtworkSampleAt(vec2 sourceUv) {
          float angle = -uArtworkRotation;
          float sine = sin(angle);
          float cosine = cos(angle);
          vec2 centered = sourceUv - 0.5;
          vec2 rotated = vec2(
            cosine * centered.x - sine * centered.y,
            sine * centered.x + cosine * centered.y
          );
          vec2 sampleUv = rotated / max(uArtworkScale, 0.001) + 0.5;
          float inside =
            step(0.0, sampleUv.x) *
            step(sampleUv.x, 1.0) *
            step(0.0, sampleUv.y) *
            step(sampleUv.y, 1.0);
          vec4 artworkSample = texture2D(
            uArtworkMap,
            clamp(sampleUv, vec2(0.0), vec2(1.0))
          );
          float discRadius = length(sourceUv - 0.5);
          float printFeather = max(fwidth(discRadius) * 1.5, 0.00075);
          float printArea =
            smoothstep(
              uArtworkPrintInnerRadius - printFeather,
              uArtworkPrintInnerRadius + printFeather,
              discRadius
            ) *
            (
              1.0 -
              smoothstep(
                uArtworkPrintOuterRadius - printFeather,
                uArtworkPrintOuterRadius + printFeather,
                discRadius
              )
            );

          artworkSample.a *= inside * printArea;
          return artworkSample;
        }

        float discArtworkMaskCoverage(vec4 artworkSample) {
          float luminance = dot(
            artworkSample.rgb,
            vec3(0.2126, 0.7152, 0.0722)
          );
          float defaultCoverage = (1.0 - luminance) * artworkSample.a;
          float invertedCoverage = luminance * artworkSample.a;

          return mix(
            defaultCoverage,
            invertedCoverage,
            step(0.5, uArtworkInvert)
          );
        }`
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        float discArtworkCoverage = 0.0;
        float discMaskMode = step(0.5, uArtworkMode);
        if (uHasArtwork > 0.5) {
          vec4 discArtworkSample = discArtworkSampleAt(vDiscArtworkUv);
          float discMaskCoverage =
            discArtworkMaskCoverage(discArtworkSample);
          discArtworkCoverage = mix(
            discArtworkSample.a,
            discMaskCoverage,
            discMaskMode
          );
          vec3 discAbsorbedSilver =
            diffuseColor.rgb * vec3(0.06, 0.072, 0.068);
          vec3 discPrintColor = mix(
            discArtworkSample.rgb,
            discAbsorbedSilver,
            discMaskMode
          );
          float discColorStrength = mix(0.92, 0.88, discMaskMode);
          diffuseColor.rgb = mix(
            diffuseColor.rgb,
            discPrintColor,
            discArtworkCoverage * discColorStrength
          );
        }`
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        if (uHasArtwork > 0.5) {
          float discColorRoughness = min(roughnessFactor + 0.05, 0.34);
          float discMaskRoughness = min(roughnessFactor + 0.028, 0.31);
          float discPrintRoughness = mix(
            discColorRoughness,
            discMaskRoughness,
            discMaskMode
          );
          roughnessFactor = mix(
            roughnessFactor,
            discPrintRoughness,
            discArtworkCoverage
          );
        }
        float discRadius = length(vDiscPosition);
        float discGroovePhase = discRadius * uDiscGrooveDensity * 0.42;
        float discGrooveFootprint = fwidth(discGroovePhase);
        float discGrooveHalfFootprint = max(discGrooveFootprint * 0.5, 0.0001);
        float discGrooveSinc =
          abs(sin(discGrooveHalfFootprint) / discGrooveHalfFootprint);
        float discGrooveFilter =
          discGrooveSinc *
          exp(-0.085 * discGrooveFootprint * discGrooveFootprint);
        float discGrooveMask =
          smoothstep(
            ${DISC_DIMENSIONS.artworkInnerRadius - 0.02},
            ${DISC_DIMENSIONS.artworkInnerRadius + 0.06},
            discRadius
          ) *
          (1.0 - smoothstep(1.88, 1.99, discRadius));
        if (uHasArtwork > 0.5) {
          float discGrooveRetention = mix(0.7, 0.9, discMaskMode);
          discGrooveMask *= mix(
            1.0,
            discGrooveRetention,
            discArtworkCoverage
          );
        }
        float discGrooveWave = sin(discGroovePhase) * discGrooveFilter;
        float discGrooveRoughness =
          discGrooveWave *
          uDiscGrooveRoughnessAmplitude *
          discGrooveMask;
        roughnessFactor = clamp(roughnessFactor + discGrooveRoughness, 0.04, 1.0);`
      )
      .replace(
        "#include <metalnessmap_fragment>",
        `#include <metalnessmap_fragment>
        if (uHasArtwork > 0.5) {
          float discMaskMetalness = max(metalnessFactor * 0.76, 0.54);
          float discPrintMetalness = mix(
            0.22,
            discMaskMetalness,
            discMaskMode
          );
          float discMetalnessStrength = mix(1.0, 0.8, discMaskMode);
          metalnessFactor = mix(
            metalnessFactor,
            discPrintMetalness,
            discArtworkCoverage * discMetalnessStrength
          );
        }`
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        float discGrooveSlope =
          cos(discGroovePhase) *
          uDiscGrooveNormalAmplitude *
          discGrooveFilter *
          discGrooveMask;
        normal = normalize(normal + normalize(vDiscRadialView) * discGrooveSlope);`
      )
      .replace(
        "#include <lights_physical_fragment>",
        `#include <lights_physical_fragment>
        #ifdef USE_ANISOTROPY
          vec3 discAnisotropyRadial = normalize(
            vDiscRadialView - normal * dot(vDiscRadialView, normal)
          );
          vec3 discAnisotropyTangent = normalize(
            cross(normal, discAnisotropyRadial)
          );
          material.anisotropyT = discAnisotropyRadial;
          material.anisotropyB = discAnisotropyTangent;
        #endif`
      );
  };
  material.anisotropy = anisotropyStrength;
  material.customProgramCacheKey = () => "disc-optical-face-v5";
  material.needsUpdate = true;
}

function updatePhysicalGrooves(
  material: MeshPhysicalMaterial,
  settings: DiscMaterialSettings
) {
  const uniforms = material.userData
    .discGrooveUniforms as PhysicalGrooveUniforms | undefined;

  if (!uniforms) {
    return;
  }

  uniforms.uDiscGrooveDensity.value = Math.min(
    1000,
    Math.max(850, settings.grooveDensity)
  );
  uniforms.uDiscGrooveNormalAmplitude.value = Math.min(
    0.001,
    0.00028 + settings.grooveStrength * 0.0045
  );
  uniforms.uDiscGrooveRoughnessAmplitude.value = Math.min(
    0.0055,
    0.0012 + settings.grooveStrength * 0.022
  );
}

function createOverlayMaterial(mode: DiscMaterialMode = "silver") {
  const config = MATERIAL_MODES[mode];

  return new ShaderMaterial({
    vertexShader: overlayVertexShader,
    fragmentShader: overlayFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: NormalBlending,
    uniforms: {
      uBaseTint: { value: new Color(config.tint) },
      uEnvironmentMap: { value: null },
      uHasEnvironment: { value: 0 },
      uEnvironmentIntensity: { value: 1 },
      uEnvironmentRotation: { value: 0 },
      uEnvironmentLightA: { value: DEFAULT_ENVIRONMENT_LIGHTS[0].direction.clone() },
      uEnvironmentLightB: { value: DEFAULT_ENVIRONMENT_LIGHTS[1].direction.clone() },
      uEnvironmentLightC: { value: DEFAULT_ENVIRONMENT_LIGHTS[2].direction.clone() },
      uEnvironmentLightWeightA: { value: DEFAULT_ENVIRONMENT_LIGHTS[0].weight },
      uEnvironmentLightWeightB: { value: DEFAULT_ENVIRONMENT_LIGHTS[1].weight },
      uEnvironmentLightWeightC: { value: DEFAULT_ENVIRONMENT_LIGHTS[2].weight },
      uEnvironmentLightSpreadA: {
        value: DEFAULT_ENVIRONMENT_LIGHTS[0].angularRadius
      },
      uEnvironmentLightSpreadB: {
        value: DEFAULT_ENVIRONMENT_LIGHTS[1].angularRadius
      },
      uEnvironmentLightSpreadC: {
        value: DEFAULT_ENVIRONMENT_LIGHTS[2].angularRadius
      },
      uFillALightPosition: { value: new Vector3(...OPTICAL_STUDIO_LIGHTS.fillA.position) },
      uFillBLightPosition: { value: new Vector3(...OPTICAL_STUDIO_LIGHTS.fillB.position) },
      uFillALightWeight: { value: OPTICAL_STUDIO_LIGHTS.fillA.diffractionWeight },
      uFillBLightWeight: { value: OPTICAL_STUDIO_LIGHTS.fillB.diffractionWeight },
      uDiffractionIntensity: { value: 0 },
      uSpectralIntensity: { value: 0 },
      uFrontVisibility: { value: 0 },
      uFresnelBoost: { value: 0 },
      uFresnelPower: { value: 2.4 },
      uGrooveDensity: { value: 900 },
      uGrooveStrength: { value: 0 },
      uGrooveVisibility: { value: 0.16 },
      uGrooveSharpness: { value: 0.88 },
      uGrooveInnerFalloff: { value: 0.08 },
      uGrooveOuterFalloff: { value: 0.96 },
      uSpectralSaturation: { value: 0.68 },
      uSpectralBrightness: { value: 0.9 },
      uCyanStrength: { value: 0.9 },
      uMagentaStrength: { value: 0.78 },
      uYellowStrength: { value: 0.84 },
      uVioletStrength: { value: 0.58 },
      uBandWidth: { value: 0.18 },
      uPearlWash: { value: 0.48 },
      uHueShift: { value: 0 },
      uOpacity: { value: 0.24 },
      uArtworkMap: { value: null },
      uHasArtwork: { value: 0 },
      uArtworkInvert: { value: 0 },
      uArtworkMode: { value: 0 },
      uArtworkPrintInnerRadius: { value: ARTWORK_PRINT_INNER_RADIUS },
      uArtworkPrintOuterRadius: { value: ARTWORK_PRINT_OUTER_RADIUS },
      uArtworkScale: { value: 1 },
      uArtworkRotation: { value: 0 }
    },
    side: FrontSide
  });
}

function setOverlayMaterialUniforms(
  material: ShaderMaterial,
  settings: DiscMaterialSettings,
  opacity: number
) {
  material.uniforms.uDiffractionIntensity.value = settings.diffractionIntensity;
  material.uniforms.uSpectralIntensity.value = settings.spectralIntensity;
  material.uniforms.uFrontVisibility.value = settings.frontVisibility;
  material.uniforms.uFresnelBoost.value = settings.fresnelBoost;
  material.uniforms.uFresnelPower.value = settings.fresnelPower;
  material.uniforms.uGrooveDensity.value = settings.grooveDensity;
  material.uniforms.uGrooveStrength.value = settings.grooveStrength;
  material.uniforms.uGrooveVisibility.value = settings.grooveVisibility;
  material.uniforms.uGrooveSharpness.value = settings.grooveSharpness;
  material.uniforms.uGrooveInnerFalloff.value = settings.grooveInnerFalloff;
  material.uniforms.uGrooveOuterFalloff.value = settings.grooveOuterFalloff;
  material.uniforms.uSpectralSaturation.value = settings.spectralSaturation;
  material.uniforms.uSpectralBrightness.value = settings.spectralBrightness;
  material.uniforms.uCyanStrength.value = settings.cyanStrength;
  material.uniforms.uMagentaStrength.value = settings.magentaStrength;
  material.uniforms.uYellowStrength.value = settings.yellowStrength;
  material.uniforms.uVioletStrength.value = settings.violetStrength;
  material.uniforms.uBandWidth.value = settings.bandWidth;
  material.uniforms.uPearlWash.value = settings.pearlWash;
  material.uniforms.uHueShift.value = settings.hueShift;
  material.uniforms.uOpacity.value = opacity;
}

function setPhysicalArtworkUniforms(
  material: MeshPhysicalMaterial,
  slot: DiscArtworkSlot | null
) {
  const uniforms = material.userData
    .discGrooveUniforms as PhysicalGrooveUniforms | undefined;

  if (!uniforms) {
    return;
  }

  uniforms.uArtworkMap.value = slot?.texture ?? null;
  uniforms.uHasArtwork.value = slot ? 1 : 0;
  uniforms.uArtworkInvert.value = slot?.transform.inverted ? 1 : 0;
  uniforms.uArtworkMode.value = (slot?.mode ?? "color") === "mask" ? 1 : 0;
  uniforms.uArtworkPrintInnerRadius.value = ARTWORK_PRINT_INNER_RADIUS;
  uniforms.uArtworkPrintOuterRadius.value = ARTWORK_PRINT_OUTER_RADIUS;
  uniforms.uArtworkScale.value = slot?.transform.scale ?? 1;
  uniforms.uArtworkRotation.value =
    ((slot?.transform.rotation ?? 0) * Math.PI) / 180;
}

function setOverlayArtworkUniforms(
  material: ShaderMaterial,
  slot: DiscArtworkSlot | null
) {
  material.uniforms.uArtworkMap.value = slot?.texture ?? null;
  material.uniforms.uHasArtwork.value = slot ? 1 : 0;
  material.uniforms.uArtworkInvert.value = slot?.transform.inverted ? 1 : 0;
  material.uniforms.uArtworkMode.value =
    (slot?.mode ?? "color") === "mask" ? 1 : 0;
  material.uniforms.uArtworkPrintInnerRadius.value =
    ARTWORK_PRINT_INNER_RADIUS;
  material.uniforms.uArtworkPrintOuterRadius.value =
    ARTWORK_PRINT_OUTER_RADIUS;
  material.uniforms.uArtworkScale.value = slot?.transform.scale ?? 1;
  material.uniforms.uArtworkRotation.value =
    ((slot?.transform.rotation ?? 0) * Math.PI) / 180;
}

type EnvironmentImageData = {
  data?: ArrayLike<number>;
  height?: number;
  width?: number;
};

function readEnvironmentChannel(
  data: ArrayLike<number>,
  index: number,
  isHalfFloat: boolean
) {
  const value = data[index] ?? 0;
  return isHalfFloat ? DataUtils.fromHalfFloat(value) : value;
}

function directionFromEquirectangularUv(u: number, v: number) {
  const longitude = (u - 0.5) * Math.PI * 2;
  const latitude = (v - 0.5) * Math.PI;
  const latitudeRadius = Math.cos(latitude);

  return new Vector3(
    Math.cos(longitude) * latitudeRadius,
    Math.sin(latitude),
    Math.sin(longitude) * latitudeRadius
  ).normalize();
}

function extractEnvironmentLights(texture: Texture) {
  const cached = environmentLightCache.get(texture);

  if (cached) {
    return cached;
  }

  const image = texture.image as EnvironmentImageData | undefined;
  const data = image?.data;
  const width = image?.width ?? 0;
  const height = image?.height ?? 0;

  if (!data || width < 2 || height < 2) {
    return [...DEFAULT_ENVIRONMENT_LIGHTS];
  }

  const channels = Math.max(3, Math.round(data.length / (width * height)));
  const stepX = Math.max(1, Math.floor(width / 128));
  const stepY = Math.max(1, Math.floor(height / 64));
  const isHalfFloat = texture.type === HalfFloatType;
  const candidates: EnvironmentLight[] = [];

  for (let y = stepY; y < height - stepY; y += stepY) {
    const v = y / (height - 1);
    const latitudeWeight = Math.max(0.08, Math.sin(Math.PI * v));

    for (let x = 0; x < width; x += stepX) {
      const index = (y * width + x) * channels;
      const red = readEnvironmentChannel(data, index, isHalfFloat);
      const green = readEnvironmentChannel(data, index + 1, isHalfFloat);
      const blue = readEnvironmentChannel(data, index + 2, isHalfFloat);
      const luminance =
        Math.max(0, red * 0.2126 + green * 0.7152 + blue * 0.0722) *
        latitudeWeight;

      if (!Number.isFinite(luminance) || luminance <= 0) {
        continue;
      }

      candidates.push({
        angularRadius: 0,
        direction: directionFromEquirectangularUv(x / width, v),
        weight: Math.log1p(luminance)
      });
    }
  }

  candidates.sort((a, b) => b.weight - a.weight);
  const selected: EnvironmentLight[] = [];

  for (const candidate of candidates) {
    const separated = selected.every(
      (light) => light.direction.dot(candidate.direction) < 0.86
    );

    if (separated) {
      selected.push(candidate);
    }

    if (selected.length === 3) {
      break;
    }
  }

  while (selected.length < 3) {
    selected.push(DEFAULT_ENVIRONMENT_LIGHTS[selected.length]);
  }

  const softenedWeights = selected.map((light) => Math.sqrt(light.weight));
  const totalWeight = softenedWeights.reduce((sum, weight) => sum + weight, 0);
  const measured = selected.map((light, index) => {
    const minimumContribution = light.weight * 0.12;
    let angularEnergy = 0;
    let neighborhoodEnergy = 0;

    for (const candidate of candidates) {
      const dot = Math.min(1, Math.max(-1, light.direction.dot(candidate.direction)));

      if (dot < 0.9 || candidate.weight < minimumContribution) {
        continue;
      }

      const angle = Math.acos(dot);
      const proximity = Math.exp(-(angle * angle) / (2 * 0.24 * 0.24));
      const contribution = candidate.weight * proximity;
      angularEnergy += angle * angle * contribution;
      neighborhoodEnergy += contribution;
    }

    const measuredRadius =
      neighborhoodEnergy > 0
        ? Math.sqrt(angularEnergy / neighborhoodEnergy) * 1.45
        : 0.22;

    return {
      angularRadius: Math.min(0.3, Math.max(0.18, measuredRadius)),
      direction: light.direction,
      weight: totalWeight > 0 ? softenedWeights[index] / totalWeight : 1 / 3
    };
  });
  const normalized = measured.map((light) => ({
    ...light,
    weight: light.weight * 0.68 + (1 / 3) * 0.32
  }));

  environmentLightCache.set(texture, normalized);
  return normalized;
}

function applyEnvironmentLights(
  material: ShaderMaterial,
  lights: readonly EnvironmentLight[],
  rotation: number,
  intensity: number
) {
  const rotatedLights = lights.map((light) => ({
    angularRadius: light.angularRadius,
    direction: light.direction
      .clone()
      .applyAxisAngle(new Vector3(0, 1, 0), rotation),
    weight: light.weight
  }));

  material.uniforms.uEnvironmentLightA.value.copy(rotatedLights[0].direction);
  material.uniforms.uEnvironmentLightB.value.copy(rotatedLights[1].direction);
  material.uniforms.uEnvironmentLightC.value.copy(rotatedLights[2].direction);
  const intensityScale = Math.min(2, Math.max(0.7, intensity / 0.48));
  material.uniforms.uEnvironmentLightWeightA.value =
    rotatedLights[0].weight * intensityScale;
  material.uniforms.uEnvironmentLightWeightB.value =
    rotatedLights[1].weight * intensityScale;
  material.uniforms.uEnvironmentLightWeightC.value =
    rotatedLights[2].weight * intensityScale;
  material.uniforms.uEnvironmentLightSpreadA.value =
    rotatedLights[0].angularRadius;
  material.uniforms.uEnvironmentLightSpreadB.value =
    rotatedLights[1].angularRadius;
  material.uniforms.uEnvironmentLightSpreadC.value =
    rotatedLights[2].angularRadius;
}

function setOverlayEnvironmentUniforms(
  material: ShaderMaterial,
  settings: DiscEnvironmentSettings,
  texture: Texture | null
) {
  material.uniforms.uEnvironmentMap.value = texture;
  material.uniforms.uHasEnvironment.value = texture ? 1 : 0;
  material.uniforms.uEnvironmentIntensity.value = settings.intensity;
  material.uniforms.uEnvironmentRotation.value = settings.rotation;
  applyEnvironmentLights(
    material,
    texture ? extractEnvironmentLights(texture) : DEFAULT_ENVIRONMENT_LIGHTS,
    settings.rotation,
    settings.intensity
  );
}

function applyPhysicalBase(material: MeshPhysicalMaterial, settings: DiscMaterialSettings) {
  material.color.set(settings.baseColor);
  material.metalness = settings.metalness;
  material.roughness = settings.roughness;
  material.clearcoat = settings.clearcoat;
  material.clearcoatRoughness = settings.clearcoatRoughness;
  material.reflectivity = 0.76;
  material.envMapIntensity = 0.48;
  material.anisotropy = 0.022;
  material.transparent = false;
  material.opacity = 1;
  material.transmission = 0;
}

export function applyDiscMaterialSettings(
  materials: DiscMaterialBundle,
  settings: DiscMaterialSettings
) {
  applyPhysicalBase(materials.faceFront, settings);
  updatePhysicalGrooves(materials.faceFront, settings);
  updatePhysicalGrooves(materials.faceBack, settings);

  materials.faceBack.color.set(settings.baseColor).multiplyScalar(0.98);
  materials.faceBack.metalness = Math.max(0.64, settings.metalness - 0.04);
  materials.faceBack.roughness = Math.min(0.31, settings.roughness + 0.02);
  materials.faceBack.clearcoat = Math.max(0.86, settings.clearcoat - 0.04);
  materials.faceBack.clearcoatRoughness = Math.min(
    0.18,
    settings.clearcoatRoughness + 0.015
  );
  materials.faceBack.reflectivity = 0.72;
  materials.faceBack.envMapIntensity = 0.54;
  materials.faceBack.anisotropy = 0.018;
  materials.faceBack.transparent = false;
  materials.faceBack.opacity = 1;
  materials.faceBack.transmission = 0;

  materials.wall.color.set(settings.baseColor).multiplyScalar(0.9);
  materials.wall.metalness = Math.max(0.45, settings.metalness - 0.06);
  materials.wall.roughness = Math.min(0.3, settings.roughness + 0.02);
  materials.wall.clearcoat = Math.max(0.7, settings.clearcoat - 0.06);
  materials.wall.clearcoatRoughness = Math.min(0.16, settings.clearcoatRoughness + 0.025);

  materials.innerWall.color.set(settings.baseColor).multiplyScalar(0.94);
  materials.innerWall.metalness = 0.18;
  materials.innerWall.roughness = 0.22;
  materials.innerWall.clearcoat = 0.92;
  materials.innerWall.clearcoatRoughness = 0.08;
  materials.innerWall.envMapIntensity = 1.2;
  materials.innerWall.reflectivity = 0.76;
  materials.innerWall.ior = 1.49;
  materials.innerWall.specularIntensity = 0.82;
  materials.innerWall.transmission = 0;

  materials.rim.color
    .set("#9fafa9")
    .multiplyScalar(Math.min(0.98, 0.88 + settings.rimBrightness * 0.05));
  materials.rim.metalness = 0.08;
  materials.rim.roughness = 0.055;
  materials.rim.clearcoat = 1;
  materials.rim.clearcoatRoughness = 0.035;
  materials.rim.reflectivity = 0.46;
  materials.rim.envMapIntensity = 0.5;
  materials.rim.ior = 1.49;
  materials.rim.transmission = 0.22;
  materials.rim.thickness = 0.02;
  materials.rim.specularIntensity = 0.66;

  materials.hub.color
    .set("#c7cfcc")
    .multiplyScalar(Math.min(1, 0.94 + settings.hubBrightness * 0.025));
  materials.hub.metalness = 0.12;
  materials.hub.roughness = Math.max(0.07, 0.125 - settings.hubGloss * 0.035);
  materials.hub.clearcoat = 1;
  materials.hub.clearcoatRoughness = 0.045;
  materials.hub.reflectivity = 0.54;
  materials.hub.envMapIntensity = 0.68;
  materials.hub.ior = 1.49;
  materials.hub.transmission = 0;
  materials.hub.thickness = 0;
  materials.hub.specularIntensity = 0.72;
  materials.hub.specularColor.set("#edf2ef");

  materials.hubLight.copy(materials.hub);
  materials.hubLight.color.set("#d9dfdc");
  materials.hubLight.metalness = 0.08;
  materials.hubLight.roughness = 0.06;
  materials.hubLight.specularIntensity = 0.76;
  materials.hubLight.envMapIntensity = 0.74;

  materials.hubBack.copy(materials.hub);
  materials.hubBack.color.set("#b9c3bf");
  materials.hubBack.roughness = 0.13;
  materials.hubBack.specularIntensity = 0.66;
  materials.hubBack.envMapIntensity = 0.6;
  materials.hubBack.side = FrontSide;

  materials.hubLine.copy(materials.hub);
  materials.hubLine.color.set("#a4afab");
  materials.hubLine.metalness = 0.1;
  materials.hubLine.roughness = 0.15;
  materials.hubLine.specularIntensity = 0.36;
  materials.hubLine.envMapIntensity = 0.3;

  materials.label.color.set("#c2cac7");
  materials.label.metalness = 0.06;
  materials.label.roughness = 0.18;
  materials.label.clearcoat = 1;
  materials.label.clearcoatRoughness = 0.085;
  materials.label.ior = 1.49;
  materials.label.transmission = 0;
  materials.label.thickness = 0;
  materials.label.reflectivity = 0.42;
  materials.label.specularIntensity = 0.54;
  materials.label.envMapIntensity = 0.44;

  const overlayEnergy = Math.max(settings.diffractionIntensity, settings.spectralIntensity);
  setOverlayMaterialUniforms(
    materials.overlayFront,
    settings,
    Math.min(1, 0.94 + overlayEnergy * 0.04)
  );
  setOverlayMaterialUniforms(
    materials.overlayBack,
    settings,
    Math.min(0.7, 0.62 + overlayEnergy * 0.08)
  );
}

export function applyDiscEnvironmentSettings(
  materials: DiscMaterialBundle,
  settings: DiscEnvironmentSettings,
  texture: Texture | null
) {
  setOverlayEnvironmentUniforms(materials.overlayFront, settings, texture);
  setOverlayEnvironmentUniforms(materials.overlayBack, settings, texture);
}

export function applyDiscArtworkState(
  materials: DiscMaterialBundle,
  artworkState: DiscArtworkState
) {
  setPhysicalArtworkUniforms(materials.faceFront, artworkState.front);
  setOverlayArtworkUniforms(materials.overlayFront, artworkState.front);

  // The back slot is intentionally dormant until back artwork is exposed.
  setPhysicalArtworkUniforms(materials.faceBack, null);
  setOverlayArtworkUniforms(materials.overlayBack, null);
}

export function createPhysicalDiscMaterials(
  mode: DiscMaterialMode = "silver",
  settings: DiscMaterialSettings = DEFAULT_MATERIAL_SETTINGS
) {
  const faceFront = new MeshPhysicalMaterial({
    color: settings.baseColor,
    side: FrontSide
  });

  const faceBack = new MeshPhysicalMaterial({
    color: settings.baseColor,
    side: FrontSide
  });

  const wall = new MeshPhysicalMaterial({
    color: settings.baseColor
  });

  const innerWall = new MeshPhysicalMaterial({
    color: settings.baseColor,
    side: BackSide
  });

  const rim = new MeshPhysicalMaterial({
    color: "#f2f4f1"
  });

  const hub = new MeshPhysicalMaterial({
    color: "#e8ebe7",
    side: FrontSide
  });

  const hubLight = hub.clone();
  const hubBack = hub.clone();
  const hubLine = hub.clone();

  const label = new MeshPhysicalMaterial({
    color: settings.baseColor,
    side: FrontSide
  });

  const overlayFront = createOverlayMaterial(mode);
  const overlayBack = createOverlayMaterial(mode);

  configurePhysicalGrooves(faceFront, 0.04);
  configurePhysicalGrooves(faceBack, 0.025);

  const materials = {
    faceFront,
    faceBack,
    wall,
    innerWall,
    rim,
    hub,
    hubLight,
    hubBack,
    hubLine,
    label,
    overlayFront,
    overlayBack
  };

  applyDiscMaterialSettings(materials, settings);

  return materials;
}
