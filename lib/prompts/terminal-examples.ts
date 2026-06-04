/**
 * Few-shot edit examples for VHS terminal-recording projects.
 *
 * Mirrors the pattern in `./snippet-examples.ts`: each example is a real edit
 * verb the user actually types ("extend", "swap", "add a step", "slow it
 * down", "fix"), with a CURRENT .tape and the IDEAL minimal-diff response.
 * The takeaway lines exist so the AI internalizes the meta-rule: every line
 * the user didn't ask to touch should remain byte-for-byte identical.
 */

export const TERMINAL_EDIT_EXAMPLES = `=== EDIT-VERB EXAMPLES ===

These are the patterns to follow when the user iterates on an existing .tape.
Each example shows USER request + CURRENT .tape + IDEAL response. Notice how
little changes between current and ideal in every case — that is the bar.

──────────────────────────────────────────────────────────────────────────────
Example 1 — Extend duration ("make it longer / N seconds")

USER: "extend this video to 12s"

CURRENT (parses to ~5.6s):
\`\`\`tape
Output out.mp4
Set Width 1920
Set Height 1080
Set Theme { "background": "#161718", "foreground": "#F4F4F5", "cursor": "#F86606", "selection": "#3D3F43", "black": "#161718", "white": "#F4F4F5" }
Set TypingSpeed 50ms
Sleep 1s
Type "ls -la"
Sleep 200ms
Enter
Sleep 4s
\`\`\`

IDEAL (parses to ~12.0s):
\`\`\`tape
Output out.mp4
Set Width 1920
Set Height 1080
Set Theme { "background": "#161718", "foreground": "#F4F4F5", "cursor": "#F86606", "selection": "#3D3F43", "black": "#161718", "white": "#F4F4F5" }
Set TypingSpeed 50ms
Sleep 1s
Type "ls -la"
Sleep 200ms
Enter
Sleep 10.4s
\`\`\`

Takeaway: only the trailing Sleep changed (4s → 10.4s, +6.4s). Theme, dimensions, command, typing speed all byte-for-byte identical.

──────────────────────────────────────────────────────────────────────────────
Example 2 — Swap a command without touching anything else

USER: "change ls -la to git status instead"

CURRENT:
\`\`\`tape
Output out.mp4
Set Width 1920
Set Height 1080
Set Theme { "background": "#161718", "foreground": "#F4F4F5", "cursor": "#F86606", "selection": "#3D3F43", "black": "#161718", "white": "#F4F4F5" }
Set TypingSpeed 80ms
Sleep 1s
Type "ls -la"
Sleep 200ms
Enter
Sleep 4s
\`\`\`

IDEAL:
\`\`\`tape
Output out.mp4
Set Width 1920
Set Height 1080
Set Theme { "background": "#161718", "foreground": "#F4F4F5", "cursor": "#F86606", "selection": "#3D3F43", "black": "#161718", "white": "#F4F4F5" }
Set TypingSpeed 80ms
Sleep 1s
Type "git status"
Sleep 200ms
Enter
Sleep 4s
\`\`\`

Takeaway: exactly one line differs — the Type. Duration shifts slightly (different command length) but that's acceptable; the user asked for a command swap, not a duration target.

──────────────────────────────────────────────────────────────────────────────
Example 3 — Insert a step in the middle

USER: "after the search command, also run apify actors list"

CURRENT:
\`\`\`tape
Output out.mp4
Set Width 1920
Set Height 1080
Set Theme { "background": "#161718", "foreground": "#F4F4F5", "cursor": "#F86606", "selection": "#3D3F43", "black": "#161718", "white": "#F4F4F5" }
Set TypingSpeed 80ms
Sleep 1s
Type 'apify actors search "instagram"'
Sleep 400ms
Enter
Sleep 5s
\`\`\`

IDEAL:
\`\`\`tape
Output out.mp4
Set Width 1920
Set Height 1080
Set Theme { "background": "#161718", "foreground": "#F4F4F5", "cursor": "#F86606", "selection": "#3D3F43", "black": "#161718", "white": "#F4F4F5" }
Set TypingSpeed 80ms
Sleep 1s
Type 'apify actors search "instagram"'
Sleep 400ms
Enter
Sleep 3s
Type "apify actors list"
Sleep 300ms
Enter
Sleep 3s
\`\`\`

Takeaway: inserted four new lines after the existing Enter, and trimmed the original trailing Sleep (5s → 3s) so the second command has room to breathe without ballooning total duration. Header lines unchanged.

──────────────────────────────────────────────────────────────────────────────
Example 4 — Slow typing without changing total duration

USER: "the typing is too fast, slow it down"

CURRENT (~6.8s):
\`\`\`tape
Output out.mp4
Set Width 1920
Set Height 1080
Set Theme { "background": "#161718", "foreground": "#F4F4F5", "cursor": "#F86606", "selection": "#3D3F43", "black": "#161718", "white": "#F4F4F5" }
Set TypingSpeed 50ms
Sleep 1s
Type 'apify actors search "instagram"'
Sleep 300ms
Enter
Sleep 4s
\`\`\`

IDEAL (~7.7s — small drift is fine):
\`\`\`tape
Output out.mp4
Set Width 1920
Set Height 1080
Set Theme { "background": "#161718", "foreground": "#F4F4F5", "cursor": "#F86606", "selection": "#3D3F43", "black": "#161718", "white": "#F4F4F5" }
Set TypingSpeed 100ms
Sleep 1s
Type 'apify actors search "instagram"'
Sleep 300ms
Enter
Sleep 2.5s
\`\`\`

Takeaway: TypingSpeed doubled (50ms → 100ms). The Type line now takes ~1.5s longer, so the trailing Sleep was reduced from 4s to 2.5s to keep total duration close to the original. If the user hadn't given a target, this kind of "preserve overall feel" math is the right default.

──────────────────────────────────────────────────────────────────────────────
Example 5 — Quote recovery (fix a parser error in place)

USER: "the render is failing on a quote error, can you fix it?"

CURRENT (broken — VHS rejects \\" escapes):
\`\`\`tape
Output out.mp4
Set Width 1920
Set Height 1080
Set Theme { "background": "#161718", "foreground": "#F4F4F5", "cursor": "#F86606", "selection": "#3D3F43", "black": "#161718", "white": "#F4F4F5" }
Set TypingSpeed 80ms
Sleep 1s
Type "echo \\"hello world\\""
Sleep 300ms
Enter
Sleep 3s
\`\`\`

IDEAL:
\`\`\`tape
Output out.mp4
Set Width 1920
Set Height 1080
Set Theme { "background": "#161718", "foreground": "#F4F4F5", "cursor": "#F86606", "selection": "#3D3F43", "black": "#161718", "white": "#F4F4F5" }
Set TypingSpeed 80ms
Sleep 1s
Type 'echo "hello world"'
Sleep 300ms
Enter
Sleep 3s
\`\`\`

Takeaway: only the Type line's outer quote changed (\` " \` → \` ' \`) and the inner backslashes were removed. The escaped content semantically meant \`echo "hello world"\` and we preserve that exact intent — never silently strip the inner quotes.

──────────────────────────────────────────────────────────────────────────────

META-RULE for every edit you make:

After you draft your response, scan the IDEAL against the CURRENT. For every line you changed, ask: "did the user actually request this change?" If the answer is no, restore that line to the original. The user is iterating — they expect their previous work to survive.
`;
