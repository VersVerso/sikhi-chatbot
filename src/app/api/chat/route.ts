import { NextRequest, NextResponse } from "next/server";

import { hasRequiredRuntimeConfig } from "@/lib/config";
import { answerWithRag } from "@/lib/rag";
import { checkRateLimit } from "@/lib/rate-limit";
import type { ChatRequestBody } from "@/types/chat";

const isValidBody = (body: unknown): body is ChatRequestBody => {
  if (!body || typeof body !== "object") return false;
  const maybe = body as Partial<ChatRequestBody>;
  return (
    typeof maybe.question === "string" &&
    (maybe.mode === "quick" || maybe.mode === "deep") &&
    (maybe.language === "de" || maybe.language === "en") &&
    (typeof maybe.allowYouTube === "boolean" || typeof maybe.allowYouTube === "undefined")
  );
};

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateLimit = checkRateLimit(ip);

  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please retry shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  if (!hasRequiredRuntimeConfig()) {
    return NextResponse.json(
      { error: "Server is missing required runtime configuration." },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const question = body.question.trim();
  if (!question) {
    return NextResponse.json({ error: "Question is required." }, { status: 400 });
  }

  try {
    const response = await answerWithRag(question, body.mode, body.language, Boolean(body.allowYouTube));
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown server error.",
      },
      { status: 500 },
    );
  }
}
