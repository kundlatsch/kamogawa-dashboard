import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { api } from "../../api/client";
import { Button } from "../../components/ui";
import AccountsPage from "../coach/AccountsPage";
import { useGyms } from "./GymsPage";

export default function GymDetailPage() {
  const { t } = useTranslation();
  const { gymId } = useParams();
  const queryClient = useQueryClient();
  const { data: gyms = [], isLoading } = useGyms();
  const gym = gyms.find((g) => String(g.id) === gymId);

  const toggleActive = useMutation({
    mutationFn: async () =>
      gym!.is_active ? api.delete(`/gyms/${gym!.id}/`) : api.patch(`/gyms/${gym!.id}/`, { is_active: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gyms"] }),
  });

  if (isLoading) return <p className="text-smoke">{t("common.loading")}</p>;
  if (!gym) return <p className="text-smoke">{t("gyms.notFound")}</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/" className="text-sm text-smoke hover:text-chalk">
          ‹ {t("gyms.title")}
        </Link>
        <span className="ml-auto text-sm text-smoke">
          {t("gyms.coachCount", { count: gym.coach_count })} · {t("gyms.studentCount", { count: gym.student_count })}
        </span>
        <Button
          variant={gym.is_active ? "danger" : "ghost"}
          onClick={() => {
            if (!gym.is_active || window.confirm(t("gyms.confirmDeactivate", { name: gym.name }))) toggleActive.mutate();
          }}
        >
          {gym.is_active ? t("gyms.deactivate") : t("gyms.reactivate")}
        </Button>
      </div>
      {!gym.is_active && <p className="rounded-lg border border-glove p-3 text-sm">{t("gyms.inactiveHint")}</p>}
      <AccountsPage kind="coaches" endpoint={`/gyms/${gym.id}/coaches/`} title={`${gym.name}: ${t("accounts.coaches.title")}`} />
    </div>
  );
}
