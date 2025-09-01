// "use client";

// import { useEffect, useRef, useState } from "react";
// import sdk, { ProjectFiles } from "@stackblitz/sdk";
// import { useQuery } from "@tanstack/react-query";
// import { Spinner } from "./spinner";

// async function fetchSandboxData(sessionId: string | null) {
//   if (!sessionId) return [];
//   const response = await fetch(`/api/sandbox/get-data?sessionId=${sessionId}`);
//   if (!response.ok) {
//     throw new Error('Failed to fetch sandbox data');
//   }
//   const data = await response.json();
//   return data.gameData || [];
// }

// // Accept messages from current StackBlitz hosts (including WebContainer variants)
// function isFromSandbox(origin: string) {
//   try {
//     const host = new URL(origin).hostname;
//     return origin === 'https://stackblitz.com'
//         || host.endsWith('.stackblitz.io')
//         || host.endsWith('.webcontainer.io')
//         || host.endsWith('.local.webcontainer.io');
//   } catch {
//     return false;
//   }
// }

// export default function GameTester({ files }: { files: Record<string, string> }) {
//   const embedRef = useRef<HTMLDivElement>(null);
//   const [sessionId, setSessionId] = useState<string | null>(null);
  
//   const { data: sandboxData, isLoading: isLoadingData, refetch } = useQuery({
//     queryKey: ['sandboxData', sessionId],
//     queryFn: () => fetchSandboxData(sessionId),
//     enabled: !!sessionId,
//     refetchInterval: 2000,
//   });

//   // Listener to receive the session ID from the bridge script
//   useEffect(() => {
//     const onMsg = (e: MessageEvent) => {
//       if (!isFromSandbox(e.origin)) return;
//       if (e.data?.type === "SANDBOX_SESSION_ID") {
//         console.log("Received session ID from sandbox:", e.data.payload);
//         setSessionId(String(e.data.payload));
//       }
//     };
//     window.addEventListener("message", onMsg);
//     return () => window.removeEventListener("message", onMsg);
//   }, []);

//   // Host-side listener that acts as a fetch proxy for the embedded project
//   useEffect(() => {
//     const handler = async (e: MessageEvent) => {
//       if (!isFromSandbox(e.origin)) {
//         // (debug) show filtered RP_* messages
//         if (typeof e.data?.type === 'string' && e.data.type.startsWith('RP_')) {
//           console.debug("[Host] Ignored message from non-sandbox origin:", e.origin, e.data?.type);
//         }
//         return;
//       }
//       const msg = e.data;
//       if (msg?.type === 'RP_FETCH') {
//         const { id, input } = msg;
//         console.log("Proxying fetch request:", input.url);

//         try {
//           // Convert relative URL to absolute URL pointing to our server
//           let fetchUrl: string = input.url as string;
//           if (fetchUrl.startsWith('/api/')) {
//             // Build the absolute URL for our testgame server
//             fetchUrl = window.location.origin + fetchUrl;
//           }
          
//           const r = await fetch(fetchUrl, input.init);
//           const body = await r.text();
//           const headers = Object.fromEntries(r.headers.entries());
          
//           // Send the response back using e.source (the window that sent the message)
//           if (e.source) {
//             (e.source as Window).postMessage(
//               { type: 'RP_FETCH_RESULT', id, status: r.status, headers, body },
//               e.origin
//             );
//           } else {
//             console.debug("[Host] No e.source on message; cannot post response");
//           }
          
//           // After successful response, trigger a data refetch
//           if (r.ok && (input.url.includes('game-session') || input.url.includes('game-data'))) {
//             setTimeout(() => refetch(), 500);
//           }
//         } catch (err) {
//           console.error("Fetch proxy error:", err);
//           if (e.source) {
//             (e.source as Window).postMessage(
//               { type: 'RP_FETCH_RESULT', id, error: String(err) },
//               e.origin
//             );
//           }
//         }
//       }
//     };
//     window.addEventListener('message', handler);
//     return () => window.removeEventListener('message', handler);
//   }, [refetch]);

//   // Embed the project when files are ready
//   useEffect(() => {
//     if (!embedRef.current || !files) return;

//     embedRef.current.innerHTML = ""; // Clear previous embed

//     sdk.embedProject(embedRef.current, {
//       title: "Game Test",
//       template: "node",
//       files: files as ProjectFiles,
//     }, {
//       height: '100%',
//       openFile: "index.html",
//       clickToLoad: false,
//       showSidebar: false,
//       startScript: "dev",
//       view: "preview",
//       terminalHeight: 75
//     });
//   }, [files]);

//   return (
//     <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
//       <div className="bg-white p-4 rounded-lg shadow-md border h-[80vh] flex flex-col">
//         <h2 className="text-xl font-semibold mb-4 text-gray-700">Game Preview</h2>
//         <div ref={embedRef} className="flex-grow w-full h-full bg-gray-100 rounded overflow-hidden flex items-center justify-center">
//           <div className="flex items-center gap-2 text-gray-500">
//             <Spinner /> <span>Booting WebContainer…</span>
//           </div>
//         </div>
//       </div>
//       <div className="bg-white p-4 rounded-lg shadow-md border h-[80vh] flex flex-col">
//         <h2 className="text-xl font-semibold mb-4 text-gray-700">Sandbox Data Log</h2>
//         <p className="text-xs text-gray-500 mb-2">
//           Session ID: {sessionId || 'Waiting for game to start...'}
//         </p>
//         <div className="flex-grow bg-gray-900 text-white font-mono text-xs p-4 rounded-md overflow-y-auto">
//           {isLoadingData && <p>Loading data...</p>}
//           {!sessionId && <p className="text-gray-400">Play the game to see data appear here.</p>}
//           {sandboxData && sandboxData.length > 0 ? (
//             <pre>{JSON.stringify(sandboxData, null, 2)}</pre>
//           ) : (
//             !isLoadingData && sessionId && <p className="text-gray-400">No data recorded for this session yet.</p>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }





"use client";

import { useEffect, useRef, useState } from "react";
import sdk, { ProjectFiles } from "@stackblitz/sdk";
import { useQuery } from "@tanstack/react-query";
import { Spinner } from "./spinner";

async function fetchSandboxData(sessionId: string | null) {
  if (!sessionId) return [];
  const response = await fetch(`/api/sandbox/get-data?sessionId=${sessionId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch sandbox data');
  }
  const data = await response.json();
  return data.gameData || [];
}

// Accept messages from current StackBlitz hosts (including WebContainer variants)
function isFromSandbox(origin: string) {
  try {
    const host = new URL(origin).hostname;
    return origin === 'https://stackblitz.com'
        || host.endsWith('.stackblitz.io')
        || host.endsWith('.webcontainer.io')
        || host.endsWith('.local.webcontainer.io');
  } catch {
    return false;
  }
}

// --- Helpers to derive a readable test-game name from the repo URL ---
function repoSlugFromUrl(url: string | undefined): string {
  if (!url) return "game";
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const raw = parts[parts.length - 1] || "game";
    return raw.replace(/\.git$/i, "").toLowerCase().replace(/[^a-z0-9-]/g, "-");
  } catch {
    return "game";
  }
}
function makeTestName(base: string): string {
  const rand = Math.random().toString(36).slice(2, 7); // 5 chars
  return `${base}-test-${rand}`;
}

export default function GameTester({
  files,
  repoUrl,
}: {
  files: Record<string, string>;
  repoUrl: string;
}) {
  const embedRef = useRef<HTMLDivElement>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const { data: sandboxData, isLoading: isLoadingData, refetch } = useQuery({
    queryKey: ['sandboxData', sessionId],
    queryFn: () => fetchSandboxData(sessionId),
    enabled: !!sessionId,                 // do not run until a session exists
    refetchInterval: sessionId ? 2000 : false, // also gate the interval explicitly
  });

  // Listener to receive the session ID from the bridge script
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (!isFromSandbox(e.origin)) return;
      if (e.data?.type === "SANDBOX_SESSION_ID") {
        console.log("Received session ID from sandbox:", e.data.payload);
        setSessionId(String(e.data.payload));
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Host-side listener that acts as a fetch proxy for the embedded project
  useEffect(() => {
    const handler = async (e: MessageEvent) => {
      if (!isFromSandbox(e.origin)) {
        if (typeof e.data?.type === 'string' && e.data.type.startsWith('RP_')) {
          console.debug("[Host] Ignored message from non-sandbox origin:", e.origin, e.data?.type);
        }
        return;
      }
      const msg = e.data;
      if (msg?.type === 'RP_FETCH') {
        const { id, input } = msg as {
          id: string;
          input: { url: string; init?: RequestInit & { body?: any } };
        };
        console.log("Proxying fetch request:", input.url);

        try {
          // Convert relative URL to absolute URL pointing to our server
          let fetchUrl: string = input.url as string;
          if (fetchUrl.startsWith('/api/')) {
            fetchUrl = window.location.origin + fetchUrl;
          }

          // If the embedded game is creating a session, inject a readable gameId/name
          let initToUse: RequestInit = { ...(input.init || {}) };
          const method = (initToUse.method || 'GET').toString().toUpperCase();
          const isSessionCreate =
            method === 'POST' &&
            (fetchUrl.includes('/api/sandbox/game-session') || input.url.includes('/game-session'));

          if (isSessionCreate) {
            const headers = new Headers(initToUse.headers as HeadersInit | undefined);
            if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

            let payload: any = {};
            if (initToUse.body) {
              try {
                payload = typeof initToUse.body === 'string' ? JSON.parse(initToUse.body) : initToUse.body;
              } catch {
                payload = {};
              }
            }

            // Only set if not already provided by the game
            const base = repoSlugFromUrl(repoUrl);
            if (!payload.gameId) payload.gameId = makeTestName(base);
            if (!payload.gameName) payload.gameName = payload.gameId;
            // keep userId/createdBy as test values for sandbox sessions

            initToUse = {
              ...initToUse,
              headers: Object.fromEntries(headers.entries()),
              body: JSON.stringify(payload),
            };
          }

          const r = await fetch(fetchUrl, initToUse);
          const body = await r.text();
          const headers = Object.fromEntries(r.headers.entries());

          // Send the response back using e.source (the window that sent the message)
          if (e.source) {
            (e.source as Window).postMessage(
              { type: 'RP_FETCH_RESULT', id, status: r.status, headers, body },
              e.origin
            );
          } else {
            console.debug("[Host] No e.source on message; cannot post response");
          }

          // After successful response, trigger a data refetch
          if (r.ok && (input.url.includes('game-session') || input.url.includes('game-data'))) {
            setTimeout(() => refetch(), 500);
          }
        } catch (err) {
          console.error("Fetch proxy error:", err);
          if (e.source) {
            (e.source as Window).postMessage(
              { type: 'RP_FETCH_RESULT', id, error: String(err) },
              e.origin
            );
          }
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [repoUrl, refetch]);

  // Embed the project when files are ready
  useEffect(() => {
    if (!embedRef.current || !files) return;

    embedRef.current.innerHTML = ""; // Clear previous embed

    sdk.embedProject(
      embedRef.current,
      {
        title: "Game Test",
        template: "node",
        files: files as ProjectFiles,
      },
      {
        height: '100%',
        openFile: "index.html",
        clickToLoad: false,
        showSidebar: false,
        startScript: "dev",
        view: "preview",
        terminalHeight: 75,
      }
    );
  }, [files]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white p-4 rounded-lg shadow-md border h-[80vh] flex flex-col">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Game Preview</h2>
        <div ref={embedRef} className="flex-grow w-full h-full bg-gray-100 rounded overflow-hidden flex items-center justify-center">
          <div className="flex items-center gap-2 text-gray-500">
            <Spinner /> <span>Booting WebContainer…</span>
          </div>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow-md border h-[80vh] flex flex-col">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Sandbox Data Log</h2>
        <p className="text-xs text-gray-500 mb-2">
          Session ID: {sessionId || 'Waiting for game to start...'}
        </p>
        <div className="flex-grow bg-gray-900 text-white font-mono text-xs p-4 rounded-md overflow-y-auto">
          {isLoadingData && <p>Loading data...</p>}
          {!sessionId && <p className="text-gray-400">Play the game to see data appear here.</p>}
          {sandboxData && sandboxData.length > 0 ? (
            <pre>{JSON.stringify(sandboxData, null, 2)}</pre>
          ) : (
            !isLoadingData && sessionId && <p className="text-gray-400">No data recorded for this session yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}