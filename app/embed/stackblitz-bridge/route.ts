// export async function GET() {
//   const js = `
// // RP Bridge for StackBlitz preview -> host
// (function () {
//   const ORIG_FETCH = window.fetch.bind(window);

//   window.fetch = (input, init) => {
//     const url = typeof input === 'string' ? input : input.url;
//     const method = (init && init.method ? init.method : 'GET').toUpperCase();

//     // Only proxy platform API calls
//     if (typeof url === 'string' && (url.startsWith('/api/') || url.includes('/api/sandbox'))) {
//       const id = Math.random().toString(36).slice(2);

//       return new Promise((resolve, reject) => {
//         function onMsg(ev) {
//           if (ev.data && ev.data.type === 'RP_FETCH_RESULT' && ev.data.id === id) {
//             window.removeEventListener('message', onMsg);

//             if (ev.data.error) return reject(new Error(ev.data.error));

//             try {
//               const urlObj = new URL(url, location.origin);
//               const isSessionCreate = method === 'POST' &&
//                 (urlObj.pathname.endsWith('/api/sandbox/game-session') || url.includes('/api/sandbox/game-session'));

//               // Announce the SAME session the game just created
//               if (isSessionCreate && ev.data.body) {
//                 const parsed = JSON.parse(ev.data.body);
//                 if (parsed && parsed.sessionId) {
//                   window.parent.postMessage({ type: 'SANDBOX_SESSION_ID', payload: parsed.sessionId }, '*');
//                   window.__RP_SESSION_ID__ = parsed.sessionId;
//                 }
//               }
//             } catch {}

//             const res = new Response(ev.data.body, { status: ev.data.status, headers: ev.data.headers });
//             resolve(res);
//           }
//         }
//         window.addEventListener('message', onMsg);

//         window.parent.postMessage({ type: 'RP_FETCH', id, input: { url, init } }, '*');
//       });
//     }

//     return ORIG_FETCH(input, init);
//   };
// })();`;

//   return new Response(js, { headers: { "Content-Type": "application/javascript" } });
// }







export async function GET() {
  const js = `
// RP Bridge for StackBlitz preview -> host
(function () {
  const ORIG_FETCH = window.fetch.bind(window);

  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = (init && init.method ? init.method : 'GET').toUpperCase();

    // Only proxy platform API calls
    if (typeof url === 'string' && (url.startsWith('/api/') || url.includes('/api/sandbox'))) {
      console.log('[Bridge] Intercepting API call:', url, method);
      const id = Math.random().toString(36).slice(2);

      return new Promise((resolve, reject) => {
        function onMsg(ev) {
          if (ev.data && ev.data.type === 'RP_FETCH_RESULT' && ev.data.id === id) {
            window.removeEventListener('message', onMsg);

            if (ev.data.error) {
              console.error('[Bridge] Fetch error:', ev.data.error);
              return reject(new Error(ev.data.error));
            }

            try {
              // Check if this is a session creation response
              const urlObj = new URL(url, location.origin);
              const isSessionCreate = method === 'POST' &&
                (urlObj.pathname.includes('/game-session') || url.includes('/game-session'));

              // Announce the session ID when created
              if (isSessionCreate && ev.data.body) {
                console.log('[Bridge] Session creation response:', ev.data.body);
                const parsed = JSON.parse(ev.data.body);
                if (parsed && parsed.sessionId) {
                  console.log('[Bridge] Announcing session ID:', parsed.sessionId);
                  window.parent.postMessage({ type: 'SANDBOX_SESSION_ID', payload: parsed.sessionId }, '*');
                  window.__RP_SESSION_ID__ = parsed.sessionId;
                }
              }
            } catch (e) {
              console.error('[Bridge] Error processing response:', e);
            }

            const res = new Response(ev.data.body, { status: ev.data.status, headers: ev.data.headers });
            resolve(res);
          }
        }
        window.addEventListener('message', onMsg);

        console.log('[Bridge] Sending fetch request to parent:', { url, method });
        window.parent.postMessage({ type: 'RP_FETCH', id, input: { url, init } }, '*');
      });
    }

    return ORIG_FETCH(input, init);
  };
  
  console.log('[Bridge] RP Bridge initialized');
})();`;

  return new Response(js, { headers: { "Content-Type": "application/javascript" } });
}