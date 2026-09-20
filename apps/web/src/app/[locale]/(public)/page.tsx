import { ArrowRight, CloudSun, FileCheck2, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

export default async function HomePage() {
  const translate = await getTranslations("public");
  const principles = [
    { key: "principleOne", icon: CloudSun },
    { key: "principleTwo", icon: FileCheck2 },
    { key: "principleThree", icon: ShieldCheck },
  ] as const;
  return (
    <div className="content-container py-14 sm:py-20 lg:py-28">
      <section className="grid items-end gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <div className="max-w-3xl space-y-7">
          <h1 className="text-4xl leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-5xl lg:text-6xl">
            {translate("title")}
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-[var(--color-text-secondary)]">
            {translate("description")}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link className={cn(buttonVariants({ size: "large" }))} href="/collector">
              {translate("collectorAction")}
              <ArrowRight aria-hidden="true" className="size-4 rtl:rotate-180" />
            </Link>
            <Link
              className={cn(buttonVariants({ variant: "secondary", size: "large" }))}
              href="/recycler"
            >
              {translate("operationsAction")}
            </Link>
          </div>
        </div>
        <ul className="divide-y rounded-[var(--radius-lg)] border bg-[var(--color-surface)] px-5 shadow-[var(--shadow-raised)]">
          {principles.map(({ key, icon: Icon }) => (
            <li className="flex min-h-20 items-center gap-4 py-4" key={key}>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--color-surface-subtle)] text-[var(--color-primary)]">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <span className="font-medium">{translate(key)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
