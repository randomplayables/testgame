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

    for (const item of treeData.tree) {
      if (item.type === "blob" && item.path && item.sha) {
        // We will process package.json separately, so skip it here.
        if (item.path === 'package.json') continue;

        try {
          const { data: blobData } = await octokit.rest.git.getBlob({ owner, repo, file_sha: item.sha });
          let content = Buffer.from(blobData.content, "base64").toString("utf-8");

          if (item.path === 'index.html') {
            const bridgeScriptTag = `<script src="${process.env.NEXT_PUBLIC_BASE_URL}/embed/stackblitz-bridge"></script>`;
            content = content.replace(/<\/head>/i, `${bridgeScriptTag}</head>`);
          }

          files[item.path] = content;
        } catch (blobError) {
          console.error(`Skipping file ${item.path} due to error:`, blobError);
        }
      }
    }

    // Now, fetch, parse, and modify the package.json
    try {
        const { data: packageJsonData } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: 'package.json',
        });

        if ('content' in packageJsonData) {
            const content = Buffer.from(packageJsonData.content, 'base64').toString('utf-8');
            const pkg = JSON.parse(content);

            // Ensure devDependencies exists
            if (!pkg.devDependencies) {
                pkg.devDependencies = {};
            }

            // --- SURGICAL MODIFICATIONS ---
            // 1. Pin Vite to a stable version
            pkg.devDependencies['vite'] = '^5.2.0';
            
            // 2. Ensure a compatible React plugin for Vite 5
            pkg.devDependencies['@vitejs/plugin-react'] = '^4.2.0';

            // 3. Remove potentially problematic ESLint packages
            for (const key in pkg.devDependencies) {
                if (key.includes('eslint')) {
                    delete pkg.devDependencies[key];
                }
            }
             for (const key in pkg.dependencies) {
                if (key.includes('eslint')) {
                    delete pkg.dependencies[key];
                }
            }

            // Overwrite the original package.json with our modified version
            files['package.json'] = JSON.stringify(pkg, null, 2);
        }
    } catch (e) {
        return NextResponse.json({ error: "Could not find or process package.json in the repository." }, { status: 400 });
    }
    

    if (!files["index.html"]) {
        return NextResponse.json({ error: "Could not find index.html in the repository root." }, { status: 400 });
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