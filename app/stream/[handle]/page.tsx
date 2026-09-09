import type { Metadata } from "next";
import { StreamRoomDashboard } from "./StreamRoomDashboard";

export async function generateMetadata(
  props: { params: Promise<{ handle: string }> }
): Promise<Metadata> {
  const { handle } = await props.params;
  return {
    title: `Fontes de Transmissão · Sala ${handle}`,
    description: `Exportar transmissões da sala ${handle} para softwares de transmissão.`,
    robots: { index: false, follow: false },
  };
}

export default async function StreamDashboardPage(
  props: { params: Promise<{ handle: string }> }
) {
  const { handle } = await props.params;
  return <StreamRoomDashboard handle={handle} />;
}

