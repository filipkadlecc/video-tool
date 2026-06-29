Output out.mp4
# x402 launch — Droid CLI agent demo (CAM-068)
# Scenario 1 (PREFERRABLE): direct API call, no install/auth visible.
# This tape just drives the real Droid session — the agent does the work for real,
# mcpc signs the x402 payment, the Apify Actor returns real data.
#
# Prereqs — done already on this machine unless noted [✓ / TODO]:
#   1. [✓] droid CLI installed (brew install --cask droid).
#        TODO: one-time interactive sign-in — run `droid` in a normal shell once.
#   2. [✓] mcpc installed (npm i -g @apify/mcpc) and x402 wallet funded
#        ($8 USDC on Base at 0xb527…A0A6 — `mcpc x402 info`).
#   3. [✓] Droid MCP server entry "apify" → http://localhost:8080 (HTTP)
#        configured via `droid mcp add apify http://localhost:8080 --type http`.
#   4. Start the mcpc proxy BEFORE rendering (and keep it running):
#        mcpc connect "mcp.apify.com?payment=x402" @apify --x402 --proxy 8080
#        Verify with `mcpc` (should show @apify ● live, proxy 127.0.0.1:8080).
#   5. Confirm the X-mentions Actor Droid picks is Pay-Per-Event
#        (x402 only settles for PPE Actors). If unsure, name a PPE one in the prompt.
#
# Brand theme matches lib/brand.ts (#292B2E bg, #FFFFFF fg).
# Resolution 4K — re-crop for X / LinkedIn in post.

Set Theme { "background": "#292B2E", "foreground": "#FFFFFF", "cursor": "#FFFFFF", "selection": "#3A3D40", "black": "#292B2E", "white": "#FFFFFF" }
Set FontSize 30
Set Width 3840
Set Height 2160
Set TypingSpeed 25ms
Set Margin 60
Set Padding 60
Set Shell "zsh"

# Brief pre-roll on a clean prompt so the first frame isn't mid-keystroke.
Sleep 1200ms

# Launch Droid — the homescreen / welcome banner is the opening shot.
Type "droid"
Enter
Sleep 4500ms

# The one prompt — verbatim from the CAM-068 brief.
Type `Use Apify to collect all mentions of Apify on X from the last 30 days. Run sentiment analysis and surface the top 5 recurring complaints and praise themes. Save the full dataset locally, give me a summary in your response and let me know what was the cost of the Actor run.`
Sleep 800ms
Enter

# Real-time hold while Droid plans, calls mcpc, signs x402, runs the Actor,
# pulls the dataset, runs sentiment, and prints the summary + cost.
# Budget is generous so the raw recording always captures the end state;
# the 30-45s cut comes from speeding up the middle in Remotion / post.
# Dial this up if observed runs take longer.
Sleep 240s

# Brief hold on the final summary frame so the end card can land cleanly in post.
Sleep 3s
