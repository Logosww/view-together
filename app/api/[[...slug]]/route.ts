import { backendApp } from "@/lib/server/elysia"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = backendApp.fetch
export const POST = backendApp.fetch
export const PUT = backendApp.fetch
export const PATCH = backendApp.fetch
export const DELETE = backendApp.fetch
export const OPTIONS = backendApp.fetch
