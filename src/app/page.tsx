import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { LaunchIcon, MissionIcon, SystemIcon } from "@/components/ui/icons";

const STEPS = [
  {
    step: "01",
    title: "Describe the mission",
    description:
      "Put the venture's mission, audience, and constraints into a single working brief.",
    icon: MissionIcon,
  },
  {
    step: "02",
    title: "Build the venture system",
    description:
      "Research, Product, Growth, Finance, and Operations coordinate around that brief.",
    icon: SystemIcon,
  },
  {
    step: "03",
    title: "Launch the first real step",
    description:
      "Turn direction into a decision, an asset, or an experiment you can act on today.",
    icon: LaunchIcon,
  },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-16 py-4 sm:py-6">
      <section className="flex flex-col gap-5">
        <Badge variant="accent" className="w-fit">
          Venture Operating System
        </Badge>
        <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
          Turn your mission into a working venture.
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-ink-secondary sm:text-lg">
          HUSTLE.OS converts entrepreneurial intent into decisions, assets, experiments,
          and measurable progress — so a mission stops being an idea and starts being a
          system.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button href="/ventures/new" size="lg">
            Build a venture
          </Button>
          <Button href="/ventures" variant="secondary" size="lg">
            View ventures
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
          How it works
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map(({ step, title, description, icon: Icon }) => (
            <Card key={step}>
              <CardContent className="flex h-full flex-col gap-3 py-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-ink-muted">{step}</span>
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink">{title}</h3>
                  <p className="mt-1.5 text-sm text-ink-secondary">{description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
