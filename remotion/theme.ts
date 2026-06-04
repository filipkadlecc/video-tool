export { BRAND } from "../lib/brand";

// Inline CSS each branded snippet emits via a <style> tag so GT Walsheim
// loads correctly in both the browser preview and `npx remotion render`.
// Files live in /Users/filip/video-tool/public/fonts/.
export const BRAND_FONT_FACE_CSS = `
@font-face {
  font-family: 'GT Walsheim';
  src: url('/fonts/GT-Walsheim-Regular.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'GT Walsheim';
  src: url('/fonts/GT-Walsheim-Medium.ttf') format('truetype');
  font-weight: 500;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'GT Walsheim';
  src: url('/fonts/GT-Walsheim-Bold.ttf') format('truetype');
  font-weight: 700;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'GT Walsheim';
  src: url('/fonts/GT-Walsheim-Black.ttf') format('truetype');
  font-weight: 900;
  font-style: normal;
  font-display: block;
}
`;
