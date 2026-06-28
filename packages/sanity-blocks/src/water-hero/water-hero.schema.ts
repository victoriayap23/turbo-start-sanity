import {
  buttonsField,
  definePortableTextField,
  imageWithAltField,
} from "@workspace/sanity-blocks/internal/schema-fields";
import { Waves } from "lucide-react";
import { defineField, defineType } from "sanity";

export const waterHeroSchema = defineType({
  name: "waterHero",
  title: "Water Hero",
  icon: Waves,
  type: "object",
  fields: [
    defineField({
      name: "badge",
      type: "string",
      title: "Badge",
      description:
        "Optional badge text displayed above the title, useful for highlighting new features or promotions",
    }),
    defineField({
      name: "title",
      type: "string",
      title: "Title",
      description:
        "The main heading text for the hero section that captures attention",
    }),
    definePortableTextField(["block"], {
      name: "richText",
    }),
    imageWithAltField(),
    buttonsField,
  ],
  preview: {
    select: {
      title: "title",
    },
    prepare: ({ title }) => ({
      title,
      subtitle: "Water Hero Block",
    }),
  },
});
