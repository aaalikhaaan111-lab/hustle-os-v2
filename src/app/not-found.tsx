import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { QuestionIcon } from "@/components/ui/icons";

export default function NotFound() {
  return (
    <div className="flex flex-col gap-8">
      <EmptyState
        icon={<QuestionIcon className="h-6 w-6" />}
        title="Страница не найдена"
        description="Такой страницы не существует, или она была перемещена."
        action={<Button href="/dashboard">Вернуться на главную</Button>}
      />
    </div>
  );
}
