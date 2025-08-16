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

//           // Inject our bridge into the preview page
//           if (item.path === 'index.html' || item.path === 'public/index.html') {
//             content = content.replace(/<\/head>/i, `${bridgeScriptTag}</head>`);
//           }

//           // Fix the API_BASE_URL issue - replace with a more robust approach
//           if (item.path === "src/services/apiService.ts") {
//             // Replace any API_BASE_URL assignment with our sandbox URL
//             content = content.replace(
//               /const\s+API_BASE_URL\s*=\s*[^;]+;/g,
//               `const API_BASE_URL = '/api/sandbox';`
//             );
            
//             // If no API_BASE_URL was found, inject it at the top of the file
//             if (!content.includes('const API_BASE_URL')) {
//               content = `const API_BASE_URL = '/api/sandbox';\n` + content;
//             }
            
//             // Also ensure the console.log shows the correct URL
//             content = content.replace(
//               /console\.log\(\s*["']Using API base URL:["'],\s*API_BASE_URL\s*\);?/g,
//               `console.log("Using API base URL:", API_BASE_URL);`
//             );
//           }
          
//           // Ensure a dev script exists for StackBlitz
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
    
//     // Inject env for the game - ensure the API URL is set correctly
//     files['.env'] = `VITE_GAME_ID=${repo}\nVITE_API_BASE_URL=/api/sandbox`;

//     // Ensure TS won't choke on eslint configs
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

//     // Always provide a JS eslint config stub so TS/StackBlitz stop looking for a missing file
//     files["eslint.config.js"] = files["eslint.config.js"] ?? `export default [];`;

//     // Ensure index.html exists at project root for StackBlitz preview
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

    const proto = request.headers.get('x-forwarded-proto') ?? 'http';
    const host = request.headers.get('host');
    const base = process.env.NEXT_PUBLIC_BASE_URL || `${proto}://${host}`;
    const bridgeScriptTag = `<script src="${base}/embed/stackblitz-bridge"></script>`;

    for (const item of treeData.tree) {
      if (item.type === "blob" && item.path && item.sha) {
        try {
          const { data: blobData } = await octokit.rest.git.getBlob({ owner, repo, file_sha: item.sha });
          let content = Buffer.from(blobData.content, "base64").toString("utf-8");

          // Inject our bridge into the preview page
          if (item.path === 'index.html' || item.path === 'public/index.html') {
            content = content.replace(/<\/head>/i, `${bridgeScriptTag}</head>`);
          }

          // **FIX START**: Correctly modify the API service to use the proxy
          if (item.path === "src/services/apiService.ts") {
            // Replace any API_BASE_URL assignment with our generic proxy URL
            content = content.replace(
              /const\s+API_BASE_URL\s*=\s*[^;]+;/g,
              `const API_BASE_URL = '/api';`
            );
            
            // If no API_BASE_URL was found, inject it at the top of the file
            if (!content.includes('const API_BASE_URL')) {
              content = `const API_BASE_URL = '/api';\n` + content;
            }
          }
          // **FIX END**
          
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
    
    // Inject env for the game
    files['.env'] = `VITE_GAME_ID=${repo}`;

    // Ensure TS won't choke on eslint configs
    const tsconfigPath = "tsconfig.json";
    const tsconfig: TsConfig = files[tsconfigPath] ? JSON.parse(files[tsconfigPath]) : { compilerOptions: {} };
    tsconfig.exclude = Array.isArray(tsconfig.exclude) ? tsconfig.exclude : [];
    const patternsToExclude = ["eslint.config.js", "eslint.config.mjs"];
    for (const pattern of patternsToExclude) {
      if (!tsconfig.exclude.includes(pattern)) {
        tsconfig.exclude.push(pattern);
      }
    }
    files[tsconfigPath] = JSON.stringify(tsconfig, null, 2);

    // **FIX START**: Forcefully overwrite eslint config to prevent StackBlitz error
    files["eslint.config.js"] = `export default [];`;
    // **FIX END**

    // Ensure index.html exists at project root for StackBlitz preview
    if (!files["index.html"] && !files["public/index.html"]) {
      return NextResponse.json({ error: "Could not find index.html in the repository." }, { status: 400 });
    }
    if (!files['index.html'] && files['public/index.html']) {
      files['index.html'] = files['public/index.html'];
    }

    return NextResponse.json({ files });
  } catch (error: unknown) {
    console.error("GitHub API Error:", error);
    if (hasStatusCode(error) && error.status === 404) {
      return NextResponse.json({ error: "Repository not found. Please check the URL." }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json({ error: "Failed to fetch repository from GitHub.", details: message }, { status: 500 });
  }
}