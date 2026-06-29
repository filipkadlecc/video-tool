export function stripBackgroundsForTransparency(code: string): string {
  let result = code.replace(/<Background\s*\/>/g, "{/* transparent */}");
  result = result.replace(/<SceneBg\s*\/>/g, "{/* transparent */}");

  result = result.replace(
    /const\s+(BlackScreen|Background|SceneBg)\s*[=:][^;{]*\{[\s\S]*?backgroundColor:\s*(?:COLORS\.bg|["']#[0-9a-fA-F]{3,8}["'])/g,
    (match) => match.replace(/backgroundColor:\s*(?:COLORS\.bg|["']#[0-9a-fA-F]{3,8}["'])/, 'backgroundColor: "transparent"'),
  );

  result = result.replace(
    /(return\s*\(\s*\n?\s*<AbsoluteFill[^>]*style=\{\{[^}]*?)backgroundColor:\s*COLORS\.bg/g,
    '$1backgroundColor: "transparent"',
  );
  result = result.replace(
    /(return\s*\(\s*\n?\s*<AbsoluteFill[^>]*style=\{\{[^}]*?)backgroundColor:\s*["']#[0-9a-fA-F]{3,8}["']/g,
    '$1backgroundColor: "transparent"',
  );

  return result;
}
