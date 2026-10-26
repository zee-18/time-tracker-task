import { useRateLimit } from "../api/rateLimit";

export function RateLimitBanner() {
  const { isWaiting, secondsLeft } = useRateLimit();

  if (!isWaiting) {
    return null;
  }

  return (
    <p
      className="rate-limit-banner"
      role="status"
      aria-live="polite"
    >
      Too many requests. Retrying in {secondsLeft} seconds.
    </p>
  );
}

export default RateLimitBanner;
