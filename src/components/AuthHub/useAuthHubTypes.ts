// Shared step-machine types for AuthHub sub-components.
export type SignupStep = 'main' | 'otp' | 'google-phone' | 'donor-profile';
export type SignupChannel = 'phone' | 'email';
export type SigninMode = 'user' | 'institution';
export type InstStep = 'email' | 'otp';
