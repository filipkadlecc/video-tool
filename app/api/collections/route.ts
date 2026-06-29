import { listCollections, createCollection } from "@/lib/collections";

export async function GET() {
  return Response.json(listCollections());
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }
  return Response.json(createCollection(name));
}
