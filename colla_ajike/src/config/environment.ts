import dotenv from 'dotenv';

// Load environment variables at the top of this file
dotenv.config();

export interface EnvironmentConfig {
  slack: {
    botToken: string;
    signingSecret: string;
    appToken: string;
  };
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
  };
  openai: {
    apiKey: string;
    model: string;
    maxTokens: number;
  };
  app: {
    nodeEnv: string;
    port: number;
    logLevel: string;
  };
  scheduling: {
    shuffleCronSchedule: string;
    rankingCronSchedule: string;
  };
}

function validateEnvironment(): EnvironmentConfig {
  const requiredEnvVars = [
    'SLACK_BOT_TOKEN',
    'SLACK_SIGNING_SECRET',
    'SLACK_APP_TOKEN',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  return {
    slack: {
      botToken: process.env.SLACK_BOT_TOKEN!,
      signingSecret: process.env.SLACK_SIGNING_SECRET!,
      appToken: process.env.SLACK_APP_TOKEN!,
    },
    supabase: {
      url: process.env.SUPABASE_URL!,
      anonKey: process.env.SUPABASE_ANON_KEY!,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY!,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '300', 10),
    },
    app: {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: parseInt(process.env.PORT || '3000', 10),
      logLevel: process.env.LOG_LEVEL || 'info',
    },
    scheduling: {
      shuffleCronSchedule: process.env.SHUFFLE_CRON_SCHEDULE || '0 10 * * 1-5',
      rankingCronSchedule: process.env.RANKING_CRON_SCHEDULE || '0 9 1 * *',
    },
  };
}

export const config = validateEnvironment();