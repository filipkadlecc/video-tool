"use client";

import React, { useState, useEffect, useMemo } from "react";
import Icon from "@/components/ui/Icon";

const FILM_FACTS = [
  "The first film ever made was 'Roundhay Garden Scene' in 1888 — it's only 2.11 seconds long.",
  "A single frame of Toy Story took 4-13 hours to render back in 1995.",
  "The Wilhelm Scream has been used in over 400 films and TV shows since 1951.",
  "24fps became the standard because it was the minimum speed for audio sync in early talkies.",
  "The Lord of the Rings trilogy used 48,000 pieces of armor and 10,000 arrows.",
  "Hitchcock's 'Rope' (1948) was designed to look like one continuous shot using hidden cuts.",
  "Stanley Kubrick used NASA lenses for candlelit scenes in 'Barry Lyndon' (1975).",
  "Motion blur in film happens naturally — without it, animation looks uncanny.",
  "The first CGI character in a film was the stained glass knight in 'Young Sherlock Holmes' (1985).",
  "Pixar's 'Monsters, Inc.' had to simulate 2.3 million individual hairs on Sulley.",
  "The 180-degree shutter rule: shutter speed = 1/(2x frame rate) for natural motion blur.",
  "A 'Dutch angle' tilts the camera to create unease — popularized in German Expressionist cinema.",
  "Wes Anderson's signature centered framing is called 'planimetric composition.'",
  "The Kuleshov Effect proves that editing context changes how we interpret an actor's expression.",
  "IMAX film frames are 70mm wide — 10x the area of standard 35mm film.",
  "The 'magic hour' for filming is the 20-30 minutes after sunrise and before sunset.",
  "Foley artists recreate everyday sounds — footsteps on gravel are often crushed cornstarch.",
  "Buster Keaton did his own stunts, including a house facade falling on him in 'Steamboat Bill, Jr.'",
  "The Mandalorian pioneered virtual production using massive LED walls instead of green screens.",
  "Eadweard Muybridge settled a bet about galloping horses — and accidentally invented motion pictures.",
  "Arnold Schwarzenegger was paid roughly $21,429 per word in Terminator 2 — he only spoke 700 words.",
  "The snow in The Shining's hedge maze was actually 900 tons of salt and crushed Styrofoam.",
  "E.T.'s face was modeled after a combination of poet Carl Sandburg, Albert Einstein, and a pug dog.",
  "Every ping-pong ball in Forrest Gump's tournament scenes is entirely CGI.",
  "Daniel Radcliffe went through approximately 160 pairs of prop glasses filming eight Harry Potter movies.",
  "The stabbing sound in Psycho's shower scene was created by plunging a knife into a casaba melon.",
  "Tom Cruise trained to hold his breath underwater for six minutes for Mission: Impossible - Rogue Nation.",
  "Monty Python used coconuts for horse hooves in Holy Grail because the budget was too small for horses.",
  "The Lion King's wildebeest stampede took Disney's CG animators three years for 2.5 minutes of footage.",
  "Jurassic Park has only 15 minutes of actual dinosaur footage in its entire 127-minute runtime.",
  "Heath Ledger locked himself in a hotel room for a month to develop the Joker's psychology and voice.",
  "In Cast Away, production shut down for a year so Tom Hanks could lose 50 pounds and grow his hair.",
  "The liquid metal T-1000 effects in Terminator 2 took 35 CGI animators ten months for five minutes.",
  "The Big Lebowski script uses the word 'dude' 160 times, and the F-word 292 times.",
  "The Millennium Falcon was redesigned last-minute because it looked like the ship from Space: 1999.",
  "In Gravity, Sandra Bullock spent up to 10 hours a day inside a massive 'lightbox' to simulate space.",
  "Akira (1988) had over 2,300 shades of color — many created specifically for the film.",
  "Toy Story (1995) rendered for a total of 800,000 machine-hours across Pixar's render farm.",
  "The opening shot of La La Land is a single take that took 4 days to choreograph.",
  "Snow White and the Seven Dwarfs (1937) was nicknamed 'Disney's Folly' — critics expected it to bankrupt the studio.",
  "Disney's multiplane camera stacked painted glass layers to fake depth, first used in 'The Old Mill' (1937).",
  "The 12 principles of animation — squash and stretch, anticipation, follow-through — come from Disney's 'Nine Old Men'.",
  "'Easing' in motion design comes from animators drawing more frames near a pose — 'slow in, slow out'.",
  "Animating 'on twos' means holding each drawing for two frames — 12 drawings per second of film.",
  "Spider-Man: Into the Spider-Verse animated its characters mostly on twos to feel like a comic book.",
  "Saul Bass's title sequences for Hitchcock turned opening credits into an art form.",
  "The Vertigo title sequence (1958) used spiral patterns plotted on a WWII anti-aircraft targeting computer.",
  "Pablo Ferro hand-lettered the credits for Dr. Strangelove, stretching letters to fill the frame.",
  "Kyle Cooper's hand-scratched Se7en titles (1995) inspired a whole generation of motion designers.",
  "The Pixar lamp, Luxo Jr., starred in a 1986 short that proved CGI could carry emotion.",
  "Toy Story (1995) was the first fully computer-animated feature film.",
  "Walt Disney voiced Mickey Mouse himself from 1928 until 1947.",
  "Steamboat Willie (1928) was one of the first cartoons with fully synchronized sound.",
  "Winsor McCay's 'Gertie the Dinosaur' (1914) was drawn on about 10,000 sheets of rice paper.",
  "The oldest surviving animated feature is 'The Adventures of Prince Achmed' (1926), made with paper cut-outs.",
  "Rotoscoping — tracing over live footage — was patented by Max Fleischer in 1917.",
  "Aardman shot Wallace & Gromit at around 12 poses per second — a good day produced a few seconds of film.",
  "Coraline's animators made more than 15,000 faces to cover every expression.",
  "Laika's Kubo and the Two Strings built a 16-foot skeleton puppet — one of the largest stop-motion puppets ever.",
  "Studio Ghibli's Princess Mononoke had about 144,000 cels — Miyazaki personally checked tens of thousands.",
  "The phi phenomenon is why a run of still images reads as motion to our brains.",
  "Early silent films were often shot at 16–18 fps — that's why they look sped up at 24 fps today.",
  "The Hobbit was shot at 48 fps — many viewers said it looked 'too real'.",
  "Gemini Man and Billy Lynn's Long Halftime Walk were shot at 120 fps.",
  "The 'Ken Burns effect' — slow pans across still photos — is named after the documentary maker.",
  "A 'J-cut' lets the next scene's audio start before its picture; an 'L-cut' does the reverse.",
  "A 'match cut' links two shots by shape or motion — like the bone-to-satellite cut in 2001: A Space Odyssey.",
  "Walter Murch's 'Rule of Six' ranks emotion above story, rhythm and eye-trace when choosing a cut.",
  "The average shot length in Hollywood films has fallen from about 12 seconds in the 1930s to around 2.5 today.",
  "Mad Max: Fury Road has around 2,700 cuts and keeps the action centered to stay readable.",
  "The 'dolly zoom' — zooming in while pulling the camera back — was invented for Vertigo.",
  "Steadicam debuted in 1976; one of its first famous uses was Rocky running up the museum steps.",
  "1917 (2019) was built to look like one continuous shot, stitched with hidden cuts.",
  "Russian Ark (2002) is a genuine single 96-minute take, shot in the Hermitage museum.",
  "Chroma key screens are green because green is far from human skin tones — and cameras are most sensitive to it.",
  "Before green, blue screens were standard — blue still works better for some night scenes.",
  "The T-Rex in Jurassic Park was originally going to be stop-motion; Phil Tippett was retrained to direct CG animators.",
  "Gollum was among the first performance-capture characters to earn serious awards talk for the actor.",
  "Avatar (2009) used a virtual camera so James Cameron could 'film' inside the CG world in real time.",
  "Tron (1982) was reportedly disqualified from the VFX Oscar because using computers was seen as 'cheating'.",
  "Industrial Light & Magic was founded in 1975 specifically to make the effects for Star Wars.",
  "Pixar's RenderMan has been used on nearly every film that won the Visual Effects Oscar for decades.",
  "Monsters University used global illumination, making light bounce like real light for the first time at Pixar.",
  "Moana's ocean was treated as a character, with its own team of animators and effects artists.",
  "'Keyframe' comes from traditional animation: lead artists drew key poses, assistants drew the in-betweens.",
  "In-betweening was once an entry-level job — many great animators started as 'in-betweeners'.",
  "The Bézier curve, the backbone of motion curves, was popularized by Renault engineer Pierre Bézier for car design.",
  "Adobe After Effects was first released in 1993 by the Company of Science and Art.",
  "Remotion lets you write videos in React — every frame is just a component rendered at a point in time.",
  "GIFs were invented in 1987 at CompuServe — and yes, the creator said it's pronounced 'jif'.",
  "The loading spinner is a descendant of the 'throbber' — the animated logo in early web browsers.",
  "Motion that lasts 200–500 ms usually feels responsive in UI; longer starts to feel slow.",
  "The 'Rule of Thirds' was first written down in 1797, for landscape painting.",
  "Golden hour light is warm because sunlight travels through more atmosphere, scattering blue away.",
  "Anamorphic lenses squeeze a wide image onto normal film — the source of those horizontal lens flares.",
  "J.J. Abrams's Star Trek has more than 700 lens flares.",
  "Film grain is often added digitally to modern films to make them feel less clinical.",
  "The Matrix's 'bullet time' used around 120 still cameras fired in sequence.",
  "Inception's rotating hallway was a real, full-size set that spun 360 degrees.",
  "Interstellar's black hole visuals were accurate enough to produce scientific papers.",
  "Christopher Nolan crashed a real Boeing 747 into a building for Tenet — it was cheaper than CGI.",
  "Wes Anderson's Fantastic Mr. Fox let the fur 'boil' on purpose, as a nod to old stop-motion.",
  "The Nightmare Before Christmas used over 400 heads for Jack Skellington.",
  "The Simpsons' yellow skin was chosen so viewers channel-surfing would notice the show.",
  "South Park's first episode was made with paper cut-outs; now it's animated in software to look the same.",
  "The first music video played on MTV (1981) was 'Video Killed the Radio Star'.",
  "A-ha's 'Take On Me' video took around 16 weeks to rotoscope by hand.",
  "Peter Gabriel's 'Sledgehammer' video was shot frame by frame, with Gabriel lying still for hours.",
  "The THX 'Deep Note' was generated by a computer program with about 20,000 lines of code.",
  "The MGM lion has been played by at least seven different real lions.",
  "The 20th Century Fox fanfare was composed in 1933 by Alfred Newman.",
  "The Pixar lamp bouncing on the 'I' in its logo is Luxo Jr. from the 1986 short.",
  "A frame at 4K resolution has about 8.3 million pixels — four times 1080p.",
  "Dolby Vision and HDR let modern screens show highlights up to thousands of nits, far above old TVs.",
  "A 24 fps film shown on a 60 Hz screen uses 3:2 pulldown, repeating frames unevenly — causing 'judder'.",
  "The 'Wilhelm Scream' is named after Private Wilhelm, a character in The Charge at Feather River (1953).",
  "Stop-motion 'replacement animation' swaps whole faces or bodies per frame instead of bending a puppet.",
];

const FACT_MS = 6000;

export default function GeneratingOverlay({ visible }: { visible: boolean }) {
  const [factIndex, setFactIndex] = useState(0);
  const initialFact = useMemo(() => Math.floor(Math.random() * FILM_FACTS.length), []);

  useEffect(() => {
    if (!visible) return;
    setFactIndex(initialFact);
    const interval = setInterval(() => {
      setFactIndex((prev) => (prev + 1) % FILM_FACTS.length);
    }, FACT_MS);
    return () => clearInterval(interval);
  }, [visible, initialFact]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        background: "rgba(5,5,8,0.88)",
        backdropFilter: "blur(18px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
        padding: 40,
      }}
    >
      {/* Animated film reel */}
      <div style={{ position: "relative", width: 120, height: 120 }}>
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          style={{ animation: "vt-spin 8s linear infinite" }}
        >
          <defs>
            <radialGradient id="gen-g">
              <stop offset="0%" stopColor="oklch(0.88 0.22 124)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="oklch(0.88 0.22 124)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="60" cy="60" r="56" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
          <circle
            cx="60"
            cy="60"
            r="56"
            fill="none"
            stroke="var(--brand)"
            strokeWidth="1.5"
            strokeDasharray="20 340"
          />
          <circle
            cx="60"
            cy="60"
            r="40"
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="0.5"
            strokeDasharray="4 4"
          />
          {[0, 60, 120, 180, 240, 300].map((a) => {
            const r = 48;
            const x = 60 + Math.cos((a * Math.PI) / 180) * r;
            const y = 60 + Math.sin((a * Math.PI) / 180) * r;
            return (
              <circle key={a} cx={x} cy={y} r="4" fill="rgba(255,255,255,0.2)" />
            );
          })}
          <circle cx="60" cy="60" r="8" fill="var(--brand)" />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: -20,
            background: "radial-gradient(circle, oklch(0.88 0.22 124 / 0.3), transparent 60%)",
            filter: "blur(20px)",
            pointerEvents: "none",
            zIndex: -1,
          }}
        />
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.4, marginBottom: 6 }}>
          Generating animation
        </div>
        <div
          className="mono"
          style={{
            fontSize: 12,
            color: "var(--ink-tertiary)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            justifyContent: "center",
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "var(--brand)",
              animation: "vt-pulse 1.4s infinite",
            }}
          />
          Code is streaming into the editor...
        </div>
      </div>

      {/* Trivia card */}
      <div
        style={{
          maxWidth: 440,
          padding: 18,
          background: "var(--surface-chrome)",
          border: "1px solid var(--border-hairline)",
          borderRadius: "var(--r-panel)",
          boxShadow: "none",
        }}
      >
        <div
          className="mono cap"
          style={{
            color: "var(--brand)",
            marginBottom: 8,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Icon name="movie" size={12} /> Did you know?
        </div>
        <div
          key={factIndex}
          style={{
            fontSize: 13,
            lineHeight: 1.55,
            color: "var(--ink-primary)",
            animation: "vt-glitch-in 400ms ease",
          }}
        >
          {FILM_FACTS[factIndex]}
        </div>
        {/* Time until the next fact. The old 8 dots stopped meaning anything once the list outgrew 8. */}
        <div style={{ height: 2, marginTop: 12, background: "var(--surface-hover)", borderRadius: 1, overflow: "hidden" }}>
          <div
            key={factIndex}
            style={{
              height: "100%",
              background: "var(--brand)",
              transformOrigin: "left",
              animation: `vt-fact-timer ${FACT_MS}ms linear forwards`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
