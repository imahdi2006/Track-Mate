export class EmailConfirmationRequired extends Error {
  readonly email: string;

  constructor(email: string, message?: string) {
    super(
      message ??
        "Account created. Open the confirmation email (check spam), then come back and sign in.",
    );
    this.name = "EmailConfirmationRequired";
    this.email = email;
  }
}

export function isEmailConfirmationRequired(err: unknown): err is EmailConfirmationRequired {
  return (
    err instanceof EmailConfirmationRequired ||
    (err instanceof Error && err.name === "EmailConfirmationRequired")
  );
}
