import type { Metadata } from "next";
import PlayClient from "./PlayClient";

type Props = {
  params: Promise<{ id: string }>;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function getGame(id: string) {
  try {
    const res = await fetch(`${API_URL}/api/games/${id}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) return { title: "게임을 찾을 수 없습니다" };
  return {
    title: game.title_ko || game.title,
    description: game.description_ko || game.description,
    openGraph: {
      title: game.title_ko || game.title,
      images: [game.thumbnail_url].filter(Boolean),
    },
  };
}

export default async function PlayPage({ params }: Props) {
  const { id } = await params;
  const game = await getGame(id);
  return <PlayClient game={game} />;
}
