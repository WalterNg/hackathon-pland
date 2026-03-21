import { redirect } from "next/navigation";

export default function DashboardPage() {
  redirect("/portfolio?name=Main%20Portfolio");
}
