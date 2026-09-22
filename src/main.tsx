import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router';
import { MainLayout, Shell } from './components/Layout';
import { ToastProvider } from './components/toast';
import { QuestionsProvider } from './lib/questions';
import { watchTheme } from './lib/settings';
import Home from './pages/Home';
import Questions from './pages/Questions';
import Quiz from './pages/Quiz';
import Results from './pages/Results';
import SettingsPage from './pages/Settings';
import Stats from './pages/Stats';
import './index.css';

const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      {
        element: <MainLayout />,
        children: [
          { index: true, element: <Home /> },
          { path: 'questions', element: <Questions /> },
          { path: 'stats', element: <Stats /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'results', element: <Results /> },
        ],
      },
      { path: 'quiz', element: <Quiz /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

watchTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <QuestionsProvider>
        <RouterProvider router={router} />
      </QuestionsProvider>
    </ToastProvider>
  </StrictMode>,
);

// Offline support: cache the app and the question files after the first visit.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(e => console.warn('Service worker not registered', e));
  });
}
