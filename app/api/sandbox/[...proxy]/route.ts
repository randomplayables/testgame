// import { NextResponse } from "next/server";
// import mongoose from "mongoose";
// import { v4 as uuidv4 } from "uuid";

// export const runtime = 'nodejs'; // Pin to the Node.js runtime for Mongoose

// // --- Database Connection (copied from main project) ---
// let sandboxConnection: mongoose.Connection | null = null;
// async function connectToSandboxDB(): Promise<mongoose.Connection> {
//   if (sandboxConnection && sandboxConnection.readyState === 1) {
//     return sandboxConnection;
//   }
//   const MONGODB_URI = process.env.MONGODB_URI;
//   if (!MONGODB_URI) throw new Error("MONGODB_URI not defined");
//   try {
//     const conn = mongoose.createConnection(MONGODB_URI);
//     sandboxConnection = await conn.useDb("GameLabSandbox", { useCache: true });
//     return sandboxConnection;
//   } catch (error) {
//     console.error("Error connecting to GameLabSandbox database:", error);
//     throw new Error("Could not connect to the sandbox database.");
//   }
// }

// async function getSandboxModels() {
//   const conn = await connectToSandboxDB();
//   const GameSessionSchema = new mongoose.Schema({
//     sessionId: { type: String, required: true, unique: true },
//     userId: { type: String },
//     gameId: { type: String, required: true },
//     startTime: { type: Date, default: Date.now },
//     isTestSession: { type: Boolean, default: true },
//   });
//   const GameDataSchema = new mongoose.Schema({
//     sessionId: { type: String, required: true },
//     gameId: { type: String, required: true },
//     userId: { type: String },
//     roundNumber: { type: Number },
//     roundData: { type: mongoose.Schema.Types.Mixed },
//     timestamp: { type: Date, default: Date.now },
//     isTestData: { type: Boolean, default: true },
//   });
//   return {
//     GameSession: conn.models.GameSession || conn.model("GameSession", GameSessionSchema),
//     GameData: conn.models.GameData || conn.model("GameData", GameDataSchema),
//   };
// }

// // --- API Route Handlers ---

// export async function POST(
//   request: Request,
//   { params }: { params: Promise<{ proxy: string[] }> }
// ) {
//   const { proxy } = await params;
//   const path = proxy.join('/');

//   try {
//     const models = await getSandboxModels();
//     const body = await request.json();

//     if (path === 'game-session') {
//       const sessionId = uuidv4();
//       const sessionData = {
//         sessionId,
//         userId: body.userId || "test-user",
//         gameId: body.gameId,
//         isTestSession: true,
//       };
//       const newSession = await models.GameSession.create(sessionData);
//       return NextResponse.json(newSession);
//     }

//     if (path === 'game-data') {
//       if (!body.sessionId) {
//         return NextResponse.json({ error: "sessionId is required for game-data" }, { status: 400 });
//       }
//       const session = await models.GameSession.findOne({ sessionId: body.sessionId });
//       if (!session) {
//         return NextResponse.json({ error: "Session not found" }, { status: 404 });
//       }
//       const gameData = {
//         ...body,
//         userId: session.userId,
//         gameId: session.gameId,
//         isTestData: true,
//       };
//       const newGameData = await models.GameData.create(gameData);
//       return NextResponse.json({ success: true, dataId: newGameData._id });
//     }

//     return NextResponse.json({ error: 'Not Found' }, { status: 404 });
//   } catch (error: unknown) {
//     console.error(`Error in /api/sandbox/${path}:`, error);
//     const message = error instanceof Error ? error.message : 'An unknown error occurred.';
//     return NextResponse.json({ error: "Sandbox API operation failed", details: message }, { status: 500 });
//   }
// }






import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

export const runtime = 'nodejs'; // Pin to the Node.js runtime for Mongoose

// --- Database Connection (copied from main project) ---
let sandboxConnection: mongoose.Connection | null = null;
async function connectToSandboxDB(): Promise<mongoose.Connection> {
  if (sandboxConnection && sandboxConnection.readyState === 1) {
    return sandboxConnection;
  }
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) throw new Error("MONGODB_URI not defined");
  try {
    const conn = mongoose.createConnection(MONGODB_URI);
    sandboxConnection = await conn.useDb("GameLabSandbox", { useCache: true });
    return sandboxConnection;
  } catch (error) {
    console.error("Error connecting to GameLabSandbox database:", error);
    throw new Error("Could not connect to the sandbox database.");
  }
}

async function getSandboxModels() {
  const conn = await connectToSandboxDB();
  const GameSessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    userId: { type: String },
    gameId: { type: String, required: true },
    startTime: { type: Date, default: Date.now },
    isTestSession: { type: Boolean, default: true },
  });
  const GameDataSchema = new mongoose.Schema({
    sessionId: { type: String, required: true },
    gameId: { type: String, required: true },
    userId: { type: String },
    roundNumber: { type: Number },
    roundData: { type: mongoose.Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now },
    isTestData: { type: Boolean, default: true },
  });
  return {
    GameSession: conn.models.GameSession || conn.model("GameSession", GameSessionSchema),
    GameData: conn.models.GameData || conn.model("GameData", GameDataSchema),
  };
}

// --- API Route Handlers ---

export async function POST(
  request: Request,
  { params }: { params: Promise<{ proxy: string[] }> }
) {
  const { proxy } = await params;
  const path = proxy.join('/');

  try {
    const models = await getSandboxModels();
    const body = await request.json();

    if (path === 'sandbox/game-session') {
      const sessionId = uuidv4();
      const sessionData = {
        sessionId,
        userId: body.userId || "test-user",
        gameId: body.gameId,
        isTestSession: true,
      };
      const newSession = await models.GameSession.create(sessionData);
      return NextResponse.json(newSession);
    }

    if (path === 'sandbox/game-data') {
      if (!body.sessionId) {
        return NextResponse.json({ error: "sessionId is required for game-data" }, { status: 400 });
      }
      const session = await models.GameSession.findOne({ sessionId: body.sessionId });
      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      const gameData = {
        ...body,
        userId: session.userId,
        gameId: session.gameId,
        isTestData: true,
      };
      const newGameData = await models.GameData.create(gameData);
      return NextResponse.json({ success: true, dataId: newGameData._id });
    }

    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  } catch (error: unknown) {
    console.error(`Error in /api/sandbox/${path}:`, error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: "Sandbox API operation failed", details: message }, { status: 500 });
  }
}