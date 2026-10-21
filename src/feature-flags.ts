import type { FlagDefinitions } from "./package/shared/module/feature-flags";

/** Product flag registry. Defaults are the safe values; FEATURE_FLAGS overrides per environment. */
export const flagDefinitions = {
  memberInvitations: {
    default: true,
    description: "Invite members by email (POST /access/members/invitations).",
    owner: "platform",
    removeBy: "2027-06-30",
  },
} as const satisfies FlagDefinitions;
