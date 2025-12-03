import styles from "./styles.module.scss";

export default function PhoneLink({ phoneNumber }: { phoneNumber: string }) {
  return (
    <a
      href={`tel:${phoneNumber.replace(/\s/g, "")}`}
      className={styles.phoneLink}
    >
      <div>
        <PhoneIcon />
      </div>
      <span>{phoneNumber}</span>
    </a>
  );
}

const PhoneIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15 15" fill="none">
    <g clipPath="url(#a)">
      <path
        stroke="#FE0140"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={0.859}
        d="M3.417 2.454H5.75l1.167 2.917-1.459.875a6.417 6.417 0 0 0 2.917 2.916l.875-1.458 2.917 1.167v2.333A1.167 1.167 0 0 1 11 12.371a9.334 9.334 0 0 1-8.75-8.75 1.167 1.167 0 0 1 1.167-1.167Z"
      />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M.5.121h14v14H.5z" />
      </clipPath>
    </defs>
  </svg>
);
