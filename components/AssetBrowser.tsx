"use client";

import React, { useState, useEffect, useRef } from "react";

interface AssetItem {
  name: string;
  path: string;
  type: "image" | "svg" | "video" | "other";
}

interface AssetGroup {
  folder: string;
  items: AssetItem[];
}

const SECTION_META: Record<string, { label: string; description: string }> = {
  backgrounds: { label: "Backgrounds", description: "Scene backgrounds and gradients" },
  logos: { label: "Logos", description: "Brand logos and wordmarks" },
  icons: { label: "Icons", description: "Icon assets and symbols" },
  images: { label: "Images", description: "Photos and illustrations" },
  other: { label: "Other", description: "Miscellaneous assets" },
};

interface AssetBrowserProps {
  open: boolean;
  onClose: () => void;
  onCopyPath: (path: string) => void;
}

export default function AssetBrowser({
  open,
  onClose,
  onCopyPath,
}: AssetBrowserProps) {
  const [groups, setGroups] = useState<AssetGroup[]>([]);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadFolderRef = useRef<string>("");

  useEffect(() => {
    if (open) fetchAssets();
  }, [open]);

  function fetchAssets() {
    fetch("/api/assets")
      .then((r) => r.json())
      .then(setGroups)
      .catch(console.error);
  }

  if (!open) return null;

  function handleCopy(assetPath: string) {
    const snippet = `staticFile("${assetPath}")`;
    navigator.clipboard.writeText(snippet);
    onCopyPath(snippet);
    setCopiedPath(assetPath);
    setTimeout(() => setCopiedPath(null), 1500);
  }

  function triggerUpload(folder: string) {
    uploadFolderRef.current = folder;
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const folder = uploadFolderRef.current;
    setUploading(folder);

    try {
      const formData = new FormData();
      formData.append("folder", folder);
      formData.append("file", file);

      const res = await fetch("/api/assets", { method: "POST", body: formData });
      if (res.ok) {
        fetchAssets();
      }
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(null);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-surface border border-border rounded-2xl w-[640px] max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold">Assets</h2>
            <p className="text-[10px] text-muted mt-0.5">Click any asset to copy its staticFile() path</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground text-xs"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {groups.map((group) => {
            const meta = SECTION_META[group.folder] ?? {
              label: group.folder,
              description: "",
            };

            return (
              <div key={group.folder} className="rounded-xl border border-border overflow-hidden">
                {/* Section header */}
                <div className="flex items-center justify-between px-4 py-3 bg-background">
                  <div>
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      {meta.label}
                    </h3>
                    {meta.description && (
                      <p className="text-[10px] text-muted mt-0.5">{meta.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted">
                      {group.items.length} {group.items.length === 1 ? "file" : "files"}
                    </span>
                    <button
                      onClick={() => triggerUpload(group.folder)}
                      disabled={uploading === group.folder}
                      className="px-2.5 py-1 text-[10px] font-medium text-accent border border-accent/30 rounded-md hover:bg-accent/10 disabled:opacity-50 transition-colors"
                    >
                      {uploading === group.folder ? "Uploading..." : "+ Upload"}
                    </button>
                  </div>
                </div>

                {/* Asset grid */}
                {group.items.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2 p-3">
                    {group.items.map((item) => (
                      <button
                        key={item.path}
                        onClick={() => handleCopy(item.path)}
                        className="group/item flex flex-col items-center gap-1.5 p-2.5 rounded-lg border border-transparent hover:border-accent/40 hover:bg-accent/5 transition-colors"
                      >
                        {item.type === "image" || item.type === "svg" ? (
                          <div className="w-14 h-14 flex items-center justify-center rounded-md bg-white/5">
                            <img
                              src={`/${item.path}`}
                              alt={item.name}
                              className="max-w-12 max-h-12 object-contain"
                            />
                          </div>
                        ) : (
                          <div className="w-14 h-14 flex items-center justify-center rounded-md bg-white/5 text-muted text-[10px] uppercase">
                            {item.type}
                          </div>
                        )}
                        <span className="text-[9px] text-muted group-hover/item:text-foreground truncate w-full text-center transition-colors">
                          {copiedPath === item.path ? "Copied!" : item.name}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-5 text-center">
                    <p className="text-[10px] text-muted">No assets yet</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Hidden file input for uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.svg,.jpg,.jpeg,.webp,.gif"
        className="hidden"
        onChange={handleFileSelected}
      />
    </div>
  );
}
