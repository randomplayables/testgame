import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "octokit";

function extractRepoPath(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname !== "github.com") {
      return null;
    }
    const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
    if (pathParts.length >= 2) {
      return `${pathParts[0]}/${pathParts[1]}`;
    }
    return null;
  } catch (error) {
    console.error("Invalid URL for repo path extraction:", url, error);
    return null;
  }
}

// Type guard to avoid `any` and satisfy ESLint
function hasStatusCode(e: unknown): e is { status: number } {
  return (
    typeof e === "object" &&
    e !== null &&
    "status" in e &&
    typeof (e as { status: unknown }).status === "number"
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const repoUrl = searchParams.get("url");

  if (!repoUrl) {
    return NextResponse.json(
      { error: "GitHub URL is required." },
      { status: 400 }
    );
  }

  const repoPath = extractRepoPath(repoUrl);
  if (!repoPath) {
    return NextResponse.json(
      { error: "Invalid GitHub repository URL format." },
      { status: 400 }
    );
  }

  const [owner, repo] = repoPath.split("/");

  const octokit = new Octokit({
    auth: process.env.GITHUB_PAT,
  });

  try {
    const { data: defaultBranchData } = await octokit.rest.repos.get({
      owner,
      repo,
    });
    const defaultBranch = defaultBranchData.default_branch;

    const { data: treeData } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: defaultBranch,
      recursive: "1",
    });

    const files: Record<string, { code: string }> = {};

    for (const item of treeData.tree) {
      if (item.type === "blob" && item.path) {
        try {
          // Skip vite-specific/lock files since we’ll run as a Sandpack react-ts template
          if (
            item.path === "vite.config.ts" ||
            item.path === "vite.config.js" ||
            item.path === "vite.config.mjs" ||
            item.path === "vite-env.d.ts" ||
            item.path === "tsconfig.node.json" ||
            item.path === "package.json" ||
            item.path === "package-lock.json" ||
            item.path === "yarn.lock" ||
            item.path === "pnpm-lock.yaml"
          ) {
            continue;
          }

          const { data: blobData } = await octokit.rest.git.getBlob({
            owner,
            repo,
            file_sha: item.sha!,
          });

          let content = Buffer.from(blobData.content, "base64").toString("utf-8");

          // Re-point apiService.ts to our local sandbox API and inject a simple session bridge
          if (item.path === "src/services/apiService.ts") {
            content = content.replace(
              /const API_BASE_URL = .*;/g,
              `const API_BASE_URL = '/api/sandbox';
                            
// --- Injected by GameTesting Platform ---
const getSessionId = async () => {
  try {
    const response = await fetch(API_BASE_URL + '/game-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId: 'test-game' })
    });
    const data = await response.json();
    if (data.sessionId) {
      window.parent.postMessage({ type: 'SANDBOX_SESSION_ID', payload: data.sessionId }, '*');
    }
    return data;
  } catch (e) {
    console.error("Failed to get session ID for sandbox", e);
    return { sessionId: 'local-sandbox-session' };
  }
};
// --- End Injection ---
`
            );
            // Preserve original logging/signature; wire our helper to exported name
            content = content.replace(
              "export async function initGameSession()",
              "export async function initGameSession_Original()"
            );
            content = content.replace(
              "export async function initGameSession",
              "export const initGameSession = getSessionId; export async function initGameSession_Renamed"
            );
          }

          // Make Vite mains compatible with react-ts template shape
          if (item.path === "src/main.tsx" || item.path === "src/main.ts") {
            content = content.replace(
              /import React from 'react'/g,
              "import * as React from 'react'"
            );
            content = content.replace(
              /import ReactDOM from 'react-dom\/client'/g,
              "import * as ReactDOM from 'react-dom/client'"
            );
            content = content.replace(
              /createRoot\(document\.getElementById\('root'\)!\)/g,
              "createRoot(document.getElementById('root') as HTMLElement)"
            );
          }

          // Ensure React import for TSX files as needed
          if (
            (item.path.endsWith(".ts") || item.path.endsWith(".tsx")) &&
            item.path.endsWith(".tsx") &&
            !content.includes("import React") &&
            !content.includes("import * as React")
          ) {
            content = `import * as React from 'react';\n${content}`;
          }

          // Convert import.meta.env references
          if (content.includes("import.meta.env")) {
            content = content
              .replace(/import\.meta\.env\.DEV/g, "process.env.NODE_ENV === 'development'")
              .replace(/import\.meta\.env\.PROD/g, "process.env.NODE_ENV === 'production'")
              .replace(/import\.meta\.env\.MODE/g, "process.env.NODE_ENV")
              .replace(/import\.meta\.env\.VITE_/g, "process.env.REACT_APP_");
          }

          // Sandpack expects absolute-style paths
          files[`/${item.path}`] = { code: content };
        } catch (blobError) {
          console.error(`Skipping file ${item.path} due to error:`, blobError);
        }
      }
    }

    // Provide a minimal React entry if needed, rename main → index for template
    if (!files["/src/index.tsx"] && !files["/src/main.tsx"]) {
      files["/src/index.tsx"] = {
        code: `import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const container = document.getElementById('root') as HTMLElement;
const root = ReactDOM.createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
      };
    } else if (files["/src/main.tsx"]) {
      files["/src/index.tsx"] = files["/src/main.tsx"];
      delete files["/src/main.tsx"];
    }

    // Update imports referencing ./main → ./index
    Object.keys(files).forEach((filePath) => {
      if (
        files[filePath].code.includes("./main") ||
        files[filePath].code.includes("/main")
      ) {
        files[filePath].code = files[filePath].code
          .replace(/from ['"]\.\/main['"]/g, 'from "./index"')
          .replace(/from ['"]\/src\/main['"]/g, 'from "/src/index"');
      }
    });

    // Basic tsconfig for the react-ts template
    files["/tsconfig.json"] = {
      code: JSON.stringify(
        {
          compilerOptions: {
            target: "ES2020",
            useDefineForClassFields: true,
            lib: ["ES2020", "DOM", "DOM.Iterable"],
            module: "ESNext",
            skipLibCheck: true,
            moduleResolution: "node",
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: "react-jsx",
            strict: true,
            noUnusedLocals: true,
            noUnusedParameters: true,
            noFallthroughCasesInSwitch: true,
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            forceConsistentCasingInFileNames: true,
            baseUrl: ".",
            paths: {
              "@/*": ["./src/*"],
            },
          },
          include: ["src"],
          exclude: ["node_modules"],
        },
        null,
        2
      ),
    };

    // Minimal HTML entry for the template
    if (!files["/public/index.html"] && !files["/index.html"]) {
      files["/public/index.html"] = {
        code: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Rectify Game</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`,
      };
    }

    return NextResponse.json({ files });
  } catch (error: unknown) {
    console.error("GitHub API Error:", error);
    if (hasStatusCode(error) && error.status === 404) {
      return NextResponse.json(
        {
          error:
            "Repository not found. Please check the URL and ensure it is a public repository.",
        },
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