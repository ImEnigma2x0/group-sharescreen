import { redirect } from "next/navigation";

export default async function ObsStreamRedirect(
  props: {
    params: Promise<{ handle: string; slug: string[] }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  }
) {
  const { handle, slug } = await props.params;
  const searchParams = await props.searchParams;
  const slugPath = slug.map(encodeURIComponent).join("/");
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      query.set(key, value);
    } else if (Array.isArray(value)) {
      for (const v of value) query.append(key, v);
    }
  }
  const queryString = query.toString();
  redirect(`/stream/${encodeURIComponent(handle)}/${slugPath}${queryString ? `?${queryString}` : ""}`);
}
