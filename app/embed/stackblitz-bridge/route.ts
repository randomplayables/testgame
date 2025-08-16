// export async function GET() {
//   const js = `
// // RP Bridge for StackBlitz preview -> host
// (function () {
//   // This function automatically starts a session when the game loads in the sandbox.
//   async function startSession() {
//     try {
//       // Note: This fetch is intercepted by the logic below.
//       const res = await fetch('/api/sandbox/game-session', {
//         method: 'POST',
//         headers: {'Content-Type': 'application/json'},
//         body: JSON.stringify({ gameId: 'test-game' })
//       });
//       const { sessionId } = await res.json();
//       // Send the session ID out to the parent window (GameTester.tsx)
//       window.parent.postMessage({ type: 'SANDBOX_SESSION_ID', payload: sessionId }, '*');
//       // Store it on the window for the game's apiService to use if needed
//       window.__RP_SESSION_ID__ = sessionId;
//     } catch (e) {
//       console.error("RP Bridge: Failed to start session", e);
//     }
//   }
//   startSession();

//   // Monkey-patch the window.fetch function to proxy API calls
//   const ORIG_FETCH = window.fetch.bind(window);
//   window.fetch = (input, init) => {
//     const url = typeof input === 'string' ? input : input.url;

//     // Intercept only calls meant for the platform's API
//     if (typeof url === 'string' && (url.startsWith('/api/') || url.includes('/api/sandbox'))) {
//       const id = Math.random().toString(36).slice(2);
      
//       return new Promise((resolve, reject) => {
//         // Listen for a response message from the host
//         function onMsg(ev) {
//           if (ev.data && ev.data.type === 'RP_FETCH_RESULT' && ev.data.id === id) {
//             window.removeEventListener('message', onMsg);
//             if (ev.data.error) {
//               return reject(new Error(ev.data.error));
//             }
//             // Reconstruct the Response object from the host's data
//             const res = new Response(ev.data.body, { status: ev.data.status, headers: ev.data.headers });
//             resolve(res);
//           }
//         }
//         window.addEventListener('message', onMsg);
        
//         // Send the fetch request details to the host window
//         window.parent.postMessage({ type: 'RP_FETCH', id, input: { url, init } }, '*');
//       });
//     }
    
//     // For all other fetch calls, use the original function
//     return ORIG_FETCH(input, init);
//   };
// })();`;

//   return new Response(js, { headers: { 'Content-Type': 'application/javascript' } });
// }




// app/embed/stackblitz-bridge/route.ts
// Serves a small JS shim that runs inside the StackBlitz iframe.
// It safely intercepts ALL /api/* calls (relative or absolute), rewrites them
// to /api/sandbox/*, and proxies via postMessage to the host.
// No UI changes. No dependency on your app code. Safe to drop in.

/* eslint-disable */
export async function GET() {
  const js = `
// === RandomPlayables StackBlitz Bridge =====================================
// This script runs in the iframe (the game). It:
//  1) Intercepts window.fetch for any /api/* request (including absolute URLs).
//  2) Rewrites them to /api/sandbox/* to keep everything in the sandbox.
//  3) Sends the request to the host via postMessage, and returns the host's response.
//  4) Adds a best-effort Axios interceptor so axios-based clients also route to sandbox.
//  5) Tries to start a sandbox session; failure is silently ignored.

(function () {
  // ------------------------------ Helpers ----------------------------------
  function toUrl(u) {
    try {
      if (typeof u === 'string') return new URL(u, location.origin);
      if (u && typeof u === 'object' && 'url' in u && u.url) return new URL(u.url, location.origin);
    } catch (_) {}
    return null;
  }

  function isInternalApi(urlObj) {
    if (!urlObj) return false;
    // Only trap site-internal API calls; do NOT trap 3rd-party origins.
    // Absolute RP URLs or relative URLs that resolve to our origin.
    const sameOrigin = urlObj.origin === location.origin;
    const path = urlObj.pathname || '/';
    return sameOrigin && path.startsWith('/api/');
  }

  function toSandboxPath(u) {
    const url = toUrl(u);
    if (!url) return '/api/sandbox';
    const p = url.pathname;            // e.g. /api/game-session
    const qs = url.search || '';
    if (p.startsWith('/api/sandbox/')) return p + qs;
    if (p === '/api/sandbox') return p + qs;
    if (p.startsWith('/api/')) return '/api/sandbox' + p.slice(4) + qs;
    return '/api/sandbox' + qs;
  }

  // -------------------------- Optional session ------------------------------
  // Best-effort; ignored if endpoint is absent.
  (async function startSessionMaybe() {
    try {
      const res = await fetch('/api/sandbox/game-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Keep the literal string 'test-game' here; do not change unrelated UI or state.
        body: JSON.stringify({ gameId: 'test-game' })
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data && data.sessionId) {
          window.__RP_SESSION_ID__ = data.sessionId;
          try {
            window.parent.postMessage({ type: 'SANDBOX_SESSION_ID', payload: data.sessionId }, '*');
          } catch (_) {}
        }
      }
    } catch (_) {
      // Silent: not critical for game operation
    }
  })();

  // ---------------------------- fetch patch ---------------------------------
  const ORIG_FETCH = window.fetch.bind(window);

  window.fetch = (input, init) => {
    const u = toUrl(input);
    if (!isInternalApi(u)) {
      // For non-internal requests, or anything we don't recognize, bypass.
      return ORIG_FETCH(input, init);
    }

    const forwardUrl = toSandboxPath(input);
    const id = Math.random().toString(36).slice(2);

    return new Promise((resolve, reject) => {
      function onMsg(ev) {
        const msg = ev?.data;
        if (!msg || msg.type !== 'RP_FETCH_RESULT' || msg.id !== id) return;
        window.removeEventListener('message', onMsg);
        if (msg.error) {
          reject(new Error(msg.error));
          return;
        }
        try {
          const res = new Response(msg.body, { status: msg.status, headers: msg.headers });
          resolve(res);
        } catch (e) {
          reject(e);
        }
      }

      window.addEventListener('message', onMsg);

      try {
        window.parent.postMessage(
          { type: 'RP_FETCH', id, input: { url: forwardUrl, init } },
          '*'
        );
      } catch (e) {
        window.removeEventListener('message', onMsg);
        reject(e);
      }
    });
  };

  // ----------------------- Axios compatibility ------------------------------
  // If axios is present, ensure axios requests to /api/* also hit the sandbox.
  try {
    if (window.axios && window.axios.interceptors && window.axios.interceptors.request) {
      window.axios.interceptors.request.use((config) => {
        try {
          if (config && config.url) {
            const u = toUrl(config.url);
            if (isInternalApi(u)) {
              config.url = toSandboxPath(config.url);
            }
          }
        } catch (_) {}
        return config;
      });
    }
  } catch (_) {
    // Ignore — axios may not be present or may be bundled differently.
  }
})();
`;
  return new Response(js, {
    headers: { "Content-Type": "application/javascript; charset=utf-8" },
  });
}