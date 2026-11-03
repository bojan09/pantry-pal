import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Shell } from './Shell';
import { usePrefs } from './PrefsProvider';
import { HomePage } from '@/features/HomePage';
import { ExpiringPage } from '@/features/pantry/ExpiringPage';
import { IngredientPage } from '@/features/pantry/IngredientPage';
import { PantryPage } from '@/features/pantry/PantryPage';
import { AnalyticsPage, MorePage, NotFoundPage, PlannerPage, ShoppingPage } from '@/features/pages';
import { RecipeDetailPage } from '@/features/recipes/RecipeDetailPage';
import { RecipesPage } from '@/features/recipes/RecipesPage';

const lazyPage = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, key: K) =>
  lazy(() => load().then((m) => ({ default: m[key] })));
const CollectionsPage = lazyPage(
  () => import('@/features/recipes/CollectionsPage'),
  'CollectionsPage',
);
const CookingPage = lazyPage(() => import('@/features/recipes/CookingPage'), 'CookingPage');
const HistoryPage = lazyPage(() => import('@/features/recipes/HistoryPage'), 'HistoryPage');
const RecipeFormPage = lazyPage(
  () => import('@/features/recipes/RecipeFormPage'),
  'RecipeFormPage',
);

const SettingsPage = lazy(() =>
  import('@/features/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const Onboarding = lazy(() =>
  import('@/features/Onboarding').then((m) => ({ default: m.Onboarding })),
);

const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'pantry', element: <PantryPage /> },
      { path: 'pantry/:id', element: <IngredientPage /> },
      { path: 'recipes', element: <RecipesPage /> },
      {
        path: 'recipes/new',
        element: (
          <Suspense fallback={null}>
            <RecipeFormPage />
          </Suspense>
        ),
      },
      { path: 'recipes/:id', element: <RecipeDetailPage /> },
      {
        path: 'recipes/:id/edit',
        element: (
          <Suspense fallback={null}>
            <RecipeFormPage />
          </Suspense>
        ),
      },
      {
        path: 'recipes/:id/cook',
        element: (
          <Suspense fallback={null}>
            <CookingPage />
          </Suspense>
        ),
      },
      {
        path: 'history',
        element: (
          <Suspense fallback={null}>
            <HistoryPage />
          </Suspense>
        ),
      },
      { path: 'planner', element: <PlannerPage /> },
      { path: 'shopping', element: <ShoppingPage /> },
      { path: 'expiring', element: <ExpiringPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      {
        path: 'collections',
        element: (
          <Suspense fallback={null}>
            <CollectionsPage />
          </Suspense>
        ),
      },
      {
        path: 'settings',
        element: (
          <Suspense fallback={null}>
            <SettingsPage />
          </Suspense>
        ),
      },
      { path: 'more', element: <MorePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export function App() {
  const { prefs } = usePrefs();
  if (!prefs.onboarded) {
    return (
      <Suspense fallback={null}>
        <Onboarding />
      </Suspense>
    );
  }
  return <RouterProvider router={router} />;
}
