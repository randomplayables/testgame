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
    let packageJsonContent: string | null = null;

    for (const item of treeData.tree) {
      if (item.type === "blob" && item.path) {
        try {
          const { data: blobData } = await octokit.rest.git.getBlob({
            owner,
            repo,
            file_sha: item.sha!,
          });

          let content = Buffer.from(blobData.content, "base64").toString(
            "utf-8"
          );

          if (item.path === "package.json") {
            packageJsonContent = content;
          }

          // Modify apiService.ts to point to our sandbox API + session bridge
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
      body: JSON.stringify({ gameId: 'test-game' }) // Using a generic test gameId
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
            // Preserve your original logging; only rename the symbol and wire our helper
            content = content.replace(
              "export async function initGameSession()",
              "export async function initGameSession_Original()"
            );
            content = content.replace(
              "export async function initGameSession",
              "export const initGameSession = getSessionId; export async function initGameSession_Renamed"
            );
          }

          // Sandpack expects absolute-style paths
          files[`/${item.path}`] = { code: content };
        } catch (blobError) {
          console.error(`Skipping file ${item.path} due to error:`, blobError);
        }
      }
    }

    // Inject sandbox-friendly tooling into package.json
    if (packageJsonContent) {
      try {
        const packageJson = JSON.parse(packageJsonContent);

        packageJson.dependencies = packageJson.dependencies || {};
        packageJson.devDependencies = packageJson.devDependencies || {};

        // 1) Keep esbuild-wasm for transforms in Nodebox
        if (!packageJson.dependencies["esbuild-wasm"]) {
          packageJson.dependencies["esbuild-wasm"] = "latest";
        }

        // 2) ***Force Rollup to WASM*** via an npm alias.
        // This ensures any `require('rollup')` (e.g., from Vite) resolves to the WASM build.
        // Using devDependencies is fine since Rollup is a build-time tool.
        if (packageJson.devDependencies["rollup"] !== "npm:@rollup/wasm-node@^4") {
          packageJson.devDependencies["rollup"] = "npm:@rollup/wasm-node@^4";
        }
        if (!packageJson.devDependencies["@rollup/wasm-node"]) {
          packageJson.devDependencies["@rollup/wasm-node"] = "^4";
        }

        // 3) Keep overrides as a belt-and-suspenders fallback
        packageJson.overrides = {
          ...(packageJson.overrides || {}),
          rollup: "@rollup/wasm-node@^4",
        };
        packageJson.pnpm = {
          ...(packageJson.pnpm || {}),
          overrides: {
            ...(packageJson.pnpm?.overrides || {}),
            rollup: "@rollup/wasm-node@^4",
          },
        };

        files["/package.json"] = {
          code: JSON.stringify(packageJson, null, 2),
        };
      } catch (e) {
        console.error("Could not parse or modify package.json", e);
        // Continue with original package.json if parsing fails
      }
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
    const message =
      error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json(
      { error: "Failed to fetch repository from GitHub.", details: message },
      { status: 500 }
    );
  }
}