import type { PagebuilderType } from "@/src/global/types";

import PortableText from "../../portableText";
import Image from "../../shared/Image";
import styles from "./styles.module.scss";

type BlurLinesTextImageProps = PagebuilderType<"blurLinesTextImage"> & {
  index: number;
};

export default function BlurLinesTextImage({
  heading,
  description,
  image,
  index,
}: BlurLinesTextImageProps) {
  return (
    <section className={`${styles.blurLinesTextImage} max-width`}>
      <header className={styles.header}>
        <PortableText
          value={heading}
          headingLevel={index === 0 ? "h1" : "h2"}
          className={styles.heading}
        />
        <PortableText
          value={description}
          enablePortableTextStyles
          className={styles.description}
        />
      </header>
      <Image
        image={image}
        sizes="(max-width: 37.4375rem) 94vw, (max-width: 47.9375rem) 80vw, (max-width: 56.1875rem) 608px, (max-width: 82.375rem) 50vw, 600px"
      />
      <Line1 />
      <Line2 />
      <Line3 />
      <Line1 />
      <Line2 />
      <Line3 />
    </section>
  );
}

const Line1 = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1366 254" fill="none">
    <path
      stroke="#FFABA7"
      d="M-108.75 252.843c5.125-5.124 111.424-66.465 220.368-128.692C219.47 62.548 347.327 46.358 467.301 78.505l7.046 1.888a446.288 446.288 0 0 0 231.017 0l171.364-45.917c47.971-12.854 99.155.861 134.272 35.978 35.12 35.117 86.3 48.832 134.27 35.978L1538.75 1"
    />
  </svg>
);

const Line2 = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1366 183" fill="none">
    <path
      stroke="#FE0140"
      d="M-52 182.5c5.245-2.098 260.482-70.223 435.416-116.797a269.591 269.591 0 0 1 139.144.121l67.021 17.958c51.62 13.832 106.698-.926 144.486-38.715C771.856 7.28 826.934-7.479 878.554 6.352l139.276 37.32c44 11.79 90.34 11.79 134.34 0a259.5 259.5 0 0 1 196.92 25.925L1482 146.332"
    />
  </svg>
);

const Line3 = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1366 183" fill="none">
    <path
      stroke="#EED8D7"
      d="M1482 182.5c-5.24-2.098-260.48-70.223-435.42-116.797a269.576 269.576 0 0 0-139.14.121l-67.021 17.958c-51.62 13.832-106.698-.926-144.486-38.715C658.144 7.28 603.066-7.479 551.446 6.352l-139.278 37.32a259.518 259.518 0 0 1-134.336 0A259.516 259.516 0 0 0 80.907 69.597L-52 146.332"
    />
  </svg>
);
