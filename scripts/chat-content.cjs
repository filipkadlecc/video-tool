// Content specs for the Apify "Claude chat" marketing GIFs.
// Deliberately VARIED — different intros, table shapes, summary sections and
// closings per use case. Fake but realistic data. Consumed by build-chat-gifs.cjs.

const t = (s) => [{ t: String(s) }]; // simple cell / plain runs
const n = (s) => ({ t: String(s) });
const b = (s) => ({ t: String(s), b: true });
const c = (s) => ({ t: String(s), c: true });
const lk = (s) => ({ t: String(s), l: true });
const it = (s) => ({ t: String(s), i: true }); // italic

const pp = (s) => ({ type: "p", runs: t(s) });
const p = (...runs) => ({ type: "p", runs });
const bq = (...runs) => ({ type: "bq", runs });
const h1 = (s) => ({ type: "h1", runs: t(s) });
const h2 = (s) => ({ type: "h2", runs: t(s) });
const ul = (...items) => ({ type: "ul", items });
const ol = (...items) => ({ type: "ol", items });
const li = (label, rest) => [b(label), n(rest)];
const liR = (...runs) => runs;
const table = (header, rows, nowrap) => ({ type: "table", header: header.map(t), rows, ...(nowrap ? { nowrap } : {}) });

const specs = [
  // 1 — Google reviews: concise intro, standout-quote callout, "vibe" summary, closing Q
  {
    slug: "google-reviews-cafe",
    name: "Google reviews — cafe (chat)",
    bubble: "Pull this week’s Google reviews for my cafe.",
    blocks: [
      p(n("On it! The best fit is the "), b("Google Maps Reviews Scraper"), n(" by "), c("compass"), n(" — a "), b("4.9/5"), n(" rating and battle-tested on millions of listings. Pulling reviews from the last 7 days…")),
      p(n("Fetched "), b("14 new reviews"), n(" this week — averaging "), b("4.3 ★"), n(" (up 0.2 vs last week). Here’s the breakdown:")),
      h1("☕ Bean Scene Café — This Week’s Reviews"),
      table(
        ["Reviewer", "⭐", "Review", "Day"],
        [
          [t("Marcus H."), t("5.0"), [it("“Best flat white in town — they even remembered my name!”")], t("Mon")],
          [t("Priya S."), t("4.0"), [it("“Lovely oat latte, but seating gets tight around 9am.”")], t("Tue")],
          [t("David L."), t("5.0"), [it("“The new pistachio croissant is unreal 🥐”")], t("Wed")],
          [t("Emma T."), t("2.0"), [it("“Waited 15 min and my order came out cold.”")], t("Thu")],
          [t("Jon R."), t("5.0"), [it("“Fast wifi and great vibe — my go-to work spot.”")], t("Fri")],
          [t("Aisha K."), t("4.0"), [it("“Friendly baristas, though prices crept up a bit.”")], t("Sat")],
        ],
        [1, 3]
      ),
      bq(n("💬 "), b("Standout:"), n(" the pistachio croissant is getting its own shout-outs — your new menu item is landing.")),
      h2("😊 The vibe this week"),
      ul(
        li("People love:", " coffee quality & friendly staff (9 mentions)"),
        li("Watch out:", " 2 reviews flagged slow service at the morning peak"),
        li("Rising star:", " the pistachio croissant is driving fresh 5★ reviews")
      ),
      pp("Want me to draft replies to the 2 critical reviews, or track this automatically every week?"),
    ],
  },

  // 2 — Reddit: sentiment %, "sentiment split" section, closing Q
  {
    slug: "reddit-brand-mentions",
    name: "Reddit brand mentions (chat)",
    bubble: "Find every mention of my brand on Reddit.",
    blocks: [
      p(n("Let me sweep Reddit. I’ll use the "), b("Reddit Scraper"), n(" by "), c("trudax"), n(" — it covers posts "), it("and"), n(" comments across every subreddit, with scores and timestamps.")),
      p(n("Found "), b("27 mentions"), n(" in the last 30 days — "), b("74% positive"), n(". Here’s where the conversation is happening:")),
      h1("👽 Where Reddit’s Talking About You"),
      table(
        ["Subreddit", "Mention", "👍", "Vibe"],
        [
          [t("r/SaaS"), [it("“Been using them 6 months — support is elite.”")], t("342"), t("🟢 Positive")],
          [t("r/nocode"), [it("“This honestly saved me a whole dev sprint.”")], t("203"), t("🟢 Positive")],
          [t("r/webdev"), [it("“Way cheaper than the big names, does the job.”")], t("128"), t("🟢 Positive")],
          [t("r/startups"), [it("“Anyone compared them to the competitor?”")], t("56"), t("⚪ Neutral")],
          [t("r/marketing"), [it("“Onboarding was a little confusing at first.”")], t("41"), t("🔴 Negative")],
        ],
        [2, 3]
      ),
      h2("📊 Sentiment split"),
      ul(
        li("🟢 Positive — 74%:", " price & support lead the praise"),
        li("⚪ Neutral — 15%:", " mostly comparison questions"),
        li("🔴 Negative — 11%:", " onboarding friction, mentioned twice")
      ),
      pp("Want me to pull the full comment threads, or set up a daily alert for new mentions?"),
    ],
  },

  // 3 — Instagram: filter blockquote up front, sorted by engagement, top-pick callout, closing Q
  {
    slug: "instagram-fitness-influencers",
    name: "Instagram fitness influencers (chat)",
    bubble: "Find fitness influencers on Instagram over 50k followers.",
    blocks: [
      p(n("Let me find creators. I’ll use the "), b("Instagram Scraper"), n(" by "), c("apify"), n(" — profiles, follower counts, engagement and recent posts.")),
      bq(n("⚠️ "), b("Filter:"), n(" fitness accounts, 50k+ followers, public stats — ranked by "), it("engagement rate"), n(", not just size.")),
      h1("💪 Fitness Creators Worth a DM"),
      table(
        ["Creator", "👥 Followers", "❤️ Avg Likes", "🔥 Engagement", "Niche"],
        [
          [t("@liftwithlena"), t("212K"), t("18.4K"), [b("8.7%")], t("Strength")],
          [t("@yoga.with.priya"), t("63K"), t("5.2K"), [b("8.2%")], t("Yoga")],
          [t("@runnerjade"), t("148K"), t("9.9K"), t("6.7%"), t("Running")],
          [t("@mobility.mike"), t("97K"), t("6.1K"), t("6.3%"), t("Mobility")],
          [t("@calisthenics.co"), t("534K"), t("22.7K"), t("4.3%"), t("Calisthenics")],
          [t("@macro.matt"), t("81K"), t("3.4K"), t("4.2%"), t("Nutrition")],
        ],
        [1, 2, 3]
      ),
      bq(n("🏆 "), b("Top pick:"), n(" "), b("@liftwithlena"), n(" — 212K followers at a rare 8.7% engagement. Big reach "), it("and"), n(" an active audience.")),
      pp("Want me to grab their contact emails for outreach, or pull each creator’s last 12 posts’ performance?"),
    ],
  },

  // 4 — TikTok: matches the reference screenshot (actor stats, total-views callout,
  //     emoji column headers, Watch links, "Key Trends", View Dataset + closing Q)
  {
    slug: "tiktok-skincare",
    name: "TikTok #skincare (chat)",
    bubble: "Get this month’s top TikToks for #skincare.",
    blocks: [
      p(n("The best option here is the "), b("TikTok Hashtag Scraper"), n(" by "), c("clockworks"), n(" — it has the highest rating ("), b("4.88/5"), n("), the most users ("), b("15,000+"), n("), and a "), b("99.8%"), n(" success rate. I’ll fetch the top TikTok videos for "), b("#skincare"), n(", limited to 10 to keep things concise.")),
      p(n("Here are the "), b("top TikToks for #skincare"), n(" right now! The hashtag has a massive "), b("946.4 billion views"), n(" in total. Highlights, sorted by play count:")),
      h1("🎬 Top #Skincare TikToks"),
      table(
        ["#", "Creator", "Caption Snippet", "▶️ Plays", "❤️ Likes", "💬 Comments", "🔗 Link"],
        [
          [t("1"), t("kumi_lumy"), [it("“Find your routine on Lumy Care app #skincare #glowup”")], t("1.7M"), t("264,900"), t("707"), [lk("Watch")]],
          [t("2"), t("alim 💎"), [it("“Thanks to @Mariana for this tip. #zincoxide #mask”")], t("3.1M"), t("60,300"), t("1,012"), [lk("Watch")]],
          [t("3"), t("linnacheung7"), [it("“hydration pearls with Anua PDRN + Aloe vera”")], t("943K"), t("36,200"), t("85"), [lk("Watch")]],
          [t("4"), t("MONA ✅"), [it("“Chcecie tiktoka z moimi make-up must have?”")], t("940.9K"), t("90,800"), t("462"), [lk("Watch")]],
          [t("5"), t("Dr. Mopick Glow"), [it("“Didn’t believe until I tried it #melasma #glowingskin”")], t("551.9K"), t("2,307"), t("95"), [lk("Watch")]],
          [t("6"), t("NADDHU"), [it("“Half Chinese skincare routine ft. Tatcha, Yepoda”")], t("439.5K"), t("27,300"), t("106"), [lk("Watch")]],
          [t("7"), t("Monika Švecová"), [it("“Korean skincare haul + SPF picks ☀️”")], t("166K"), t("11,000"), t("25"), [lk("Watch")]],
          [t("8"), t("Madalina"), [it("“@Beauty of Joseon #milktoner #koreanskincare”")], t("143K"), t("3,658"), t("40"), [lk("Watch")]],
          [t("9"), t("“Mašek”"), [it("“my skin gonna be back i promise 💕 #skincareroutine”")], t("117.4K"), t("4,166"), t("21"), [lk("Watch")]],
          [t("10"), t("✦ vanilla"), [it("“Evening skincare ASMR #kbeauty #recommendations”")], t("20.6K"), t("2,852"), t("34"), [lk("Watch")]],
        ],
        [0, 3, 4, 5, 6]
      ),
      h2("📌 Key Trends"),
      ul(
        liR(b("Korean skincare (K-beauty)"), n(" is dominating — Tatcha, Beauty of Joseon, AESTURA and PDRN-based products are all over.")),
        liR(b("Hydration-focused routines"), n(" are a big theme this month.")),
        liR(b("Zinc oxide masks"), n(" are going viral (3.1M plays!).")),
      ),
      p(n("You can explore the full dataset here: 📊 "), lk("View Dataset")),
      pp("Would you like me to dig deeper — e.g., filter by engagement rate, get comments, or scrape a specific creator’s profile?"),
    ],
  },

  // 5 — Bali: ranked by value, "vibe" column, my-pick callout, closing Q
  {
    slug: "bali-hotel-prices",
    name: "Bali hotel prices (chat)",
    bubble: "Compare hotel prices in Bali on Booking.",
    blocks: [
      p(n("Comparing Bali stays. I’ll use the "), b("Booking.com Scraper"), n(" by "), c("voyager"), n(" — live prices, ratings and availability for your dates.")),
      p(n("Checked "), b("40 properties"), n(". Prices span "), b("$23–$210/night"), n(" — here they are ranked by value:")),
      h1("🏝️ Bali Stays, Ranked by Value"),
      table(
        ["Hotel", "💰 / night", "⭐ Score", "🗺️ Area", "Vibe"],
        [
          [t("Canggu Surf Lodge"), [b("$47")], t("8.5"), t("Canggu"), [it("Surf-town buzz")]],
          [t("Ubud Jungle Retreat"), t("$62"), t("9.1"), t("Ubud"), [it("Rice-field calm")]],
          [t("Seminyak Beach Villas"), t("$148"), t("8.8"), t("Seminyak"), [it("Beach & bars")]],
          [t("Nusa Dua Grand Resort"), t("$210"), [b("9.3")], t("Nusa Dua"), [it("Luxe & quiet")]],
          [t("Kuta Budget Inn"), t("$23"), t("7.9"), t("Kuta"), [it("Backpacker hub")]],
        ],
        [1, 2]
      ),
      bq(n("🏆 "), b("My pick:"), n(" "), b("Canggu Surf Lodge"), n(" — $47/night, 8.5★, walkable to the beach. Best value in the set.")),
      pp("Want me to filter for free cancellation and breakfast, or pull photos and amenities for the top 3?"),
    ],
  },

  // 6 — SERP: "that failed, switching" beat, result-type column, opportunity callout, closing Q
  {
    slug: "serp-vegan-protein",
    name: "Google SERP — vegan protein (chat)",
    bubble: "Show me who ranks in the top 10 for “vegan protein”.",
    blocks: [
      pp("Let me check the live SERP. First I’ll try a generic search scraper…"),
      p(n("That one only returns cached results — switching to the "), b("Google Search Results Scraper"), n(" by "), c("apify"), n(", which pulls the "), it("live"), n(" top 10 with titles, domains and result types.")),
      p(n("Here’s page one for "), b("“vegan protein”"), n(" (US, desktop):")),
      h1("🔎 Google Top 10 — “vegan protein”"),
      table(
        ["#", "Result", "Domain", "Type"],
        [
          [t("1"), t("Best Vegan Protein Powders (2026)"), t("healthline.com"), t("📄 Article")],
          [t("2"), t("Vegan Protein: The Complete Guide"), t("myprotein.com"), t("🛒 Store")],
          [t("3"), t("15 High-Protein Vegan Foods"), t("bbcgoodfood.com"), t("📄 Article")],
          [t("4"), t("Plant Protein vs Whey — What Wins?"), t("menshealth.com"), t("📄 Article")],
          [t("5"), t("Our Best-Selling Vegan Blend"), t("huel.com"), t("🛒 Store")],
          [t("6"), t("Vegan Protein Powder — Honest Reviews"), t("reddit.com"), t("💬 Forum")],
          [t("7"), t("How Much Protein Do Vegans Need?"), t("healthline.com"), t("📄 Article")],
          [t("8"), t("Top 10 Vegan Protein Sources"), t("medicalnewstoday.com"), t("📄 Article")],
          [t("9"), t("Vegan Protein Powder — Best Sellers"), t("amazon.com"), t("🛒 Store")],
          [t("10"), t("The Complete Plant Protein Guide"), t("nutrition.org"), t("📄 Article")],
        ],
        [0, 3]
      ),
      bq(n("💡 "), b("Opportunity:"), n(" 7 of 10 results are articles and "), it("no"), n(" niche brand cracks the top 5 — a sharp comparison listicle could rank.")),
      pp("Want me to scrape the top 3 pages’ headings and word counts for a content brief?"),
    ],
  },

  // 7 — Facebook ads: italic ad copy, "what they're testing" section, closing Q
  {
    slug: "facebook-competitor-ads",
    name: "Facebook competitor ads (chat)",
    bubble: "Show me the Facebook ads my competitor is running.",
    blocks: [
      p(n("Let me pull their ads. I’ll use the "), b("Facebook Ads Library Scraper"), n(" by "), c("curious_coder"), n(" — active ads, creative, formats, start dates and CTAs.")),
      p(n("Your competitor has "), b("12 active ads"), n(". Here are the ones running longest and hardest:")),
      h1("📣 Competitor Ads — Live Right Now"),
      table(
        ["Ad copy", "🎬 Format", "📅 Since", "🎯 CTA"],
        [
          [[it("“Summer Sale — 40% off everything”")], t("Video"), t("Jun 2"), t("Shop Now")],
          [[it("“Start free — no card required”")], t("Image"), t("May 18"), t("Sign Up")],
          [[it("“See why 10k teams switched”")], t("Carousel"), [b("Apr 30")], t("Learn More")],
          [[it("“Customer story: how Acme scaled”")], t("Video"), t("Jun 11"), t("Watch More")],
          [[it("“Limited seats — live webinar”")], t("Image"), t("Jun 20"), t("Register")],
        ],
        [1, 2, 3]
      ),
      h2("🧩 What they’re testing"),
      ul(
        li("Longest-runner:", " “See why 10k teams switched” — live 7+ weeks (it’s working)"),
        li("Format bet:", " video leads, 5 of 12 active ads"),
        li("Core offer:", " discounts & free trials — price-led messaging"),
        li("New this week:", " 2 webinar / event ads")
      ),
      pp("Want me to download the ad creatives, or monitor for new ads every week?"),
    ],
  },

  // 8 — Website→chatbot: crawl stats, status column, output callout, closing Q
  {
    slug: "website-to-chatbot",
    name: "Website → chatbot data (chat)",
    bubble: "Turn this website into data for my chatbot.",
    blocks: [
      p(n("Crawling now. I’ll use the "), b("Website Content Crawler"), n(" by "), c("apify"), n(" — it strips nav & ads and outputs clean, chunked Markdown built for RAG.")),
      p(n("Crawled "), b("128 pages"), n(" in 47s with "), b("0 errors"), n(". A sample of what’s ready:")),
      h1("🤖 Your Site, Ready for a Chatbot"),
      table(
        ["Page", "📝 Words", "🔢 Tokens", "Status"],
        [
          [t("/ (Home)"), t("820"), t("1,090"), t("✅ Clean")],
          [t("/pricing"), t("540"), t("710"), t("✅ Clean")],
          [t("/docs/getting-started"), t("2,310"), t("3,050"), t("✅ Clean")],
          [t("/blog/how-it-works"), t("1,470"), t("1,940"), t("✅ Clean")],
          [t("/faq"), t("1,120"), t("1,480"), t("✅ Clean")],
        ],
        [1, 2, 3]
      ),
      bq(n("📦 "), b("Output:"), n(" clean Markdown, "), b("~243K tokens"), n(" total, pre-chunked and embedding-ready.")),
      pp("Point me at your vector DB — Pinecone, Weaviate or pgvector — and I’ll format the embeddings payload next."),
    ],
  },

  // 9 — YouTube: totals in intro, "patterns" section, closing Q
  {
    slug: "youtube-channel-videos",
    name: "YouTube channel videos (chat)",
    bubble: "Get all videos and view counts from this channel.",
    blocks: [
      p(n("On it. I’ll use the "), b("YouTube Channel Scraper"), n(" by "), c("streamers"), n(" — every video with views, likes, publish dates and duration.")),
      p(n("Scraped all "), b("214 videos"), n(" — "), b("24.6M"), n(" total views, ~115K average. Top performers:")),
      h1("▶️ Channel Breakdown — Top Videos"),
      table(
        ["Video", "👁️ Views", "👍 Likes", "📅 Published", "⏱️"],
        [
          [t("I Tried Every AI Tool for 30 Days"), [b("1.9M")], t("84K"), t("Mar 2026"), t("18:42")],
          [t("5 APIs That Feel Illegal to Know"), t("1.2M"), t("61K"), t("Dec 2025"), t("9:47")],
          [t("The Truth About Web Scraping"), t("820K"), t("37K"), t("Jan 2026"), t("12:10")],
          [t("Build a Full App in 10 Minutes"), t("640K"), t("29K"), t("Feb 2026"), t("10:03")],
          [t("My $0 Startup Tech Stack"), t("410K"), t("19K"), t("Nov 2025"), t("14:22")],
        ],
        [1, 2, 3, 4]
      ),
      h2("📈 Patterns"),
      ul(
        li("Winner:", " “I Tried Every AI Tool” — 1.9M views, 4.4% like rate"),
        li("Sweet spot:", " 9–13 min videos consistently over-perform"),
        li("Cadence:", " ~4 uploads/month keeps views compounding")
      ),
      pp("Want the full 214-row export, or a month-by-month views chart?"),
    ],
  },
  // 10 — MacBook Pro love/hate: no table — numbered LOVE / HATE lists + pro tips + summary
  {
    slug: "macbook-pro-reviews",
    name: "MacBook Pro — love & hate (chat)",
    noOutro: true,
    bubble: "I am about to buy a new MacBook Pro. What people love and hate about it?",
    blocks: [
      pp("Let me search for an Actor that can help gather reviews and opinions about the MacBook Pro!"),
      p(n("The best option here is the "), b("Amazon Reviews Scraper"), n(" by "), c("junglee"), n(" — it’s the most popular with over "), b("10,700 users"), n(" and a "), b("97.3%"), n(" success rate. I’ll use it to scrape MacBook Pro reviews from Amazon.")),
      p(n("I’ll fetch a sample of "), b("10 reviews"), n(" (a mix of positive and negative) to give you a balanced view. Let me find the right Amazon product URL and run it now!")),
      pp("Got the reviews! Let me fetch them now."),
      pp("Here’s a balanced summary of what real MacBook Pro buyers love and hate, based on Amazon reviews:"),
      h1("💚 What People LOVE About MacBook Pro"),
      ol(
        [b("Blazing Performance"), n(" — Reviewers consistently praise the M-series chip as fast, quiet, and powerful. As one buyer put it: "), it("“It’s fast, quiet, has an excellent-quality display, and a battery that lasts for many hours.”")],
        [b("All-Day Battery Life"), n(" — Multiple reviewers highlight that the battery easily lasts through a full day of work and school.")],
        [b("Premium Design"), n(" — The laptop is described as elegant and lightweight, making it easy to carry around everywhere.")],
        [b("Beautiful Display"), n(" — The screen quality gets repeated shoutouts for its sharpness and clarity.")],
        [b("Convenience Features"), n(" — Touch ID (fingerprint login) is a fan favorite: "), it("“The fingerprint tech makes it easy to login to all my accounts with my thumb.”")],
        [b("Reliability Over Time"), n(" — Many long-term Apple users report years of dependable performance and note that it’s a "), it("“worthwhile investment if you’re looking for quality and efficiency.”")],
      ),
      h1("🔥 What People HATE About MacBook Pro"),
      ol(
        [b("Durability Concerns"), n(" — Some reviewers report hardware failures relatively shortly after purchase (e.g., screen issues with horizontal lines, motherboard shorts), particularly after the warranty expires.")],
        [b("Expensive Repairs"), n(" — Out-of-warranty repairs can be brutal. One reviewer was quoted "), b("$700 for a new screen"), n(", calling it an overpriced fix for what they saw as a manufacturing defect.")],
        [b("Poor Customer Support"), n(" — A recurring complaint is that both Apple and Amazon pass the buck when issues arise with Amazon-purchased units. One user spent "), b("3 hours on the phone"), n(" only to be told neither company could help.")],
        [b("Learning Curve"), n(" — A few users, especially those switching from Windows, find macOS unintuitive at first: "), it("“Not easy to use. FORGET about getting new password!”")],
      ),
      h1("💡 Pro Tips from Reviewers"),
      ul(
        [b("Buy directly from the Apple Store"), n(" (not a third-party listing on Amazon) to ensure better warranty and support coverage.")],
        [b("Consider AppleCare+"), n(" — multiple reviewers suggest it’s worth the extra cost given the high repair prices.")],
      ),
      p(n("Overall, most buyers are very happy with the performance and design, but the risk of hardware defects and the cost of repairs are real concerns worth factoring in. 🍎")),
    ],
  },
];

module.exports = { specs };
