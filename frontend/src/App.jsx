import { AuthProvider } from './context/AuthProvider';
import { ToastProvider } from './components/ui/Toast';
import AppRouter from './routes/AppRouter';

export function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppRouter />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
