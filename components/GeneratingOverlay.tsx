"use client";

import React, { useState, useEffect, useMemo } from "react";

const FILM_FACTS = [
  // Original facts
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
  // Movie facts
  "The iconic Star Wars opening crawl was created by physically filming yellow letters crawling over a black paper background.",
  "Arnold Schwarzenegger was paid roughly $21,429 per word in Terminator 2 — he only spoke 700 words in the entire film.",
  "The snow in The Shining's hedge maze was actually 900 tons of salt and crushed Styrofoam.",
  "Marlon Brando read his Superman (1978) dialogue from cards hidden on set, including one taped to baby Superman's diaper.",
  "E.T.'s face was modeled after a combination of poet Carl Sandburg, Albert Einstein, and a pug dog.",
  "The word 'mafia' is never spoken in The Godfather — the real mob struck a deal with producers to remove it.",
  "Every ping-pong ball in Forrest Gump's tournament scenes is entirely CGI — Tom Hanks was just waving a paddle at thin air.",
  "Daniel Radcliffe went through approximately 160 pairs of prop glasses while filming the eight Harry Potter movies.",
  "Heath Ledger designed the Joker's messy makeup himself using cheap drugstore clown makeup.",
  "The stabbing sound in Psycho's shower scene was created by plunging a kitchen knife into a casaba melon.",
  "In Raiders of the Lost Ark, the monkey doing the 'Heil Hitler' salute was actually just reaching for a grape off-camera.",
  "The assembly code from the Terminator's POV in the 1984 film is actually Apple II operating system code.",
  "Sean Connery was only 12 years older than Harrison Ford when he played his father in Indiana Jones and the Last Crusade.",
  "Tom Cruise trained to hold his breath underwater for six minutes for a stunt in Mission: Impossible - Rogue Nation.",
  "The horses in The Wizard of Oz's Emerald City were colored using powdered Jell-O crystals, which they constantly tried to lick off.",
  "The 'pea soup' vomit in The Exorcist was actually Andersen's brand split pea soup — they tried Campbell's but didn't like the texture.",
  "During filming of The Texas Chain Saw Massacre (1974), a real human skeleton was used because it was cheaper than a plastic replica.",
  "In Candyman (1992), the bees were real — Tony Todd negotiated $1,000 per sting, netting an extra $23,000.",
  "The Nakatomi Plaza in Die Hard is actually Fox Plaza in Los Angeles — the real headquarters of the studio making the movie.",
  "Groundhog Day was filmed in Woodstock, Illinois, not Punxsutawney. There's now a plaque where Bill Murray kept stepping in the puddle.",
  "Monty Python used coconuts for horse hooves in Holy Grail purely because the budget was too small to afford real horses.",
  "The Casablanca script was unfinished during filming — actors often didn't know how the movie would end until the day they shot it.",
  "The Lion King's wildebeest stampede took Disney's CG animators three years to create for just two and a half minutes of screen time.",
  "The ballroom scene in Beauty and the Beast was one of the first times 3D CGI was seamlessly blended with 2D hand-drawn animation.",
  "The original cut of The Wolf of Wall Street was over four hours long.",
  "In Interstellar, the ticking on the water planet happens every 1.25 seconds — equaling one full day passing on Earth due to time dilation.",
  "Jim Carrey hated the Grinch makeup so much that production brought in a CIA torture-resistance specialist to help him endure the process.",
  "In The Shawshank Redemption, the mugshot of a young Red is actually a photo of Morgan Freeman's son, Alfonso.",
  "Nicolas Cage ate a real live cockroach in Vampire's Kiss. He had to do three takes.",
  "James Earl Jones initially requested to be uncredited as Darth Vader because he felt his contribution was 'just special effects.'",
  "The rain in Singin' in the Rain was mixed with milk so it would show up better on camera, causing Gene Kelly's wool suit to shrink.",
  "Jurassic Park has only 15 minutes of actual dinosaur footage in its entire 127-minute runtime.",
  "The phrase 'Beam me up, Scotty' is never actually said in any canonical Star Trek movie or TV episode.",
  "Heath Ledger locked himself in a hotel room for a month to develop the Joker's psychology, posture, and iconic voice.",
  "In Home Alone, the tarantula on Marv's face was real — Daniel Stern had to mime his scream so he wouldn't scare the spider.",
  "Robin Williams' story about his wife farting in her sleep in Good Will Hunting was completely improvised — Matt Damon's laughter is real.",
  "In Cast Away, production shut down for a year so Tom Hanks could lose 50 pounds and grow his hair out.",
  "The original Godzilla suit weighed over 220 pounds — the actor inside frequently passed out from the heat of studio lights.",
  "To film the reverse-motion scenes in Tenet, actors had to learn how to walk, run, blink, and speak backwards.",
  "'We're gonna need a bigger boat' from Jaws was actually an inside joke about the tiny barge the crew was forced to use for equipment.",
  "Leonardo DiCaprio, a vegetarian, actually ate a raw bison liver on camera for The Revenant.",
  "The creepy twin girls in The Shining weren't actually twins — they were sisters with a slight age difference.",
  "The massive wall of speakers in Mad Max: Fury Road was 100% functional and actually blasted music on set.",
  "The liquid metal T-1000 effects in Terminator 2 took 35 CGI animators ten months — for just five minutes of screen time.",
  "Sylvester Stallone urged Dolph Lundgren to actually hit him during Rocky IV fight scenes, which put Stallone in the ICU for eight days.",
  "The script for The Big Lebowski uses the word 'dude' 160 times, and the F-word 292 times.",
  "The terrifying shark in Jaws rarely worked, forcing Spielberg to use John Williams' theme to signify the shark instead — heightening the suspense.",
  "In the movie Speed, the bus jump over the unfinished freeway was done practically — the stunt driver ramped the bus 109 feet through the air.",
  "The alien language in District 9 was created by rubbing a pumpkin against a wet piece of rubber.",
  "The famous 'You can't handle the truth!' scene in A Few Good Men was shot in a single day — Jack Nicholson delivered it around 50 times.",
  "The sound of punches in Fight Club was created by smashing walnuts stuffed inside a chicken carcass.",
  "The velociraptors in Jurassic Park's kitchen scene were occasionally played by men in heavy rubber suits from the waist up.",
  "The Millennium Falcon was redesigned last-minute because it looked too much like the ship from Space: 1999 — George Lucas based it on a half-eaten hamburger.",
  "The Blair Witch Project actors were given GPS trackers and waypoints to find milk crates with daily instructions and dwindling food supplies.",
  "In Gravity, Sandra Bullock spent up to 10 hours a day inside a massive mechanical 'lightbox' to simulate floating in space.",
  "The Predator's clicking sound was improvised by voice actor Peter Cullen, who is also the voice of Optimus Prime.",
  "Close Encounters of the Third Kind features a tiny R2-D2 strapped to the alien spaceship as an Easter egg.",
  "The Death Star explosion in Star Wars was created using titanium shavings and high-speed photography.",
  "To prepare for The Pianist, Adrien Brody sold his apartment, sold his car, and moved to Europe with just two bags to understand loss.",
  "Babe (1995) required 48 different real pigs because piglets grow so fast they'd visibly age out of the role in weeks.",
  "The sound of the Matrix code falling was created by shaking a massive ring of keys and manipulating the audio.",
  "The Avengers' post-credits shawarma scene was shot weeks after the movie had already premiered.",
];

export default function GeneratingOverlay({ visible }: { visible: boolean }) {
  const [factIndex, setFactIndex] = useState(0);
  const initialFact = useMemo(() => Math.floor(Math.random() * FILM_FACTS.length), []);

  useEffect(() => {
    if (!visible) return;
    setFactIndex(initialFact);
    const interval = setInterval(() => {
      setFactIndex((prev) => (prev + 1) % FILM_FACTS.length);
    }, 12000);
    return () => clearInterval(interval);
  }, [visible, initialFact]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
      <div className="w-[55%] max-w-2xl bg-surface border border-border rounded-2xl p-8 shadow-2xl text-center">
        {/* Shimmer bar */}
        <div className="h-1 w-full bg-border rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-accent rounded-full"
            style={{
              width: "30%",
              animation: "genShimmer 1.2s ease-in-out infinite",
            }}
          />
        </div>

        <p className="text-base font-semibold text-foreground mb-2">Generating animation...</p>
        <p className="text-sm text-muted mb-6">Code is streaming into the editor</p>

        <div className="bg-background rounded-xl px-6 py-4">
          <p className="text-[10px] uppercase tracking-widest text-accent font-bold mb-2">Did you know?</p>
          <p className="text-sm text-foreground/80 leading-relaxed italic">{FILM_FACTS[factIndex]}</p>
        </div>
      </div>

      <style>{`
        @keyframes genShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(430%); }
        }
      `}</style>
    </div>
  );
}
