import type { ButtonProps } from "@workspace/sanity-blocks/internal/sanity-buttons";
import type { SanityImageData } from "@workspace/sanity-blocks/internal/sanity-image";
import type { RichTextValue } from "@workspace/sanity-blocks/internal/rich-text";

export interface WaterHeroBlockProps {
  badge?: string | null;
  buttons?: ButtonProps[] | null;
  image?: SanityImageData | null;
  richText?: RichTextValue;
  title?: string | null;
}

export function WaterHeroBlock(props: Readonly<WaterHeroBlockProps>) {
  // This is a placeholder — the real water animation is rendered
  // directly in the page via WaterHeroClient to keep canvas logic
  // out of the shared package. This component intentionally returns
  // null so the page-level component takes over.
  return null;
}
