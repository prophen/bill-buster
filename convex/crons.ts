import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Every Monday, re-check competitor pricing on bills that are still active.
// This only records fresh priceChecks; it never drafts or sends email.
crons.weekly(
  "weekly price recheck",
  { dayOfWeek: "monday", hourUTC: 14, minuteUTC: 0 },
  internal.negotiate.recheckActiveBills,
  {},
);

export default crons;
