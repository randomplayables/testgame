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
        try {
          const { data: blobData } = await octokit.rest.git.getBlob({ owner, repo, file_sha: item.sha });
          let content = Buffer.from(blobData.content, "base64").toString("utf-8");

          // Inject our bridge script into the main HTML file
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