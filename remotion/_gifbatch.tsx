import { registerRoot, Composition } from "remotion";
import React from "react";
import S_google_reviews_cafe from "./scenes/gen/google-reviews-cafe.built";
import S_reddit_brand_mentions from "./scenes/gen/reddit-brand-mentions.built";
import S_instagram_fitness_influencers from "./scenes/gen/instagram-fitness-influencers.built";
import S_tiktok_skincare from "./scenes/gen/tiktok-skincare.built";
import S_bali_hotel_prices from "./scenes/gen/bali-hotel-prices.built";
import S_serp_vegan_protein from "./scenes/gen/serp-vegan-protein.built";
import S_facebook_competitor_ads from "./scenes/gen/facebook-competitor-ads.built";
import S_website_to_chatbot from "./scenes/gen/website-to-chatbot.built";
import S_youtube_channel_videos from "./scenes/gen/youtube-channel-videos.built";
import S_macbook_pro_reviews from "./scenes/gen/macbook-pro-reviews.built";

const Root: React.FC = () => (
  <>
      <Composition id="google-reviews-cafe" component={S_google_reviews_cafe} durationInFrames={375} fps={25} width={1920} height={1080} />
      <Composition id="google-reviews-cafe-sq" component={S_google_reviews_cafe} durationInFrames={375} fps={25} width={1080} height={1080} />
      <Composition id="reddit-brand-mentions" component={S_reddit_brand_mentions} durationInFrames={375} fps={25} width={1920} height={1080} />
      <Composition id="reddit-brand-mentions-sq" component={S_reddit_brand_mentions} durationInFrames={375} fps={25} width={1080} height={1080} />
      <Composition id="instagram-fitness-influencers" component={S_instagram_fitness_influencers} durationInFrames={375} fps={25} width={1920} height={1080} />
      <Composition id="instagram-fitness-influencers-sq" component={S_instagram_fitness_influencers} durationInFrames={375} fps={25} width={1080} height={1080} />
      <Composition id="tiktok-skincare" component={S_tiktok_skincare} durationInFrames={375} fps={25} width={1920} height={1080} />
      <Composition id="tiktok-skincare-sq" component={S_tiktok_skincare} durationInFrames={375} fps={25} width={1080} height={1080} />
      <Composition id="bali-hotel-prices" component={S_bali_hotel_prices} durationInFrames={375} fps={25} width={1920} height={1080} />
      <Composition id="bali-hotel-prices-sq" component={S_bali_hotel_prices} durationInFrames={375} fps={25} width={1080} height={1080} />
      <Composition id="serp-vegan-protein" component={S_serp_vegan_protein} durationInFrames={375} fps={25} width={1920} height={1080} />
      <Composition id="serp-vegan-protein-sq" component={S_serp_vegan_protein} durationInFrames={375} fps={25} width={1080} height={1080} />
      <Composition id="facebook-competitor-ads" component={S_facebook_competitor_ads} durationInFrames={375} fps={25} width={1920} height={1080} />
      <Composition id="facebook-competitor-ads-sq" component={S_facebook_competitor_ads} durationInFrames={375} fps={25} width={1080} height={1080} />
      <Composition id="website-to-chatbot" component={S_website_to_chatbot} durationInFrames={375} fps={25} width={1920} height={1080} />
      <Composition id="website-to-chatbot-sq" component={S_website_to_chatbot} durationInFrames={375} fps={25} width={1080} height={1080} />
      <Composition id="youtube-channel-videos" component={S_youtube_channel_videos} durationInFrames={375} fps={25} width={1920} height={1080} />
      <Composition id="youtube-channel-videos-sq" component={S_youtube_channel_videos} durationInFrames={375} fps={25} width={1080} height={1080} />
      <Composition id="macbook-pro-reviews" component={S_macbook_pro_reviews} durationInFrames={375} fps={25} width={1920} height={1080} />
      <Composition id="macbook-pro-reviews-sq" component={S_macbook_pro_reviews} durationInFrames={375} fps={25} width={1080} height={1080} />
  </>
);
registerRoot(Root);
