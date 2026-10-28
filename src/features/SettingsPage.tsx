import { useState, type ChangeEvent } from 'react';
import { Download } from 'lucide-react';
import { db } from '@/data/db';
import { newId } from '@/lib/ids';
import { downscaleImage } from '@/lib/image';
import { useInstall } from '@/app/pwa';
import { usePrefs } from '@/app/PrefsProvider';
import {
  ACCENTS,
  ALLERGENS,
  BACKGROUNDS,
  CURRENCIES,
  DIETS,
  MOTION_LEVELS,
  THEMES,
  type Prefs,
} from '@/app/prefs';
import { Button, Card, Chip, Field, inputClass, PageHeader, Segmented } from '@/design/ui';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const opts = <T extends string>(xs: readonly T[]) =>
  xs.map((value) => ({ value, label: cap(value) }));

const SWATCH: Record<(typeof ACCENTS)[number], string> = {
  terracotta: '#D76543',
  sage: '#74866B',
  saffron: '#E8B95D',
  plum: '#8A4A68',
};

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="mb-4 text-xl font-semibold">{title}</h2>
      <div className="grid gap-5">{children}</div>
    </Card>
  );
}

function toggle<T>(list: readonly T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function SettingsPage() {
  const { prefs, update, reset } = usePrefs();
  const { canInstall, installed, install } = useInstall();
  const [bgError, setBgError] = useState<string>();

  const onBgFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { blob, width, height } = await downscaleImage(file);
      const id = newId();
      await db.mediaAssets.put({
        id,
        kind: 'background',
        mime: blob.type,
        width,
        height,
        blob,
        createdAt: Date.now(),
      });
      if (prefs.customBackgroundId) await db.mediaAssets.delete(prefs.customBackgroundId);
      update({ background: 'custom', customBackgroundId: id });
      setBgError(undefined);
    } catch (err) {
      setBgError(err instanceof Error ? err.message : 'Could not use that image.');
    }
  };

  const set =
    <K extends keyof Prefs>(k: K) =>
    (v: Prefs[K]) =>
      update({ [k]: v } as Partial<Prefs>);

  return (
    <>
      <PageHeader title="Settings" subtitle="Saved on this device only." back="/more" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Group title="Profile">
          <Field label="Your name">
            {(id) => (
              <input
                id={id}
                className={inputClass}
                maxLength={40}
                value={prefs.name}
                onChange={(e) => update({ name: e.target.value })}
                placeholder="Optional"
                autoComplete="off"
              />
            )}
          </Field>
          <Field label="Household size" hint="Used as the default number of servings.">
            {(id) => (
              <input
                id={id}
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                className={inputClass}
                value={prefs.household ?? ''}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  update({
                    household: e.target.value && n >= 1 && n <= 20 ? Math.round(n) : undefined,
                  });
                }}
              />
            )}
          </Field>
        </Group>

        <Group title="Appearance">
          <div className="grid gap-2">
            <span className="text-sm font-semibold">Theme</span>
            <Segmented
              label="Theme"
              value={prefs.theme}
              options={opts(THEMES)}
              onChange={set('theme')}
            />
          </div>
          <div className="grid gap-2">
            <span className="text-sm font-semibold">Accent colour</span>
            <div role="radiogroup" aria-label="Accent colour" className="flex flex-wrap gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  role="radio"
                  aria-checked={prefs.accent === a}
                  onClick={() => update({ accent: a })}
                  className={`flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium ${prefs.accent === a ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
                >
                  <span
                    aria-hidden
                    className="size-4 rounded-full"
                    style={{ background: SWATCH[a] }}
                  />
                  {cap(a)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <span className="text-sm font-semibold">Background</span>
            <Segmented
              label="Background"
              value={prefs.background}
              options={BACKGROUNDS.map((b) => ({
                value: b,
                label: b === 'solid' ? 'Cream' : b === 'kitchen' ? 'Kitchen' : cap(b),
              }))}
              onChange={set('background')}
            />
          </div>
          <Field label="Custom background photo" hint="Stays on this device. Resized to fit.">
            {(id) => (
              <input
                id={id}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onBgFile}
                className={inputClass + ' py-2.5'}
              />
            )}
          </Field>
          {bgError && (
            <p role="alert" className="text-sm text-bad">
              {bgError}
            </p>
          )}
          {prefs.background === 'custom' && prefs.customBackgroundId && (
            <div className="grid gap-4">
              {(
                [
                  ['bgDim', 'Dim', 0, 80],
                  ['bgBlur', 'Blur', 0, 20],
                  ['bgContrast', 'Contrast', 70, 130],
                ] as const
              ).map(([k, label, min, max]) => (
                <Field key={k} label={`${label}: ${prefs[k]}`}>
                  {(id) => (
                    <input
                      id={id}
                      type="range"
                      min={min}
                      max={max}
                      value={prefs[k]}
                      onChange={(e) => update({ [k]: Number(e.target.value) })}
                      className="h-11 w-full accent-[var(--accent)]"
                    />
                  )}
                </Field>
              ))}
            </div>
          )}
          <div className="grid gap-2">
            <span className="text-sm font-semibold">Motion</span>
            <Segmented
              label="Motion"
              value={prefs.motion}
              options={opts(MOTION_LEVELS)}
              onChange={set('motion')}
            />
            <p className="text-sm text-ink-soft">
              Low turns animations off. Your system&apos;s reduce-motion setting is always
              respected.
            </p>
          </div>
        </Group>

        <Group title="Units & money">
          <div className="grid gap-2">
            <span className="text-sm font-semibold">Measurements</span>
            <Segmented
              label="Measurements"
              value={prefs.units}
              options={opts(['metric', 'imperial'] as const)}
              onChange={set('units')}
            />
          </div>
          <Field label="Currency" hint="Prices are your own estimates, never live store prices.">
            {(id) => (
              <select
                id={id}
                className={inputClass}
                value={prefs.currency}
                onChange={(e) => update({ currency: e.target.value as Prefs['currency'] })}
              >
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            )}
          </Field>
          <div className="grid gap-2">
            <span className="text-sm font-semibold">Week starts on</span>
            <Segmented
              label="Week starts on"
              value={prefs.weekStart}
              options={opts(['monday', 'sunday'] as const)}
              onChange={set('weekStart')}
            />
          </div>
        </Group>

        <Group title="Food preferences">
          <div className="grid gap-2">
            <span className="text-sm font-semibold">Diets</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Diets">
              {DIETS.map((d) => (
                <Chip
                  key={d}
                  selected={prefs.diets.includes(d)}
                  onClick={() => update({ diets: toggle(prefs.diets, d) })}
                >
                  {cap(d)}
                </Chip>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <span className="text-sm font-semibold">Allergens to flag</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Allergens">
              {ALLERGENS.map((a) => (
                <Chip
                  key={a}
                  selected={prefs.allergens.includes(a)}
                  onClick={() => update({ allergens: toggle(prefs.allergens, a) })}
                >
                  {cap(a)}
                </Chip>
              ))}
            </div>
            <p className="text-sm text-ink-soft">
              Warnings are informational and depend on the ingredient data you enter. They are not
              medical or safety advice.
            </p>
          </div>
        </Group>

        <Group title="Sample content">
          <p className="text-sm text-ink-soft">
            Shows illustrative recipes, expiring items and a meal plan, clearly labelled SAMPLE, so
            you can preview the app. It is not stored and never counted as your data.
          </p>
          <Chip
            selected={prefs.sampleContent}
            onClick={() => update({ sampleContent: !prefs.sampleContent })}
          >
            {prefs.sampleContent ? 'Sample content: on' : 'Sample content: off'}
          </Chip>
        </Group>

        <Group title="App & data">
          {installed ? (
            <p className="text-ink-soft">PantryPal is installed on this device.</p>
          ) : canInstall ? (
            <Button onClick={install}>
              <Download aria-hidden className="size-4" />
              Install PantryPal
            </Button>
          ) : (
            <p className="text-ink-soft">
              Install is offered by your browser when available (for example via the browser menu →
              Install app).
            </p>
          )}
          <p className="text-sm text-ink-soft">
            Your data lives only in this browser. There is no account and no sync, and the browser
            or OS can clear it. Backup and restore are planned for a later release.
          </p>
          <Button
            variant="ghost"
            onClick={() => {
              reset();
            }}
          >
            Reset preferences
          </Button>
        </Group>
      </div>
    </>
  );
}
