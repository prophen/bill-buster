/* Hand-written stand-in for `npx convex codegen` output.
   Real codegen runs on `npx convex dev` / `npx convex deploy` once the
   project is linked to a Convex account, and will overwrite this directory.
   Component references (agentmail, firecrawl, staticHosting) are typed
   loosely here; real codegen produces their precise component APIs. */

import type * as bills from "../bills.js";
import type * as ingest from "../ingest.js";
import type * as negotiate from "../negotiate.js";
import type * as outreach from "../outreach.js";
import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  bills: typeof bills;
  ingest: typeof ingest;
  negotiate: typeof negotiate;
  outreach: typeof outreach;
}>;

export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public", any, any>
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal", any, any>
>;

// Loose component handles: replaced by precise generated types on codegen.
declare const components: {
  agentmail: any;
  firecrawl: any;
  staticHosting: any;
};
export { components };
