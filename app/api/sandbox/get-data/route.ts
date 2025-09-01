// import { NextRequest, NextResponse } from "next/server";
// import mongoose from "mongoose";

// export const runtime = 'nodejs'; // Pin to the Node.js runtime for Mongoose

// // --- Database Connection ---
// let sandboxConnection: mongoose.Connection | null = null;
// async function connectToSandboxDB(): Promise<mongoose.Connection> {
//   if (sandboxConnection && sandboxConnection.readyState === 1) {
//     return sandboxConnection;
//   }
//   const MONGODB_URI = process.env.MONGODB_URI;
//   if (!MONGODB_URI) throw new Error("MONGODB_URI not defined");
//   try {
//     const conn = mongoose.createConnection(MONGODB_URI);
//     // Connect to the new GameTest database
//     sandboxConnection = await conn.useDb("GameTest", { useCache: true });
//     return sandboxConnection;
//   } catch (error) {
//     console.error("Error connecting to GameTest database:", error);
//     throw new Error("Could not connect to the sandbox database.");
//   }
// }

// async function getSandboxModels() {
//   const conn = await connectToSandboxDB();
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
//     // Explicit collection name to match your specification
//     GameData: conn.models.GameData || conn.model("GameData", GameDataSchema, "gamedatas"),
//   };
// }

// export async function GET(request: NextRequest) {
//   try {
//     const models = await getSandboxModels();
//     const { searchParams } = new URL(request.url);
//     const sessionId = searchParams.get("sessionId");

//     if (!sessionId) {
//       return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
//     }

//     const gameData = await models.GameData.find({ sessionId })
//       .sort({ timestamp: 1 })
//       .lean();

//     return NextResponse.json({ success: true, gameData });
//   } catch (error: unknown) {
//     console.error("Error in /api/sandbox/get-data:", error);
//     const message = error instanceof Error ? error.message : 'An unknown error occurred.';
//     return NextResponse.json({ error: "Sandbox GET operation failed", details: message }, { status: 500 });
//   }
// }






import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

export const runtime = 'nodejs'; // Pin to the Node.js runtime for Mongoose

// --- Database Connection ---
let sandboxConnection: mongoose.Connection | null = null;
async function connectToSandboxDB(): Promise<mongoose.Connection> {
  if (sandboxConnection && sandboxConnection.readyState === 1) {
    return sandboxConnection;
  }
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) throw new Error("MONGODB_URI not defined");
  try {
    const conn = mongoose.createConnection(MONGODB_URI);
    // Connect to the GameLabSandbox database (aligned with DataLab/Sandbox UI)
    sandboxConnection = await conn.useDb("GameLabSandbox", { useCache: true });
    return sandboxConnection;
  } catch (error) {
    console.error("Error connecting to GameTest database:", error);
    throw new Error("Could not connect to the sandbox database.");
  }
}

async function getSandboxModels() {
  const conn = await connectToSandboxDB();
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
    // Explicit collection name to match your specification
    GameData: conn.models.GameData || conn.model("GameData", GameDataSchema, "gamedatas"),
  };
}

export async function GET(request: NextRequest) {
  try {
    const models = await getSandboxModels();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const gameData = await models.GameData.find({ sessionId })
      .sort({ timestamp: 1 })
      .lean();

    return NextResponse.json({ success: true, gameData });
  } catch (error: unknown) {
    console.error("Error in /api/sandbox/get-data:", error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: "Sandbox GET operation failed", details: message }, { status: 500 });
  }
}