// import { NextRequest, NextResponse } from "next/server";
// import { Octokit } from "octokit";

// function extractRepoPath(url: string): string | null {
//   try {
//     const parsedUrl = new URL(url);
//     if (parsedUrl.hostname !== "github.com") {
//       return null;
//     }
//     const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
//     if (pathParts.length >= 2) {
//       return `${pathParts[0]}/${pathParts[1]}`;
//     }
//     return null;
//   } catch (error) {
//     console.error("Invalid URL for repo path extraction:", url, error);
//     return null;
//   }
// }

// // Type guard to avoid `any` and satisfy ESLint
// function hasStatusCode(e: unknown): e is { status: number } {
//   return (
//     typeof e === "object" &&
//     e !== null &&
//     "status" in e &&
//     typeof (e as { status: unknown }).status === "number"
//   );
// }

// export async function GET(request: NextRequest) {
//   const { searchParams } = new URL(request.url);
//   const repoUrl = searchParams.get("url");

//   if (!repoUrl) {
//     return NextResponse.json(
//       { error: "GitHub URL is required." },
//       { status: 400 }
//     );
//   }

//   const repoPath = extractRepoPath(repoUrl);
//   if (!repoPath) {
//     return NextResponse.json(
//       { error: "Invalid GitHub repository URL format." },
//       { status: 400 }
//     );
//   }

//   const [owner, repo] = repoPath.split("/");

//   const octokit = new Octokit({
//     auth: process.env.GITHUB_PAT,
//   });

//   try {
//     const { data: defaultBranchData } = await octokit.rest.repos.get({
//       owner,
//       repo,
//     });
//     const defaultBranch = defaultBranchData.default_branch;

//     const { data: treeData } = await octokit.rest.git.getTree({
//       owner,
//       repo,
//       tree_sha: defaultBranch,
//       recursive: "1",
//     });

//     const files: Record<string, { code: string }> = {};
//     let packageJsonContent: string | null = null;

//     for (const item of treeData.tree) {
//       if (item.type === "blob" && item.path) {
//         try {
//           const { data: blobData } = await octokit.rest.git.getBlob({
//             owner,
//             repo,
//             file_sha: item.sha!,
//           });

//           let content = Buffer.from(blobData.content, "base64").toString(
//             "utf-8"
//           );

//           if (item.path === "package.json") {
//             packageJsonContent = content;
//           }

//           // Modify apiService.ts to point to our sandbox API + session bridge
//           if (item.path === "src/services/apiService.ts") {
//             content = content.replace(
//               /const API_BASE_URL = .*;/g,
//               `const API_BASE_URL = '/api/sandbox';
                            
// // --- Injected by GameTesting Platform ---
// const getSessionId = async () => {
//   try {
//     const response = await fetch(API_BASE_URL + '/game-session', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ gameId: 'test-game' }) // Using a generic test gameId
//     });
//     const data = await response.json();
//     if (data.sessionId) {
//       window.parent.postMessage({ type: 'SANDBOX_SESSION_ID', payload: data.sessionId }, '*');
//     }
//     return data;
//   } catch (e) {
//     console.error("Failed to get session ID for sandbox", e);
//     return { sessionId: 'local-sandbox-session' };
//   }
// };
// // --- End Injection ---
// `
//             );
//             // Preserve your original logging; only rename the symbol and wire our helper
//             content = content.replace(
//               "export async function initGameSession()",
//               "export async function initGameSession_Original()"
//             );
//             content = content.replace(
//               "export async function initGameSession",
//               "export const initGameSession = getSessionId; export async function initGameSession_Renamed"
//             );
//           }
          
//           // Modify any existing vite.config files to exclude rollup
//           if (item.path === "vite.config.ts" || item.path === "vite.config.js" || item.path === "vite.config.mjs") {
//             // Add optimizeDeps exclusion if not present
//             if (!content.includes('optimizeDeps')) {
//               content = content.replace(
//                 'export default defineConfig(',
//                 `export default defineConfig({
//   optimizeDeps: {
//     exclude: ['rollup']
//   },`
//               );
//             }
//           }

//           // Sandpack expects absolute-style paths
//           files[`/${item.path}`] = { code: content };
//         } catch (blobError) {
//           console.error(`Skipping file ${item.path} due to error:`, blobError);
//         }
//       }
//     }

//     // Inject sandbox-friendly tooling into package.json
//     if (packageJsonContent) {
//       try {
//         const packageJson = JSON.parse(packageJsonContent);

//         packageJson.dependencies = packageJson.dependencies || {};
//         packageJson.devDependencies = packageJson.devDependencies || {};

//         // 1) Keep esbuild-wasm for transforms in Nodebox
//         if (!packageJson.dependencies["esbuild-wasm"]) {
//           packageJson.dependencies["esbuild-wasm"] = "latest";
//         }

//         // 2) Remove any existing rollup and vite references
//         delete packageJson.dependencies["rollup"];
//         delete packageJson.devDependencies["rollup"];
//         delete packageJson.dependencies["vite"];
//         delete packageJson.devDependencies["vite"];
        
//         // 3) Add @rollup/wasm-node directly as the main rollup package
//         packageJson.dependencies["@rollup/wasm-node"] = "^4.28.1";
//         // Add rollup as an alias to the WASM version
//         packageJson.dependencies["rollup"] = "npm:@rollup/wasm-node@^4.28.1";
        
//         // 4) Re-add vite with a specific version that's compatible
//         packageJson.devDependencies["vite"] = "^5.4.11";
        
//         // 5) Force all package managers to use WASM rollup via aliases and overrides
//         // NPM overrides
//         packageJson.overrides = {
//           ...(packageJson.overrides || {}),
//           "rollup": "npm:@rollup/wasm-node@^4.28.1",
//           "@rollup/rollup-linux-x32": "npm:@rollup/wasm-node@^4.28.1",
//           "@rollup/rollup-linux-x64-gnu": "npm:@rollup/wasm-node@^4.28.1",
//           "@rollup/rollup-linux-x64-musl": "npm:@rollup/wasm-node@^4.28.1",
//           "vite": {
//             "rollup": "npm:@rollup/wasm-node@^4.28.1"
//           }
//         };
        
//         // PNPM overrides
//         packageJson.pnpm = {
//           ...(packageJson.pnpm || {}),
//           overrides: {
//             ...(packageJson.pnpm?.overrides || {}),
//             "rollup": "npm:@rollup/wasm-node@^4.28.1",
//             "@rollup/rollup-linux-x32": "npm:@rollup/wasm-node@^4.28.1",
//             "@rollup/rollup-linux-x64-gnu": "npm:@rollup/wasm-node@^4.28.1",
//             "@rollup/rollup-linux-x64-musl": "npm:@rollup/wasm-node@^4.28.1"
//           }
//         };
        
//         // Yarn resolutions
//         packageJson.resolutions = {
//           ...(packageJson.resolutions || {}),
//           "rollup": "npm:@rollup/wasm-node@^4.28.1",
//           "**/rollup": "npm:@rollup/wasm-node@^4.28.1",
//           "@rollup/rollup-linux-x32": "npm:@rollup/wasm-node@^4.28.1",
//           "@rollup/rollup-linux-x64-gnu": "npm:@rollup/wasm-node@^4.28.1",
//           "@rollup/rollup-linux-x64-musl": "npm:@rollup/wasm-node@^4.28.1"
//         };

//         files["/package.json"] = {
//           code: JSON.stringify(packageJson, null, 2),
//         };
//       } catch (e) {
//         console.error("Could not parse or modify package.json", e);
//         // Continue with original package.json if parsing fails
//       }
//     }
    
//     // Create a custom vite config that forces WASM rollup usage
//     if (!files["/vite.config.ts"] && !files["/vite.config.js"]) {
//       files["/vite.config.ts"] = {
//         code: `import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// // https://vitejs.dev/config/
// export default defineConfig({
//   plugins: [react()],
//   build: {
//     rollupOptions: {
//       // Use the WASM version of rollup
//     }
//   },
//   optimizeDeps: {
//     exclude: ['rollup']
//   }
// })`
//       };
//     }
    
//     // Create a rollup shim that redirects to WASM version
//     files["/node_modules/rollup/package.json"] = {
//       code: JSON.stringify({
//         "name": "rollup",
//         "version": "4.28.1",
//         "main": "dist/rollup.js",
//         "module": "dist/rollup.js",
//         "browser": "dist/rollup.browser.js",
//         "exports": {
//           ".": {
//             "import": "./dist/rollup.js",
//             "require": "./dist/rollup.js"
//           }
//         }
//       }, null, 2)
//     };
    
//     files["/node_modules/rollup/dist/rollup.js"] = {
//       code: `// Rollup shim for Sandpack - redirects to WASM version
// module.exports = require('@rollup/wasm-node');`
//     };
    
//     files["/node_modules/rollup/dist/rollup.browser.js"] = {
//       code: `// Rollup browser shim for Sandpack - redirects to WASM version
// export * from '@rollup/wasm-node';
// export { default } from '@rollup/wasm-node';`
//     };
    
//     // Also override the native.js file that's causing the error
//     files["/node_modules/rollup/dist/native.js"] = {
//       code: `// Native shim for Sandpack - redirects to WASM version
// module.exports = require('@rollup/wasm-node');`
//     };

//     return NextResponse.json({ files });
//   } catch (error: unknown) {
//     console.error("GitHub API Error:", error);
//     if (hasStatusCode(error) && error.status === 404) {
//       return NextResponse.json(
//         {
//           error:
//             "Repository not found. Please check the URL and ensure it is a public repository.",
//         },
//         { status: 404 }
//       );
//     }
//     const message =
//       error instanceof Error ? error.message : "An unknown error occurred.";
//     return NextResponse.json(
//       { error: "Failed to fetch repository from GitHub.", details: message },
//       { status: 500 }
//     );
//   }
// }




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
          // Skip vite-specific config files since we're using react-ts template
          if (item.path === "vite.config.ts" || 
              item.path === "vite.config.js" || 
              item.path === "vite.config.mjs" ||
              item.path === "vite-env.d.ts" ||
              item.path === "tsconfig.node.json" ||
              item.path === "package.json" ||
              item.path === "package-lock.json" ||
              item.path === "yarn.lock" ||
              item.path === "pnpm-lock.yaml") {
            continue;
          }

          const { data: blobData } = await octokit.rest.git.getBlob({
            owner,
            repo,
            file_sha: item.sha!,
          });

          let content = Buffer.from(blobData.content, "base64").toString(
            "utf-8"
          );

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

          // Modify main.tsx or index.tsx to work with react-ts template
          if (item.path === "src/main.tsx" || item.path === "src/main.ts") {
            // Replace Vite-specific imports with standard React
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

          // For TypeScript files, ensure proper imports
          if (item.path.endsWith('.ts') || item.path.endsWith('.tsx')) {
            // Ensure React is imported for JSX files
            if (item.path.endsWith('.tsx') && !content.includes('import React') && !content.includes('import * as React')) {
              content = `import * as React from 'react';\n${content}`;
            }
          }

          // Convert vite env references to standard process.env
          if (content.includes('import.meta.env')) {
            content = content.replace(/import\.meta\.env\.DEV/g, "process.env.NODE_ENV === 'development'");
            content = content.replace(/import\.meta\.env\.PROD/g, "process.env.NODE_ENV === 'production'");
            content = content.replace(/import\.meta\.env\.MODE/g, "process.env.NODE_ENV");
            content = content.replace(/import\.meta\.env\.VITE_/g, "process.env.REACT_APP_");
          }

          // Sandpack expects absolute-style paths
          files[`/${item.path}`] = { code: content };
        } catch (blobError) {
          console.error(`Skipping file ${item.path} due to error:`, blobError);
        }
      }
    }

    // Create a simple index.tsx if main.tsx doesn't exist (for react-ts template)
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
);`
      };
    } else if (files["/src/main.tsx"]) {
      // Rename main.tsx to index.tsx for react-ts template
      files["/src/index.tsx"] = files["/src/main.tsx"];
      delete files["/src/main.tsx"];
    }

    // Update imports that reference main.tsx
    Object.keys(files).forEach(filePath => {
      if (files[filePath].code.includes('./main') || files[filePath].code.includes('/main')) {
        files[filePath].code = files[filePath].code
          .replace(/from ['"]\.\/main['"]/g, 'from "./index"')
          .replace(/from ['"]\/src\/main['"]/g, 'from "/src/index"');
      }
    });

    // Create a basic tsconfig.json for react-ts template
    files["/tsconfig.json"] = {
      code: JSON.stringify({
        "compilerOptions": {
          "target": "ES2020",
          "useDefineForClassFields": true,
          "lib": ["ES2020", "DOM", "DOM.Iterable"],
          "module": "ESNext",
          "skipLibCheck": true,
          "moduleResolution": "node",
          "resolveJsonModule": true,
          "isolatedModules": true,
          "noEmit": true,
          "jsx": "react-jsx",
          "strict": true,
          "noUnusedLocals": true,
          "noUnusedParameters": true,
          "noFallthroughCasesInSwitch": true,
          "esModuleInterop": true,
          "allowSyntheticDefaultImports": true,
          "forceConsistentCasingInFileNames": true,
          "baseUrl": ".",
          "paths": {
            "@/*": ["./src/*"]
          }
        },
        "include": ["src"],
        "exclude": ["node_modules"]
      }, null, 2)
    };

    // Ensure we have an HTML entry point
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
</html>`
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
    const message =
      error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json(
      { error: "Failed to fetch repository from GitHub.", details: message },
      { status: 500 }
    );
  }
}