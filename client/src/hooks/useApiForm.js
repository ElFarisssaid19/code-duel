import { useState } from 'react';

/**
 * Form state for forms that submit to the API: values, per-field errors from the server's
 * `details`, a form-level error, and a submitting flag.
 */
export function useApiForm(initialValues, onSubmit) {
  const [values, setValues] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    // Clear a field's server error as soon as the user edits it.
    setFieldErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      const errors = {};
      for (const [field, messages] of Object.entries(err.details ?? {})) {
        if (field in initialValues) errors[field] = [].concat(messages)[0];
      }
      setFieldErrors(errors);
      // Field errors explain themselves; otherwise show the server's message (e.g. "Invalid credentials").
      if (Object.keys(errors).length === 0) setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return { values, fieldErrors, formError, submitting, handleChange, handleSubmit };
}
