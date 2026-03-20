import fs from "fs";
import path from "path";

interface AssetItem {
  name: string;
  path: string;
  type: "image" | "svg" | "video" | "other";
}

interface AssetGroup {
  folder: string;
  items: AssetItem[];
}

function getFileType(filename: string): AssetItem["type"] {
  const ext = path.extname(filename).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) return "image";
  if (ext === ".svg") return "svg";
  if ([".mp4", ".webm", ".mov"].includes(ext)) return "video";
  return "other";
}

export async function GET() {
  const assetsDir = path.join(process.cwd(), "public", "assets");

  if (!fs.existsSync(assetsDir)) {
    return Response.json([]);
  }

  const folders = fs
    .readdirSync(assetsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const groups: AssetGroup[] = folders.map((folder) => {
    const folderPath = path.join(assetsDir, folder);
    const files = fs
      .readdirSync(folderPath)
      .filter((f) => !f.startsWith("."));

    return {
      folder,
      items: files.map((f) => ({
        name: f,
        path: `assets/${folder}/${f}`,
        type: getFileType(f),
      })),
    };
  });

  return Response.json(groups);
}

const ALLOWED_EXTENSIONS = [".png", ".svg", ".jpg", ".jpeg", ".webp", ".gif"];

export async function POST(request: Request) {
  const formData = await request.formData();
  const folder = formData.get("folder") as string;
  const file = formData.get("file") as File;

  if (!folder || !file) {
    return Response.json({ error: "folder and file are required" }, { status: 400 });
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return Response.json({ error: `Only ${ALLOWED_EXTENSIONS.join(", ")} files allowed` }, { status: 400 });
  }

  const assetsDir = path.join(process.cwd(), "public", "assets");
  const folderPath = path.join(assetsDir, folder);

  // Ensure folder exists
  fs.mkdirSync(folderPath, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = path.join(folderPath, file.name);
  fs.writeFileSync(filePath, buffer);

  return Response.json({
    name: file.name,
    path: `assets/${folder}/${file.name}`,
    type: getFileType(file.name),
  });
}
