export type BillableTradeOption = {
  trade: string;
  clients: { id: string; name: string }[];
};

export type BillableTradeChoice = {
  trade: string;
  label: string;
};

export function billableTradeChoices(
  trades: BillableTradeOption[],
  clientId: string | null | undefined,
): BillableTradeChoice[] {
  const scoped = clientId
    ? trades.filter((item) => item.clients.some((client) => client.id === clientId))
    : [];

  if (clientId && scoped.length > 0) {
    return scoped.map((item) => ({ trade: item.trade, label: item.trade }));
  }

  return trades.map((item) => {
    const names = [...item.clients]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((client) => client.name);
    return {
      trade: item.trade,
      label: `${item.trade} · ${names.join(", ")}`,
    };
  });
}
