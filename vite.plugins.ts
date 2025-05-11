import { PluginOption } from "vite";

export interface MagicPluginOptions {
    defines: Record<string, (src: string, id: string) => string>;
}

export function magicPlugin(options: MagicPluginOptions): PluginOption {
    const rxFile = /\.(js|ts)$/;

    function transform(src: string, id: string) {
        return src.replace(/import\.meta\.([a-z_$][a-z_$0-9]*)/gi, (original, key) => {
            return options.defines[key]?.(src, id) ?? original;
        });
    }

    return {
        name: "magic-plugin",
        transform(src, id) {
            if (rxFile.test(id)) {
                // console.log("MAGIC:", id);
                return {
                    code: transform(src, id),
                    map: null,
                };
            }
        },
    };
}

const rxPrefix = /^(src)(?=\/)/;

// const prefix: Record<string, string> = {
//     src: "~",
//     lib: "#",
// };

function getExtLength(id: string): number {
    return id.length - id.lastIndexOf(".");
}

export function moduleName(projectPath: string, projectName: string, id: string): string {
    const pathLength = projectPath.length + 1;
    // g = "src" | "lib"
    const name = id
        .slice(pathLength, -getExtLength(id))
        .replace(rxPrefix, (m, g) => projectName)
        .replace(/\//g, ".");
    return JSON.stringify(name);
}
