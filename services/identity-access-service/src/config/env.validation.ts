/**
 * Validation centralisée des variables d'environnement obligatoires (modules-convention).
 * Échoue au démarrage — jamais au moment d'une requête — si un secret ou une valeur
 * indispensable au fonctionnement du service est absent.
 */
const REQUIRED_ENVIRONMENT_VARIABLE_NAMES = ['DATABASE_URL', 'JWT_SECRET', 'INTERNAL_SECRET'] as const;

export type RequiredEnvironmentVariableName = (typeof REQUIRED_ENVIRONMENT_VARIABLE_NAMES)[number];

export function validateEnvironment(
  rawConfig: Record<string, unknown>,
): Record<string, unknown> {
  const missingVariableNames = REQUIRED_ENVIRONMENT_VARIABLE_NAMES.filter((variableName) => {
    const rawValue = rawConfig[variableName];
    return rawValue === undefined || rawValue === null || String(rawValue).trim().length === 0;
  });

  if (missingVariableNames.length > 0) {
    throw new Error(
      `identity-access-service: missing required environment variable(s): ${missingVariableNames.join(', ')}`,
    );
  }

  return rawConfig;
}
