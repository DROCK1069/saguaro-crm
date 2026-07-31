import { redirect } from 'next/navigation'

// The legacy /portals/subcontractor/[token] portal duplicated the working
// /portals/sub/[token] portal but called /api/portals/subcontractor/* routes
// that never existed (every action 404'd). It is consolidated onto the
// canonical, fully-wired sub portal at /portals/sub/[token] (backed by
// /api/portal/sub/*). The landing /portals/subcontractor already redirects to
// /portals/sub, so this keeps any deep-linked token URLs working too.
export default async function SubcontractorTokenRedirect({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  redirect(`/portals/sub/${token}`)
}
