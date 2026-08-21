import { redirect } from 'next/navigation';

// Server-side redirect straight into the project home — no blank client frame,
// no useEffect hop (Procore-parity speed contract W-1).
export default function ProjectIndexPage({ params }: { params: { projectId: string } }) {
  redirect(`/app/projects/${params.projectId}/overview`);
}
