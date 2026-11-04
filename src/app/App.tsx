import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Shell } from './Shell';
import { usePrefs } from './PrefsProvider';
import { HomePage } from '@/features/HomePage';

/**
 * Only the home screen ships in the first download. Every other screen is its own chunk, loaded
 * on first visit (and precached by the service worker, so it also works offline).
 */
const page = <K extends string>(load: () => Promise<Record<K, ComponentType>>, key: K) => {
  const C = lazy(() => load().then((m) => ({ default: m[key] as ComponentType })));
  return (
    <Suspense fallback={null}>
      <C />
    </Suspense>
  );
};

const Onboarding = lazy(() =>
  import('@/features/Onboarding').then((m) => ({ default: m.Onboarding })),
);

const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'pantry', element: page(() => import('@/features/pantry/PantryPage'), 'PantryPage') },
      {
        path: 'pantry/:id',
        element: page(() => import('@/features/pantry/IngredientPage'), 'IngredientPage'),
      },
      {
        path: 'recipes',
        element: page(() => import('@/features/recipes/RecipesPage'), 'RecipesPage'),
      },
      {
        path: 'recipes/new',
        element: page(() => import('@/features/recipes/RecipeFormPage'), 'RecipeFormPage'),
      },
      {
        path: 'recipes/:id',
        element: page(() => import('@/features/recipes/RecipeDetailPage'), 'RecipeDetailPage'),
      },
      {
        path: 'recipes/:id/edit',
        element: page(() => import('@/features/recipes/RecipeFormPage'), 'RecipeFormPage'),
      },
      {
        path: 'recipes/:id/cook',
        element: page(() => import('@/features/recipes/CookingPage'), 'CookingPage'),
      },
      {
        path: 'history',
        element: page(() => import('@/features/recipes/HistoryPage'), 'HistoryPage'),
      },
      {
        path: 'planner',
        element: page(() => import('@/features/planner/PlannerPage'), 'PlannerPage'),
      },
      {
        path: 'shopping',
        element: page(() => import('@/features/shopping/ShoppingPage'), 'ShoppingPage'),
      },
      {
        path: 'expiring',
        element: page(() => import('@/features/pantry/ExpiringPage'), 'ExpiringPage'),
      },
      {
        path: 'analytics',
        element: page(() => import('@/features/analytics/AnalyticsPage'), 'AnalyticsPage'),
      },
      {
        path: 'collections',
        element: page(() => import('@/features/recipes/CollectionsPage'), 'CollectionsPage'),
      },
      { path: 'settings', element: page(() => import('@/features/SettingsPage'), 'SettingsPage') },
      { path: 'privacy', element: page(() => import('@/features/PrivacyPage'), 'PrivacyPage') },
      { path: 'more', element: page(() => import('@/features/pages'), 'MorePage') },
      { path: '*', element: page(() => import('@/features/pages'), 'NotFoundPage') },
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
