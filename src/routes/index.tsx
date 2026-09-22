import { createFileRoute } from "@tanstack/react-router";
import { VectorFang } from "@/components/VectorFang";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <VectorFang />;
}
