// Runtime shim for the Vite build. The real `npx convex codegen` output
// (api.js with concrete function references) replaces this directory on
// `npx convex dev` / `npx convex deploy`. The app cannot talk to a backend
// until then, so any actual call through this shim throws a clear error.
function makeApi(path = "api") {
  const fn = function () {
    throw new Error(
      `Convex codegen has not run (tried to call ${path}). Run \`npx convex dev\` first.`,
    );
  };
  return new Proxy(fn, {
    get(target, prop) {
      if (prop === Symbol.toPrimitive) return () => path;
      if (typeof prop === "string") return makeApi(`${path}.${prop}`);
      return target[prop];
    },
    apply() {
      throw new Error(
        `Convex codegen has not run (tried to call ${path}). Run \`npx convex dev\` first.`,
      );
    },
  });
}

export const api = makeApi("api");
export const internal = makeApi("internal");
export const components = makeApi("components");
