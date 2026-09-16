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

  /*
   * Both names come from the client, so both are reduced to a single path
   * segment before they touch the filesystem. Without this a `folder` of
   * "../../lib" writes wherever it likes — the media and LUT uploaders have
   * always basenamed their input; this one never did, and it only stops being
   * theoretical the moment the app leaves localhost.
   */
  const safeSegment = (name: string) => path.basename(name).replace(/^\.+/, "");
  const safeFolder = safeSegment(folder);
  const safeName = safeSegment(file.name);
  if (!safeFolder || !safeName) {
    return Response.json({ error: "invalid folder or file name" }, { status: 400 });
  }

  const assetsDir = path.join(process.cwd(), "public", "assets");
  const folderPath = path.join(assetsDir, safeFolder);

  // Ensure folder exists
  fs.mkdirSync(folderPath, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = path.join(folderPath, safeName);
  fs.writeFileSync(filePath, buffer);

  // Report where it ACTUALLY went, not where it was asked to go.
  return Response.json({
    name: safeName,
    path: `assets/${safeFolder}/${safeName}`,
    type: getFileType(safeName),
  });
}
