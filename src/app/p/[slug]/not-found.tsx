import Link from "next/link";
import { getLocale } from "next-intl/server";

export default async function PublicProjectNotFound() {
  const locale = await getLocale();
  const copy = locale === "ru"
    ? { title: "Проект недоступен", body: "Возможно, ссылка неверна или проект больше не опубликован.", home: "Перейти в Ventrio" }
    : { title: "Project unavailable", body: "The link may be incorrect, or this project is no longer published.", home: "Go to Ventrio" };

  return (
    <main className="public-project-unavailable">
      <div>
        <p>Ventrio</p>
        <h1>{copy.title}</h1>
        <span>{copy.body}</span>
        <Link href="/">{copy.home} <i aria-hidden>→</i></Link>
      </div>
    </main>
  );
}
