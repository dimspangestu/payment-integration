import "server-only";
import { NextResponse } from "next/server";
import { DanaConfigError } from "./config";
import { DanaInputError } from "./utils";
import type { DanaResult } from "./client";

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || undefined;
}

export function respond(result: DanaResult) {
  return NextResponse.json(result, { status: 200 });
}

export function handleError(err: unknown) {
  if (err instanceof DanaInputError) {
    return NextResponse.json({ ok: false, responseCode: "INPUT_ERROR", responseMessage: err.message }, { status: 400 });
  }
  if (err instanceof DanaConfigError) {
    return NextResponse.json({ ok: false, responseCode: "CONFIG_ERROR", responseMessage: err.message }, { status: 500 });
  }
  console.error("[dana]", err);
  return NextResponse.json(
    { ok: false, responseCode: "SERVER_ERROR", responseMessage: (err as Error)?.message || "Unknown error" },
    { status: 500 }
  );
}
