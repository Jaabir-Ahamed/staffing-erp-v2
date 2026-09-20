import { MetricCards } from "@/src/components/presentational/metric-cards";
import { ClientsBoard } from "@/src/features/clients/ui/clients-board";
import { listClientsWithRules } from "@/src/features/clients/queries";
import { requireAppUser } from "@/src/lib/auth";
import { isAdminRole } from "@/src/lib/auth";

export default async function ClientsPage() {
  const [user, clients] = await Promise.all([requireAppUser(), listClientsWithRules()]);
  const rateRules = clients.reduce((sum, client) => sum + client.rate_rules.length, 0);
  const overlapping = clients.reduce(
    (sum, client) => sum + client.rate_rules.filter((rule) => rule.overlaps).length,
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="type-page">Clients & rate rules</h1>
        <p className="type-meta mt-1">
          Overlapping windows for the same client and trade are flagged. That is why a charge can
          stay NULL without anyone guessing a rate.
        </p>
      </div>
      <MetricCards
        items={[
          { label: "Total clients", value: clients.length, tone: "primary" },
          { label: "Total rate rules", value: rateRules, tone: "primary" },
          { label: "Rules with overlap", value: overlapping, tone: "danger" },
        ]}
      />
      <ClientsBoard clients={clients} isAdmin={isAdminRole(user.role)} />
    </div>
  );
}
