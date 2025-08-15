import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "octokit";

function extractRepoPath(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname !== "github.com") return null;
    const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
    if (pathParts.length >= 2) return `${pathParts[0]}/${pathParts[1]}`;
    return null;
  } catch (error) {
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

          if (item.path === 'index.html' || item.path === 'public/index.html') {
            content = content.replace(/<\/head>/i, `${bridgeScriptTag}</head>`);
          }

          // **FIX 1 of 3: Ensure API calls are correctly routed**
          if (item.path === "src/services/apiService.ts") {
            content = content.replace(
              /const\s+API_BASE_URL\s*=\s*["'`].*?["'`]\s*;/,
              `const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/sandbox';`
            );
          }
          
          // **FIX 2 of 3: Guarantee a working dev script in package.json**
          if (item.path === "package.json") {
            try {
              const pkg = JSON.parse(content);
              pkg.scripts = pkg.scripts || {};
              if (!pkg.scripts.dev) {
                pkg.scripts.dev = "vite";
              }
              content = JSON.stringify(pkg, null, 2);
            } catch (e) {
              console.error("Failed to parse or modify package.json, leaving as-is.", e);
            }
          }

          files[item.path] = content;
        } catch (blobError) {
          console.error(`Skipping file ${item.path} due to error:`, blobError);
        }
      }
    }
    
    // **FIX 3 of 3 (Part 1): Create .env file with API endpoint hint**
    files['.env'] = `VITE_GAME_ID=${repo}\nVITE_API_BASE_URL=/api/sandbox`;

    // **FIX 3 of 3 (Part 2): Inject a no-op ESLint config if none exists**
    if (!files["eslint.config.js"] && !files["eslint.config.mjs"]) {
        files["eslint.config.js"] = `export default [];`;
    }

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