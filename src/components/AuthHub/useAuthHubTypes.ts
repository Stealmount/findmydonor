// Shared step-machine types for AuthHub sub-components.
// 'initial' = show Google sign-in button; 'google-phone' = post-auth WhatsApp form.
export type SignupStep = 'initial' | 'google-phone';
