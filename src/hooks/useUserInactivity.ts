import { useState, useEffect, useRef, useCallback } from "react";
import { UserRole } from "../types";

interface UseUserInactivityProps {
  currentUser: string | null;
  userRole: UserRole | null;
  timeoutMs?: number; // default: 15 minutes (900,000 ms)
  onIdle?: () => void;
  onWakeUp?: () => void;
}

export function useUserInactivity({
  currentUser,
  userRole,
  timeoutMs = 15 * 60 * 1000, // 15 minutos
  onIdle,
  onWakeUp
}: UseUserInactivityProps) {
  const [isIdle, setIsIdle] = useState<boolean>(false);
  const [idleSince, setIdleSince] = useState<Date | null>(null);

  const lastActivityRef = useRef<number>(Date.now());
  const isIdleRef = useRef<boolean>(false);
  const lastHeartbeatSentRef = useRef<number>(0);
  const throttleActivityTimerRef = useRef<number | null>(null);

  // Send presence status to backend
  const updatePresenceBackend = useCallback(async (status: 'active' | 'inactive') => {
    if (!currentUser) return;
    try {
      await fetch("/api/users/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: currentUser,
          role: userRole || 'editor',
          status
        })
      });
      lastHeartbeatSentRef.current = Date.now();
    } catch (e) {
      // Non-critical network error
    }
  }, [currentUser, userRole]);

  // Wake up session immediately on any user action
  const wakeUp = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (isIdleRef.current) {
      isIdleRef.current = false;
      setIsIdle(false);
      setIdleSince(null);
      updatePresenceBackend('active');
      if (onWakeUp) {
        onWakeUp();
      }
    }
  }, [updatePresenceBackend, onWakeUp]);

  // Record user interaction (throttled)
  const handleUserActivity = useCallback(() => {
    // If currently idle, wake up immediately on the first interaction
    if (isIdleRef.current) {
      wakeUp();
      return;
    }

    // Otherwise, throttle timestamp updates
    const now = Date.now();
    lastActivityRef.current = now;

    // Send active heartbeat if more than 3 minutes since last heartbeat
    if (now - lastHeartbeatSentRef.current > 3 * 60 * 1000) {
      updatePresenceBackend('active');
    }
  }, [wakeUp, updatePresenceBackend]);

  // Listen for interaction events
  useEffect(() => {
    if (!currentUser) {
      setIsIdle(false);
      isIdleRef.current = false;
      setIdleSince(null);
      return;
    }

    // Initial presence notification
    updatePresenceBackend('active');

    const eventNames = ['mousedown', 'click', 'keydown', 'touchstart', 'scroll', 'wheel'];

    const onEvent = () => {
      if (throttleActivityTimerRef.current) return;
      handleUserActivity();
      throttleActivityTimerRef.current = window.setTimeout(() => {
        throttleActivityTimerRef.current = null;
      }, 500);
    };

    eventNames.forEach(evt => {
      window.addEventListener(evt, onEvent, { passive: true, capture: true });
    });

    // Check inactivity status every 5 seconds
    const intervalCheck = setInterval(() => {
      if (!currentUser) return;
      const now = Date.now();
      const elapsed = now - lastActivityRef.current;

      if (elapsed >= timeoutMs && !isIdleRef.current) {
        // Transition this user to IDLE / INACTIVE
        isIdleRef.current = true;
        setIsIdle(true);
        setIdleSince(new Date(lastActivityRef.current));
        updatePresenceBackend('inactive');
        if (onIdle) {
          onIdle();
        }
      }
    }, 5000);

    return () => {
      eventNames.forEach(evt => {
        window.removeEventListener(evt, onEvent, { capture: true });
      });
      clearInterval(intervalCheck);
      if (throttleActivityTimerRef.current) {
        clearTimeout(throttleActivityTimerRef.current);
      }
    };
  }, [currentUser, timeoutMs, handleUserActivity, updatePresenceBackend, onIdle]);

  return {
    isIdle,
    idleSince,
    wakeUp,
    lastActivity: lastActivityRef.current
  };
}
