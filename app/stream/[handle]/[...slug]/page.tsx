import type { Metadata } from "next";
import { StreamViewer } from "./StreamViewer";

export const metadata: Metadata = {
  title: "GoLive · Fonte de Transmissão",
  robots: { index: false, follow: false },
};

export default async function StreamPage(
  props: { params: Promise<{ handle: string; slug: string[] }> }
) {
  const { handle, slug } = await props.params;
  return <StreamViewer handle={handle} slug={slug} />;
}

