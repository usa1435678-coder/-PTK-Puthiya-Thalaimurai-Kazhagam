'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const volunteerForm = document.getElementById('volunteerFormInner');
  const grievanceForm = document.getElementById('grievanceFormInner');
  const contactForm = document.getElementById('contactForm');

  const submitJson = async (form, url) => {
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result || !result.success) {
        throw new Error(result && result.message ? result.message : 'Your request could not be submitted. Please try again.');
      }

      window.alert(window.ptkTranslate(result.message || 'Submitted successfully'));
      form.reset();
    } catch (error) {
      window.alert(window.ptkTranslate(error.message || 'Your request could not be submitted. Please try again.'));
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  };

  if (volunteerForm) {
    volunteerForm.addEventListener('submit', (event) => {
      event.preventDefault();
      submitJson(volunteerForm, '/volunteer');
    });
  }

  if (grievanceForm) {
    grievanceForm.addEventListener('submit', (event) => {
      event.preventDefault();
      submitJson(grievanceForm, '/grievance');
    });
  }

  if (contactForm) {
    contactForm.addEventListener('submit', (event) => {
      event.preventDefault();
      submitJson(contactForm, '/contact');
    });
  }
});
