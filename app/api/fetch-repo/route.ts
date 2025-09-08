// import { NextRequest, NextResponse } from "next/server";
// import { Octokit } from "octokit";

// // Define a type for the tsconfig object to satisfy the linter
// interface TsConfig {
//   compilerOptions: Record<string, unknown>;
//   exclude?: string[];
// }

// function extractRepoPath(url: string): string | null {
//   try {
//     const parsedUrl = new URL(url);
//     if (parsedUrl.hostname !== "github.com") return null;
//     const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
//     if (pathParts.length >= 2) return `${pathParts[0]}/${pathParts[1]}`;
//     return null;
//   } catch {
//     return null;
//   }
// }

// function hasStatusCode(e: unknown): e is { status: number } {
//   return typeof e === "object" && e !== null && "status" in e;
// }

// export async function GET(request: NextRequest) {
//   const { searchParams } = new URL(request.url);
//   const repoUrl = searchParams.get("url");

//   if (!repoUrl) {
//     return NextResponse.json({ error: "GitHub URL is required." }, { status: 400 });
//   }

//   const repoPath = extractRepoPath(repoUrl);
//   if (!repoPath) {
//     return NextResponse.json({ error: "Invalid GitHub repository URL format." }, { status: 400 });
//   }

//   const [owner, repo] = repoPath.split("/");
//   const octokit = new Octokit({ auth: process.env.GITHUB_PAT });

//   try {
//     const { data: defaultBranchData } = await octokit.rest.repos.get({ owner, repo });
//     const { data: treeData } = await octokit.rest.git.getTree({
//       owner,
//       repo,
//       tree_sha: defaultBranchData.default_branch,
//       recursive: "1",
//     });

//     const files: Record<string, string> = {};

//     const proto = request.headers.get('x-forwarded-proto') ?? 'http';
//     const host = request.headers.get('host');
//     const base = process.env.NEXT_PUBLIC_BASE_URL || `${proto}://${host}`;
//     const bridgeScriptTag = `<script src="${base}/embed/stackblitz-bridge"></script>`;

//     for (const item of treeData.tree) {
//       if (item.type === "blob" && item.path && item.sha) {
//         try {
//           const { data: blobData } = await octokit.rest.git.getBlob({ owner, repo, file_sha: item.sha });
//           let content = Buffer.from(blobData.content, "base64").toString("utf-8");

//           if (item.path === 'index.html' || item.path === 'public/index.html') {
//             content = content.replace(/<\/head>/i, `${bridgeScriptTag}</head>`);
//           }

//           if (item.path === "src/services/apiService.ts") {
//             // Replace API_BASE_URL assignment with our generic proxy URL
//             content = content.replace(
//               /const\s+API_BASE_URL\s*=\s*[^;]+;/g,
//               `const API_BASE_URL = '/api';`
//             );
            
//             if (!content.includes('const API_BASE_URL')) {
//               content = `const API_BASE_URL = '/api';\n` + content;
//             }
//           }
          
//           if (item.path === "package.json") {
//             try {
//               const pkg = JSON.parse(content);
//               pkg.scripts = pkg.scripts || {};
//               if (!pkg.scripts.dev) {
//                 pkg.scripts.dev = "vite";
//               }
//               content = JSON.stringify(pkg, null, 2);
//             } catch {
//               console.error("Failed to parse or modify package.json, leaving as-is.");
//             }
//           }

//           files[item.path] = content;
//         } catch (blobError) {
//           console.error(`Skipping file ${item.path} due to error:`, blobError);
//         }
//       }
//     }
    
//     files['.env'] = `VITE_GAME_ID=${repo}`;

//     const tsconfigPath = "tsconfig.json";
//     const tsconfig: TsConfig = files[tsconfigPath] ? JSON.parse(files[tsconfigPath]) : { compilerOptions: {} };
//     tsconfig.exclude = Array.isArray(tsconfig.exclude) ? tsconfig.exclude : [];
//     const patternsToExclude = ["eslint.config.js", "eslint.config.mjs"];
//     for (const pattern of patternsToExclude) {
//       if (!tsconfig.exclude.includes(pattern)) {
//         tsconfig.exclude.push(pattern);
//       }
//     }
//     files[tsconfigPath] = JSON.stringify(tsconfig, null, 2);

//     // Forcefully overwrite eslint config to prevent StackBlitz error
//     files["eslint.config.js"] = `export default [];`;

//     if (!files["index.html"] && !files["public/index.html"]) {
//       return NextResponse.json({ error: "Could not find index.html in the repository." }, { status: 400 });
//     }
//     if (!files['index.html'] && files['public/index.html']) {
//       files['index.html'] = files['public/index.html'];
//     }

//     return NextResponse.json({ files });
//   } catch (error: unknown) {
//     console.error("GitHub API Error:", error);
//     if (hasStatusCode(error) && error.status === 404) {
//       return NextResponse.json({ error: "Repository not found. Please check the URL." }, { status: 404 });
//     }
//     const message = error instanceof Error ? error.message : "An unknown error occurred.";
//     return NextResponse.json({ error: "Failed to fetch repository from GitHub.", details: message }, { status: 500 });
//   }
// }







import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "octokit";

// Define a type for the tsconfig object to satisfy the linter
interface TsConfig {
  compilerOptions: Record<string, unknown>;
  exclude?: string[];
}

function extractRepoPath(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname !== "github.com") return null;
    const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
    if (pathParts.length >= 2) return `${pathParts[0]}/${pathParts[1]}`;
    return null;
  } catch {
    return null;
  }
}

function hasStatusCode(e: unknown): e is { status: number } {
  return typeof e === "object" && e !== null && "status" in e;
}

/**
 * Allow-list of files we will include in the project payload sent to StackBlitz.
 * - Exact files: index.html, package.json
 * - Vite config files: vite.config.ts/js/mjs
 * - Any tsconfig* files (tsconfig.json, tsconfig.app.json, etc.)
 * - Everything under src/** and public/**
 */
const ALLOW_PREFIXES = ["src/", "public/"];
const ALLOW_EXACT = new Set([
  "index.html",
  "package.json",
  "vite.config.ts",
  "vite.config.js",
  "vite.config.mjs",
]);
const ALLOW_REGEXES = [/^tsconfig(\.|$)/];

function isAllowedPath(path: string): boolean {
  if (ALLOW_EXACT.has(path)) return true;
  if (ALLOW_PREFIXES.some((p) => path.startsWith(p))) return true;
  if (ALLOW_REGEXES.some((re) => re.test(path))) return true;
  return false;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const repoUrl = searchParams.get("url");

  if (!repoUrl) {
    return NextResponse.json({ error: "GitHub URL is required." }, { status: 400 });
  }

  const repoPath = extractRepoPath(repoUrl);
  if (!repoPath) {
    return NextResponse.json({ error: "Invalid GitHub repository URL format." }, { status: 400 });
  }

  const [owner, repo] = repoPath.split("/");
  const octokit = new Octokit({ auth: process.env.GITHUB_PAT });

  try {
    const { data: defaultBranchData } = await octokit.rest.repos.get({ owner, repo });
    const { data: treeData } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: defaultBranchData.default_branch,
      recursive: "1",
    });

    const files: Record<string, string> = {};

    const proto = request.headers.get("x-forwarded-proto") ?? "http";
    const host = request.headers.get("host");
    const base = process.env.NEXT_PUBLIC_BASE_URL || `${proto}://${host}`;
    const bridgeScriptTag = `<script src="${base}/embed/stackblitz-bridge"></script>`;

    for (const item of treeData.tree) {
      if (item.type === "blob" && item.path && item.sha) {
        // NEW: enforce allow-list BEFORE downloading blob content
        if (!isAllowedPath(item.path)) {
          continue;
        }
        try {
          const { data: blobData } = await octokit.rest.git.getBlob({
            owner,
            repo,
            file_sha: item.sha,
          });
          let content = Buffer.from(blobData.content, "base64").toString("utf-8");

          // Inject our bridge script into the HTML the preview loads
          if (item.path === "index.html" || item.path === "public/index.html") {
            content = content.replace(/<\/head>/i, `${bridgeScriptTag}</head>`);
          }

          // Normalize API base URL inside known service file
          if (item.path === "src/services/apiService.ts") {
            // Replace API_BASE_URL assignment with our generic proxy URL
            content = content.replace(
              /const\s+API_BASE_URL\s*=\s*[^;]+;/g,
              `const API_BASE_URL = '/api';`
            );

            if (!content.includes("const API_BASE_URL")) {
              content = `const API_BASE_URL = '/api';\n` + content;
            }
          }

          // Ensure a dev script exists for StackBlitz
          if (item.path === "package.json") {
            try {
              const pkg = JSON.parse(content);
              pkg.scripts = pkg.scripts || {};
              if (!pkg.scripts.dev) {
                pkg.scripts.dev = "vite";
              }
              content = JSON.stringify(pkg, null, 2);
            } catch {
              console.error("Failed to parse or modify package.json, leaving as-is.");
            }
          }

          files[item.path] = content;
        } catch (blobError) {
          console.error(`Skipping file ${item.path} due to error:`, blobError);
        }
      }
    }

    // Provide a default game id for the test environment
    files[".env"] = `VITE_GAME_ID=${repo}`;

    // Make sure eslint configs are excluded so StackBlitz doesn't choke on them via tsconfig
    const tsconfigPath = "tsconfig.json";
    const tsconfig: TsConfig = files[tsconfigPath]
      ? JSON.parse(files[tsconfigPath])
      : { compilerOptions: {} };
    tsconfig.exclude = Array.isArray(tsconfig.exclude) ? tsconfig.exclude : [];
    const patternsToExclude = ["eslint.config.js", "eslint.config.mjs"];
    for (const pattern of patternsToExclude) {
      if (!tsconfig.exclude.includes(pattern)) {
        tsconfig.exclude.push(pattern);
      }
    }
    files[tsconfigPath] = JSON.stringify(tsconfig, null, 2);

    // Forcefully overwrite eslint config to prevent StackBlitz error
    files["eslint.config.js"] = `export default [];`;

    // Ensure there's an index.html at project root for the embed openFile
    if (!files["index.html"] && !files["public/index.html"]) {
      return NextResponse.json(
        { error: "Could not find index.html in the repository." },
        { status: 400 }
      );
    }
    if (!files["index.html"] && files["public/index.html"]) {
      files["index.html"] = files["public/index.html"];
    }

    return NextResponse.json({ files });
  } catch (error: unknown) {
    console.error("GitHub API Error:", error);
    if (hasStatusCode(error) && error.status === 404) {
      return NextResponse.json(
        { error: "Repository not found. Please check the URL." },
        { status: 404 }
      );
    }
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json(
      { error: "Failed to fetch repository from GitHub.", details: message },
      { status: 500 }
    );
  }
}