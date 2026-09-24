import { useState, useEffect, useRef, useCallback } from "react";
import { UserRole } from "../types";

export const DATA_SAVER_TIMEOUT_MS = 7 * 60 * 1000; // 7 minutos para modo de economia
export const LOGOUT_TIMEOUT_MS = 15 * 60 * 1000;    // 15 minutos para logout automático

interface UseUserInactivityProps {
  currentUser: string | null;
  userRole: UserRole | null;
  dataSaverTimeoutMs?: number; // default: 7 minutes
  logoutTimeoutMs?: number;    // default: 15 minutes
  onDataSaver?: () => void;
  onAutoLogout?: () => void;
  onWakeUp?: () => void;
}

export function useUserInactivity({
  currentUser,
  userRole,
  dataSaverTimeoutMs = DATA_SAVER_TIMEOUT_MS,
  logoutTimeoutMs = LOGOUT_TIMEOUT_MS,
  onDataSaver,
  onAutoLogout,
  onWakeUp
}: UseUserInactivityProps) {
  const [isDataSaver, setIsDataSaver] = useState<boolean>(false);
  const [idleSince, setIdleSince] = useState<Date | null>(null);
  const [remainingSecondsToLogout, setRemainingSecondsToLogout] = useState<number>(
    Math.floor((logoutTimeoutMs - dataSaverTimeoutMs) / 1000)
  );

  const lastActivityRef = useRef<number>(Date.now());
  const isDataSaverRef = useRef<boolean>(false);
  const lastHeartbeatSentRef = useRef<number>(0);
  const throttleActivityTimerRef = useRef<number | null>(null);
  const hasLoggedOutRef = useRef<boolean>(false);

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
    const now = Date.now();
    lastActivityRef.current = now;
    hasLoggedOutRef.current = false;
    
    try {
      localStorage.setItem("crm_last_user_activity", String(now));
    } catch (e) {}

    if (isDataSaverRef.current) {
      isDataSaverRef.current = false;
      setIsDataSaver(false);
      setIdleSince(null);
      setRemainingSecondsToLogout(Math.floor((logoutTimeoutMs - dataSaverTimeoutMs) / 1000));
      updatePresenceBackend('active');
      if (onWakeUp) {
        onWakeUp();
      }
    }
  }, [updatePresenceBackend, onWakeUp, logoutTimeoutMs, dataSaverTimeoutMs]);

  // Record user interaction (throttled)
  const handleUserActivity = useCallback(() => {
    // If currently in data saver mode, wake up immediately on the first interaction
    if (isDataSaverRef.current) {
      wakeUp();
      return;
    }

    // Otherwise, throttle timestamp updates
    const now = Date.now();
    lastActivityRef.current = now;
    try {
      localStorage.setItem("crm_last_user_activity", String(now));
    } catch (e) {}

    // Send active heartbeat if more than 3 minutes since last heartbeat
    if (now - lastHeartbeatSentRef.current > 3 * 60 * 1000) {
      updatePresenceBackend('active');
    }
  }, [wakeUp, updatePresenceBackend]);

  // Listen for interaction events & check intervals
  useEffect(() => {
    if (!currentUser) {
      setIsDataSaver(false);
      isDataSaverRef.current = false;
      setIdleSince(null);
      hasLoggedOutRef.current = false;
      return;
    }

    hasLoggedOutRef.current = false;
    lastActivityRef.current = Date.now();
    try {
      localStorage.setItem("crm_last_user_activity", String(Date.now()));
    } catch (e) {}

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

    // Cross-tab sync: if active in another tab, update activity timestamp here
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "crm_last_user_activity" && e.newValue) {
        const remoteTime = parseInt(e.newValue, 10);
        if (!isNaN(remoteTime) && remoteTime > lastActivityRef.current) {
          lastActivityRef.current = remoteTime;
          if (isDataSaverRef.current) {
            wakeUp();
          }
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);

    // Check inactivity status every 1 second
    const intervalCheck = setInterval(() => {
      if (!currentUser || hasLoggedOutRef.current) return;

      const now = Date.now();
      const elapsed = now - lastActivityRef.current;

      // 1. Check if reached 15 minutes -> Auto-Logout
      if (elapsed >= logoutTimeoutMs) {
        hasLoggedOutRef.current = true;
        isDataSaverRef.current = false;
        setIsDataSaver(false);
        updatePresenceBackend('inactive');
        if (onAutoLogout) {
          onAutoLogout();
        }
        return;
      }

      // 2. Check if between 7 and 15 minutes -> Data Saver Mode
      if (elapsed >= dataSaverTimeoutMs) {
        const remainingSecs = Math.max(0, Math.floor((logoutTimeoutMs - elapsed) / 1000));
        setRemainingSecondsToLogout(remainingSecs);

        if (!isDataSaverRef.current) {
          isDataSaverRef.current = true;
          setIsDataSaver(true);
          setIdleSince(new Date(lastActivityRef.current));
          updatePresenceBackend('inactive');
          if (onDataSaver) {
            onDataSaver();
          }
        }
      } else {
        // Less than 7 minutes -> Normal active state
        if (isDataSaverRef.current) {
          isDataSaverRef.current = false;
          setIsDataSaver(false);
          setIdleSince(null);
          updatePresenceBackend('active');
        }
      }
    }, 1000);

    return () => {
      eventNames.forEach(evt => {
        window.removeEventListener(evt, onEvent, { capture: true });
      });
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(intervalCheck);
      if (throttleActivityTimerRef.current) {
        clearTimeout(throttleActivityTimerRef.current);
      }
    };
  }, [
    currentUser, 
    dataSaverTimeoutMs, 
    logoutTimeoutMs, 
    handleUserActivity, 
    updatePresenceBackend, 
    onDataSaver, 
    onAutoLogout,
    wakeUp
  ]);

  return {
    isDataSaver,
    isIdle: isDataSaver, // alias for backwards compatibility
    idleSince,
    remainingSecondsToLogout,
    wakeUp,
    lastActivity: lastActivityRef.current
  };
}
