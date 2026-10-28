import { useState } from 'react';
import { Logo, Sprig } from '@/design/illustrations';
import { Button, Card, Chip, Field, inputClass, Segmented } from '@/design/ui';
import { usePrefs } from '@/app/PrefsProvider';
import { ALLERGENS, CURRENCIES, DIETS, type Prefs } from '@/app/prefs';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const toggle = <T,>(l: readonly T[], v: T) =>
  l.includes(v) ? l.filter((x) => x !== v) : [...l, v];

export function Onboarding() {
  const { prefs, update } = usePrefs();
  const [step, setStep] = useState(0);
  const finish = () => update({ onboarded: true });

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-8">
      <Card className="relative w-full max-w-xl overflow-hidden">
        <Sprig
          aria-hidden
          className="pointer-events-none absolute -right-3 -top-3 h-32 opacity-60"
        />
        <div className="flex items-center gap-3">
          <Logo className="size-12" />
          <p className="font-display text-2xl font-semibold">PantryPal</p>
        </div>
        <p className="mt-4 text-sm font-semibold text-ink-soft" aria-live="polite">
          Step {step + 1} of 3
        </p>

        {step === 0 && (
          <div className="mt-2 grid gap-4">
            <h1 className="text-3xl font-semibold">Welcome to your kitchen</h1>
            <p className="text-ink-soft">
              PantryPal keeps everything on this device. No account, no tracking, no uploads.
              Because data stays in your browser, it can be lost if browser data is cleared, so
              back-ups matter (coming in a later release).
            </p>
            <Field label="What should we call you?">
              {(id) => (
                <input
                  id={id}
                  className={inputClass}
                  value={prefs.name}
                  maxLength={40}
                  autoComplete="given-name"
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder="Optional"
                />
              )}
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="mt-2 grid gap-5">
            <h1 className="text-3xl font-semibold">Units & money</h1>
            <div className="grid gap-2">
              <span className="text-sm font-semibold">Measurements</span>
              <Segmented
                label="Measurements"
                value={prefs.units}
                options={[
                  { value: 'metric', label: 'Metric' },
                  { value: 'imperial', label: 'Imperial' },
                ]}
                onChange={(units) => update({ units })}
              />
            </div>
            <Field label="Currency">
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
                options={[
                  { value: 'monday', label: 'Monday' },
                  { value: 'sunday', label: 'Sunday' },
                ]}
                onChange={(weekStart) => update({ weekStart })}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mt-2 grid gap-5">
            <h1 className="text-3xl font-semibold">About your household</h1>
            <p className="text-ink-soft">All optional. Change any of this later in Settings.</p>
            <Field label="People in your household">
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
              <p className="text-sm text-ink-soft">Informational only. Not medical advice.</p>
            </div>
            <div className="grid gap-2">
              <span className="text-sm font-semibold">Start with</span>
              <Segmented
                label="Start with"
                value={prefs.sampleContent ? 'sample' : 'empty'}
                options={[
                  { value: 'sample', label: 'Sample content' },
                  { value: 'empty', label: 'Empty kitchen' },
                ]}
                onChange={(v) => update({ sampleContent: v === 'sample' })}
              />
              <p className="text-sm text-ink-soft">
                Sample content is illustrative, labelled SAMPLE, and can be turned off in Settings.
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={finish}>
              Skip setup
            </Button>
          )}
          {step < 2 ? (
            <Button onClick={() => setStep(step + 1)}>Next</Button>
          ) : (
            <Button onClick={finish}>Start cooking</Button>
          )}
        </div>
      </Card>
    </main>
  );
}
