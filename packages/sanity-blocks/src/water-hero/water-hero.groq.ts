import {
  buttonsFragment,
  imageFragment,
  richTextFragment,
} from "../internal/groq-fragments";

export const waterHeroGroqProjection = /* groq */ `
  _type == "waterHero" => {
    ...,
    ${imageFragment},
    ${buttonsFragment},
    ${richTextFragment}
  }
`;
