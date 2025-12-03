import styles from "./styles.module.scss";

type Props = {
  _createdAt?: string;
  date?: string;
};

export default function DateBox({ _createdAt, date }: Props) {
  const dateToUse = date || _createdAt || "";
  const formattedDate = new Date(dateToUse).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <span className={styles.dateBox}>
      <CalendarIcon />
      <time dateTime={dateToUse}>{formattedDate}</time>
    </span>
  );
}

const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={17} fill="none">
    <g
      stroke="#000"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={0.875}
      clipPath="url(#a)"
    >
      <path d="M2.666 5.288a1.333 1.333 0 0 1 1.333-1.334h8a1.333 1.333 0 0 1 1.334 1.334v8a1.333 1.333 0 0 1-1.334 1.333H4a1.333 1.333 0 0 1-1.333-1.333v-8ZM10.669 2.62v2.667M5.332 2.62v2.667M2.666 7.955h10.667" />
      <path d="M5.332 10.62h1.333v1.334H5.332v-1.333Z" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 .62h16v16H0z" />
      </clipPath>
    </defs>
  </svg>
);
