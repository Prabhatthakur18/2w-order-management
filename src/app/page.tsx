import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { landingFor } from "@/lib/roles";

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  redirect(landingFor(session.user.roles ?? []));
}
