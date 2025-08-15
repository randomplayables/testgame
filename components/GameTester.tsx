// "use client";

// import { SandpackProvider, SandpackLayout, SandpackPreview } from "@codesandbox/sandpack-react";
// import { SandpackFiles } from '@codesandbox/sandpack-react';
// import { useState, useEffect } from 'react';
// import { useQuery } from '@tanstack/react-query';
// import { Spinner } from './spinner';

// interface GameTesterProps {
//   files: SandpackFiles;
// }

// async function fetchSandboxData(sessionId: string | null) {
//   if (!sessionId) return [];
//   const response = await fetch(`/api/sandbox/get-data?sessionId=${sessionId}`);
//   if (!response.ok) {
//     throw new Error('Failed to fetch sandbox data');
//   }
//   const data = await response.json();
//   return data.gameData || [];
// }

// export default function GameTester({ files }: GameTesterProps) {
//   const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
//   const [isReady, setIsReady] = useState(false);

//   const { data: sandboxData, isLoading: isLoadingData } = useQuery({
//     queryKey: ['sandboxData', activeSessionId],
//     queryFn: () => fetchSandboxData(activeSessionId),
//     enabled: !!activeSessionId,
//     refetchInterval: 2000, // Poll for new data every 2 seconds
//   });

//   useEffect(() => {
//     const handleMessage = (event: MessageEvent) => {
//       // It's good practice to check the origin for security
//       // if (event.origin !== "https://sandpack-your-origin.com") return;

//       if (event.data?.type === 'SANDBOX_SESSION_ID') {
//         const receivedSessionId = event.data.payload;
//         if (receivedSessionId && activeSessionId !== receivedSessionId) {
//           console.log(`Received new session ID from sandbox: ${receivedSessionId}`);
//           setActiveSessionId(receivedSessionId);
//         }
//       }
//     };

//     window.addEventListener('message', handleMessage);
//     return () => {
//       window.removeEventListener('message', handleMessage);
//     };
//   }, [activeSessionId]);

//   // A simple effect to give Sandpack time to initialize before showing content
//   useEffect(() => {
//     const timer = setTimeout(() => setIsReady(true), 500);
//     return () => clearTimeout(timer);
//   }, []);

//   return (
//     <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
//       <div className="bg-white p-4 rounded-lg shadow-md border h-[70vh] flex flex-col">
//         <h2 className="text-xl font-semibold mb-4 text-gray-700">Game Preview</h2>
//         <div className="flex-grow w-full h-full border rounded-md overflow-hidden bg-gray-100 relative">
//           {isReady ? (
//             <SandpackProvider
//               template="vite-react-ts"
//               files={files}
//               options={{
//                 externalResources: ["https://cdn.tailwindcss.com"],
//               }}
//               theme="light"
//             >
//               <SandpackLayout>
//                 <SandpackPreview
//                   showNavigator={true}
//                   showOpenInCodeSandbox={false}
//                   showRefreshButton={true}
//                   style={{ height: '100%', width: '100%' }}
//                 />
//               </SandpackLayout>
//             </SandpackProvider>
//           ) : (
//             <div className="flex items-center justify-center h-full">
//               <Spinner />
//               <span className="ml-2">Initializing Sandbox...</span>
//             </div>
//           )}
//         </div>
//       </div>
//       <div className="bg-white p-4 rounded-lg shadow-md border h-[70vh] flex flex-col">
//         <h2 className="text-xl font-semibold mb-4 text-gray-700">Sandbox Data Log</h2>
//         <p className="text-xs text-gray-500 mb-2">
//           Session ID: {activeSessionId || 'Waiting for game to start...'}
//         </p>
//         <div className="flex-grow bg-gray-900 text-white font-mono text-xs p-4 rounded-md overflow-y-auto">
//           {isLoadingData && <p>Loading data...</p>}
//           {!activeSessionId && <p className="text-gray-400">Play the game to see data appear here.</p>}
//           {sandboxData && sandboxData.length > 0 ? (
//             <pre>{JSON.stringify(sandboxData, null, 2)}</pre>
//           ) : (
//             !isLoadingData && activeSessionId && <p className="text-gray-400">No data recorded for this session yet.</p>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }






"use client";

import { SandpackProvider, SandpackLayout, SandpackPreview } from "@codesandbox/sandpack-react";
import { SandpackFiles } from '@codesandbox/sandpack-react';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Spinner } from './spinner';

interface GameTesterProps {
  files: SandpackFiles;
}

async function fetchSandboxData(sessionId: string | null) {
  if (!sessionId) return [];
  const response = await fetch(`/api/sandbox/get-data?sessionId=${sessionId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch sandbox data');
  }
  const data = await response.json();
  return data.gameData || [];
}

export default function GameTester({ files }: GameTesterProps) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const { data: sandboxData, isLoading: isLoadingData } = useQuery({
    queryKey: ['sandboxData', activeSessionId],
    queryFn: () => fetchSandboxData(activeSessionId),
    enabled: !!activeSessionId,
    refetchInterval: 2000, // Poll for new data every 2 seconds
  });

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // It's good practice to check the origin for security
      // if (event.origin !== "https://sandpack-your-origin.com") return;

      if (event.data?.type === 'SANDBOX_SESSION_ID') {
        const receivedSessionId = event.data.payload;
        if (receivedSessionId && activeSessionId !== receivedSessionId) {
          console.log(`Received new session ID from sandbox: ${receivedSessionId}`);
          setActiveSessionId(receivedSessionId);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [activeSessionId]);

  // A simple effect to give Sandpack time to initialize before showing content
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white p-4 rounded-lg shadow-md border h-[70vh] flex flex-col">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Game Preview</h2>
        <div className="flex-grow w-full h-full border rounded-md overflow-hidden bg-gray-100 relative">
          {isReady ? (
            <SandpackProvider
              template="react-ts"
              files={files}
              options={{
                externalResources: ["https://cdn.tailwindcss.com"],
                bundlerURL: "https://sandpack-bundler.codesandbox.io",
              }}
              customSetup={{
                dependencies: {
                  "react": "^18.2.0",
                  "react-dom": "^18.2.0",
                  "mathjs": "^13.0.3",
                  "clsx": "^2.1.1"
                },
                devDependencies: {
                  "@types/react": "^18.2.0",
                  "@types/react-dom": "^18.2.0",
                  "typescript": "^5.0.0"
                }
              }}
              theme="light"
            >
              <SandpackLayout>
                <SandpackPreview
                  showNavigator={true}
                  showOpenInCodeSandbox={false}
                  showRefreshButton={true}
                  style={{ height: '100%', width: '100%' }}
                />
              </SandpackLayout>
            </SandpackProvider>
          ) : (
            <div className="flex items-center justify-center h-full">
              <Spinner />
              <span className="ml-2">Initializing Sandbox...</span>
            </div>
          )}
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow-md border h-[70vh] flex flex-col">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Sandbox Data Log</h2>
        <p className="text-xs text-gray-500 mb-2">
          Session ID: {activeSessionId || 'Waiting for game to start...'}
        </p>
        <div className="flex-grow bg-gray-900 text-white font-mono text-xs p-4 rounded-md overflow-y-auto">
          {isLoadingData && <p>Loading data...</p>}
          {!activeSessionId && <p className="text-gray-400">Play the game to see data appear here.</p>}
          {sandboxData && sandboxData.length > 0 ? (
            <pre>{JSON.stringify(sandboxData, null, 2)}</pre>
          ) : (
            !isLoadingData && activeSessionId && <p className="text-gray-400">No data recorded for this session yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}