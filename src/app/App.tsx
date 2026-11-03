import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Shell } from './Shell';
import { usePrefs } from './PrefsProvider';
import { HomePage } from '@/features/HomePage';
import { ExpiringPage } from '@/features/pantry/ExpiringPage';
import { IngredientPage } from '@/features/pantry/IngredientPage';
import { PantryPage } from '@/features/pantry/PantryPage';
import {
  AnalyticsPage,
  CollectionsPage,
  MorePage,
  NotFoundPage,
  PlannerPage,
  RecipeDetailPage,
  RecipesPage,
  ShoppingPage,
} from '@/features/pages';

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
      { path: 'recipes/:id', element: <RecipeDetailPage /> },
      { path: 'planner', element: <PlannerPage /> },
      { path: 'shopping', element: <ShoppingPage /> },
      { path: 'expiring', element: <ExpiringPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'collections', element: <CollectionsPage /> },
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
