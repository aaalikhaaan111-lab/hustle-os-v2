import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { TaskDetailForm } from "@/components/build/TaskDetailForm";
import { ALL_LESSONS } from "@/constants/courses";
import { pick } from "@/i18n/content";
import type { TaskReview } from "@/lib/build/types";

interface TaskDetailPageProps {
  params: Promise<{ taskId: string }>;
}

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  const { taskId } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    redirect("/login");
  }

  const { data: task } = await supabase
    .from("project_tasks")
    .select("*")
    .eq("id", taskId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!task) {
    notFound();
  }

  const { data: output } = await supabase
    .from("project_outputs")
    .select("content")
    .eq("task_id", taskId)
    .maybeSingle();

  const t = await getTranslations("build");
  const locale = await getLocale();

  const recommendedLesson = task.recommended_lesson_id
    ? ALL_LESSONS.find((lesson) => lesson.id === task.recommended_lesson_id)
    : undefined;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={t("taskEyebrow")} title={task.title} description={task.objective} />
      <TaskDetailForm
        task={task}
        existingAnswer={output?.content ?? ""}
        recommendedLessonTitle={recommendedLesson ? pick(recommendedLesson.title, locale) : null}
        initialReview={(task.review as TaskReview | null) ?? null}
      />
    </div>
  );
}
