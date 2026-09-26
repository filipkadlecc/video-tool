// sucrase ships types for its parser under dist/types but only maps the
// package root to them; scene-elements.ts imports the parser directly.
declare module "sucrase/dist/esm/parser" {
  export * from "sucrase/dist/types/parser";
}
declare module "sucrase/dist/esm/parser/tokenizer/types" {
  export * from "sucrase/dist/types/parser/tokenizer/types";
}
