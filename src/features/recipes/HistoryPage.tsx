import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { History, Star } from 'lucide-react';
import { db } from '@/data/db';
import { Card, EmptyState, LinkButton, PageHeader } from '@/design/ui';
import { formatQuantity } from '@/domain/units';

export function HistoryPage() {
  const data = useLiveQuery(async () => {
    const [sessions, recipes, ingredients] = await Promise.all([
      db.cookingSessions.filter((s) => s.status === 'completed').toArray(),
      db.recipes.toArray(),
      db.ingredients.toArray(),
    ]);
    return {
      sessions: sessions.sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0)),
      recipes: new Map(recipes.map((r) => [r.id, r])),
      ingredients: new Map(ingredients.map((i) => [i.id, i])),
    };
  }, []);

  return (
    <>
      <PageHeader
        title="Cooking history"
        subtitle="Meals you finished cooking, newest first."
        back="/recipes"
      />
      {data && data.sessions.length === 0 && (
        <Card>
          <EmptyState
            art={<History aria-hidden className="size-full text-accent-bright" />}
            title="Nothing cooked yet"
            body="When you finish a recipe in Cooking Mode it is recorded here, along with what you used."
            action={<LinkButton to="/recipes">Browse recipes</LinkButton>}
          />
        </Card>
      )}
      {data && data.sessions.length > 0 && (
        <ol className="grid gap-3">
          {data.sessions.map((s) => {
            const r = data.recipes.get(s.recipeId);
            const when = new Date(s.finishedAt ?? s.startedAt).toLocaleString('en', {
              dateStyle: 'medium',
              timeStyle: 'short',
            });
            return (
              <li key={s.id}>
                <Card as="article" className="grid gap-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-xl font-semibold">
                      {r ? (
                        <Link to={`/recipes/${r.id}`} className="hover:underline">
                          {r.name}
                        </Link>
                      ) : (
                        (s.recipeName ?? 'Deleted recipe')
                      )}
                    </h2>
                    <p className="text-sm text-ink-soft">
                      {when} · {s.servings} {s.servings === 1 ? 'serving' : 'servings'}
                    </p>
                  </div>
                  {s.rating && (
                    <p
                      className="flex items-center gap-0.5"
                      aria-label={`Rated ${s.rating} out of 5`}
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          aria-hidden
                          className={`size-4 ${n <= s.rating! ? 'fill-saffron text-saffron' : 'text-line'}`}
                        />
                      ))}
                    </p>
                  )}
                  {s.notes && <p className="text-ink-soft">&ldquo;{s.notes}&rdquo;</p>}
                  <p className="text-sm text-ink-soft">
                    {s.deductions?.length
                      ? `Used from pantry: ${s.deductions
                          .map(
                            (d) =>
                              `${data.ingredients.get(d.ingredientId)?.name ?? 'Ingredient'} (${formatQuantity(d.quantity, d.unit)})`,
                          )
                          .join(', ')}`
                      : 'Pantry was not changed.'}
                  </p>
                </Card>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
