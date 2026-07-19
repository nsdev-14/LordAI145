// Node ESM loader: redirect 'react' and 'react-dom/client' (and react/jsx-runtime)
// to the PRODUCTION builds, so we test prod-React behavior (minified #185 path).
import { pathToFileURL } from "node:url";
import { resolve as pathResolve } from "node:path";

const ROOT = "/workspaces/LordAI145/node_modules";
const MAP = {
  react: pathResolve(ROOT + "/react/cjs/react.production.js"),
  "react/jsx-runtime": pathResolve(ROOT + "/react/cjs/react-jsx-runtime.production.js"),
  "react-dom": pathResolve(ROOT + "/react-dom/cjs/react-dom.production.js"),
  "react-dom/client": pathResolve(ROOT + "/react-dom/cjs/react-dom-client.production.js"),
  "react-dom/test-utils": pathResolve(ROOT + "/react-dom/cjs/react-dom-test-utils.production.js"),
};

export async function resolve(specifier, context, nextResolve) {
  if (MAP[specifier]) {
    return { url: pathToFileURL(MAP[specifier]).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
