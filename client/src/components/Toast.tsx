import { useEffect, useRef } from "react";

interface ToastProps {
  message: string;
  onClose: () => void;
}

export function Toast({ message, onClose }: ToastProps) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onCloseRef.current();
    }, 5_000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [message]);

  return (
    <div className="toast" role="status" aria-live="polite">
      <span className="toast-message">{message}</span>
      <button
        type="button"
        className="toast-close"
        aria-label="Close notification"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
}

export default Toast;
