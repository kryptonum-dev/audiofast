import styles from "./styles.module.scss";

export function YoutubeVideoSkeleton() {
  return (
    <div className={styles.youtubeVideo}>
      <div className={styles.skeletonContainer}>
        <div className={styles.skeletonThumbnail} />
        <div className={styles.skeletonTitleOverlay} />
        <div className={styles.skeletonPlayButton} />
      </div>
    </div>
  );
}
