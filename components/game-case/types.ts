// Full state union for the case interaction. Milestone 1 wires
// closed/opening/open; sleeveOut and discFocus land in later milestones.
export type CaseState =
  | "closed"
  | "opening"
  | "open"
  | "sleeveOut"
  | "discFocus";

export type CaseEnvironmentSettings = {
  intensity: number;
  rotation: number;
};
