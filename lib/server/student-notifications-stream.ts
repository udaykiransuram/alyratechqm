type StudentNotificationEvent = {
  event: "notification.created";
  payload: {
    id: string;
    type: string;
  };
};

type StudentNotificationListener = (event: StudentNotificationEvent) => void;

const studentNotificationListeners = new Map<string, Set<StudentNotificationListener>>();

export function subscribeStudentNotifications(
  studentId: string,
  listener: StudentNotificationListener,
) {
  const normalizedId = String(studentId || "").trim();
  if (!normalizedId) {
    return () => undefined;
  }

  let listeners = studentNotificationListeners.get(normalizedId);
  if (!listeners) {
    listeners = new Set();
    studentNotificationListeners.set(normalizedId, listeners);
  }
  listeners.add(listener);

  return () => {
    const set = studentNotificationListeners.get(normalizedId);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) {
      studentNotificationListeners.delete(normalizedId);
    }
  };
}

export function broadcastStudentNotification(
  studentId: string,
  payload: StudentNotificationEvent["payload"],
) {
  const normalizedId = String(studentId || "").trim();
  if (!normalizedId) return;

  const listeners = studentNotificationListeners.get(normalizedId);
  if (!listeners || listeners.size === 0) return;

  const event: StudentNotificationEvent = {
    event: "notification.created",
    payload,
  };

  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      console.error("Student notification SSE listener failed:", error);
    }
  }
}
