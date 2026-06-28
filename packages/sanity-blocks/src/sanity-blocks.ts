import { ctaSchema } from "./cta/cta.schema";
import { faqAccordionSchema } from "./faq-accordion/faq-accordion.schema";
import { featureCardsIconSchema } from "./feature-cards-icon/feature-cards-icon.schema";
import { heroSchema } from "./hero/hero.schema";
import { imageLinkCardsSchema } from "./image-link-cards/image-link-cards.schema";
import { richTextBlockSchema } from "./rich-text-block/rich-text-block.schema";
import { subscribeNewsletterSchema } from "./subscribe-newsletter/subscribe-newsletter.schema";
import { waterHeroSchema } from "./water-hero/water-hero.schema";

export { ctaSchema } from "./cta/cta.schema";
export { faqAccordionSchema } from "./faq-accordion/faq-accordion.schema";
export { featureCardsIconSchema } from "./feature-cards-icon/feature-cards-icon.schema";
export { heroSchema } from "./hero/hero.schema";
export { imageLinkCardsSchema } from "./image-link-cards/image-link-cards.schema";
export { richTextBlockSchema } from "./rich-text-block/rich-text-block.schema";
export { subscribeNewsletterSchema } from "./subscribe-newsletter/subscribe-newsletter.schema";
export { waterHeroSchema } from "./water-hero/water-hero.schema";
export { WaterHeroBlock } from "./water-hero/index";

export const blockSchemas = [
  heroSchema,
  waterHeroSchema,
  ctaSchema,
  featureCardsIconSchema,
  faqAccordionSchema,
  imageLinkCardsSchema,
  richTextBlockSchema,
  subscribeNewsletterSchema,
];
