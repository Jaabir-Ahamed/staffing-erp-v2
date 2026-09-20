import Link from "next/link";

export type MetricTone = "primary" | "warning" | "success" | "danger";

export type MetricItem = {
  label: string;
  value: string | number;
  tone: MetricTone;
  href?: string;
};

export function MetricCards({ items }: { items: MetricItem[] }) {
  return (
    <div
      className={
        items.length <= 3
          ? "grid grid-cols-1 gap-3 sm:grid-cols-3"
          : "grid grid-cols-2 gap-3 lg:grid-cols-4"
      }
    >
      {items.map((item) => {
        const inner = (
          <>
            <p className="type-meta">{item.label}</p>
            <p className="metric-value">{item.value}</p>
          </>
        );
        if (item.href) {
          return (
            <Link key={item.label} href={item.href} className="metric-card" data-tone={item.tone}>
              {inner}
            </Link>
          );
        }
        return (
          <div key={item.label} className="metric-card" data-tone={item.tone}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
