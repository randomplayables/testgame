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

export default function GameTester({ files }: { files: Record<string, string> }) {
  const embedRef = useRef<HTMLDivElement>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  const { data: sandboxData, isLoading: isLoadingData } = useQuery({
    queryKey: ['sandboxData', sessionId],
    queryFn: () => fetchSandboxData(sessionId),
    enabled: !!sessionId,
    refetchInterval: 2000,
  });

  // Listener to receive the session ID from the bridge script
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if ((/\.stackblitz\.io$/.test(new URL(e.origin).hostname) || e.origin === "https://stackblitz.com")
         && e.data?.type === "SANDBOX_SESSION_ID") {
        setSessionId(String(e.data.payload));
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Host-side listener that acts as a fetch proxy for the embedded project
  useEffect(() => {
    const handler = async (e: MessageEvent) => {
      if (!/\.stackblitz\.io$/.test(new URL(e.origin).hostname) && e.origin !== 'https://stackblitz.com') return;
      const msg = e.data;
      if (msg?.type === 'RP_FETCH') {
        const { id, input } = msg;
        try {
          const r = await fetch(input.url, input.init);
          const body = await r.text();
          const headers = Object.fromEntries(r.headers.entries());
          (embedRef.current?.querySelector('iframe') as HTMLIFrameElement)?.contentWindow?.postMessage(
            { type: 'RP_FETCH_RESULT', id, status: r.status, headers, body },
            e.origin
          );
        } catch (err) {
          (embedRef.current?.querySelector('iframe') as HTMLIFrameElement)?.contentWindow?.postMessage(
            { type: 'RP_FETCH_RESULT', id, error: String(err) },
            e.origin
          );
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Effect to embed the project when files are ready
  useEffect(() => {
    if (!embedRef.current || !files) return;

    embedRef.current.innerHTML = ""; // Clear previous embed

    sdk.embedProject(embedRef.current, {
      title: "Game Test",
      template: "node",
      files: files as ProjectFiles,
    }, {
      height: '100%',
      // --- FIX: Point to the correct entry file for the web server ---
      openFile: "index.html",
      // -----------------------------------------------------------------
      clickToLoad: false,
      showSidebar: false,
      startScript: "npm run dev",
      view: "preview",
      terminalHeight: 75
    });
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