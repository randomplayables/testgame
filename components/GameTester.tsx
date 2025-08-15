"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
  SandpackFiles,
} from "@codesandbox/sandpack-react";
import { Spinner } from "./spinner";

interface GameTesterProps {
  files: SandpackFiles;
}

async function fetchSandboxData(sessionId: string | null) {
  if (!sessionId) return [];
  const response = await fetch(`/api/sandbox/get-data?sessionId=${sessionId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch sandbox data");
  }
  const data = await response.json();
  return data.gameData || [];
}

export default function GameTester({ files }: GameTesterProps) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Listen for session id posted by injected helper in apiService.ts
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event?.data?.type === "SANDBOX_SESSION_ID" && event.data.payload) {
        setActiveSessionId(String(event.data.payload));
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const { data: sandboxData, isLoading: isLoadingData } = useQuery({
    queryKey: ["sandboxData", activeSessionId],
    queryFn: () => fetchSandboxData(activeSessionId),
    enabled: !!activeSessionId,
    refetchInterval: 2000,
  });

  // Keep files stable across renders
  const spFiles = useMemo(() => files, [files]);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-white">
        <SandpackProvider
          template="react-ts"
          files={spFiles}
          options={{
            externalResources: [],
            recompileMode: "delayed",
            recompileDelay: 300,
          }}
        >
          <SandpackLayout>
            <SandpackPreview showRefreshButton />
          </SandpackLayout>
        </SandpackProvider>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h3 className="text-lg font-semibold mb-2">Session Data</h3>
        {!activeSessionId && (
          <p className="text-sm text-gray-600">
            Waiting for session to start…
          </p>
        )}
        {activeSessionId && (
          <p className="text-sm text-gray-600 mb-3">
            Session: <span className="font-mono">{activeSessionId}</span>
          </p>
        )}
        {activeSessionId && isLoadingData && (
          <div className="flex items-center gap-2 text-gray-600">
            <Spinner className="w-4 h-4" />
            <span>Loading sandbox data…</span>
          </div>
        )}
        {activeSessionId && !isLoadingData && (
          <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto max-h-72">
            {JSON.stringify(sandboxData, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}