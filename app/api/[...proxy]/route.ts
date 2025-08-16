import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ proxy: string[] }> }
) {
  const { proxy } = await params;
  const path = proxy.join('/');

  console.log("Fallback API route handling:", path);

  // Redirect game-session and game-data requests to the sandbox API
  if (path === 'game-session' || path === 'game-data') {
    const url = new URL(request.url);
    const sandboxUrl = `${url.origin}/api/sandbox/${path}`;
    
    console.log("Redirecting to sandbox API:", sandboxUrl);
    
    try {
      const body = await request.json();
      const response = await fetch(sandboxUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    } catch (error) {
      console.error("Error redirecting to sandbox API:", error);
      return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Not Found' }, { status: 404 });
}