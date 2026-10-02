export const ENGINE_CONFIG = {
  /** Graded answers per study session. */
  sessionSize: 20,
  maxNewItemsPerSession: 5,
  /** New items are only introduced while fewer than this many prompts are in learning. */
  maxLearningPrompts: 15,
  /** The last N distinct items served are ineligible for the next pick. */
  cooldownItems: 3,
  /** Consecutive correct answers needed to leave each rung. */
  climbStreak: { 1: 1, 2: 2, 3: 1 } as Record<1 | 2 | 3, number>,
  /** Rung a prompt returns to after forgetting it in review. */
  lapseRung: 2 as const,
  /** Confusion count at which a contrast drill is queued. */
  contrastThreshold: 2,
  desiredRetention: 0.9,
  retentionNudgeBelow: 0.9,
  /** FSRS stability (days) at which an item counts as "strong" on the mastery grid. */
  strongStabilityDays: 21,
  typoShortMax: 1,
  typoLongMax: 2,
  typoLongMinLength: 8,
} as const;
