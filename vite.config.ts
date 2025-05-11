import { defineConfig } from "vite";
import { resolve } from "node:path";
import { project, externals } from "./vite.util";
import { magicPlugin, moduleName } from "./vite.plugins";
import dts from "vite-plugin-dts";

export default defineConfig({
    build: {
        sourcemap: true,
        minify: false,
        lib: {
            name: "moon7-async",
            entry: {
                index: resolve(project.path, "src/index.ts"),
            },
            formats: ["es", "umd"],
            // fileName: "index",
        },
        rollupOptions: {
            // make sure to externalize deps that shouldn't be bundled into your library
            external: externals,
            output: {
                // Provide global variables to use in the UMD build for externalized deps
                globals: {
                    vue: "Vue",
                },
            },
        },
    },
    define: {
        __PROJECT__: JSON.stringify({
            id: project.id,
            scope: project.scope,
            name: project.name,
            version: project.version,
            build: project.build,
        }),
    },
    plugins: [
        magicPlugin({
            defines: {
                module: (src, id) => moduleName(project.path, project.id, id),
                project: (src, id) => JSON.stringify(project),
            },
        }),
        dts({
            // rollupTypes: true,
            include: [
                // formatting
                "types/**/*",
                "src/**/*",
            ],
        }),
    ],
    optimizeDeps: {},
    resolve: {
        alias: {
            "~": resolve(project.path, "src"),
            "!": resolve(project.path, "test"),
        },
    },
});
