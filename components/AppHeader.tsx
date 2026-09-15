"use client";

import React from "react";
import ApifySymbol from "@/components/ui/ApifySymbol";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import Menu, { type MenuItem } from "@/components/ui/Menu";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { version as APP_VERSION } from "../package.json";

/**
 * The app header. 56px, `surface-chrome`, 32px gutters.
 *
 * Back controls are always chevron-left plus THE NAME OF WHERE YOU LAND, far
 * left — never a bare arrow, and never "back".
 */
interface AppHeaderProps {
  /** Omit on Home. */
  back?: { label: string; onClick: () => void };
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  onSettings?: () => void;
  /** A menu on the gear, when settings is more than one thing. */
  settingsMenu?: MenuItem[];
  /** Right-hand actions, e.g. New project on the grid screen. */
  actions?: React.ReactNode;
}

export default function AppHeader({ back, search, onSettings, settingsMenu, actions }: AppHeaderProps) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        height: 56,
        flexShrink: 0,
        padding: "0 32px",
        background: "var(--surface-chrome)",
        borderBottom: "1px solid var(--border-hairline)",
      }}
    >
      {back ? (
        <Button variant="ghost" size="chrome" icon="chevronLeft" onClick={back.onClick}>
          {back.label}
        </Button>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ApifySymbol size={20} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-primary)" }}>Video tool</span>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {search && (
        <div style={{ width: 300 }}>
          <Input
            value={search.value}
            onChange={search.onChange}
            placeholder={search.placeholder ?? "Search projects"}
            prefix={<Icon name="search" size={14} style={{ color: "var(--ink-tertiary)" }} />}
            suffix="⌘K"
          />
        </div>
      )}

      {actions}

      {/* Kept from the old header: the build you are looking at, at a glance. */}
      <span className="t-data-s" style={{ color: "var(--ink-disabled)" }}>v{APP_VERSION}</span>

      {settingsMenu ? (
        <Menu align="right" items={settingsMenu}>
          <IconButton icon="settings" title="Settings" />
        </Menu>
      ) : onSettings ? (
        <IconButton icon="settings" onClick={onSettings} title="Storage & settings" />
      ) : null}
    </header>
  );
}
