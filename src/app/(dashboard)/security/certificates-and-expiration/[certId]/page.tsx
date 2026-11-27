import type { Metadata } from "next";

import { CertificateDetail } from "@/components/certificates/certificate-detail";

interface CertificateDetailPageProps {
  params: Promise<{ certId: string }>;
}

export async function generateMetadata({ params }: CertificateDetailPageProps): Promise<Metadata> {
  const { certId } = await params;
  return { title: `${certId} | Certificates & Expiration` };
}

export default async function CertificateDetailPage({ params }: CertificateDetailPageProps) {
  const { certId } = await params;
  return <CertificateDetail certId={certId} />;
}
