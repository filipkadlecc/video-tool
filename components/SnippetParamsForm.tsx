"use client";

import React, { useState } from "react";
import Icon from "@/components/ui/Icon";
import ActorLookup from "@/components/ActorLookup";
import {
  type ArrayItemParam,
  type ArrayParam,
  type EnumParam,
  type ImagesParam,
  type Param,
  type SnippetSchema,
  buildDefaultValues,
  isFieldVisible,
} from "@/lib/snippet-schemas";

interface SnippetParamsFormProps {
  schema: SnippetSchema;
  onBack?: () => void;
  onInsert?: (values: Record<string, unknown>) => void;
  insertLabel?: string;
  // Controlled mode: when both are provided, the parent owns the values.
  // Lets the form be embedded inside another wizard (e.g. NewProjectModal).
  values?: Record<string, unknown>;
  onValuesChange?: (values: Record<string, unknown>) => void;
  // Hide the default Back/Insert footer (embedded usage relies on the host's
  // own CTA, e.g. the wizard's "Create" button).
  hideFooter?: boolean;
}

export default function SnippetParamsForm({
  schema,
  onBack,
  onInsert,
  insertLabel = "Insert into project",
  values: controlledValues,
  onValuesChange,
  hideFooter = false,
}: SnippetParamsFormProps) {
  const [internalValues, setInternalValues] = useState<Record<string, unknown>>(() =>
    buildDefaultValues(schema),
  );
  const isControlled = controlledValues !== undefined && onValuesChange !== undefined;
  const values = isControlled ? controlledValues! : internalValues;

  function setValue(key: string, v: unknown) {
    const next = { ...values, [key]: v };
    if (isControlled) onValuesChange!(next);
    else setInternalValues(next);
  }

  // Merge several fields at once (used by the Apify Store prefill lookup).
  function applyPatch(patch: Record<string, unknown>) {
    const next = { ...values, ...patch };
    if (isControlled) onValuesChange!(next);
    else setInternalValues(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        className="vt-scroll"
        style={{
          overflowY: hideFooter ? "visible" : "auto",
          flex: hideFooter ? "none" : 1,
          padding: hideFooter ? 0 : "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {schema.prefill?.kind === "apifyActor" && <ActorLookup onPick={applyPatch} />}
        {Object.entries(schema.params).map(([key, param]) => {
          if (!isFieldVisible(schema, key, values)) return null;
          return (
            <FieldRenderer
              key={key}
              fieldKey={key}
              param={param}
              value={values[key]}
              onChange={(v) => setValue(key, v)}
            />
          );
        })}
      </div>

      {!hideFooter && (
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "12px 20px",
            borderTop: "0.5px solid var(--line-1)",
            background: "var(--bg-2)",
          }}
        >
          {onBack && (
            <button
              onClick={onBack}
              style={{
                height: 32,
                padding: "0 14px",
                background: "var(--bg-3)",
                color: "var(--text-1)",
                border: "0.5px solid var(--line-2)",
                borderRadius: "var(--r-sm)",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon name="chevron-left" size={12} /> Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {onInsert && (
            <button
              onClick={() => onInsert(values)}
              style={{
                height: 32,
                padding: "0 18px",
                background: "var(--accent)",
                color: "var(--accent-ink)",
                border: "none",
                borderRadius: "var(--r-sm)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon name="check" size={12} /> {insertLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface FieldRendererProps {
  fieldKey: string;
  param: Param;
  value: unknown;
  onChange: (v: unknown) => void;
}

function FieldRenderer({ fieldKey, param, value, onChange }: FieldRendererProps) {
  switch (param.kind) {
    case "string":
      return (
        <StringField
          fieldKey={fieldKey}
          label={param.label}
          placeholder={param.placeholder}
          multiline={!!param.multiline}
          value={String(value ?? "")}
          onChange={onChange}
        />
      );
    case "boolean":
      return (
        <BooleanField
          label={param.label}
          description={param.description}
          value={Boolean(value)}
          onChange={onChange}
        />
      );
    case "enum":
      return (
        <EnumField
          label={param.label}
          options={param.options}
          value={String(value ?? param.default)}
          onChange={onChange}
        />
      );
    case "number":
      return (
        <NumberField
          label={param.label}
          min={param.min}
          max={param.max}
          step={param.step}
          value={Number(value ?? param.default)}
          onChange={onChange}
        />
      );
    case "array":
      return (
        <ArrayField
          fieldKey={fieldKey}
          param={param}
          value={(value as Record<string, unknown>[]) ?? []}
          onChange={onChange}
        />
      );
    case "images":
      return (
        <ImagesField
          param={param}
          value={(value as string[]) ?? []}
          onChange={onChange}
        />
      );
  }
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: "var(--text-1)",
        letterSpacing: "0.01em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </label>
  );
}

const inputBaseStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-inset)",
  border: "0.5px solid var(--line-2)",
  borderRadius: "var(--r-sm)",
  padding: "8px 10px",
  fontSize: 12,
  color: "var(--text-0)",
  fontFamily: "inherit",
  outline: "none",
};

function StringField({
  label,
  placeholder,
  multiline,
  value,
  onChange,
}: {
  fieldKey: string;
  label: string;
  placeholder?: string;
  multiline: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <FieldLabel>{label}</FieldLabel>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          style={{ ...inputBaseStyle, resize: "vertical", minHeight: 72, lineHeight: 1.4 }}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={inputBaseStyle}
        />
      )}
    </div>
  );
}

function BooleanField({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <FieldLabel>{label}</FieldLabel>
        {description && (
          <span style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.4 }}>{description}</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        aria-pressed={value}
        style={{
          width: 44,
          height: 24,
          borderRadius: 999,
          background: value ? "var(--accent)" : "var(--bg-3)",
          border: "0.5px solid var(--line-2)",
          position: "relative",
          cursor: "pointer",
          transition: "background 120ms ease",
          padding: 0,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: value ? 22 : 2,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: value ? "var(--accent-ink)" : "var(--text-1)",
            transition: "left 120ms ease",
          }}
        />
      </button>
    </div>
  );
}

function EnumField({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: EnumParam["options"];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <FieldLabel>{label}</FieldLabel>
      <div
        style={{
          display: "flex",
          gap: 2,
          padding: 2,
          background: "var(--bg-inset)",
          border: "0.5px solid var(--line-2)",
          borderRadius: "var(--r-sm)",
        }}
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              style={{
                flex: 1,
                height: 26,
                padding: "0 10px",
                background: active ? "var(--accent)" : "transparent",
                color: active ? "var(--accent-ink)" : "var(--text-1)",
                border: "none",
                borderRadius: "var(--r-sm)",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NumberField({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={(e) => {
          const n = e.target.value === "" ? 0 : Number(e.target.value);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        style={inputBaseStyle}
      />
    </div>
  );
}

function ArrayField({
  fieldKey,
  param,
  value,
  onChange,
}: {
  fieldKey: string;
  param: ArrayParam;
  value: Record<string, unknown>[];
  onChange: (v: Record<string, unknown>[]) => void;
}) {
  const itemKeys = Object.keys(param.itemSchema);
  const isPrimitive = itemKeys.length === 1 && itemKeys[0] === "value";
  const max = param.max ?? Infinity;
  const min = param.min ?? 0;

  function updateItem(i: number, k: string, v: unknown) {
    const next = value.map((row, idx) => (idx === i ? { ...row, [k]: v } : row));
    onChange(next);
  }
  function addItem() {
    if (value.length >= max) return;
    const blank: Record<string, unknown> = {};
    for (const [k, p] of Object.entries(param.itemSchema)) blank[k] = p.default;
    onChange([...value, blank]);
  }
  function removeItem(i: number) {
    if (value.length <= min) return;
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <FieldLabel>{param.label}</FieldLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {value.map((row, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              padding: 10,
              background: "var(--bg-inset)",
              border: "0.5px solid var(--line-2)",
              borderRadius: "var(--r-sm)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 2,
              }}
            >
              <span style={{ fontSize: 10, color: "var(--text-2)", fontWeight: 600 }}>
                {isPrimitive ? `Row ${i + 1}` : `Item ${i + 1}`}
              </span>
              <button
                type="button"
                onClick={() => removeItem(i)}
                disabled={value.length <= min}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-2)",
                  cursor: value.length <= min ? "not-allowed" : "pointer",
                  fontSize: 11,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: 0,
                  opacity: value.length <= min ? 0.4 : 1,
                }}
                aria-label="Remove"
              >
                <Icon name="close" size={12} /> Remove
              </button>
            </div>
            {Object.entries(param.itemSchema).map(([k, itemParam]) => (
              <ArrayItemField
                key={k}
                fieldKey={`${fieldKey}.${i}.${k}`}
                param={itemParam}
                value={row[k]}
                onChange={(v) => updateItem(i, k, v)}
              />
            ))}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addItem}
        disabled={value.length >= max}
        style={{
          alignSelf: "flex-start",
          height: 28,
          padding: "0 12px",
          background: "var(--bg-3)",
          color: "var(--text-1)",
          border: "0.5px dashed var(--line-2)",
          borderRadius: "var(--r-sm)",
          fontSize: 11,
          fontWeight: 600,
          cursor: value.length >= max ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: 5,
          opacity: value.length >= max ? 0.4 : 1,
        }}
      >
        <Icon name="plus" size={11} />
        {param.addLabel}
      </button>
    </div>
  );
}

function ImagesField({
  param,
  value,
  onChange,
}: {
  param: ImagesParam;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const max = param.max ?? Infinity;
  const inputRef = React.useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = max - value.length;
    const picked = Array.from(files).slice(0, room < 0 ? 0 : room);
    Promise.all(
      picked.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.readAsDataURL(file);
          }),
      ),
    ).then((uris) => onChange([...value, ...uris.filter(Boolean)]));
  }

  function removeAt(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <FieldLabel>{param.label}</FieldLabel>
      {param.description && (
        <span style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.4 }}>{param.description}</span>
      )}
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {value.map((src, i) => (
            <div
              key={i}
              style={{
                position: "relative",
                width: 72,
                height: 72,
                borderRadius: "var(--r-sm)",
                overflow: "hidden",
                border: "0.5px solid var(--line-2)",
                background: "var(--bg-inset)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Screenshot ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label="Remove image"
                style={{
                  position: "absolute",
                  top: 3,
                  right: 3,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.65)",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                <Icon name="close" size={11} />
              </button>
              <span
                style={{
                  position: "absolute",
                  bottom: 3,
                  left: 3,
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#fff",
                  background: "rgba(0,0,0,0.6)",
                  borderRadius: 4,
                  padding: "0 4px",
                }}
              >
                {i + 1}
              </span>
            </div>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
        style={{ display: "none" }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={value.length >= max}
        style={{
          alignSelf: "flex-start",
          height: 28,
          padding: "0 12px",
          background: "var(--bg-3)",
          color: "var(--text-1)",
          border: "0.5px dashed var(--line-2)",
          borderRadius: "var(--r-sm)",
          fontSize: 11,
          fontWeight: 600,
          cursor: value.length >= max ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: 5,
          opacity: value.length >= max ? 0.4 : 1,
        }}
      >
        <Icon name="plus" size={11} />
        Add screenshots{value.length > 0 ? ` (${value.length}${param.max ? `/${param.max}` : ""})` : ""}
      </button>
    </div>
  );
}

function ArrayItemField({
  fieldKey,
  param,
  value,
  onChange,
}: {
  fieldKey: string;
  param: ArrayItemParam;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (param.kind) {
    case "string":
      return (
        <StringField
          fieldKey={fieldKey}
          label={param.label}
          placeholder={param.placeholder}
          multiline={!!param.multiline}
          value={String(value ?? "")}
          onChange={onChange}
        />
      );
    case "boolean":
      return (
        <BooleanField
          label={param.label}
          description={param.description}
          value={Boolean(value)}
          onChange={onChange}
        />
      );
    case "enum":
      return (
        <EnumField
          label={param.label}
          options={param.options}
          value={String(value ?? param.default)}
          onChange={onChange}
        />
      );
    case "number":
      return (
        <NumberField
          label={param.label}
          min={param.min}
          max={param.max}
          step={param.step}
          value={Number(value ?? param.default)}
          onChange={onChange}
        />
      );
  }
}
