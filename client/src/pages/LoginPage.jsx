import { Link, useLocation } from 'react-router';
import AuthLayout from '@/components/AuthLayout.jsx';
import Button from '@/components/ui/Button.jsx';
import FormError from '@/components/FormError.jsx';
import FormField from '@/components/ui/FormField.jsx';
import { useApiForm } from '@/hooks/useApiForm.js';
import { useAuthStore } from '@/store/authStore.js';

export default function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const notice = useAuthStore((s) => s.notice);
  const location = useLocation();
  // On success the store flips to "authenticated" and GuestRoute redirects.
  const { values, fieldErrors, formError, submitting, handleChange, handleSubmit } = useApiForm(
    { identifier: '', password: '' },
    ({ identifier, password }) => login(identifier, password),
  );

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to jump into a duel."
      footer={
        <>
          New here?{' '}
          <Link
            to="/register"
            state={location.state}
            className="font-medium text-emerald-400 hover:text-emerald-300"
          >
            Create an account
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <FormError tone="info">{notice}</FormError>
        <FormError>{formError}</FormError>
        <FormField
          label="Username or email"
          name="identifier"
          autoComplete="username"
          autoFocus
          value={values.identifier}
          onChange={handleChange}
          error={fieldErrors.identifier}
        />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={handleChange}
          error={fieldErrors.password}
        />
        <Button type="submit" loading={submitting} className="w-full">
          {submitting ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
    </AuthLayout>
  );
}
