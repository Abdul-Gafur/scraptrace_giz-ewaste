import { UserRoleSchema } from "@scraptrace/contracts";

import {
  SectionPlaceholder,
  sectionMetadata,
  sectionParams,
} from "@/components/layout/section-placeholder";

const role = UserRoleSchema.enum.programme_reviewer;

export const dynamicParams = false;

export const generateStaticParams = () => sectionParams(role);

export const generateMetadata = ({
  params,
}: {
  params: Promise<{ locale: string; section: string }>;
}) => sectionMetadata(role, params);

export default function Page({ params }: { params: Promise<{ locale: string; section: string }> }) {
  return <SectionPlaceholder params={params} role={role} />;
}
