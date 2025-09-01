import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

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
    console.log("Connecting to MongoDB for GameTest...");
    const conn = mongoose.createConnection(MONGODB_URI);
    // Connect to the GameLabSandbox database (align with DataLab/Sandbox UI)
    sandboxConnection = await conn.useDb("GameLabSandbox", { useCache: true });
    console.log("Connected to GameTest database");
    return sandboxConnection;
  } catch (error) {
    console.error("Error connecting to GameTest database:", error);
    throw new Error("Could not connect to the sandbox database.");
  }
}

async function getSandboxModels() {
  const conn = await connectToSandboxDB();

  // Define schemas with collection names matching your specification
  const GameSchema = new mongoose.Schema({
    gameId: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    description: { type: String },
    createdBy: { type: String },
    createdAt: { type: Date, default: Date.now },
  }, { strict: false });

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
    Game: conn.models.Game || conn.model("Game", GameSchema, "games"),
    GameSession: conn.models.GameSession || conn.model("GameSession", GameSessionSchema, "gamesessions"),
    GameData: conn.models.GameData || conn.model("GameData", GameDataSchema, "gamedatas"),
  };
}

// --- API Route Handlers ---

export async function POST(
  request: Request,
  { params }: { params: Promise<{ proxy: string[] }> }
) {
  const { proxy } = await params;
  const path = proxy.join('/');

  console.log("Sandbox API POST request to path:", path);

  try {
    const models = await getSandboxModels();
    const body = await request.json();

    console.log("Request body:", body);

    // Handle game-session endpoint
    if (path === 'game-session') {
      const sessionId = uuidv4();
      const sessionData = {
        sessionId,
        userId: body.userId || body.passedUserId || "test-user",
        gameId: body.gameId || "test-game",
        isTestSession: true,
      };

      const gameId = String(sessionData.gameId);
      const gameName = body.gameName || gameId;
      await models.Game.updateOne(
        { gameId },
        {
          $setOnInsert: {
            gameId,
            name: gameName,
            description: body.gameDescription || '',
            createdBy: sessionData.userId,
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );

      console.log("Creating session with data:", sessionData);
      const newSession = await models.GameSession.create(sessionData);
      console.log("Session created successfully:", newSession);
      return NextResponse.json(newSession);
    }

    // Handle game-data endpoint
    if (path === 'game-data') {
      if (!body.sessionId) {
        console.error("No sessionId provided in game-data request");
        return NextResponse.json({ error: "sessionId is required for game-data" }, { status: 400 });
      }

      console.log("Looking for session:", body.sessionId);
      const session = await models.GameSession.findOne({ sessionId: body.sessionId });
      if (!session) {
        console.error("Session not found:", body.sessionId);
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      const gameData = {
        sessionId: body.sessionId,
        userId: session.userId,
        gameId: session.gameId,
        roundNumber: body.roundNumber,
        roundData: body.roundData,
        isTestData: true,
      };
      console.log("Creating game data:", gameData);
      const newGameData = await models.GameData.create(gameData);
      console.log("Game data created successfully with ID:", newGameData._id);
      return NextResponse.json({ success: true, dataId: newGameData._id });
    }

    console.error("No matching endpoint for path:", path);
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  } catch (error: unknown) {
    console.error(`Error in /api/sandbox/${path}:`, error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: "Sandbox API operation failed", details: message }, { status: 500 });
  }
}