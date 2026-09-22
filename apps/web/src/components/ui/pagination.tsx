"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "./button";

interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  const translate = useTranslations("pagination");
  return (
    <nav aria-label={translate("label")} className="flex items-center justify-between gap-3">
      <Button disabled={page <= 1} onClick={() => onPageChange(page - 1)} variant="secondary">
        <ChevronLeft aria-hidden="true" className="size-4 rtl:rotate-180" />
        {translate("previous")}
      </Button>
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {translate("pageOf", { page, total: pageCount })}
      </p>
      <Button
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
        variant="secondary"
      >
        {translate("next")}
        <ChevronRight aria-hidden="true" className="size-4 rtl:rotate-180" />
      </Button>
    </nav>
  );
}
