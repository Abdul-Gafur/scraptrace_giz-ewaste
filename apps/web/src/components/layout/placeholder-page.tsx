import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <section className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
        <p className="max-w-prose leading-7 text-[var(--color-text-secondary)]">{description}</p>
      </div>
      <Card>
        <CardHeader>
          <div className="h-2 w-20 rounded-full bg-[var(--color-primary)]" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="h-20 rounded-md bg-[var(--color-surface-subtle)]" aria-hidden="true" />
        </CardContent>
      </Card>
    </section>
  );
}
