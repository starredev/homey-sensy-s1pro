import {
  Activity,
  ArrowRight,
  BellRing,
  LayoutDashboard,
  ShieldCheck,
  SlidersHorizontal,
  SquareDashed,
  Users,
  Wind,
  Workflow,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { basePath, githubUrl } from '@/lib/shared';

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

const features: { icon: ReactNode; title: string; text: string; href: string }[] = [
  {
    icon: <Users className="size-4" />,
    title: 'Presence and people',
    text: 'Presence that stays on while you sit still, movement, and how many people are in the room.',
    href: '/docs/device',
  },
  {
    icon: <SquareDashed className="size-4" />,
    title: 'Zones',
    text: 'Draw up to three zones and an exclusion zone on a live radar map. Each zone gets its own values and flows.',
    href: '/docs/zones',
  },
  {
    icon: <Wind className="size-4" />,
    title: 'Air quality',
    text: 'Real CO₂, an air quality index with a plain-language class, VOC, temperature, humidity, light and UV.',
    href: '/docs/air-quality',
  },
  {
    icon: <LayoutDashboard className="size-4" />,
    title: 'Radar widget',
    text: 'A live top-down radar on your dashboard, showing who moves, who stands still and who is held.',
    href: '/docs/widget',
  },
  {
    icon: <Workflow className="size-4" />,
    title: 'Flows',
    text: 'Triggers, conditions and actions for the room, every zone, air quality and new firmware.',
    href: '/docs/flows',
  },
  {
    icon: <SlidersHorizontal className="size-4" />,
    title: 'Every setting',
    text: 'Detection, tracking, calibration and buzzer, kept in sync with the sensor in both directions.',
    href: '/docs/settings',
  },
];

const steps = [
  { title: 'Install', text: 'Install Sensy S1 Pro on your Homey Pro (2023) or Homey Pro mini.' },
  { title: 'Add the sensor', text: 'Homey finds the S1 Pro on your network, or add it by IP address.' },
  { title: 'Draw zones', text: 'Walk through the room and draw zones on the live radar map.' },
];

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="relative overflow-hidden border-b">
        <div className="hero-grid pointer-events-none absolute inset-0" />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.05fr_1fr] lg:py-28">
          <div className="flex flex-col items-start gap-6">
            <span className="inline-flex items-center gap-2 rounded-full border bg-fd-background px-3 py-1 text-xs font-medium text-fd-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Homey app · Python · local only
            </span>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Room presence for Homey, with the Sensy S1 Pro.
            </h1>
            <p className="max-w-xl text-lg text-fd-muted-foreground text-pretty">
              mmWave presence that sees people sitting still, zones you draw on a live radar, people counting and
              air quality. Straight from the sensor to Homey over the local ESPHome API.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/docs"
                className="inline-flex h-10 items-center gap-2 rounded-md bg-fd-primary px-5 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
              >
                Get started
                <ArrowRight className="size-4" />
              </Link>
              <a
                href={githubUrl}
                className="inline-flex h-10 items-center gap-2 rounded-md border bg-fd-background px-5 text-sm font-medium transition-colors hover:bg-fd-accent"
              >
                <GitHubIcon />
                GitHub
              </a>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-fd-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4" /> No cloud, no MQTT
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Activity className="size-4" /> Live radar
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BellRing className="size-4" /> Firmware notices
              </span>
            </div>
          </div>
          <div className="rounded-2xl border bg-fd-card p-2 shadow-sm">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="size-2 rounded-full bg-emerald-500" />
                Living room
              </div>
              <span className="rounded-full bg-fd-accent px-2.5 py-0.5 text-xs font-medium">2 present</span>
            </div>
            <img src={`${basePath}/images/radar-hero-light.svg`} alt="Live radar with zones and three people" className="block w-full dark:hidden" />
            <img src={`${basePath}/images/radar-hero-dark.svg`} alt="Live radar with zones and three people" className="hidden w-full dark:block" />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight">Everything the S1 Pro can do, in Homey</h2>
          <p className="mt-2 text-fd-muted-foreground">
            Built on homey-esphomedriver, the shared ESPHome layer for Homey, plus everything specific to the S1 Pro.
          </p>
        </div>
        <div className="grid gap-px overflow-hidden rounded-xl border bg-fd-border sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Link key={feature.title} href={feature.href} className="group flex flex-col gap-3 bg-fd-background p-6 transition-colors hover:bg-fd-accent/50">
              <span className="inline-flex size-8 items-center justify-center rounded-md border bg-fd-card">{feature.icon}</span>
              <h3 className="font-medium">{feature.title}</h3>
              <p className="text-sm text-fd-muted-foreground">{feature.text}</p>
              <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium opacity-0 transition-opacity group-hover:opacity-100">
                Read more <ArrowRight className="size-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t bg-fd-card/40">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-20 lg:grid-cols-[1fr_2fr]">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Up and running in minutes</h2>
            <p className="mt-2 text-fd-muted-foreground">No YAML, no broker, no extra hardware.</p>
            <Link href="/docs/installation" className="mt-6 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">
              Installation guide <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <ol className="grid gap-4 sm:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="rounded-xl border bg-fd-background p-5">
                <span className="font-mono text-xs text-fd-muted-foreground">0{index + 1}</span>
                <h3 className="mt-2 font-medium">{step.title}</h3>
                <p className="mt-1 text-sm text-fd-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-fd-muted-foreground sm:flex-row sm:justify-between">
          <span>MIT licence · Unofficial community project, not made or endorsed by Sensy-One.</span>
          <a href={githubUrl} className="hover:text-fd-foreground">
            starredev/homey-sensy-s1pro
          </a>
        </div>
      </footer>
    </main>
  );
}
