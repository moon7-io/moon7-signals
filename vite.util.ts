import { resolve } from "node:path";
import { builtinModules } from "node:module";
import { readFileSync } from "node:fs";

export const cwd = process.cwd();
export const pkg = JSON.parse(readFileSync(resolve(cwd, "package.json"), "utf8"));

export const project = {
    path: cwd,
    id: pkg.name, // @moon7/signals
    scope: pkg.name.includes("/") ? pkg.name.split("/")[0] : null, // @moon7
    name: pkg.name.split("/").at(-1), // signals
    version: pkg.version,
    build: {
        time: Date.now(),
    },
};

export const externals = [
    /^disposablestack(\/.*)?$/,
    /^node:.*/,
    ...builtinModules,
    ...Object.entries(pkg.dependencies ?? [])
        // .filter(([key, value]) => !value.startsWith("workspace:"))
        .map(([key, value]) => key),
];
