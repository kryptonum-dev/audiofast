import type { PortableTextTypeComponentProps } from "@portabletext/react";

import type { SanityRawImage } from "../../shared/Image";
import { Slider } from "./Slider";

type ImageSliderValue = {
  _type: "ptImageSlider";
  _key: string;
  images?: SanityRawImage[];
};

export function ImageSliderComponent({
  value,
}: PortableTextTypeComponentProps<ImageSliderValue>) {
  const { images } = value;

  if (!images || images.length === 0) return null;

  return <Slider images={images} />;
}
