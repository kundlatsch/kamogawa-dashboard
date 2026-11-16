import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../api/client";
import type { NotificationList } from "../api/types";
import { useNavigate } from "react-router-dom";

import { formatDate, todayISO } from "../lib/dates";

export const useNotifications = () =>
  useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get<NotificationList>("/notifications/")).data,
    refetchInterval: 60_000,
  });

export default function NotificationBell() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { data } = useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const readAll = useMutation({
    mutationFn: async () => api.post("/notifications/read-all/"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => !ref.current?.contains(event.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const unread = data?.unread ?? 0;
  return (
    <div className="relative" ref={ref}>
      <button
        aria-label={t("notifications.title")}
        onClick={() => {
          setOpen((o) => !o);
          if (!open && unread > 0) readAll.mutate();
        }}
        className="relative rounded-full p-1.5 text-xl hover:bg-rope"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-5 rounded-full bg-glove px-1 text-center text-xs font-bold">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-rope bg-canvas p-2 shadow-2xl">
          <p className="px-2 py-1 font-display text-lg tracking-wide uppercase">{t("notifications.title")}</p>
          {!data?.results.length && <p className="p-2 text-sm text-smoke">{t("notifications.empty")}</p>}
          <ul className="max-h-96 overflow-y-auto">
            {data?.results.map((notification) => {
              const session = notification.session;
              const date = session
                ? formatDate(session.date, i18n.language, { weekday: "long", day: "numeric", month: "long" })
                : "";
              const sparring = notification.kind === "SPARRING";
              const injury = notification.kind === "INJURY_REPORTED";
              return (
                <li
                  key={notification.id}
                  onClick={() => {
                    setOpen(false);
                    if (session) navigate(notificationTarget(notification.kind, session.id, session.date));
                  }}
                  className={`m-1 cursor-pointer rounded-lg p-2 text-sm hover:ring-1 hover:ring-smoke ${sparring || injury ? "border border-blood bg-blood/15" : "bg-ring"} ${
                    notification.read_at ? "" : "font-semibold"
                  }`}
                >
                  {sparring ? "🥊 " : injury ? "🤕 " : "📋 "}
                  {t(`notifications.kind.${notification.kind}`, { date, name: notification.subject?.display_name })}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Coaches go to the class on the board; students to today's routine or their upcoming classes. */
export function notificationTarget(kind: string, sessionId: number, date: string): string {
  if (kind === "INJURY_REPORTED") return `/?session=${sessionId}`;
  return date === todayISO() ? "/" : "/upcoming";
}
