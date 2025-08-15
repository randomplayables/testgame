import { NextResponse } from "next/server";

// This route serves the client-side script that will be injected into the sandboxed game.
export async function GET() {
  const js = `
// RP Bridge for StackBlitz preview -> host
(function () {
  // This function automatically starts a session when the game loads in the sandbox.
  async function startSession() {
    try {
      // Note: This fetch is intercepted by the logic below.
      const res = await fetch('/api/sandbox/game-session', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ gameId: 'test-game' })
      });
      const { sessionId } = await res.json();
      // Send the session ID out to the parent window (GameTester.tsx)
      window.parent.postMessage({ type: 'SANDBOX_SESSION_ID', payload: sessionId }, '*');
      // Store it on the window for the game's apiService to use if needed
      window.__RP_SESSION_ID__ = sessionId;
    } catch (e) {
      console.error("RP Bridge: Failed to start session", e);
    }
  }
  startSession();

  // Monkey-patch the window.fetch function to proxy API calls
  const ORIG_FETCH = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input.url;

    // Intercept only calls meant for the platform's API
    if (typeof url === 'string' && (url.startsWith('/api/') || url.includes('/api/sandbox'))) {
      const id = Math.random().toString(36).slice(2);
      
      return new Promise((resolve, reject) => {
        // Listen for a response message from the host
        function onMsg(ev) {
          if (ev.data && ev.data.type === 'RP_FETCH_RESULT' && ev.data.id === id) {
            window.removeEventListener('message', onMsg);
            if (ev.data.error) {
              return reject(new Error(ev.data.error));
            }
            // Reconstruct the Response object from the host's data
            const res = new Response(ev.data.body, { status: ev.data.status, headers: ev.data.headers });
            resolve(res);
          }
        }
        window.addEventListener('message', onMsg);
        
        // Send the fetch request details to the host window
        window.parent.postMessage({ type: 'RP_FETCH', id, input: { url, init } }, '*');
      });
    }
    
    // For all other fetch calls, use the original function
    return ORIG_FETCH(input, init);
  };
})();`;

  return new Response(js, { headers: { 'Content-Type': 'application/javascript' } });
}