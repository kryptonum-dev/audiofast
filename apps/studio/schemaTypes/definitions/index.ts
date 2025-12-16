import { ptArrowList } from "../portableText/arrow-list";
import { ptButton } from "../portableText/button";
import { ptCircleNumberedList } from "../portableText/circle-numbered-list";
import { ptCtaSection } from "../portableText/cta-section";
import { ptFeaturedProducts } from "../portableText/featured-products";
import { ptHeading } from "../portableText/heading";
import { ptHorizontalLine } from "../portableText/horizontal-line";
import { ptImage } from "../portableText/image";
import { ptImageSlider } from "../portableText/image-slider";
import { ptInlineImage } from "../portableText/inline-image";
import { ptMinimalImage } from "../portableText/minimal-image";
import { ptPageBreak } from "../portableText/page-break";
import { ptQuote } from "../portableText/quote";
import { ptReviewEmbed } from "../portableText/review-embed";
import { ptTwoColumnTable } from "../portableText/two-column-table";
import { ptVimeoVideo } from "../portableText/vimeo-video";
import { ptYoutubeVideo } from "../portableText/youtube-video";
import { button, buttonWithNoVariant } from "./button";
import {
  contentBlockHorizontalLine,
  contentBlockText,
  contentBlockVimeo,
  contentBlockYoutube,
} from "./content-blocks";
import { customUrl } from "./custom-url";
import { formState } from "./form-state";
import { cpoPageBuilder, pageBuilder } from "./pagebuilder";

export const definitions = [
  customUrl,
  button,
  buttonWithNoVariant,
  pageBuilder,
  cpoPageBuilder,
  formState,
  ptImage,
  ptMinimalImage,
  ptInlineImage,
  ptImageSlider,
  ptArrowList,
  ptCircleNumberedList,
  ptCtaSection,
  ptTwoColumnTable,
  ptFeaturedProducts,
  ptQuote,
  ptButton,
  ptHeading,
  ptYoutubeVideo,
  ptVimeoVideo,
  ptPageBreak,
  ptHorizontalLine,
  ptReviewEmbed,
  contentBlockText,
  contentBlockYoutube,
  contentBlockVimeo,
  contentBlockHorizontalLine,
];
