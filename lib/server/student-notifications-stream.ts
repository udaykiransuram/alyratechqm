type StudentNotificationEvent = {
  event: "notification.created";
  payload: {
    id: string;
    type: string;
    signalVersion?: number | null;
  };
};

type StudentNotificationListener = (event: StudentNotificationEvent) => void;

const studentNotificationListeners = new Map<
  string,
  Set<StudentNotificationListener>
>();

function buildStudentNotificationListenerKey(
  schoolKey: string,
  studentId: string,
) {
  return `${String(schoolKey || "").trim()}::${String(studentId || "").trim()}`;
}

export function subscribeStudentNotifications(
  schoolKey: string,
  studentId: string,
  listener: StudentNotificationListener,
) {
  const listenerKey = buildStudentNotificationListenerKey(schoolKey, studentId);
  if (!listenerKey || listenerKey === "::") {
    return () => undefined;
  }

  let listeners = studentNotificationListeners.get(listenerKey);
  if (!listeners) {
    listeners = new Set();
    studentNotificationListeners.set(listenerKey, listeners);
  }
  listeners.add(listener);

  return () => {
    const set = studentNotificationListeners.get(listenerKey);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) {
      studentNotificationListeners.delete(listenerKey);
    }
  };
}

export function broadcastStudentNotification(
  schoolKey: string,
  studentId: string,
  payload: StudentNotificationEvent["payload"],
) {
  const listenerKey = buildStudentNotificationListenerKey(schoolKey, studentId);
  if (!listenerKey || listenerKey === "::") return;

  const listeners = studentNotificationListeners.get(listenerKey);
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
