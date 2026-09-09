import { redirect } from "next/navigation";

export default async function ObsDashboardRedirect(
  props: { params: Promise<{ handle: string }> }
) {
  const { handle } = await props.params;
  redirect(`/stream/${encodeURIComponent(handle)}`);
}
